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
export const NICHT_LAGER_KATEGORIEN = ["Beratung", "Analysen"];

export function istLagerrelevant(kategorie: string): boolean {
  return !NICHT_LAGER_KATEGORIEN.includes(kategorie);
}

function naechsteNummer(prefix: string, letzte: string | null): string {
  const jahr = new Date().getFullYear();
  if (!letzte) return `${prefix}-${jahr}-0001`;
  const parts = letzte.split("-");
  const letzteJahr = parts.length >= 3 ? parseInt(parts[1]) : 0;
  if (letzteJahr !== jahr) return `${prefix}-${jahr}-0001`;
  const num = parseInt(parts[parts.length - 1] || "0") + 1;
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
