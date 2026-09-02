// Server-Helfer: lädt die (konfigurierbare) Artikel-Kategorie-Taxonomie aus der
// Einstellung-Tabelle für resolveKategorie() (lib/auswahllisten.ts).
import { prisma } from "@/lib/prisma";
import { Sentry } from "@/lib/sentry";
import {
  DEFAULT_ARTIKEL_KATEGORIEN,
  DEFAULT_UNTERKATEGORIEN,
  getUnterkategorienKey,
  parseListSetting,
} from "@/lib/auswahllisten";

export interface KategorieTaxonomie {
  kategorien: string[];
  unterkategorienByKat: Record<string, string[]>;
}

/** Liefert die konfigurierten Top-Level-Kategorien sowie deren Unterkategorien in einem Zug —
 *  für resolveKategorie() beim Artikel-Import. Fällt bei fehlender Einstellung/Fehler auf die
 *  Standardwerte zurück. */
export async function loadKategorieTaxonomie(): Promise<KategorieTaxonomie> {
  try {
    const rows = await prisma.einstellung.findMany({ where: { key: { startsWith: "system." } } });
    const settings: Record<string, string> = {};
    for (const r of rows) settings[r.key] = r.value;

    const kategorien = parseListSetting(settings, "system.artikelkategorien", DEFAULT_ARTIKEL_KATEGORIEN);
    const unterkategorienByKat: Record<string, string[]> = {};
    for (const kat of kategorien) {
      unterkategorienByKat[kat] = parseListSetting(settings, getUnterkategorienKey(kat), DEFAULT_UNTERKATEGORIEN[kat] ?? []);
    }
    return { kategorien, unterkategorienByKat };
  } catch (e) {
    Sentry.captureException(e);
    return { kategorien: DEFAULT_ARTIKEL_KATEGORIEN, unterkategorienByKat: DEFAULT_UNTERKATEGORIEN };
  }
}
