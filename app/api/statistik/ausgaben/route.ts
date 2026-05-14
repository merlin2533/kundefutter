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

    type KatRow = {
      kategorie: string;
      netto: number | null;
      brutto: number | null;
    };
    type MonatRow = {
      monat: string;
      brutto: number | null;
    };
    type SummeRow = {
      netto: number | null;
      brutto: number | null;
      anzahl: number;
    };

    const [nachKategorieRaw, nachMonatRaw, summeRaw] = await Promise.all([
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
        vonIso,
        bisIso
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
        vonIso,
        bisIso
      ),
      prisma.$queryRawUnsafe<SummeRow[]>(
        `SELECT
           CAST(SUM(betragNetto) AS REAL)                                AS netto,
           CAST(SUM(betragNetto * (1.0 + mwstSatz / 100.0)) AS REAL)    AS brutto,
           COUNT(*) AS anzahl
         FROM Ausgabe
         WHERE datum >= ? AND datum < ?`,
        vonIso,
        bisIso
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

    return NextResponse.json({
      nachKategorie,
      nachMonat,
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
