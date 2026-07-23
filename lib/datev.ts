/**
 * lib/datev.ts
 * Zentrale Buchungskonto-Logik für den DATEV-Export (SKR03 / SKR04).
 * Sachkonten, Gegenkonten, Buchungstypen und Hilfsfunktionen.
 */

// ─── Whitelists ───────────────────────────────────────────────────────────────

export const BUCHUNGSTYPEN = [
  "Betriebsausgabe",
  "Privatentnahme",
  "Privateinlage",
  "Reisekosten",
  "Bewirtung",
] as const;
export type Buchungstyp = (typeof BUCHUNGSTYPEN)[number];

export const ZAHLUNGSWEGE = [
  "Bar",
  "Überweisung",
  "EC",
  "Kreditkarte",
  "Privat",
] as const;
export type Zahlungsweg = (typeof ZAHLUNGSWEGE)[number];

// ─── Kilometerpauschale / Bewirtung ───────────────────────────────────────────

/** § 9 Abs. 1 Nr. 4 EStG – 0,30 €/km (Standardwert; wird von getKilometerpauschale() überschrieben) */
export const KILOMETERPAUSCHALE_EUR = 0.3;

/** § 4 Abs. 5 Nr. 2 EStG – nur 70 % der Bewirtungskosten abzugsfähig (Standardwert) */
export const BEWIRTUNG_ABZUGSFAEHIG = 0.7;

/** Lädt die Kilometerpauschale aus den DB-Einstellungen (datev.kilometerpauschale). */
export async function getKilometerpauschale(): Promise<number> {
  const { prisma } = await import("@/lib/prisma");
  const e = await prisma.einstellung.findUnique({ where: { key: "datev.kilometerpauschale" } });
  if (!e?.value) return KILOMETERPAUSCHALE_EUR;
  const n = parseFloat(e.value);
  return Number.isFinite(n) && n > 0 ? n : KILOMETERPAUSCHALE_EUR;
}

/** Lädt den abzugsfähigen Bewirtungsanteil aus den DB-Einstellungen (datev.bewirtungsanteil, in %). */
export async function getBewirtungsanteil(): Promise<number> {
  const { prisma } = await import("@/lib/prisma");
  const e = await prisma.einstellung.findUnique({ where: { key: "datev.bewirtungsanteil" } });
  if (!e?.value) return BEWIRTUNG_ABZUGSFAEHIG;
  const n = parseFloat(e.value);
  // Gespeichert als Prozentzahl (z. B. 70), intern aber als Dezimal (0.7)
  if (Number.isFinite(n) && n > 0 && n <= 100) return n / 100;
  return BEWIRTUNG_ABZUGSFAEHIG;
}

// ─── Sachkonten-Mapping ───────────────────────────────────────────────────────

/** Kategorie → SKR03 Aufwandskonto */
export const SACHKONTEN_SKR03: Record<string, string> = {
  Wareneinkauf: "3200",
  Betriebsbedarf: "4200",
  Fahrtkosten: "4530",
  Bürobedarf: "4930",
  "Telefon/Internet": "4920",
  Versicherung: "4360",
  Miete: "4210",
  Personal: "4120",   // Löhne und Gehälter
  Sonstige: "4900",
};

/** Kategorie → SKR04 Aufwandskonto */
export const SACHKONTEN_SKR04: Record<string, string> = {
  Wareneinkauf: "5200",
  Betriebsbedarf: "6300",
  Fahrtkosten: "6520",
  Bürobedarf: "6815",
  "Telefon/Internet": "6805",
  Versicherung: "6310",
  Miete: "6130",
  Personal: "6010",   // Löhne und Gehälter
  Sonstige: "6800",
};

/** Buchungstyp-Overrides – haben Vorrang vor der Kategorie */
export const BUCHUNGSTYP_KONTEN_SKR03: Partial<Record<Buchungstyp, string>> = {
  Privatentnahme: "1800",
  Privateinlage: "1890",
  Reisekosten: "4530",
  Bewirtung: "4654",
};

