// Standardwerte und Lader für konfigurierbare Auswahllisten
// (Saatgut-Kulturen, Einheiten, Kategorien …).
// Werte werden in der Tabelle `Einstellung` als JSON-Array unter
// `system.<key>` gespeichert und können unter
// /einstellungen/stammdaten gepflegt werden.

export const DEFAULT_SAATGUT_KULTUREN = [
  "Mais",
  "Raps",
  "Getreide",
  "Gräser",
  "Kartoffel",
  "Zwischenfrüchte",
  "Leguminosen",
  "Sonnenblumen",
  "Sorghum",
];

export const DEFAULT_ARTIKEL_KATEGORIEN = ["Futter", "Duenger", "Saatgut", "Analysen", "Beratung"];

export const DEFAULT_EINHEITEN = ["kg", "t", "dt", "Sack", "Stk", "Liter", "Kanister", "Palette", "BigBag", "km", "Stunden"];

/** Liest ein JSON-Array aus dem Einstellungs-Objekt (Antwort von
 *  GET /api/einstellungen?prefix=system.). Gibt `fallback` zurück
 *  wenn der Key fehlt, leer oder kein gültiges Array ist. */
export function parseListSetting(
  data: Record<string, unknown> | null | undefined,
  key: string,
  fallback: string[],
): string[] {
  const raw = data?.[key];
  if (typeof raw !== "string" || raw.trim() === "") return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.filter((v): v is string => typeof v === "string" && v.trim() !== "");
    }
  } catch {
    /* ignore */
  }
  return fallback;
}

/** Analyse-Artikel haben keinen physischen Lagerbestand. Sie werden in
 *  Listen und Detailseiten ohne Bestand/Ampel/Nachbestell-Box angezeigt. */
export function istAnalyseArtikel(kategorie: string | null | undefined): boolean {
  return kategorie === "Analysen" || kategorie === "Analyse";
}
