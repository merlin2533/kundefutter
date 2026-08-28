// Gemeinsame Fuzzy-Matching-Logik für KI-erkannte Lieferschein-/Bestellungsdaten
// (Kunde/Artikel-Zuordnung), genutzt sowohl vom Einzel-Scan (app/ki/lieferung,
// app/ki/wareneingang) als auch vom Batch-Modus (app/ki/lieferung/batch).

// Wiederverwendung der bereits vorhandenen, abhängigkeitsfreien Textähnlichkeits-Funktionen aus
// dem Bankabgleich-Matcher statt einer eigenen (dritten) Implementierung oder einer neuen
// npm-Abhängigkeit — bankabgleich-matching.ts hat selbst keine Imports und ist damit bundle-sicher
// auch für diese ausschließlich clientseitig genutzte Datei. Re-exportiert, damit Aufrufer sie bei
// Bedarf direkt aus @/lib/kiMatching beziehen können.
import { normalizeText, tokenSimilarity } from "./bankabgleich-matching";
export { normalizeText, tokenSimilarity };

export type Konfidenz = "hoch" | "mittel" | "niedrig" | "keine" | "gelernt";

// Schwellwerte für das Best-Pick-Namens-Scoring und den Fuzzy-Fallback auf gelernte Zuordnungen —
// an einer Stelle gesammelt, damit sie sich leicht nachjustieren lassen.
/** Ab diesem tokenSimilarity-Wert gilt ein KI-erkannter Name als "im Grunde derselbe Text" wie
 * ein bereits gelernter Suchtext (toleriert OCR-Rauschen: Leerzeichen, Wortstellung, Umlaute). */
const GELERNT_FUZZY_MIN_SCORE = 0.9;
/** Best-Pick-Namens-Score ab dieser Schwelle → Konfidenz "mittel". */
const NAME_SCORE_MITTEL = 0.8;
/** Best-Pick-Namens-Score ab dieser Schwelle (aber unter NAME_SCORE_MITTEL) → "niedrig". */
const NAME_SCORE_NIEDRIG = 0.5;
/** Score-Untergrenze, wenn ein normalisierter Name den anderen vollständig enthält (z.B. "Mais"
 * vs. "Mais Gelb Körnermais 25kg") — Substring-Enthaltung ist ein starkes Signal, auch wenn der
 * reine Token-Overlap-Wert wegen der unterschiedlichen Länge niedriger ausfallen würde. */
const NAME_CONTAINS_BONUS = 0.85;

/**
 * Lädt eine paginierte Liste-API vollständig durch (alle Seiten), statt sich
 * auf ein festes Limit zu verlassen. Für die KI-Zuordnung muss immer der
 * komplette Artikel-/Kunden-/Lieferantenbestand im Client verfügbar sein —
 * ein starres Limit (z.B. 500) würde bei wachsendem Datenbestand irgendwann
 * wieder Einträge im Zuordnungs-Dropdown verschwinden lassen.
 */
export async function fetchAlleSeiten<T>(
  ladeSeite: (page: number) => Promise<{ items: T[]; total: number } | null>
): Promise<T[]> {
  const alle: T[] = [];
  let page = 1;
  for (;;) {
    const seite = await ladeSeite(page);
    if (!seite || seite.items.length === 0) break;
    alle.push(...seite.items);
    if (alle.length >= seite.total) break;
    page++;
  }
  return alle;
}

export function normalisiereSuchtext(text: string): string {
  return text.trim().toLowerCase();
}

export interface MatchArtikelInput {
  name: string;
  artikelnummer?: string;
}

export interface MatchableArtikel {
  id: number;
  name: string;
  artikelnummer: string;
}

/** Normalisiert eine Lieferanten-/Artikelnummer für den Vergleich: Leerzeichen und Bindestriche
 * entfernen, Groß-/Kleinschreibung vereinheitlichen — Lieferanten drucken dieselbe Nummer auf
 * Belegen oft mit leicht abweichender Formatierung (z.B. "12 345" vs. "12345", "AB-100" vs. "ab100"). */
export function normalisiereArtikelnummer(nr: string): string {
  return nr.trim().replace(/[\s-]+/g, "").toUpperCase();
}

/** Bewertet, wie gut ein KI-erkannter Name zu einem Artikelnamen passt (0..1) — exakter
 * normalisierter Treffer zählt als 1, sonst Token-Overlap (tokenSimilarity), angehoben auf
 * mindestens NAME_CONTAINS_BONUS wenn einer der beiden Namen den anderen vollständig enthält. */
