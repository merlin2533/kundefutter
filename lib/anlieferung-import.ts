// Geteilte Parsing-/Auflösungslogik für den Anlieferungs-Import (CSV/XLS) — von
// app/api/anlieferungen/import/vorschau/route.ts UND app/api/anlieferungen/import/route.ts
// genutzt, damit Vorschau und tatsächlicher Import exakt dasselbe Ergebnis liefern (analog
// dem bereits etablierten Vorschau/Commit-Muster bei /api/artikel/import).
import { pickCol, parseNumber, parseImportDatum, ANLIEFERUNG_ALIAS } from "@/lib/import-utils";
import type { Tx } from "@/lib/lieferung";

export interface AnlieferungZeilenFehler {
  zeile: number;
  grund: string;
}

/** Wird innerhalb der Import-Transaktion geworfen, wenn Kunde/Artikel einer Zeile nicht
 * eindeutig aufgelöst werden konnten — vom Aufrufer als Zeilenfehler (nicht als 500er)
 * abzufangen. */
export class AnlieferungImportZeilenFehler extends Error {}

export interface AnlieferungGeparsteZeile {
  zeile: number;
  kundeName: string;
  artikelRef: string;
  datum: Date;
  menge: number;
  einheit: string;
  feuchte: number | null;
  qualitaet: string | null;
  preisProEinheit: number | null;
  notiz: string | null;
  externeNr: string | null;
}

export type ParseErgebnis =
  | { ok: true; zeile: AnlieferungGeparsteZeile }
  | { ok: false; fehler: AnlieferungZeilenFehler };

/** Parst + validiert eine rohe Import-Zeile — reine Funktion ohne DB-Zugriff. Erkennt fehlende
 * Pflichtfelder und ungültige Datumswerte (inkl. Excel-Seriencodes, siehe parseImportDatum). */
export function parseAnlieferungZeile(row: Record<string, unknown>, zeile: number): ParseErgebnis {
  const kundeName = pickCol(row, ...ANLIEFERUNG_ALIAS.kunde);
  if (!kundeName) return { ok: false, fehler: { zeile, grund: "Kunde/Erzeuger fehlt" } };

  const artikelRef = pickCol(row, ...ANLIEFERUNG_ALIAS.artikel);
  if (!artikelRef) return { ok: false, fehler: { zeile, grund: "Artikel fehlt" } };

  const mengeStr = pickCol(row, ...ANLIEFERUNG_ALIAS.menge);
  const menge = parseNumber(mengeStr);
  if (!mengeStr || menge <= 0) {
    return { ok: false, fehler: { zeile, grund: "Menge fehlt oder ungültig (muss > 0 sein)" } };
  }

  const datumStr = pickCol(row, ...ANLIEFERUNG_ALIAS.datum);
  const datumParsed = parseImportDatum(row, ...ANLIEFERUNG_ALIAS.datum);
  if (datumStr && !datumParsed) {
    return { ok: false, fehler: { zeile, grund: `Datum ungültig: „${datumStr}“` } };
  }

  const feuchteStr = pickCol(row, ...ANLIEFERUNG_ALIAS.feuchte);
  const preisStr = pickCol(row, ...ANLIEFERUNG_ALIAS.preisProEinheit);

  return {
    ok: true,
    zeile: {
      zeile,
      kundeName,
      artikelRef,
      datum: datumParsed ?? new Date(),
      menge,
      einheit: pickCol(row, ...ANLIEFERUNG_ALIAS.einheit) || "t",
      feuchte: feuchteStr ? parseNumber(feuchteStr) : null,
      qualitaet: pickCol(row, ...ANLIEFERUNG_ALIAS.qualitaet) || null,
      preisProEinheit: preisStr ? parseNumber(preisStr) : null,
      notiz: pickCol(row, ...ANLIEFERUNG_ALIAS.notiz) || null,
      externeNr: pickCol(row, ...ANLIEFERUNG_ALIAS.externeNr) || null,
    },
  };
}

export type AufgeloesterName = { id: number; name: string } | { error: string };

/** Löst einen Kunden-/Erzeugernamen auf: zuerst exakter Treffer auf Name/Firma, sonst — da
 * Prisma `equals` auf SQLite case-sensitiv ist, `contains` aber nativ case-insensitiv (ASCII,
 * siehe AGENTS.md) — ein eindeutiger Teilstring-Treffer. Mehrdeutigkeit/kein Treffer wird als
 * Fehlertext statt einer Exception zurückgegeben, damit die aufrufende Zeile sauber als
 * "fehler" statt eines 500ers markiert werden kann. */
export async function resolveAnlieferungKunde(tx: Tx, name: string): Promise<AufgeloesterName> {
  const exakt = await tx.kunde.findFirst({
    where: { OR: [{ name }, { firma: name }] },
    select: { id: true, name: true },
  });
  if (exakt) return exakt;

  const kandidaten = await tx.kunde.findMany({
    where: { OR: [{ name: { contains: name } }, { firma: { contains: name } }] },
    select: { id: true, name: true },
    take: 5,
  });
  if (kandidaten.length === 1) return kandidaten[0];
  if (kandidaten.length === 0) return { error: `Kunde/Erzeuger „${name}“ nicht gefunden` };
  return { error: `Kunde/Erzeuger „${name}“ nicht eindeutig (${kandidaten.length} Treffer)` };
}

/** Löst eine Artikel-Referenz auf: zuerst exakte Artikelnummer (häufigster Fall bei
 * Waagen-/Sortiermaschinen-Exporten), dann exakter Name, dann ein eindeutiger
 * Teilstring-Treffer auf den Namen. */
export async function resolveArtikelRef(tx: Tx, ref: string): Promise<AufgeloesterName> {
  const exaktNummer = await tx.artikel.findUnique({
    where: { artikelnummer: ref },
    select: { id: true, name: true },
  });
  if (exaktNummer) return exaktNummer;

  const exaktName = await tx.artikel.findFirst({ where: { name: ref }, select: { id: true, name: true } });
  if (exaktName) return exaktName;

  const kandidaten = await tx.artikel.findMany({
    where: { name: { contains: ref } },
    select: { id: true, name: true },
    take: 5,
  });
  if (kandidaten.length === 1) return kandidaten[0];
  if (kandidaten.length === 0) return { error: `Artikel „${ref}“ nicht gefunden` };
  return { error: `Artikel „${ref}“ nicht eindeutig (${kandidaten.length} Treffer)` };
}