export const BUCHUNGSTYP_KONTEN_SKR04: Partial<Record<Buchungstyp, string>> = {
  Privatentnahme: "2100",
  Privateinlage: "2110",
  Reisekosten: "6520",
  Bewirtung: "6640",
};

// ─── Gegenkonten ──────────────────────────────────────────────────────────────

/** Zahlungsweg → SKR03 Gegenkonto */
export const GEGENKONTO_SKR03: Record<string, string> = {
  Bar: "1000",
  Überweisung: "1200",
  EC: "1200",
  Kreditkarte: "1200",
  Privat: "1890",
};

/** Zahlungsweg → SKR04 Gegenkonto */
export const GEGENKONTO_SKR04: Record<string, string> = {
  Bar: "1600",
  Überweisung: "1800",
  EC: "1800",
  Kreditkarte: "1800",
  Privat: "2110",
};

// ─── Erlöskonten (aus altem Route-Inline-Code extrahiert) ─────────────────────

/** Erlöskonto je MwSt-Satz */
export function erloeseKonto(
  mwstSatz: number,
  kontenrahmen: "SKR03" | "SKR04"
): string {
  if (kontenrahmen === "SKR04") {
    if (mwstSatz === 19) return "4400";
    if (mwstSatz === 7) return "4300";
    return "4200";
  }
  // SKR03
  if (mwstSatz === 19) return "8400";
  if (mwstSatz === 7) return "8300";
  return "8000";
}

/** Kreditorenkonto für Lieferanten (70000 + lieferantId) */
export function kreditorenKonto(lieferantId: number | null | undefined): string {
  return String(70000 + (lieferantId ?? 0));
}

// ─── Hauptfunktionen ──────────────────────────────────────────────────────────

/**
 * Bestimmt das DATEV-Sachkonto (Soll-Konto) für eine Ausgabe.
 * Priorität: explizit gesetztes Konto > Buchungstyp-Override > Kategorie-Mapping > Fallback
 */
export function getSachkonto(
  kategorie: string,
  buchungstyp: string,
  kontenrahmen: "SKR03" | "SKR04",
  explicitSachkonto?: string | null
): string {
  if (explicitSachkonto) return explicitSachkonto;

  const typeMap =
    kontenrahmen === "SKR04"
      ? BUCHUNGSTYP_KONTEN_SKR04
      : BUCHUNGSTYP_KONTEN_SKR03;
  if (buchungstyp in typeMap)
    return typeMap[buchungstyp as Buchungstyp]!;

  const katMap =
    kontenrahmen === "SKR04" ? SACHKONTEN_SKR04 : SACHKONTEN_SKR03;
  return katMap[kategorie] ?? (kontenrahmen === "SKR04" ? "6800" : "4900");
}

/**
 * Bestimmt das DATEV-Gegenkonto (Bank/Kasse/Kreditor) für eine Ausgabe.
 * Privatentnahmen/einlagen erhalten eigenständige Eigenkapital-Konten.
 */
export function getGegenkonto(
  zahlungsweg: string | null | undefined,
  lieferantId: number | null | undefined,
  kontenrahmen: "SKR03" | "SKR04",
  buchungstyp: string
): string {
  if (buchungstyp === "Privatentnahme")
    return kontenrahmen === "SKR04" ? "2100" : "1800";
  if (buchungstyp === "Privateinlage")
    return kontenrahmen === "SKR04" ? "2110" : "1890";

  if (zahlungsweg) {
    const map =
      kontenrahmen === "SKR04" ? GEGENKONTO_SKR04 : GEGENKONTO_SKR03;
    if (zahlungsweg in map) return map[zahlungsweg];
  }

  // Fallback: Kreditorenkonto
  return kreditorenKonto(lieferantId);
}

/**
 * Gibt den DATEV-BU-Schlüssel für eine Ausgabe zurück.
 * Bewirtungskosten → BU-Schlüssel 9 (nicht abzugsfähige Betriebsausgaben)
 */
export function getBuSchluessel(buchungstyp: string): string {
  return buchungstyp === "Bewirtung" ? "9" : "";
}

