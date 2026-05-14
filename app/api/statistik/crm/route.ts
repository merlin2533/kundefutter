import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseYearMonth, parseBisYearMonth } from "@/lib/utils";
export const dynamic = "force-dynamic";

// GET /api/statistik/crm?von=YYYY-MM&bis=YYYY-MM
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const von = searchParams.get("von");
    const bis = searchParams.get("bis");

    const vonDate = parseYearMonth(von);
    const bisDate = parseBisYearMonth(bis);
    const vonIso = vonDate.toISOString();
    const bisIso = bisDate.toISOString();

    type TypRow = { typ: string; anzahl: number };
    type MonatRow = { monat: string; anzahl: number };
    type OffeneRow = { anzahl: number };
    type GesamtRow = { anzahl: number };

    const [nachTypRaw, nachMonatRaw, offeneRaw, gesamtRaw] = await Promise.all([
      prisma.$queryRawUnsafe<TypRow[]>(
        `SELECT
           typ,
           COUNT(id) as anzahl
         FROM KundeAktivitaet
         WHERE datum >= ? AND datum < ?
         GROUP BY typ
         ORDER BY anzahl DESC`,
        vonIso,
        bisIso
      ),
      prisma.$queryRawUnsafe<MonatRow[]>(
        `SELECT
           strftime('%Y-%m', datum) as monat,
           COUNT(id) as anzahl
         FROM KundeAktivitaet
         WHERE datum >= ? AND datum < ?
         GROUP BY monat
         ORDER BY monat`,
        vonIso,
        bisIso
      ),
      prisma.$queryRawUnsafe<OffeneRow[]>(
        `SELECT COUNT(id) as anzahl
         FROM KundeAktivitaet
         WHERE erledigt = 0 AND faelligAm IS NOT NULL`
      ),
      prisma.$queryRawUnsafe<GesamtRow[]>(
        `SELECT COUNT(id) as anzahl
         FROM KundeAktivitaet
         WHERE datum >= ? AND datum < ?`,
        vonIso,
        bisIso
      ),
    ]);

    const nachTyp = nachTypRaw.map((row) => ({
      typ: row.typ,
      anzahl: Number(row.anzahl) || 0,
    }));

    const nachMonat = nachMonatRaw.map((row) => ({
      monat: row.monat,
      anzahl: Number(row.anzahl) || 0,
    }));

    const offeneAufgaben = Number(offeneRaw[0]?.anzahl ?? 0);
    const anzahl = Number(gesamtRaw[0]?.anzahl ?? 0);

    return NextResponse.json({
      nachTyp,
      nachMonat,
      offeneAufgaben,
      summe: { anzahl },
    });
  } catch (e) {
    console.error("Statistik/CRM API Fehler:", e);
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && e instanceof Error ? e.message : "Datenbankfehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
