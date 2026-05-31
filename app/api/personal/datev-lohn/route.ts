import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAppName } from "@/lib/appinfo";
import {
  lohnKonto,
  lohnGegenkonto,
  datevQ as q,
  datevBelegdatum as belegdatum,
  datevLeistungsdatum as leistungsdatumFmt,
  DATEV_COL_HEADERS,
  buildDatevHeaderLine,
} from "@/lib/datev";

export const dynamic = "force-dynamic";

function pad2(n: number): string { return String(n).padStart(2, "0"); }

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
    const vonDatum = von.toISOString().slice(0, 10).replace(/-/g, "");
    const bisDatum = bis.toISOString().slice(0, 10).replace(/-/g, "");

    // AUSGEZAHLT + ABGERECHNET: beide gehören in die Lohnbuchhaltung
    // Datum-Fallback: letzter Tag des Abrechnungsmonats (für ABGERECHNET ohne zahlungsDatum)
    const abrechnungen = await prisma.gehaltsabrechnung.findMany({
      where: {
        status: { in: ["AUSGEZAHLT", "ABGERECHNET"] },
        OR: [
          { zahlungsDatum: { gte: von, lte: bis } },
          {
            zahlungsDatum: null,
            updatedAt: { gte: von, lte: bis },
          },
        ],
      },
      select: {
        monat: true,
        jahr: true,
        netto: true,
        status: true,
        zahlungsDatum: true,
        mitarbeiter: {
          select: { vorname: true, nachname: true, typ: true, kostenstelle: true },
        },
      },
      orderBy: [{ jahr: "asc" }, { monat: "asc" }],
      take: 5000,
    });

    const headerLine = buildDatevHeaderLine({
      appName,
      beraternummer,
      mandantennummer,
      kontenrahmen,
      wjStartStr,
      vonDatum,
      bisDatum,
      bezeichnung: `DATEV-Lohn-Export ${appName}`,
    });

    const dataLines = abrechnungen.map((a) => {
      // Zahlungsdatum oder letzter Tag des Abrechnungsmonats
      const datum = a.zahlungsDatum ?? new Date(a.jahr, a.monat, 0);
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

    const csvContent = [headerLine, DATEV_COL_HEADERS, ...dataLines].join("\r\n");
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