// ─── DATEV CSV Formatierungshilfen ────────────────────────────────────────────

/** Quote und escape einen CSV-Feldwert für DATEV */
export function datevQ(val: string): string {
  return `"${val.replace(/"/g, '""')}"`;
}

function _p(n: number): string { return String(n).padStart(2, "0"); }

/** DATEV Belegdatum-Format DDMM */
export function datevBelegdatum(date: Date): string {
  return `${_p(date.getDate())}${_p(date.getMonth() + 1)}`;
}

/** DATEV Leistungsdatum-Format DDMMYYYY */
export function datevLeistungsdatum(date: Date): string {
  return `${_p(date.getDate())}${_p(date.getMonth() + 1)}${date.getFullYear()}`;
}

/** Fertig formatierte Spaltenköpfe-Zeile für DATEV-Buchungsstapel (65 Spalten) */
export const DATEV_COL_HEADERS = [
  "Umsatz (ohne Soll/Haben-Kz)", "Soll/Haben-Kennzeichen", "WKZ Umsatz",
  "Kurs", "Basis-Umsatz", "WKZ Basis-Umsatz",
  "Konto", "Gegenkonto (ohne BU-Schlüssel)", "BU-Schlüssel",
  "Belegdatum", "Belegfeld 1", "Belegfeld 2", "Skonto", "Buchungstext",
  "Postensperre", "Diverse Adressnummer", "Geschäftspartnerbank",
  "Sachverhalt", "Zinssperre", "Beleglink",
  "Beleginfo - Art 1", "Beleginfo - Inhalt 1",
  "Beleginfo - Art 2", "Beleginfo - Inhalt 2",
  "Beleginfo - Art 3", "Beleginfo - Inhalt 3",
  "Beleginfo - Art 4", "Beleginfo - Inhalt 4",
  "Beleginfo - Art 5", "Beleginfo - Inhalt 5",
  "Beleginfo - Art 6", "Beleginfo - Inhalt 6",
  "Beleginfo - Art 7", "Beleginfo - Inhalt 7",
  "Beleginfo - Art 8", "Beleginfo - Inhalt 8",
  "Kostenrechnung - Kostenstelle 1", "Kostenrechnung - Kostenmenge 1",
  "Kostenrechnung - Kostenstelle 2", "Kostenrechnung - Kostenmenge 2",
  "Kostenrechnung - Kostenstelle 3", "Kostenrechnung - Kostenmenge 3",
  "KOST1 - Auftragsnummer", "KOST2 - Auftragsnummer", "Kost-Datum",
  "SEPA-Mandatsreferenz", "Skontosperre", "Gesellschaftername",
  "Beteiligtennummer", "Identifikationsnummer", "Zeichnernummer",
  "Postensperre bis", "Bezeichnung SoBil-Sachverhalt",
  "Kennzeichen SoBil-Buchung", "Festschreibung",
  "Leistungsdatum", "Datum Zuord. Steuerperiode", "Fälligkeit",
  "Generalumkehr (GU)", "Steuersatz", "Land",
  "Abrechnungsreferenz", "BVV-Position (Betriebsvermögensvergleich)",
  "EU-Land u. UStID", "EU-Steuersatz",
].map(datevQ).join(";");

interface DatevHeaderOpts {
  appName: string;
  beraternummer: string;
  mandantennummer: string;
  kontenrahmen: string;
  /** YYYYMMDD */
  wjStartStr: string;
  /** YYYYMMDD */
  vonDatum: string;
  /** YYYYMMDD */
  bisDatum: string;
  bezeichnung: string;
}

/** Erzeugt die DATEV-Metadaten-Kopfzeile (erste Zeile im Buchungsstapel) */
export function buildDatevHeaderLine(opts: DatevHeaderOpts): string {
  const exportDatum = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return [
    datevQ("EXTF"), "700", "21", datevQ("Buchungsstapel"), "9",
    `${exportDatum}000000`, "", datevQ(opts.appName), "", "",
    opts.beraternummer, opts.mandantennummer, opts.wjStartStr, "4",
    opts.vonDatum, opts.bisDatum,
    datevQ(opts.bezeichnung), "", "1", "0", "0", "EUR",
    "", "", opts.kontenrahmen, "", "", "",
  ].join(";");
}

