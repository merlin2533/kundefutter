import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

/** Revenue account by VAT rate (SKR03) */
function gegenkonto(mwstSatz: number, kontenrahmen: string): string {
  // SKR03 defaults; SKR04 uses different accounts
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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const vonStr = searchParams.get("von");
  const bisStr = searchParams.get("bis");

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

  // Query invoiced deliveries in range
  const lieferungen = await prisma.lieferung.findMany({
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
  });

  // Build DATEV data rows
  // Group invoice positions by VAT rate per invoice
  interface DatevRow {
    umsatz: number;      // Brutto
    sollHaben: string;   // S
    wkz: string;         // EUR
    konto: string;       // debtor: 10000 + kundeId
    gegenkonto: string;  // revenue account
    buSchluessel: string;
    belegdatum: string;  // DDMM
    belegfeld1: string;  // rechnungNr
    buchungstext: string; // Kundenname
  }

  const rows: DatevRow[] = [];

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
        gegenkonto: gegenkonto(satz, kontenrahmen),
        buSchluessel: "",
        belegdatum: belegdatum(rechnungDatum),
        belegfeld1: lief.rechnungNr ?? "",
        buchungstext: kundeName.substring(0, 60),
      });
    }
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
    q("AgrarOffice"),  // Herkunft
    "",                // Exportiert von
    "",                // Importiert von
    beraternummer,     // Beraternummer
    mandantennummer,   // Mandantennummer
    wjStartStr,        // WJ-Beginn (YYYYMMDD)
    "4",               // Sachkontenlänge
    vonDatum,          // Datum von
    bisDatum,          // Datum bis
    q("DATEV-Export AgrarOffice"), // Bezeichnung
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
  const dataLines = rows.map((r) => {
    const umsatzStr = r.umsatz.toFixed(2).replace(".", ",");
    return [
      umsatzStr,
      r.sollHaben,
      r.wkz,
      "", // Kurs
      "", // Basis-Umsatz
      "", // WKZ Basis-Umsatz
      r.konto,
      r.gegenkonto,
      r.buSchluessel,
      r.belegdatum,
      q(r.belegfeld1),
      "", // Belegfeld 2
      "", // Skonto
      q(r.buchungstext),
      // remaining 50 empty fields
      ...Array(50).fill(""),
    ].join(";");
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
}
