// Standardwerte und Lader für konfigurierbare Auswahllisten
// (Saatgut-Kulturen, Einheiten, Kategorien …).
// Werte werden in der Tabelle `Einstellung` als JSON-Array unter
// `system.<key>` gespeichert und können unter
// /einstellungen/stammdaten gepflegt werden.
//
// Wird auch von "use client"-Seiten importiert — daher Direkt-Import aus
// @sentry/nextjs statt @/lib/sentry (das next/server + Prisma nach sich zieht).
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
  } catch (e) {
    Sentry.captureException(e);
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

/** Umlaut-tolerantes Normalisieren für den Kategorie-Abgleich in resolveKategorie() — dieselbe
 *  ä/ö/ü/ß-Faltung wie normalizeText() in lib/bankabgleich-matching.ts, hier lokal statt importiert
 *  (lib/auswahllisten.ts bleibt bewusst frei von Cross-Modul-Importen). Ohne diese Faltung matchte
 *  ein Importwert "Dünger" (natürliche deutsche Schreibweise) NIE die intern ASCII-gespeicherte
 *  Kategorie "Duenger" — jede Dünger-Zeile fiel dadurch auf den "Futter"-Fallback zurück, weil
 *  reines toLowerCase() Umlaute nicht angleicht. */
function normKategorieWert(s: string): string {
  return s.trim().toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss");
}

/** Löst eine aus einer Importdatei gelesene Kategorie/Unterkategorie-Kombination gegen die
 *  tatsächlich konfigurierte Taxonomie auf. Import-Quelldateien liefern in der "Kategorie"-Spalte
 *  oft eine Fruchtart/Kultur (z.B. "Getreide") statt einer der festen Top-Level-Kategorien —
 *  ungeprüft übernommen legt das einen Artikel mit einem nirgends konfigurierten Kategorie-Wert an.
 *  Die Kategorie-/Unterkategorie-<select>-Felder der Artikel-Detailseite kennen dafür keine
 *  passende <option>, zeigen also stillschweigend den jeweils ERSTEN Listeneintrag an (Kategorie
 *  "Futter", Unterkategorie "— keine —") und würden diesen beim nächsten Speichern der Seite ohne
 *  Rückfrage über den eigentlichen Wert schreiben.
 *  `kategorien` = gültige Top-Level-Kategorien, `unterkategorienByKat` = deren konfigurierte
 *  Unterkategorien (aus `system.unterkategorien_<Kategorie>` bzw. `system.saatgut_kulturen`). */
export function resolveKategorie(
  kategorieRaw: string,
  unterkategorieRaw: string | null,
  kategorien: string[],
  unterkategorienByKat: Record<string, string[]>,
): { kategorie: string; unterkategorie: string | null } {
  const norm = normKategorieWert;

  const kategorieTreffer = kategorien.find((k) => norm(k) === norm(kategorieRaw));
  if (kategorieTreffer) return { kategorie: kategorieTreffer, unterkategorie: unterkategorieRaw };

  // Kein Treffer als Top-Level-Kategorie — evtl. ist der Wert eigentlich eine Unterkategorie
  // (Fruchtart/Kultur), die versehentlich in die falsche Spalte gerutscht ist.
  for (const kat of kategorien) {
    const unterTreffer = (unterkategorienByKat[kat] ?? []).find((u) => norm(u) === norm(kategorieRaw));
    if (unterTreffer) return { kategorie: kat, unterkategorie: unterTreffer };
  }

  const fallback = kategorien.find((k) => k === "Futter") ?? kategorien[0] ?? "Futter";
  return { kategorie: fallback, unterkategorie: unterkategorieRaw };
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
  } catch (e) {
    Sentry.captureException(e);
  }
  return fallback;
}

/** Analyse-Artikel haben keinen physischen Lagerbestand. Sie werden in
 *  Listen und Detailseiten ohne Bestand/Ampel/Nachbestell-Box angezeigt. */
export function istAnalyseArtikel(kategorie: string | null | undefined): boolean {
  return kategorie === "Analysen" || kategorie === "Analyse";
}
