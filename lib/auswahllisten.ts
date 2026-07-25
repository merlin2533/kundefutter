// Standardwerte und Lader für konfigurierbare Auswahllisten
// (Saatgut-Kulturen, Einheiten, Kategorien …).
// Werte werden in der Tabelle `Einstellung` als JSON-Array unter
// `system.<key>` gespeichert und können unter
// /einstellungen/stammdaten gepflegt werden.
import * as Sentry from "@sentry/nextjs";

export const DEFAULT_SAATGUT_KULTUREN = [
  "Mais",
  "Raps",
  "Getreide",
  "Gräser",
  "Grünland",
  "Pflanzkartoffeln",
  "Zwischenfrüchte",
  "Leguminosen",
  "Sonnenblumen",
  "Sorghum",
];

export const DEFAULT_ARTIKEL_KATEGORIEN = ["Futter", "Duenger", "Saatgut", "Analysen", "Beratung", "Pflege"];

/** Kategorien, deren Artikel zwingend chargenpflichtig sind
 *  (gesetzliche Rückverfolgbarkeit für Futtermittel und Saatgut).
 *  Über /einstellungen/artikelkategorien konfigurierbar
 *  (Einstellung-Key `system.chargenpflicht_kategorien`). */
export const CHARGENPFLICHT_KATEGORIEN_KEY = "system.chargenpflicht_kategorien";
export const DEFAULT_CHARGENPFLICHT_KATEGORIEN = ["Futter", "Saatgut"];

/** Liest die chargenpflichtigen Kategorien aus geladenen Einstellungen.
 *  Im Unterschied zu parseListSetting wird eine *explizit leere* Liste `[]`
 *  respektiert (= keine Kategorie chargenpflichtig); nur ein fehlender Wert
 *  fällt auf die Standardwerte zurück. */
export function chargenpflichtKategorienAusSettings(
  settings: Record<string, unknown> | null | undefined,
): string[] {
  const raw = settings?.[CHARGENPFLICHT_KATEGORIEN_KEY];
  if (typeof raw !== "string" || raw.trim() === "") return DEFAULT_CHARGENPFLICHT_KATEGORIEN;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((v): v is string => typeof v === "string" && v.trim() !== "");
    }
  } catch (err) {
    Sentry.captureException(err);
    /* ignore */
  }
  return DEFAULT_CHARGENPFLICHT_KATEGORIEN;
}

/** Prüft, ob eine Artikelkategorie automatisch Chargenpflicht erfordert.
 *  `kategorien` ist die (konfigurierbare) Liste chargenpflichtiger Kategorien;
 *  ohne Angabe gelten die Standardwerte. */
export function istChargenpflichtKategorie(
  kategorie?: string | null,
  kategorien: string[] = DEFAULT_CHARGENPFLICHT_KATEGORIEN,
): boolean {
  if (!kategorie) return false;
  const k = kategorie.trim().toLowerCase();
  return kategorien.some((c) => c.trim().toLowerCase() === k);
}

export const DEFAULT_EINHEITEN = ["kg", "t", "dt", "Sack", "Stk", "Liter", "Kanister", "Palette", "BigBag", "km", "Stunden"];

/** Standardmäßige Unterkategorien je Hauptkategorie */
export const DEFAULT_UNTERKATEGORIEN: Record<string, string[]> = {
  Saatgut: DEFAULT_SAATGUT_KULTUREN,
};

/** DB-Key für Unterkategorien einer Kategorie.
 *  Saatgut nutzt aus Rückwärtskompatibilität system.saatgut_kulturen. */
export function getUnterkategorienKey(kategorie: string): string {
  return kategorie === "Saatgut" ? "system.saatgut_kulturen" : `system.unterkategorien_${kategorie}`;
}

export const DEFAULT_LAGERORTE: string[] = [];

export const DEFAULT_FRUCHTARTEN = [
  "Winterweizen",
  "Sommerweizen",
  "Wintergerste",
  "Sommergerste",
  "Winterraps",
  "Mais",
  "Silomais",
  "Zuckerrüben",
  "Futterrüben",
  "Soja",
  "Erbsen",
  "Ackerbohnen",
  "Grünland",
  "Kleegras",
  "Zwischenfrucht",
];

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
  } catch (err) {
    Sentry.captureException(err);
    /* ignore */
  }
  return fallback;
}

/** Analyse-Artikel haben keinen physischen Lagerbestand. Sie werden in
 *  Listen und Detailseiten ohne Bestand/Ampel/Nachbestell-Box angezeigt. */
export function istAnalyseArtikel(kategorie: string | null | undefined): boolean {
  return kategorie === "Analysen" || kategorie === "Analyse";
}