// ─── Lohnbuchhaltung ──────────────────────────────────────────────────────────

/**
 * Aufwandskonto für Lohnzahlungen.
 * SKR03: 4120 Gehälter | 4110 Löhne
 * SKR04: 6010 Löhne und Gehälter
 */
export function lohnKonto(typ: string, kontenrahmen: "SKR03" | "SKR04"): string {
  if (kontenrahmen === "SKR04") return "6010";
  return typ === "festgehalt" ? "4120" : "4110";
}

/**
 * Bank-Gegenkonto für ausgezahlte Löhne (Girokonto).
 * SKR03: 1200 | SKR04: 1800
 */
export function lohnGegenkonto(kontenrahmen: "SKR03" | "SKR04"): string {
  return kontenrahmen === "SKR04" ? "1800" : "1200";
}

// ─── Vollständiger DATEV-Buchungsstapel-Export ───────────────────────────────

/**
 * Baut den kompletten DATEV-Buchungsstapel (Lieferungen, Sammelrechnungen,
 * Gutschriften, Ausgaben) für den Zeitraum [von, bis] als CSV-String.
 * Wird sowohl vom Direkt-Download (`/api/exporte/datev`) als auch von der
 * Nextcloud-Archivierung (`/api/exporte/datev/archivieren`) verwendet.
 */