function nameScore(kiName: string, artikelName: string): number {
  const a = normalizeText(kiName);
  const b = normalizeText(artikelName);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const score = tokenSimilarity(kiName, artikelName);
  if (a.includes(b) || b.includes(a)) return Math.max(score, NAME_CONTAINS_BONUS);
  return score;
}

/**
 * Ordnet eine KI-erkannte Position einem bestehenden Artikel zu — nach dem Best-Pick-Prinzip:
 * bewertet bei der Namens-Zuordnung ALLE Kandidaten und nimmt den bestbewerteten statt (wie
 * früher) den ersten Teilstring-/Wort-Treffer im Array.
 *
 * Reihenfolge:
 * 1. Gelernt exakt (KiLernZuordnung) — eine direkt vom Nutzer bestätigte Korrektur für genau
 *    diesen Text ist die vertrauenswürdigste und günstigste Quelle.
 * 2. Lieferanten-Artikelnummer exakt (`lieferantenArtNrMap`, nur wenn übergeben) — die vom Beleg
 *    gelesene "artikelnummer" ist praktisch immer die Nummer DES LIEFERANTEN, nicht unsere
 *    interne SKU, daher vor dem internen Artikelnummer-Abgleich geprüft.
 * 3. Eigene `Artikel.artikelnummer` exakt — Fallback für den seltenen Fall, dass die gelesene
 *    Nummer zufällig unserer internen SKU entspricht.
 * 4. Gelernt, näherungsweise — toleriert OCR-Rauschen (Leerzeichen, Wortstellung, Umlaute)
 *    zwischen dem beim Lernen gespeicherten Text und dem aktuell erkannten.
 * 5. Best-Pick Namens-Scoring über alle Kandidaten.
 */
export function matchArtikel<T extends MatchableArtikel>(
  kiPos: MatchArtikelInput,
  artikel: T[],
  gelernt?: Map<string, number>,
  lieferantenArtNrMap?: Map<string, number>
): { artikel: T | null; konfidenz: Konfidenz } {
  if (!artikel.length) return { artikel: null, konfidenz: "keine" };

  if (gelernt && gelernt.size > 0 && kiPos.name) {
    const gelerntId = gelernt.get(normalisiereSuchtext(kiPos.name));
    if (gelerntId != null) {
      const treffer = artikel.find((a) => a.id === gelerntId);
      if (treffer) return { artikel: treffer, konfidenz: "gelernt" };
    }
  }

  if (kiPos.artikelnummer && lieferantenArtNrMap && lieferantenArtNrMap.size > 0) {
    const gesucht = normalisiereArtikelnummer(kiPos.artikelnummer);
    const artikelId = gesucht ? lieferantenArtNrMap.get(gesucht) : undefined;
    if (artikelId != null) {
      const treffer = artikel.find((a) => a.id === artikelId);
      if (treffer) return { artikel: treffer, konfidenz: "hoch" };
    }
  }

  if (kiPos.artikelnummer) {
    const exact = artikel.find(
      (a) => a.artikelnummer.toLowerCase() === kiPos.artikelnummer!.toLowerCase()
    );
    if (exact) return { artikel: exact, konfidenz: "hoch" };
  }

  // KI-Antworten können ein Feld explizit auf null setzen, wenn es auf dem
  // Beleg nicht lesbar war (siehe lib/ai.ts PROMPTS) — kiPos.name ist zur
  // Laufzeit trotz des string-Typs nicht garantiert vorhanden.
  if (!kiPos.name) return { artikel: null, konfidenz: "keine" };

  if (gelernt && gelernt.size > 0) {
    let bester: { zielId: number; score: number } | null = null;
    for (const [suchtext, zielId] of gelernt) {
      const score = tokenSimilarity(kiPos.name, suchtext);
      if (score >= GELERNT_FUZZY_MIN_SCORE && (!bester || score > bester.score)) {
        bester = { zielId, score };
      }
    }
    if (bester) {
      const treffer = artikel.find((a) => a.id === bester!.zielId);
      if (treffer) return { artikel: treffer, konfidenz: "gelernt" };
    }
  }

  let bester: { artikel: T; score: number } | null = null;
  for (const a of artikel) {
    const score = nameScore(kiPos.name, a.name);
    if (!bester || score > bester.score) bester = { artikel: a, score };
  }
  if (bester && bester.score >= NAME_SCORE_MITTEL) return { artikel: bester.artikel, konfidenz: "mittel" };
  if (bester && bester.score >= NAME_SCORE_NIEDRIG) return { artikel: bester.artikel, konfidenz: "niedrig" };

  return { artikel: null, konfidenz: "keine" };
}

