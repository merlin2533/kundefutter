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
  // Nur aktive Kunden — vermeidet sowohl einen stillen Treffer auf einen per "Löschen"
  // (aktiv:false) entfernten Kunden als auch eine übersehene Mehrdeutigkeit, wenn nach einem
  // Kunden-Merge noch ein inaktives Duplikat mit demselben Namen existiert.
  const exakt = await tx.kunde.findMany({
    where: { aktiv: true, OR: [{ name }, { firma: name }] },
    select: { id: true, name: true },
    take: 2,
  });
  if (exakt.length === 1) return exakt[0];
  // Zwei Erzeuger mit exakt demselben Namen (z.B. Nachname "Meier") sind real möglich —
  // ein findFirst() hätte hier still einen davon gewählt, statt die Mehrdeutigkeit zu melden.
  if (exakt.length > 1) return { error: `Kunde/Erzeuger „${name}“ nicht eindeutig (mehrere aktive Kunden mit diesem Namen)` };

  const kandidaten = await tx.kunde.findMany({
    where: { aktiv: true, OR: [{ name: { contains: name } }, { firma: { contains: name } }] },
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
  // artikelnummer ist global @unique — ein Treffer hier ist immer eindeutig, unabhängig von
  // aktiv/inaktiv (eine importierte Zeile referenziert bewusst denselben Artikel, den der
  // Nutzer auch über seine Artikelnummer wiederfinden würde).
  const exaktNummer = await tx.artikel.findUnique({
    where: { artikelnummer: ref },
    select: { id: true, name: true },
  });
  if (exaktNummer) return exaktNummer;

  // Artikelnamen sind NICHT unique — zwei aktive Artikel mit exakt demselben Namen sind
  // möglich (z.B. vor einer Bereinigung/einem Merge). Nur aktive Artikel berücksichtigen und
  // bei mehr als einem Treffer die Mehrdeutigkeit melden statt still einen davon zu wählen.
  const exaktName = await tx.artikel.findMany({
    where: { aktiv: true, name: ref },
    select: { id: true, name: true },
    take: 2,
  });
  if (exaktName.length === 1) return exaktName[0];
  if (exaktName.length > 1) return { error: `Artikel „${ref}“ nicht eindeutig (mehrere aktive Artikel mit diesem Namen)` };

  const kandidaten = await tx.artikel.findMany({
    where: { aktiv: true, name: { contains: ref } },
    select: { id: true, name: true },
    take: 5,
  });
  if (kandidaten.length === 1) return kandidaten[0];
  if (kandidaten.length === 0) return { error: `Artikel „${ref}“ nicht gefunden` };
  return { error: `Artikel „${ref}“ nicht eindeutig (${kandidaten.length} Treffer)` };
}
