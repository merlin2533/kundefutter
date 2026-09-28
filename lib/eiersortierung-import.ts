// Geteilte Parsing-/Auflösungslogik für den EierSortierung-Import (Sortiermaschinen-Export,
// CSV/XLS) — von app/api/eiersortierung/import/vorschau/route.ts UND
// app/api/eiersortierung/import/route.ts genutzt (analog lib/anlieferung-import.ts). Eine
// Zeile = eine klassifizierte Ausgangscharge = eine eigene EierSortierung mit genau einer
// Position, bewusst analog der manuellen Erfassung unter /eiersortierung/neu — keine implizite
// Gruppierung mehrerer Zeilen zu einer Sortierung, da die Quelldatei dafür keinen verlässlichen
// Gruppierungsschlüssel liefert.
import { pickCol, parseNumber, parseImportDatum, EIERSORTIERUNG_ALIAS } from "@/lib/import-utils";
import { resolveArtikelRef } from "@/lib/anlieferung-import";
import type { Tx } from "@/lib/lieferung";

export { resolveArtikelRef };

export interface EierSortierungImportZeilenFehler {
  zeile: number;
  grund: string;
}

export class EierSortierungImportFehler extends Error {}

export interface EierSortierungGeparsteZeile {
  zeile: number;
  artikelRef: string;
  gueteklasse: string;
  gewichtsklasse: string;
  menge: number;
  datum: Date;
  anlieferungRef: string | null;
  chargeNr: string | null;
  legedatum: Date | null;
  erzeugercode: string | null;
  notiz: string | null;
}

export type ParseErgebnis =
  | { ok: true; zeile: EierSortierungGeparsteZeile }
  | { ok: false; fehler: EierSortierungImportZeilenFehler };

/** Parst + validiert eine rohe Import-Zeile — reine Funktion ohne DB-Zugriff. Güte-/
 * Gewichtsklasse werden NICHT gegen die Whitelist geprüft (das übernimmt
 * validiereEierSortierungPositionen() aus lib/eiersortierung.ts als einzige Quelle der
 * Wahrheit dafür, siehe Aufrufer), nur auf reine Anwesenheit. */
export function parseEierSortierungZeile(row: Record<string, unknown>, zeile: number): ParseErgebnis {
  const artikelRef = pickCol(row, ...EIERSORTIERUNG_ALIAS.artikel);
  if (!artikelRef) return { ok: false, fehler: { zeile, grund: "Artikel fehlt" } };

  const gueteklasse = pickCol(row, ...EIERSORTIERUNG_ALIAS.gueteklasse).toUpperCase();
  if (!gueteklasse) return { ok: false, fehler: { zeile, grund: "Güteklasse fehlt" } };

  const gewichtsklasse = pickCol(row, ...EIERSORTIERUNG_ALIAS.gewichtsklasse).toUpperCase();
  if (!gewichtsklasse) return { ok: false, fehler: { zeile, grund: "Gewichtsklasse fehlt" } };

  const mengeStr = pickCol(row, ...EIERSORTIERUNG_ALIAS.menge);
  const menge = parseNumber(mengeStr);
  if (!mengeStr || menge <= 0) {
    return { ok: false, fehler: { zeile, grund: "Menge fehlt oder ungültig (muss > 0 sein)" } };
  }

  const datumStr = pickCol(row, ...EIERSORTIERUNG_ALIAS.datum);
  const datumParsed = parseImportDatum(row, ...EIERSORTIERUNG_ALIAS.datum);
  if (datumStr && !datumParsed) {
    return { ok: false, fehler: { zeile, grund: `Datum ungültig: „${datumStr}“` } };
  }

  const legedatumStr = pickCol(row, ...EIERSORTIERUNG_ALIAS.legedatum);
  const legedatumParsed = parseImportDatum(row, ...EIERSORTIERUNG_ALIAS.legedatum);
  if (legedatumStr && !legedatumParsed) {
    return { ok: false, fehler: { zeile, grund: `Legedatum ungültig: „${legedatumStr}“` } };
  }

  return {
    ok: true,
    zeile: {
      zeile,
      artikelRef,
      gueteklasse,
      gewichtsklasse,
      menge,
      datum: datumParsed ?? new Date(),
      anlieferungRef: pickCol(row, ...EIERSORTIERUNG_ALIAS.anlieferung) || null,
      chargeNr: pickCol(row, ...EIERSORTIERUNG_ALIAS.chargeNr) || null,
      legedatum: legedatumParsed,
      erzeugercode: pickCol(row, ...EIERSORTIERUNG_ALIAS.erzeugercode) || null,
      notiz: pickCol(row, ...EIERSORTIERUNG_ALIAS.notiz) || null,
    },
  };
}

export type AufgeloesteAnlieferung = { id: number } | { error: string } | { none: true };

/** Löst eine optionale Anlieferungs-Referenz auf — per interner `nummer` (ANL-JJJJ-NNNN) ODER
 * per `externeNr` (Beleg der Waage/des Vorlieferanten), damit ein Sortierungs-Import auf eine
 * per Anlieferungs-Import eingespielte Zeile verweisen kann, ohne deren intern vergebene
 * Nummer zu kennen (siehe Anlieferung.externeNr-Kommentar im Schema). */
export async function resolveAnlieferungRef(tx: Tx, ref: string | null): Promise<AufgeloesteAnlieferung> {
  if (!ref) return { none: true };
  // Erst die interne nummer versuchen — die ist global @unique, ein Treffer ist also immer
  // eindeutig. externeNr ist NUR je Kunde eindeutig (@@unique([kundeId, externeNr])); zwei
  // verschiedene Erzeuger können denselben Wiegeschein-/Belegnummern-Wert haben, ein
  // findFirst() über alle Kunden hinweg würde dann still den falschen Erzeuger treffen.
  const perNummer = await tx.anlieferung.findFirst({ where: { nummer: ref }, select: { id: true } });
  if (perNummer) return { id: perNummer.id };

  const kandidaten = await tx.anlieferung.findMany({ where: { externeNr: ref }, select: { id: true }, take: 2 });
  if (kandidaten.length === 0) return { error: `Anlieferung „${ref}“ nicht gefunden` };
  if (kandidaten.length > 1) return { error: `Anlieferung „${ref}“ nicht eindeutig (externeNr bei mehreren Erzeugern vorhanden)` };
  return { id: kandidaten[0].id };
}
