import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseYearMonth, parseBisYearMonth } from "@/lib/utils";
export const dynamic = "force-dynamic";

// GET /api/statistik/lieferanten?von=YYYY-MM&bis=YYYY-MM
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const von = searchParams.get("von");
    const bis = searchParams.get("bis");

    const vonDate = parseYearMonth(von);
    const bisDate = parseBisYearMonth(bis);
    const vonIso = vonDate.toISOString();
    const bisIso = bisDate.toISOString();

    type LieferantRow = {
      lieferantId: number;
      name: string;
      anzahl: number;
      summe: number | null;
      offen: number | null;
    };
    type StatusRow = {
      status: string;
      anzahl: number;
      summe: number | null;
    };
    type SummeRow = {
      anzahl: number;
      betrag: number | null;
      offen: number | null;
    };

    const params: unknown[] = [vonIso, bisIso];

    const [lieferantenRaw, nachStatusRaw, summeRaw] = await Promise.all([
      prisma.$queryRawUnsafe<LieferantRow[]>(
        `SELECT
           er.lieferantId,
           l.name,
           COUNT(er.id) as anzahl,
           CAST(SUM(er.betrag) AS REAL) as summe,
           CAST(SUM(CASE WHEN er.status = 'OFFEN' THEN er.betrag ELSE 0 END) AS REAL) as offen
         FROM EingangsRechnung er
         JOIN Lieferant l ON l.id = er.lieferantId
         WHERE er.datum >= ? AND er.datum < ?
         GROUP BY er.lieferantId, l.name
         ORDER BY summe DESC
         LIMIT 200`,
        ...params
      ),
      prisma.$queryRawUnsafe<StatusRow[]>(
        `SELECT
           status,
           COUNT(id) as anzahl,
           CAST(SUM(betrag) AS REAL) as summe
         FROM EingangsRechnung
         WHERE datum >= ? AND datum < ?
         GROUP BY status
         ORDER BY summe DESC`,
        ...params
      ),
      prisma.$queryRawUnsafe<SummeRow[]>(
        `SELECT
           COUNT(id) as anzahl,
           CAST(SUM(betrag) AS REAL) as betrag,
           CAST(SUM(CASE WHEN status = 'OFFEN' THEN betrag ELSE 0 END) AS REAL) as offen
         FROM EingangsRechnung
         WHERE datum >= ? AND datum < ?`,
        ...params
      ),
    ]);

    const r2 = (n: number | null | undefined) => Math.round((n ?? 0) * 100) / 100;

    const lieferanten = lieferantenRaw.map((z) => ({
      lieferantId: z.lieferantId,
      name: z.name,
      anzahl: Number(z.anzahl) || 0,
      summe: r2(z.summe),
      offen: r2(z.offen),
    }));

    const nachStatus = nachStatusRaw.map((z) => ({
      status: z.status,
      anzahl: Number(z.anzahl) || 0,
      summe: r2(z.summe),
    }));

    const s = summeRaw[0];
    return NextResponse.json({
      lieferanten,
      nachStatus,
      summe: {
        anzahl: Number(s?.anzahl) || 0,
        betrag: r2(s?.betrag),
        offen: r2(s?.offen),
      },
    });
  } catch (e) {
    console.error("Statistik/Lieferanten API Fehler:", e);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