export interface MatchKundeInput {
  name: string;
  firma?: string;
  ort?: string;
  betriebsnummer?: string | null;
}

export interface MatchableKunde {
  id: number;
  name: string;
  firma?: string;
  betriebsnummer?: string | null;
  vvvoNr?: string | null;
}

function normalisiereNummer(nr: string): string {
  return nr.replace(/\s+/g, "").toUpperCase();
}

/**
 * Ordnet einen KI-erkannten Kunden einem bestehenden Kunden zu. Prüft zuerst
 * gelernte Korrekturen (KiLernZuordnung), dann eine genannte Betriebsnummer/
 * VVVO-Nummer (eindeutiger als ein gesprochener Name), dann exakten Namens-/
 * Firmentreffer, dann Teilstring, dann Wort-Teiltreffer.
 */
export function matchKunde<T extends MatchableKunde>(
  kiKunde: MatchKundeInput,
  kunden: T[],
  gelernt?: Map<string, number>
): { kunde: T | null; konfidenz: Konfidenz } {
  if (!kunden.length) return { kunde: null, konfidenz: "keine" };

  const search = (kiKunde.firma || kiKunde.name).toLowerCase();

  if (gelernt && gelernt.size > 0 && search) {
    const gelerntId = gelernt.get(normalisiereSuchtext(search));
    if (gelerntId != null) {
      const treffer = kunden.find((k) => k.id === gelerntId);
      if (treffer) return { kunde: treffer, konfidenz: "gelernt" };
    }
  }

  if (kiKunde.betriebsnummer) {
    const gesuchteNr = normalisiereNummer(kiKunde.betriebsnummer);
    if (gesuchteNr) {
      const treffer = kunden.find((k) => {
        const bnr = k.betriebsnummer ? normalisiereNummer(k.betriebsnummer) : "";
        const vvvo = k.vvvoNr ? normalisiereNummer(k.vvvoNr) : "";
        return (bnr && bnr === gesuchteNr) || (vvvo && vvvo === gesuchteNr);
      });
      if (treffer) return { kunde: treffer, konfidenz: "hoch" };
    }
  }

  const exact = kunden.find(
    (k) => k.name.toLowerCase() === search || (k.firma && k.firma.toLowerCase() === search)
  );
  if (exact) return { kunde: exact, konfidenz: "hoch" };

  const containsMatch =
    search.length >= 3
      ? kunden.find(
          (k) =>
            k.name.toLowerCase().includes(search) ||
            (k.firma && k.firma.toLowerCase().includes(search)) ||
            search.includes(k.name.toLowerCase())
        )
      : null;
  if (containsMatch) return { kunde: containsMatch, konfidenz: "mittel" };

  const words = search.split(/\s+/).filter((w) => w.length > 2);
  for (const word of words) {
    const partial = kunden.find(
      (k) =>
        k.name.toLowerCase().includes(word) ||
        (k.firma && k.firma.toLowerCase().includes(word))
    );
    if (partial) return { kunde: partial, konfidenz: "niedrig" };
  }

  return { kunde: null, konfidenz: "keine" };
}

export interface FehlendeFelderPosition {
  artikelId: string | number | null;
  konfidenz: Konfidenz;
  verkaufspreis?: number;
  menge?: number;
}

/**
 * Berechnet eine Liste von Hinweistexten für Dinge, die bei einer KI-erkannten
 * Lieferung noch manuell geprüft/ergänzt werden sollten (für Batch-Übersicht).
 */
export function berechneFehlendeFelder(input: {
  kundeKonfidenz: Konfidenz;
  positionen: FehlendeFelderPosition[];
}): string[] {
  const felder: string[] = [];

  if (input.kundeKonfidenz === "keine" || input.kundeKonfidenz === "niedrig") {
    felder.push("Kunde nicht eindeutig zugeordnet");
  }

  input.positionen.forEach((p, i) => {
    if (!p.artikelId) {
      felder.push(`Position ${i + 1}: Artikel nicht gefunden`);
    } else if (p.konfidenz === "niedrig") {
      felder.push(`Position ${i + 1}: Artikel-Zuordnung unsicher`);
    }
    if (p.verkaufspreis == null || p.verkaufspreis <= 0) {
      felder.push(`Position ${i + 1}: Preis fehlt`);
    }
    if (p.menge == null || p.menge <= 0) {
      felder.push(`Position ${i + 1}: Menge fehlt`);
    }
  });

  return felder;
}
