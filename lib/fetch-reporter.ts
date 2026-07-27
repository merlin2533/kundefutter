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
    // Session-Prüfungen und Portal-Endpunkte liefern im abgemeldeten Zustand
    // regulär 401 — normales Nutzerverhalten, kein Anwendungsfehler.
    return pfad.startsWith("/api/auth/") || pfad.startsWith("/api/portal/auth/");
  }
  if (status === 404) {
    // Lookups, die "nicht gefunden" als gültiges Ergebnis kennen.
    return pfad.startsWith("/api/suche") || pfad.startsWith("/api/telefonmaske");
  }
  return false;
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
    const laenge = Number(res.headers.get("content-length") ?? "0");
    if (laenge > 8192) return undefined;
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

      if (pfad && !res.ok && !istErwartet(pfad, res.status)) {
        // Query bewusst abgeschnitten: bessere Gruppierung, keine PII.
        const meldung = `HTTP ${res.status} ${methode} ${pfad}`;
        const detail = res.status >= 500 ? await fehlerDetail(res) : undefined;
        logEreignis({
          level: res.status >= 500 ? "error" : "warn",
          meldung,
          ctx: { pfad, methode, status: res.status, ...(detail ? { detail } : {}) },
          issue: false,
        });
      }

      return res;
    } catch (err) {
      if (pfad) {
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
