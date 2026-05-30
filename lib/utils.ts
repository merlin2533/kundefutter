export function berechneVerkaufspreis(
  artikel: { standardpreis: number },
  kundePreis?: { preis: number; rabatt: number } | null
): number {
  if (kundePreis) {
    const p = kundePreis.preis * (1 - kundePreis.rabatt / 100);
    return Math.round(p * 100) / 100;
  }
  return artikel.standardpreis;
}

export function berechneMarge(verkaufspreis: number, einkaufspreis: number) {
  const margeEuro = verkaufspreis - einkaufspreis;
  const margeProzent =
    verkaufspreis > 0 ? (margeEuro / verkaufspreis) * 100 : 0;
  return {
    margeEuro: Math.round(margeEuro * 100) / 100,
    margeProzent: Math.round(margeProzent * 10) / 10,
  };
}

export function lagerStatus(
  bestand: number,
  mindestbestand: number
): "rot" | "gelb" | "gruen" {
  if (bestand <= 0) return "rot";
  if (bestand <= mindestbestand) return "gelb";
  return "gruen";
}

// Kategorien, für die kein Lagerbestand geführt wird (Dienstleistungen)
// Wird durch Einstellung "system.lager_no_tracking_kategorien" ergänzt.
export const NICHT_LAGER_KATEGORIEN = ["Beratung", "Analysen"];

/**
 * Prüft ob ein Artikel lagerrelevant ist.
 * @param kategorie  Artikel-Kategorie
 * @param lagerTracking  Artikel-spezifisches Flag; false = immer deaktiviert
 * @param extraKategorien  Zusätzliche Kategorien aus Einstellungen
 */
export function istLagerrelevant(
  kategorie: string,
  lagerTracking?: boolean,
  extraKategorien?: string[]
): boolean {
  if (lagerTracking === false) return false;
  const alle = extraKategorien
    ? [...NICHT_LAGER_KATEGORIEN, ...extraKategorien]
    : NICHT_LAGER_KATEGORIEN;
  return !alle.includes(kategorie);
}

function naechsteNummer(prefix: string, letzte: string | null): string {
  const jahr = new Date().getFullYear();
  if (!letzte) return `${prefix}-${jahr}-0001`;
  const parts = letzte.split("-");
  const letzteJahr = parts.length >= 3 ? parseInt(parts[1], 10) : 0;
  if (letzteJahr !== jahr) return `${prefix}-${jahr}-0001`;
  const num = parseInt(parts[parts.length - 1] || "0", 10) + 1;
  return `${prefix}-${jahr}-${String(num).padStart(4, "0")}`;
}

export const naechsteRechnungsnummer = (letzte: string | null) => naechsteNummer("RE", letzte);
export const naechsteGutschriftsnummer = (letzte: string | null) => naechsteNummer("GS", letzte);

export function addTage(datum: Date, tage: number): Date {
  const d = new Date(datum);
  d.setDate(d.getDate() + tage);
  return d;
}

export function formatDatum(d: Date | string): string {
  return new Date(d).toLocaleDateString("de-DE");
}

export function formatEuro(n: number): string {
  return n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

export function formatPercent(n: number): string {
  return n.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "\u00a0%";
}

/** Mengenangabe mit bis zu 3 Nachkommastellen (z.B. 0,120 t). */
export function formatMenge(n: number): string {
  return n.toLocaleString("de-DE", { maximumFractionDigits: 3 });
}

// \u2500\u2500\u2500 Datum / Zeitraum \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

/** Fr\u00fchestes Jahr, das in Auswertungs-Filtern angeboten wird. */
const BASE_YEAR = 2024;

/**
 * Dynamische Jahresliste von BASE_YEAR bis einschlie\u00dflich (aktuelles Jahr + 1)
 * als Strings \u2014 direkt f\u00fcr <option>-Elemente nutzbar.
 */
export function getJahreListe(): string[] {
  const current = new Date().getFullYear();
  const jahre: string[] = [];
  for (let y = BASE_YEAR; y <= current + 1; y++) jahre.push(String(y));
  return jahre;
}

/** Dieselbe Jahresliste als Zahlen (Saisonal-Vergleich, Budget). */
export function getJahreListeNum(): number[] {
  return getJahreListe().map(Number);
}

/** Jahresliste f\u00fcr die Budgetplanung \u2014 zus\u00e4tzliches Planjahr in der Zukunft. */
export function getBudgetJahre(): number[] {
  const liste = getJahreListeNum();
  return [...liste, liste[liste.length - 1] + 1];
}

/** Monate mit Wert ("01"\u2013"12") und langem Label \u2014 einzige Quelle f\u00fcr Monats-Selects. */
export const MONATE_LANG = [
  { value: "01", label: "Januar" },
  { value: "02", label: "Februar" },
  { value: "03", label: "M\u00e4rz" },
  { value: "04", label: "April" },
  { value: "05", label: "Mai" },
  { value: "06", label: "Juni" },
  { value: "07", label: "Juli" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "Oktober" },
  { value: "11", label: "November" },
  { value: "12", label: "Dezember" },
] as const;

/** Kurz-Labels der Monate (Index 0 = Jan) \u2014 f\u00fcr Diagramme. */
export const MONATE_KURZ = [
  "Jan", "Feb", "M\u00e4r", "Apr", "Mai", "Jun",
  "Jul", "Aug", "Sep", "Okt", "Nov", "Dez",
] as const;

/**
 * Parst "YYYY-MM" zum UTC-Monatsanfang. Ung\u00fcltige/leere Eingabe \u2192 fallback
 * (Standard: 2024-01-01T00:00:00Z).
 */
export function parseYearMonth(ym: string | null | undefined, fallback?: Date): Date {
  if (ym) {
    const d = new Date(`${ym}-01T00:00:00.000Z`);
    if (!isNaN(d.getTime())) return d;
  }
  return fallback ?? new Date("2024-01-01T00:00:00.000Z");
}

/**
 * Exklusive Obergrenze f\u00fcr einen "bis=YYYY-MM"-Parameter:
 * "2025-03" \u2192 2025-04-01 (Monatsanfang des Folgemonats).
 * Ung\u00fcltige/leere Eingabe \u2192 fallback (Standard: jetzt).
 */
export function parseBisYearMonth(ym: string | null | undefined, fallback?: Date): Date {
  if (ym) {
    const parts = ym.split("-").map(Number);
    if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return new Date(parts[0], parts[1], 1);
    }
  }
  return fallback ?? new Date();
}
