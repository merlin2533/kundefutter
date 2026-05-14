import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseYearMonth, parseBisYearMonth } from "@/lib/utils";
export const dynamic = "force-dynamic";

// GET /api/statistik/reklamationen?von=YYYY-MM&bis=YYYY-MM
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const von = searchParams.get("von");
    const bis = searchParams.get("bis");

    const vonDate = parseYearMonth(von);
    const bisDate = parseBisYearMonth(bis);
    const vonIso = vonDate.toISOString();
    const bisIso = bisDate.toISOString();

    const params: unknown[] = [vonIso, bisIso];

    type KatRow = { kategorie: string; anzahl: number };
    type StatusRow = { status: string; anzahl: number };
    type PrioRow = { prioritaet: string; anzahl: number };
    type OffenRow = { offeneAnzahl: number };
    type SummeRow = { anzahl: number };

    const [nachKategorieRaw, nachStatusRaw, nachPrioritaetRaw, offenRaw, summeRaw] =
      await Promise.all([
        prisma.$queryRawUnsafe<KatRow[]>(
          `SELECT
             kategorie,
             COUNT(id) as anzahl
           FROM Reklamation
           WHERE datum >= ? AND datum < ?
           GROUP BY kategorie
           ORDER BY anzahl DESC`,
          ...params
        ),
        prisma.$queryRawUnsafe<StatusRow[]>(
          `SELECT
             status,
             COUNT(id) as anzahl
           FROM Reklamation
           WHERE datum >= ? AND datum < ?
           GROUP BY status
           ORDER BY anzahl DESC`,
          ...params
        ),
        prisma.$queryRawUnsafe<PrioRow[]>(
          `SELECT
             prioritaet,
             COUNT(id) as anzahl
           FROM Reklamation
           WHERE datum >= ? AND datum < ?
           GROUP BY prioritaet
           ORDER BY anzahl DESC`,
          ...params
        ),
        prisma.$queryRawUnsafe<OffenRow[]>(
          `SELECT COUNT(id) as offeneAnzahl
           FROM Reklamation
           WHERE datum >= ? AND datum < ?
             AND status IN ('OFFEN', 'IN_BEARBEITUNG')`,
          ...params
        ),
        prisma.$queryRawUnsafe<SummeRow[]>(
          `SELECT COUNT(id) as anzahl
           FROM Reklamation
           WHERE datum >= ? AND datum < ?`,
          ...params
        ),
      ]);

    return NextResponse.json({
      nachKategorie: nachKategorieRaw.map((r) => ({
        kategorie: r.kategorie,
        anzahl: Number(r.anzahl) || 0,
      })),
      nachStatus: nachStatusRaw.map((r) => ({
        status: r.status,
        anzahl: Number(r.anzahl) || 0,
      })),
      nachPrioritaet: nachPrioritaetRaw.map((r) => ({
        prioritaet: r.prioritaet,
        anzahl: Number(r.anzahl) || 0,
      })),
      offeneAnzahl: Number(offenRaw[0]?.offeneAnzahl) || 0,
      summe: {
        anzahl: Number(summeRaw[0]?.anzahl) || 0,
      },
    });
  } catch (e) {
    console.error("Statistik/Reklamationen API Fehler:", e);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