export async function buildDatevCsv(
  von: Date,
  bis: Date,
  baseUrl: string
): Promise<{ csv: string; filename: string }> {
  const { prisma } = await import("@/lib/prisma");
  const { getAppName } = await import("@/lib/appinfo");

  const appName = await getAppName();

  const einstellungen = await prisma.einstellung.findMany({
    where: { key: { in: ["datev.beraternummer", "datev.mandantennummer", "datev.sachkontenrahmen", "datev.wirtschaftsjahrBeginn"] } },
  });
  const settMap = Object.fromEntries(einstellungen.map((e) => [e.key, e.value]));
  const beraternummer = settMap["datev.beraternummer"] ?? "0";
  const mandantennummer = settMap["datev.mandantennummer"] ?? "1";
  const kontenrahmen = settMap["datev.sachkontenrahmen"] ?? "SKR03";
  const wjBeginnMonat = parseInt(settMap["datev.wirtschaftsjahrBeginn"] ?? "1", 10);

  const wjJahr = von.getFullYear();
  const wjStart = new Date(wjJahr, wjBeginnMonat - 1, 1);

  const [lieferungen, sammelrechnungen, gutschriften, ausgaben] = await Promise.all([
    prisma.lieferung.findMany({
      where: { status: "geliefert", rechnungNr: { not: null }, datum: { gte: von, lte: bis } },
      select: {
        id: true,
        kundeId: true,
        datum: true,
        rechnungNr: true,
        rechnungDatum: true,
        kunde: { select: { name: true, firma: true } },
        positionen: { select: { menge: true, verkaufspreis: true, artikel: { select: { mwstSatz: true } } } },
      },
      orderBy: { datum: "asc" },
    }),
    prisma.sammelrechnung.findMany({
      where: { rechnungNr: { not: null }, rechnungDatum: { gte: von, lte: bis } },
      select: {
        id: true,
        kundeId: true,
        rechnungNr: true,
        rechnungDatum: true,
        kunde: { select: { name: true, firma: true } },
        lieferungen: {
          select: { positionen: { select: { menge: true, verkaufspreis: true, artikel: { select: { mwstSatz: true } } } } },
        },
      },
      orderBy: { rechnungDatum: "asc" },
    }),
    prisma.gutschrift.findMany({
      where: { status: { not: "STORNIERT" }, datum: { gte: von, lte: bis } },
      select: {
        id: true,
        kundeId: true,
        nummer: true,
        datum: true,
        kunde: { select: { name: true, firma: true } },
        positionen: { select: { menge: true, preis: true, artikel: { select: { mwstSatz: true } } } },
      },
      orderBy: { datum: "asc" },
    }),
    prisma.ausgabe.findMany({
      where: { datum: { gte: von, lte: bis } },
      select: {
        id: true, datum: true, belegNr: true, beschreibung: true, betragNetto: true, mwstSatz: true,
        kategorie: true, lieferantId: true, belegPfad: true, buchungstyp: true, sachkonto: true,
        zahlungsweg: true, kostenstelle: true, reiseZiel: true, bewirtungZweck: true,
      },
      orderBy: { datum: "asc" },
    }),
  ]);

  interface DatevRow {
    umsatz: number;
    sollHaben: string;
    wkz: string;
    konto: string;
    gegenkonto: string;
    buSchluessel: string;
    belegdatum: string;
    belegfeld1: string;
    buchungstext: string;
    beleglink: string;
    leistungsdatum: string;
    steuersatz: string;
    kostenstelle: string;
  }

  const rows: DatevRow[] = [];

  for (const lief of lieferungen) {
    const rechnungDatum = lief.rechnungDatum ?? lief.datum;
    const kundeName = lief.kunde.firma ? `${lief.kunde.firma} ${lief.kunde.name}` : lief.kunde.name;
    const konto = String(10000 + lief.kundeId);
    const byMwst = new Map<number, number>();
    for (const pos of lief.positionen) {
      const satz = pos.artikel.mwstSatz ?? 19;
      const brutto = pos.menge * pos.verkaufspreis * (1 + satz / 100);
      byMwst.set(satz, (byMwst.get(satz) ?? 0) + brutto);
    }
    for (const [satz, brutto] of byMwst.entries()) {
      rows.push({
        umsatz: Math.round(brutto * 100) / 100, sollHaben: "S", wkz: "EUR", konto,
        gegenkonto: erloeseKonto(satz, kontenrahmen as "SKR03" | "SKR04"), buSchluessel: "",
        belegdatum: datevBelegdatum(rechnungDatum), belegfeld1: lief.rechnungNr ?? "",
        buchungstext: kundeName.substring(0, 60), beleglink: "",
        leistungsdatum: datevLeistungsdatum(rechnungDatum), steuersatz: String(satz), kostenstelle: "",
      });
    }
  }

  for (const sr of sammelrechnungen) {
    const rechnungDatum = sr.rechnungDatum!;
    const kundeName = sr.kunde.firma ? `${sr.kunde.firma} ${sr.kunde.name}` : sr.kunde.name;
    const konto = String(10000 + sr.kundeId);
    const byMwst = new Map<number, number>();
    for (const lief of sr.lieferungen) {
      for (const pos of lief.positionen) {
        const satz = pos.artikel.mwstSatz ?? 19;
        const brutto = pos.menge * pos.verkaufspreis * (1 + satz / 100);
        byMwst.set(satz, (byMwst.get(satz) ?? 0) + brutto);
      }
    }
    for (const [satz, brutto] of byMwst.entries()) {
      rows.push({
        umsatz: Math.round(brutto * 100) / 100, sollHaben: "S", wkz: "EUR", konto,
        gegenkonto: erloeseKonto(satz, kontenrahmen as "SKR03" | "SKR04"), buSchluessel: "",
        belegdatum: datevBelegdatum(rechnungDatum), belegfeld1: sr.rechnungNr ?? "",
        buchungstext: kundeName.substring(0, 60), beleglink: "",
        leistungsdatum: datevLeistungsdatum(rechnungDatum), steuersatz: String(satz), kostenstelle: "",
      });
    }
  }

  for (const gs of gutschriften) {
    const datum = gs.datum;
    const kundeName = gs.kunde.firma ? `${gs.kunde.firma} ${gs.kunde.name}` : gs.kunde.name;
    const konto = String(10000 + gs.kundeId);
    const byMwst = new Map<number, number>();
    for (const pos of gs.positionen) {
      const satz = pos.artikel?.mwstSatz ?? 19;
      const brutto = pos.menge * pos.preis * (1 + satz / 100);
      byMwst.set(satz, (byMwst.get(satz) ?? 0) + brutto);
    }
    for (const [satz, brutto] of byMwst.entries()) {
      rows.push({
        umsatz: Math.round(brutto * 100) / 100, sollHaben: "H", wkz: "EUR", konto,
        gegenkonto: erloeseKonto(satz, kontenrahmen as "SKR03" | "SKR04"), buSchluessel: "",
        belegdatum: datevBelegdatum(datum), belegfeld1: gs.nummer,
        buchungstext: `Gutschrift ${kundeName}`.substring(0, 60), beleglink: "",
        leistungsdatum: datevLeistungsdatum(datum), steuersatz: String(satz), kostenstelle: "",
      });
    }
  }

  const kr = kontenrahmen as "SKR03" | "SKR04";
  for (const ausg of ausgaben) {
    const bt = ausg.buchungstyp ?? "Betriebsausgabe";
    const isPrivat = bt === "Privatentnahme" || bt === "Privateinlage";
    const mwst = isPrivat ? 0 : ausg.mwstSatz;
    const brutto = ausg.betragNetto * (1 + mwst / 100);
    const beleglink = ausg.belegPfad && baseUrl ? `${baseUrl}${ausg.belegPfad}` : "";

    let buchungstext = ausg.beschreibung;
    if (bt === "Reisekosten" && ausg.reiseZiel) buchungstext = `${buchungstext} [${ausg.reiseZiel}]`;
    if (bt === "Bewirtung" && ausg.bewirtungZweck) buchungstext = `${buchungstext} [${ausg.bewirtungZweck}]`;
    buchungstext = buchungstext.substring(0, 60);

    rows.push({
      umsatz: Math.round(brutto * 100) / 100, sollHaben: "H", wkz: "EUR",
      konto: getSachkonto(ausg.kategorie, bt, kr, ausg.sachkonto),
      gegenkonto: getGegenkonto(ausg.zahlungsweg, ausg.lieferantId, kr, bt),
      buSchluessel: getBuSchluessel(bt), belegdatum: datevBelegdatum(ausg.datum),
      belegfeld1: (ausg.belegNr ?? "").substring(0, 36), buchungstext, beleglink,
      leistungsdatum: datevLeistungsdatum(ausg.datum), steuersatz: String(mwst),
      kostenstelle: ausg.kostenstelle ?? "",
    });
  }

  const vonDatum = von.toISOString().slice(0, 10).replace(/-/g, "");
  const bisDatum = bis.toISOString().slice(0, 10).replace(/-/g, "");
  const wjStartStr = wjStart.toISOString().slice(0, 10).replace(/-/g, "");

  const headerLine = buildDatevHeaderLine({
    appName, beraternummer, mandantennummer, kontenrahmen, wjStartStr, vonDatum, bisDatum,
    bezeichnung: `DATEV-Export ${appName}`,
  });

  const colHeaders = DATEV_COL_HEADERS;

  const dataLines = rows.map((r) => {
    const umsatzStr = r.umsatz.toFixed(2).replace(".", ",");
    const fields: string[] = [
      umsatzStr, r.sollHaben, r.wkz, "", "", "", r.konto, r.gegenkonto, r.buSchluessel,
      r.belegdatum, datevQ(r.belegfeld1), "", "", datevQ(r.buchungstext), "", "", "", "", "",
      r.beleglink ? datevQ(r.beleglink) : "",
      "", "", "", "", "", "", "", "", "", "",
      "", "", "", "", "", "",
      r.kostenstelle ? datevQ(r.kostenstelle) : "",
      "", "", "", "",
      "", "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      r.leistungsdatum,
      "",
      "",
      "",
      r.steuersatz,
      "",
      "",
      "",
      "",
    ];
    return fields.join(";");
  });

  const csvContent = [headerLine, colHeaders, ...dataLines].join("\r\n");
  const BOM = "﻿";
  const csv = BOM + csvContent;
  const filename = `DATEV-Buchungsstapel-${vonDatum}-${bisDatum}.csv`;

  return { csv, filename };
}

