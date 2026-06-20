// Server-Helfer: lädt die (konfigurierbare) Liste chargenpflichtiger
// Artikelkategorien aus der Einstellung-Tabelle.
import { prisma } from "@/lib/prisma";
import {
  CHARGENPFLICHT_KATEGORIEN_KEY,
  DEFAULT_CHARGENPFLICHT_KATEGORIEN,
  chargenpflichtKategorienAusSettings,
} from "@/lib/auswahllisten";

/** Liefert die aktuell als chargenpflichtig konfigurierten Kategorien.
 *  Fällt bei fehlender Einstellung/Fehler auf die Standardwerte zurück;
 *  eine explizit leere Liste wird respektiert. */
export async function getChargenpflichtKategorien(): Promise<string[]> {
  try {
    const row = await prisma.einstellung.findUnique({
      where: { key: CHARGENPFLICHT_KATEGORIEN_KEY },
    });
    return chargenpflichtKategorienAusSettings(
      row ? { [CHARGENPFLICHT_KATEGORIEN_KEY]: row.value } : {},
    );
  } catch {
    return DEFAULT_CHARGENPFLICHT_KATEGORIEN;
  }
}
