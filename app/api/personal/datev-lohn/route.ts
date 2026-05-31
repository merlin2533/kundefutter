import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAppName } from "@/lib/appinfo";
import { lohnKonto, lohnGegenkonto } from "@/lib/datev";

export const dynamic = "force-dynamic";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function belegdatum(date: Date): string {
  return `${pad2(date.getDate())}${pad2(date.getMonth() + 1)}`;
}

function leistungsdatumFmt(date: Date): string {
  return `${pad2(date.getDate())}${pad2(date.getMonth() + 1)}${date.getFullYear()}`;
}

function q(val: string): string {
  return `"${val.replace(/"/g, '""')}"`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const vonStr = searchParams.get("von");
  const bisStr = searchParams.get("bis");

  try {
    const appName = await getAppName();

    const einstellungen = await prisma.einstellung.findMany({
      where: {
        key: {
          in: [
            "datev.beraternummer",
            "datev.mandantennummer",
            "datev.sachkontenrahmen",
            "datev.wirtschaftsjahrBeginn",
          ],
        },
      },
    });
    const settMap = Object.fromEntries(einstellungen.map((e) => [e.key, e.value]));
    const beraternummer = settMap["datev.beraternummer"] ?? "0";
    const mandantennummer = settMap["datev.mandantennummer"] ?? "1";
    const kontenrahmen = (settMap["datev.sachkontenrahmen"] ?? "SKR03") as "SKR03" | "SKR04";
    const wjBeginnMonat = parseInt(settMap["datev.wirtschaftsjahrBeginn"] ?? "1", 10);

    const today = new Date();
    const von = vonStr ? new Date(vonStr) : new Date(today.getFullYear(), 0, 1);
    von.setHours(0, 0, 0, 0);
    const bis = bisStr ? new Date(bisStr) : new Date(today.getFullYear(), 11, 31);
    bis.setHours(23, 59, 59, 999);

    const wjStart = new Date(von.getFullYear(), wjBeginnMonat - 1, 1);
    const wjStartStr = wjStart.toISOString().slice(0, 10).replace(/-/g, "");

    const abrechnungen = await prisma.gehaltsabrechnung.findMany({
      where: {
        status: "AUSGEZAHLT",
        zahlungsDatum: { gte: von, lte: bis },
      },
      select: {
        monat: true,
        jahr: true,
        netto: true,
        zahlungsDatum: true,
        mitarbeiter: {
          select: { vorname: true, nachname: true, typ: true, kostenstelle: true },
        },
      },
      orderBy: { zahlungsDatum: "asc" },
      take: 5000,
    });

    const exportDatum = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const vonDatum = von.toISOString().slice(0, 10).replace(/-/g, "");
    const bisDatum = bis.toISOString().slice(0, 10).replace(/-/g, "");

    const headerLine = [
      q("EXTF"), "700", "21", q("Buchungsstapel"), "9",
      exportDatum + "000000", "", q(appName), "", "",
      beraternummer, mandantennummer, wjStartStr, "4",
      vonDatum, bisDatum,
      q(`DATEV-Lohn-Export ${appName}`), "", "1", "0", "0", "EUR",
      "", "", kontenrahmen, "", "", "",
    ].join(";");

    const colHeaders = [
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
    ].map(q).join(";");

    const dataLines = abrechnungen.map((a) => {
      const datum = a.zahlungsDatum!;
      const ma = a.mitarbeiter;
      const buchungstext = `Gehalt ${ma.vorname} ${ma.nachname} ${pad2(a.monat)}/${a.jahr}`.substring(0, 60);
      const fields: string[] = [
        a.netto.toFixed(2).replace(".", ","), // 0  Umsatz
        "H",                                  // 1  Soll/Haben: H = Aufwand
        "EUR",                                // 2  WKZ
        "", "", "",                           // 3-5
        lohnKonto(ma.typ, kontenrahmen),      // 6  Konto (Lohnaufwand)
        lohnGegenkonto(kontenrahmen),          // 7  Gegenkonto (Bank)
        "",                                   // 8  BU-Schlüssel (leer = MwSt-frei)
        belegdatum(datum),                    // 9  Belegdatum
        "",                                   // 10 Belegfeld 1
        "",                                   // 11 Belegfeld 2
        "",                                   // 12 Skonto
        q(buchungstext),                      // 13 Buchungstext
        "",                                   // 14 Postensperre
        "",                                   // 15 Diverse Adressnummer
        "",                                   // 16 Geschäftspartnerbank
        "",                                   // 17 Sachverhalt
        "",                                   // 18 Zinssperre
        "",                                   // 19 Beleglink
        "", "", "", "", "", "", "", "", "", "", // 20-29 Beleginfo 1-5
        "", "", "", "", "", "",               // 30-35 Beleginfo 6-8
        ma.kostenstelle ? q(ma.kostenstelle) : "", // 36 Kostenstelle
        "", "", "", "", "",                   // 37-41
        "", "",                              // 42-43 KOST
        "",                                  // 44 Kost-Datum
        "", "", "", "", "", "", "", "", "", "", // 45-54
        leistungsdatumFmt(datum),            // 55 Leistungsdatum
        "", "", "",                          // 56-58
        "0",                                 // 59 Steuersatz (MwSt-frei)
        "", "", "",                          // 60-62
        "",                                  // 63 EU-Land
      ];
      return fields.join(";");
    });

    const csvContent = [headerLine, colHeaders, ...dataLines].join("\r\n");
    const filename = `DATEV-Lohn-${vonDatum}-${bisDatum}.csv`;

    return new NextResponse("\uFEFF" + csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "DATEV-Lohn-Export fehlgeschlagen" }, { status: 500 });
  }
}
