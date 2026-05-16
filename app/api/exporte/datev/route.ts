import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAppName } from "@/lib/appinfo";

export const dynamic = "force-dynamic";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Format date as DDMM for DATEV Belegdatum */
function belegdatum(date: Date): string {
  return `${pad2(date.getDate())}${pad2(date.getMonth() + 1)}`;
}

/** Escape and quote a text field for CSV */
function q(val: string): string {
  return `"${val.replace(/"/g, '""')}"`;
}

/** Revenue account by VAT rate */
function erloeseKonto(mwstSatz: number, kontenrahmen: string): string {
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

/** Expense account by category */
function aufwandsKonto(kategorie: string, kontenrahmen: string): string {
  if (kontenrahmen === "SKR04") {
    switch (kategorie) {
      case "Wareneinkauf":     return "5200";
      case "Betriebsbedarf":   return "6300";
      case "Fahrtkosten":      return "6520";
      case "Bürobedarf":       return "6815";
      case "Telefon/Internet": return "6805";
      case "Versicherung":     return "6310";
      case "Miete":            return "6130";
      default:                 return "6800";
    }
  }
  // SKR03
  switch (kategorie) {
    case "Wareneinkauf":     return "3200";
    case "Betriebsbedarf":   return "4200";
    case "Fahrtkosten":      return "4530";
    case "Bürobedarf":       return "4930";
    case "Telefon/Internet": return "4920";
    case "Versicherung":     return "4360";
    case "Miete":            return "4210";
    default:                 return "4900";
  }
}

/** Creditor account: 70000 + lieferantId, or fixed 70000 for unknown */
function kreditorenKonto(lieferantId: number | null): string {
  return String(70000 + (lieferantId ?? 0));
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const vonStr = searchParams.get("von");
  const bisStr = searchParams.get("bis");

  try {
  const appName = await getAppName();

  // Load DATEV settings from DB
  const einstellungen = await prisma.einstellung.findMany({
    where: { key: { in: ["datev.beraternummer", "datev.mandantennummer", "datev.sachkontenrahmen", "datev.wirtschaftsjahrBeginn"] } },
  });
  const settMap = Object.fromEntries(einstellungen.map((e) => [e.key, e.value]));
  const beraternummer = settMap["datev.beraternummer"] ?? "0";
  const mandantennummer = settMap["datev.mandantennummer"] ?? "1";
  const kontenrahmen = settMap["datev.sachkontenrahmen"] ?? "SKR03";
  const wjBeginnMonat = parseInt(settMap["datev.wirtschaftsjahrBeginn"] ?? "1", 10);

  // Date range
  const today = new Date();
  const von = vonStr ? new Date(vonStr) : new Date(today.getFullYear(), today.getMonth(), 1);
  von.setHours(0, 0, 0, 0);
  const bis = bisStr ? new Date(bisStr) : today;
  bis.setHours(23, 59, 59, 999);

  // Wirtschaftsjahr-Start: first day of wjBeginnMonat in same year as von
  const wjJahr = von.getFullYear();
  const wjStart = new Date(wjJahr, wjBeginnMonat - 1, 1);

  // Query invoiced deliveries, sammelrechnungen, gutschriften and expenses in range
  const [lieferungen, sammelrechnungen, gutschriften, ausgaben] = await Promise.all([
    prisma.lieferung.findMany({
      where: {
        status: "geliefert",
        rechnungNr: { not: null },
        datum: { gte: von, lte: bis },
      },
      select: {
        id: true,
        kundeId: true,
        datum: true,
        rechnungNr: true,
        rechnungDatum: true,
        kunde: { select: { name: true, firma: true } },
        positionen: {
          select: { menge: true, verkaufspreis: true, artikel: { select: { mwstSatz: true } } },
        },
      },
      orderBy: { datum: "asc" },
    }),
    prisma.sammelrechnung.findMany({
      where: {
        rechnungNr: { not: null },
        rechnungDatum: { gte: von, lte: bis },
      },
      select: {
        id: true,
        kundeId: true,
        rechnungNr: true,
        rechnungDatum: true,
        kunde: { select: { name: true, firma: true } },
        lieferungen: {
          select: {
            positionen: {
              select: { menge: true, verkaufspreis: true, artikel: { select: { mwstSatz: true } } },
            },
          },
        },
      },
      orderBy: { rechnungDatum: "asc" },
    }),
    prisma.gutschrift.findMany({
      where: {
        status: { not: "STORNIERT" },
        datum: { gte: von, lte: bis },
      },
      select: {
        id: true,
        kundeId: true,
        nummer: true,
        datum: true,
        kunde: { select: { name: true, firma: true } },
        positionen: {
          select: { menge: true, preis: true, artikel: { select: { mwstSatz: true } } },
        },
      },
      orderBy: { datum: "asc" },
    }),
    prisma.ausgabe.findMany({
      where: { datum: { gte: von, lte: bis } },
      select: {
        id: true,
        datum: true,
        belegNr: true,
        beschreibung: true,
        betragNetto: true,
        mwstSatz: true,
        kategorie: true,
        lieferantId: true,
        belegPfad: true,
      },
      orderBy: { datum: "asc" },
    }),
  ]);

  // Build DATEV data rows
  interface DatevRow {
    umsatz: number;
    sollHaben: string;   // S = Soll (Einnahmen), H = Haben (Ausgaben)
    wkz: string;
    konto: string;
    gegenkonto: string;
    buSchluessel: string;
    belegdatum: string;
    belegfeld1: string;
    buchungstext: string;
    beleglink: string;   // URL zum Belegscan (DATEV Beleglink Feld)
    leistungsdatum: string; // DDMMYYYY
    steuersatz: string;  // e.g. "19"
  }

  // Base URL for Beleglink (e.g. http://194.164.59.48:8080)
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  const baseUrl = host ? `${proto}://${host}` : "";

  const rows: DatevRow[] = [];

  /** Format date as DDMMYYYY for DATEV Leistungsdatum */
  function leistungsdatumFmt(date: Date): string {
    return `${pad2(date.getDate())}${pad2(date.getMonth() + 1)}${date.getFullYear()}`;
  }

  // ── Einnahmen (Lieferungen) ──────────────────────────────────────────────
  for (const lief of lieferungen) {
    const rechnungDatum = lief.rechnungDatum ?? lief.datum;
    const kundeName = lief.kunde.firma
      ? `${lief.kunde.firma} ${lief.kunde.name}`
      : lief.kunde.name;
    const konto = String(10000 + lief.kundeId);

    // Group positions by MwSt rate
    const byMwst = new Map<number, number>();
    for (const pos of lief.positionen) {
      const satz = pos.artikel.mwstSatz ?? 19;
      const brutto = pos.menge * pos.verkaufspreis * (1 + satz / 100);
      byMwst.set(satz, (byMwst.get(satz) ?? 0) + brutto);
    }

    for (const [satz, brutto] of byMwst.entries()) {
      rows.push({
        umsatz: Math.round(brutto * 100) / 100,
        sollHaben: "S",
        wkz: "EUR",
        konto,
        gegenkonto: erloeseKonto(satz, kontenrahmen),
        buSchluessel: "",
        belegdatum: belegdatum(rechnungDatum),
        belegfeld1: lief.rechnungNr ?? "",
        buchungstext: kundeName.substring(0, 60),
        beleglink: "",
        leistungsdatum: leistungsdatumFmt(rechnungDatum),
        steuersatz: String(satz),
      });
    }
  }

  // ── Sammelrechnungen ──────────────────────────────────────────────────────
  for (const sr of sammelrechnungen) {
    const rechnungDatum = sr.rechnungDatum!;
    const kundeName = sr.kunde.firma
      ? `${sr.kunde.firma} ${sr.kunde.name}`
      : sr.kunde.name;
    const konto = String(10000 + sr.kundeId);

    // Aggregate all positions from all included deliveries by MwSt rate
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
        umsatz: Math.round(brutto * 100) / 100,
        sollHaben: "S",
        wkz: "EUR",
        konto,
        gegenkonto: erloeseKonto(satz, kontenrahmen),
        buSchluessel: "",
        belegdatum: belegdatum(rechnungDatum),
        belegfeld1: sr.rechnungNr ?? "",
        buchungstext: kundeName.substring(0, 60),
        beleglink: "",
        leistungsdatum: leistungsdatumFmt(rechnungDatum),
        steuersatz: String(satz),
      });
    }
  }

  // ── Gutschriften (Storno / Haben) ─────────────────────────────────────────
  for (const gs of gutschriften) {
    const datum = gs.datum;
    const kundeName = gs.kunde.firma
      ? `${gs.kunde.firma} ${gs.kunde.name}`
      : gs.kunde.name;
    const konto = String(10000 + gs.kundeId);

    const byMwst = new Map<number, number>();
    for (const pos of gs.positionen) {
      const satz = pos.artikel?.mwstSatz ?? 19;
      const brutto = pos.menge * pos.preis * (1 + satz / 100);
      byMwst.set(satz, (byMwst.get(satz) ?? 0) + brutto);
    }

    for (const [satz, brutto] of byMwst.entries()) {
      rows.push({
        umsatz: Math.round(brutto * 100) / 100,
        sollHaben: "H",
        wkz: "EUR",
        konto,
        gegenkonto: erloeseKonto(satz, kontenrahmen),
        buSchluessel: "",
        belegdatum: belegdatum(datum),
        belegfeld1: gs.nummer,
        buchungstext: `Gutschrift ${kundeName}`.substring(0, 60),
        beleglink: "",
        leistungsdatum: leistungsdatumFmt(datum),
        steuersatz: String(satz),
      });
    }
  }

  // ── Ausgaben (Betriebsausgaben / Eingangsrechnungen) ─────────────────────
  for (const ausg of ausgaben) {
    const brutto = ausg.betragNetto * (1 + ausg.mwstSatz / 100);
    const beleglink = ausg.belegPfad && baseUrl ? `${baseUrl}${ausg.belegPfad}` : "";
    rows.push({
      umsatz: Math.round(brutto * 100) / 100,
      sollHaben: "H",
      wkz: "EUR",
      konto: aufwandsKonto(ausg.kategorie, kontenrahmen),
      gegenkonto: kreditorenKonto(ausg.lieferantId),
      buSchluessel: "",
      belegdatum: belegdatum(ausg.datum),
      belegfeld1: (ausg.belegNr ?? "").substring(0, 36),
      buchungstext: ausg.beschreibung.substring(0, 60),
      beleglink,
      leistungsdatum: leistungsdatumFmt(ausg.datum),
      steuersatz: String(ausg.mwstSatz),
    });
  }

  // Build DATEV CSV
  // DATEV format: UTF-8 with BOM, semicolon delimiter
  const exportDatum = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const vonDatum = von.toISOString().slice(0, 10).replace(/-/g, "");
  const bisDatum = bis.toISOString().slice(0, 10).replace(/-/g, "");
  const wjStartStr = wjStart.toISOString().slice(0, 10).replace(/-/g, "");

  // DATEV header line (Metadaten)
  const headerLine = [
    q("EXTF"),         // Kennzeichen
    "700",             // Versionsnummer (DATEV Format 700)
    "21",              // Datenkategorie: 21 = Buchungsstapel
    q("Buchungsstapel"),
    "9",               // Formatversion
    exportDatum + "000000", // Erstellt am (YYYYMMDDHHmmss)
    "",                // Importiert
    q(appName),  // Herkunft
    "",                // Exportiert von
    "",                // Importiert von
    beraternummer,     // Beraternummer
    mandantennummer,   // Mandantennummer
    wjStartStr,        // WJ-Beginn (YYYYMMDD)
    "4",               // Sachkontenlänge
    vonDatum,          // Datum von
    bisDatum,          // Datum bis
    q(`DATEV-Export ${appName}`), // Bezeichnung
    "",                // Diktatkürzel
    "1",               // Buchungstyp: 1 = Finanzbuchhaltung
    "0",               // Rechnungslegungszweck
    "0",               // Festschreibung
    "EUR",             // WKZ
    "",                // Derivatskennzeichen
    "",                // SKR
    kontenrahmen,      // Kontierungsfeld
    "",                // Anlagenbuchhaltung
    "",                // Anlagennummer
    "",                // Kostenstelle
  ].join(";");

  // Column headers line
  const colHeaders = [
    "Umsatz (ohne Soll/Haben-Kz)",
    "Soll/Haben-Kennzeichen",
    "WKZ Umsatz",
    "Kurs",
    "Basis-Umsatz",
    "WKZ Basis-Umsatz",
    "Konto",
    "Gegenkonto (ohne BU-Schlüssel)",
    "BU-Schlüssel",
    "Belegdatum",
    "Belegfeld 1",
    "Belegfeld 2",
    "Skonto",
    "Buchungstext",
    "Postensperre",
    "Diverse Adressnummer",
    "Geschäftspartnerbank",
    "Sachverhalt",
    "Zinssperre",
    "Beleglink",
    "Beleginfo - Art 1",
    "Beleginfo - Inhalt 1",
    "Beleginfo - Art 2",
    "Beleginfo - Inhalt 2",
    "Beleginfo - Art 3",
    "Beleginfo - Inhalt 3",
    "Beleginfo - Art 4",
    "Beleginfo - Inhalt 4",
    "Beleginfo - Art 5",
    "Beleginfo - Inhalt 5",
    "Beleginfo - Art 6",
    "Beleginfo - Inhalt 6",
    "Beleginfo - Art 7",
    "Beleginfo - Inhalt 7",
    "Beleginfo - Art 8",
    "Beleginfo - Inhalt 8",
    "Kostenrechnung - Kostenstelle 1",
    "Kostenrechnung - Kostenmenge 1",
    "Kostenrechnung - Kostenstelle 2",
    "Kostenrechnung - Kostenmenge 2",
    "Kostenrechnung - Kostenstelle 3",
    "Kostenrechnung - Kostenmenge 3",
    "KOST1 - Auftragsnummer",
    "KOST2 - Auftragsnummer",
    "Kost-Datum",
    "SEPA-Mandatsreferenz",
    "Skontosperre",
    "Gesellschaftername",
    "Beteiligtennummer",
    "Identifikationsnummer",
    "Zeichnernummer",
    "Postensperre bis",
    "Bezeichnung SoBil-Sachverhalt",
    "Kennzeichen SoBil-Buchung",
    "Festschreibung",
    "Leistungsdatum",
    "Datum Zuord. Steuerperiode",
    "Fälligkeit",
    "Generalumkehr (GU)",
    "Steuersatz",
    "Land",
    "Abrechnungsreferenz",
    "BVV-Position (Betriebsvermögensvergleich)",
    "EU-Land u. UStID",
    "EU-Steuersatz",
  ].map(q).join(";");

  // Data rows
  // Column count: 64 fields (index 0-63)
  // Index 55 = Leistungsdatum, Index 63 = Steuersatz (last field)
  const dataLines = rows.map((r) => {
    const umsatzStr = r.umsatz.toFixed(2).replace(".", ",");
    const fields: string[] = [
      umsatzStr,       // 0  Umsatz
      r.sollHaben,     // 1  Soll/Haben-Kennzeichen
      r.wkz,           // 2  WKZ Umsatz
      "",              // 3  Kurs
      "",              // 4  Basis-Umsatz
      "",              // 5  WKZ Basis-Umsatz
      r.konto,         // 6  Konto
      r.gegenkonto,    // 7  Gegenkonto
      r.buSchluessel,  // 8  BU-Schlüssel
      r.belegdatum,    // 9  Belegdatum
      q(r.belegfeld1), // 10 Belegfeld 1
      "",              // 11 Belegfeld 2
      "",              // 12 Skonto
      q(r.buchungstext), // 13 Buchungstext
      "",              // 14 Postensperre
      "",              // 15 Diverse Adressnummer
      "",              // 16 Geschäftspartnerbank
      "",              // 17 Sachverhalt
      "",              // 18 Zinssperre
      r.beleglink ? q(r.beleglink) : "", // 19 Beleglink
      "", "", "", "", "", "", "", "", "", "", // 20-29 Beleginfo Art/Inhalt 1-5
      "", "", "", "", "", "",               // 30-35 Beleginfo Art/Inhalt 6-8
      "", "", "", "", "", "",               // 36-41 Kostenrechnung Kostenstelle/Kostenmenge 1-3
      "", "",                              // 42-43 KOST1/KOST2-Auftragsnummer
      "",                                  // 44 Kost-Datum
      "",                                  // 45 SEPA-Mandatsreferenz
      "",                                  // 46 Skontosperre
      "",                                  // 47 Gesellschaftername
      "",                                  // 48 Beteiligtennummer
      "",                                  // 49 Identifikationsnummer
      "",                                  // 50 Zeichnernummer
      "",                                  // 51 Postensperre bis
      "",                                  // 52 Bezeichnung SoBil-Sachverhalt
      "",                                  // 53 Kennzeichen SoBil-Buchung
      "",                                  // 54 Festschreibung
      r.leistungsdatum,                    // 55 Leistungsdatum (DDMMYYYY)
      "",                                  // 56 Datum Zuord. Steuerperiode
      "",                                  // 57 Fälligkeit
      "",                                  // 58 Generalumkehr (GU)
      r.steuersatz,                        // 59 Steuersatz
      "",                                  // 60 Land
      "",                                  // 61 Abrechnungsreferenz
      "",                                  // 62 BVV-Position
      "",                                  // 63 EU-Land u. UStID (last)
    ];
    return fields.join(";");
  });

  const csvContent = [headerLine, colHeaders, ...dataLines].join("\r\n");

  // UTF-8 BOM + content
  const BOM = "\uFEFF";
  const fullCsv = BOM + csvContent;

  const filename = `DATEV-Buchungsstapel-${vonDatum}-${bisDatum}.csv`;

  return new NextResponse(fullCsv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
  } catch {
    return NextResponse.json({ error: "DATEV-Export fehlgeschlagen" }, { status: 500 });
  }
}
