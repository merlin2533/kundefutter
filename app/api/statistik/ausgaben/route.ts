import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseYearMonth, parseBisYearMonth } from "@/lib/utils";
export const dynamic = "force-dynamic";

// GET /api/statistik/ausgaben?von=YYYY-MM&bis=YYYY-MM
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const von = searchParams.get("von");
    const bis = searchParams.get("bis");

    const vonDate = parseYearMonth(von);
    const bisDate = parseBisYearMonth(bis);
    const vonIso = vonDate.toISOString();
    const bisIso = bisDate.toISOString();

    type KatRow = { kategorie: string; netto: number | null; brutto: number | null };
    type MonatRow = { monat: string; brutto: number | null };
    type SummeRow = { netto: number | null; brutto: number | null; anzahl: number };
    type BuchtypRow = { buchungstyp: string; netto: number | null; brutto: number | null; anzahl: number };
    type ReiseRow = { totalKm: number | null; totalPauschale: number | null };

    const [nachKategorieRaw, nachMonatRaw, summeRaw, nachBuchungstypRaw, reiseSummaryRaw] = await Promise.all([
      prisma.$queryRawUnsafe<KatRow[]>(
        `SELECT
           kategorie,
           CAST(SUM(betragNetto) AS REAL)                                AS netto,
           CAST(SUM(betragNetto * (1.0 + mwstSatz / 100.0)) AS REAL)    AS brutto
         FROM Ausgabe
         WHERE datum >= ? AND datum < ?
         GROUP BY kategorie
         ORDER BY brutto DESC
         LIMIT 100`,
        vonIso, bisIso
      ),
      prisma.$queryRawUnsafe<MonatRow[]>(
        `SELECT
           strftime('%Y-%m', datum) AS monat,
           CAST(SUM(betragNetto * (1.0 + mwstSatz / 100.0)) AS REAL) AS brutto
         FROM Ausgabe
         WHERE datum >= ? AND datum < ?
         GROUP BY monat
         ORDER BY monat ASC
         LIMIT 120`,
        vonIso, bisIso
      ),
      prisma.$queryRawUnsafe<SummeRow[]>(
        `SELECT
           CAST(SUM(betragNetto) AS REAL)                                AS netto,
           CAST(SUM(betragNetto * (1.0 + mwstSatz / 100.0)) AS REAL)    AS brutto,
           COUNT(*) AS anzahl
         FROM Ausgabe
         WHERE datum >= ? AND datum < ?`,
        vonIso, bisIso
      ),
      prisma.$queryRawUnsafe<BuchtypRow[]>(
        `SELECT
           COALESCE(buchungstyp, 'Betriebsausgabe') AS buchungstyp,
           CAST(SUM(betragNetto) AS REAL)                             AS netto,
           CAST(SUM(betragNetto * (1.0 + mwstSatz / 100.0)) AS REAL) AS brutto,
           COUNT(*) AS anzahl
         FROM Ausgabe
         WHERE datum >= ? AND datum < ?
         GROUP BY buchungstyp
         ORDER BY brutto DESC`,
        vonIso, bisIso
      ),
      prisma.$queryRawUnsafe<ReiseRow[]>(
        `SELECT
           CAST(SUM(reiseKm) AS REAL) AS totalKm,
           CAST(SUM(CASE WHEN reiseKilometerpauschale = 1 THEN betragNetto ELSE 0 END) AS REAL) AS totalPauschale
         FROM Ausgabe
         WHERE buchungstyp = 'Reisekosten' AND datum >= ? AND datum < ?`,
        vonIso, bisIso
      ),
    ]);

    const r2 = (n: number | null | undefined) => Math.round((n ?? 0) * 100) / 100;

    const s = summeRaw[0];
    const gesamtBrutto = r2(s?.brutto);

    const nachKategorie = nachKategorieRaw.map((k) => {
      const brutto = r2(k.brutto);
      return {
        kategorie: k.kategorie,
        netto: r2(k.netto),
        brutto,
        anteilProzent:
          gesamtBrutto > 0
            ? Math.round((brutto / gesamtBrutto) * 1000) / 10
            : 0,
      };
    });

    const nachMonat = nachMonatRaw.map((m) => ({
      monat: m.monat,
      brutto: r2(m.brutto),
    }));

    const nachBuchungstyp = nachBuchungstypRaw.map(b => ({
      buchungstyp: b.buchungstyp,
      netto: r2(b.netto),
      brutto: r2(b.brutto),
      anzahl: Number(b.anzahl),
    }));

    const rr = reiseSummaryRaw[0];

    return NextResponse.json({
      nachKategorie,
      nachMonat,
      nachBuchungstyp,
      reisekosten: {
        totalKm: r2(rr?.totalKm),
        totalPauschale: r2(rr?.totalPauschale),
      },
      summe: {
        netto: r2(s?.netto),
        brutto: gesamtBrutto,
        anzahl: Number(s?.anzahl) || 0,
      },
    });
  } catch (e) {
    console.error("Statistik/Ausgaben API Fehler:", e);
    const isDev = process.env.NODE_ENV === "development";
    const msg =
      isDev && e instanceof Error ? e.message : "Datenbankfehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
