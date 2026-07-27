/**
 * Globales Sicherheitsnetz für fehlgeschlagene API-Aufrufe im Browser.
 *
 * Hintergrund: die App ruft `fetch()` an über 880 Stellen direkt auf. Viele
 * behandeln einen HTTP-Fehler nur lokal (`if (!res.ok) { setError(…) }`) oder
 * gar nicht (`.then()`-Kette ohne `.catch()`), sodass ein HTTP 500 für den
 * Nutzer wie „keine Daten" aussieht und niemand davon erfährt.
 *
 * Statt 231 Dateien umzuschreiben wird `window.fetch` hier genau einmal
 * umhüllt. Bewusst NUR Log-Strom, KEIN Issue: den eigentlichen Fehler hat der
 * Server bereits mit echtem Stacktrace als Issue gemeldet. Dieser Eintrag ist
 * der Nachweis, dass ein Nutzer ihn tatsächlich gesehen hat — dafür ist die
 * Zeitachse im Log-Strom das richtige Werkzeug, und es entsteht kein
 * Doppel-Reporting.
 *
 * Wird aus `instrumentation-client.ts` NACH `Sentry.init()` aufgerufen.
 */
import { logEreignis } from "@/lib/logger";

const MARKER = "__kfFetchReporter";

type MarkiertesFenster = Window & { [MARKER]?: boolean };

/** Erwartete Nicht-Fehler: nicht angemeldet / bewusst leeres Lookup-Ergebnis. */
function istErwartet(pfad: string, status: number): boolean {
  if (status === 401) {
    // 401 ist GRUNDSÄTZLICH kein Anwendungsfehler: `middleware.ts` gibt das für
    // JEDEN /api/*-Pfad zurück, sobald die Session abgelaufen ist. Ein über
    // Nacht offener Tab würde sonst über alle gepollten Endpunkte hinweg einen
    // dauerhaften Meldungsstrom erzeugen.
    return true;
  }
  if (status === 404) {
    // Lookups, die "nicht gefunden" als gültiges Ergebnis kennen.
    return pfad.startsWith("/api/suche") || pfad.startsWith("/api/telefonmaske");
  }
  return false;
}

/**
 * Deckel gegen Dauerfeuer: die App pollt an mehreren Stellen im Minutentakt
 * (Dashboard, NotificationCenter auf jeder Seite, Fahrer-Standorte). Fällt die
 * DB aus, würde ein einzelner offener Tab sonst unbegrenzt Einträge erzeugen.
 * Gleiche Meldung (Pfad+Methode+Status) daher höchstens einmal pro Fenster.
 */
const DEDUP_FENSTER_MS = 60_000;
const zuletztGemeldet = new Map<string, number>();

function darfMelden(schluessel: string, jetzt: number): boolean {
  const vorher = zuletztGemeldet.get(schluessel);
  if (vorher !== undefined && jetzt - vorher < DEDUP_FENSTER_MS) return false;
  zuletztGemeldet.set(schluessel, jetzt);
  // Die Map darf nicht unbegrenzt wachsen (lange Sitzungen, viele Pfade).
  if (zuletztGemeldet.size > 200) {
    for (const [k, t] of zuletztGemeldet) {
      if (jetzt - t >= DEDUP_FENSTER_MS) zuletztGemeldet.delete(k);
    }
  }
  return true;
}

/**
 * Nur eigene API-Aufrufe überwachen. Damit fallen automatisch weg: der
 * GlitchTip-Envelope-Request selbst (Rückkopplung!), Nominatim/OSRM/unpkg
 * (haben eigene Catches) sowie Next-Interna (`/_next/`, `?_rsc=`).
 */
function eigenerApiPfad(url: string): string | null {
  try {
    const aufgelöst = new URL(url, window.location.origin);
    if (aufgelöst.origin !== window.location.origin) return null;
    if (!aufgelöst.pathname.startsWith("/api/")) return null;
    return aufgelöst.pathname;
  } catch {
    return null;
  }
}

function urlAusEingabe(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function methodeAusEingabe(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) return init.method.toUpperCase();
  if (typeof input === "object" && "method" in input && input.method) {
    return input.method.toUpperCase();
  }
  return "GET";
}

/** Antwortkörper eines Serverfehlers als Zusatzkontext — klein und gedeckelt. */
async function fehlerDetail(res: Response): Promise<string | undefined> {
  try {
    // Fehlt `content-length` — der Normalfall bei chunked/gestreamten Antworten,
    // also z.B. bei jeder Next.js-500-HTML-Seite — ist die Größe UNBEKANNT.
    // Dann bewusst nicht lesen: `Number(null ?? "0")` ergäbe 0 und würde den
    // Deckel unterlaufen, sodass der komplette Body gepuffert würde.
    const rohLaenge = res.headers.get("content-length");
    const laenge = rohLaenge === null ? NaN : Number(rohLaenge);
    if (!Number.isFinite(laenge) || laenge <= 0 || laenge > 8192) return undefined;
    const text = await res.clone().text();
    return text.slice(0, 500) || undefined;
  } catch {
    // clone()/text() darf das Verhalten der Aufrufstelle niemals beeinflussen.
    return undefined;
  }
}

export function installFetchReporter(): void {
  if (typeof window === "undefined") return;

  const fenster = window as MarkiertesFenster;
  if (fenster[MARKER]) return; // idempotent
  fenster[MARKER] = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    let pfad: string | null = null;
    let methode = "GET";
    try {
      pfad = eigenerApiPfad(urlAusEingabe(input));
      methode = methodeAusEingabe(input, init);
    } catch {
      // Analyse der Eingabe darf den Aufruf nicht verhindern.
    }

    try {
      const res = await originalFetch(input, init);

      if (
        pfad &&
        !res.ok &&
        !istErwartet(pfad, res.status) &&
        darfMelden(`${methode} ${pfad} ${res.status}`, Date.now())
      ) {
        // Query bewusst abgeschnitten: bessere Gruppierung, keine PII.
        const meldung = `HTTP ${res.status} ${methode} ${pfad}`;
        const basisCtx = { pfad, methode, status: res.status };

        if (res.status >= 500) {
          // Den Antwortkörper NICHT awaiten, bevor die Aufrufstelle ihre
          // Response bekommt — sonst wartet sie auf unser Diagnose-Lesen.
          void fehlerDetail(res).then((detail) => {
            logEreignis({
              level: "error",
              meldung,
              ctx: detail ? { ...basisCtx, detail } : basisCtx,
              issue: false,
            });
          });
        } else {
          logEreignis({ level: "warn", meldung, ctx: basisCtx, issue: false });
        }
      }

      return res;
    } catch (err) {
      if (pfad && darfMelden(`${methode} ${pfad} netz`, Date.now())) {
        const abgebrochen = err instanceof Error && err.name === "AbortError";
        const offline =
          typeof navigator !== "undefined" && navigator.onLine === false;
        logEreignis({
          // Abbruch ist gewollt (Navigation/Neuanfrage), Offline ist Umgebung —
          // beides ist kein Anwendungsfehler.
          level: abgebrochen ? "info" : offline ? "warn" : "error",
          meldung: `Netzwerkfehler ${methode} ${pfad}`,
          fehler: err,
          ctx: { pfad, methode, ...(offline ? { offline: true } : {}) },
          issue: false,
        });
      }
      throw err; // Verhalten der Aufrufstelle unverändert lassen
    }
  };
}
