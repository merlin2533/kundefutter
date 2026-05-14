import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

// GET /api/statistik/kunden?von=YYYY-MM&bis=YYYY-MM&kategorie=Landwirt
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const von = searchParams.get("von");
    const bis = searchParams.get("bis");
    const kategorie = searchParams.get("kategorie");

    const vonDate = von
      ? (() => { const d = new Date(`${von}-01T00:00:00.000Z`); return isNaN(d.getTime()) ? new Date("2024-01-01T00:00:00.000Z") : d; })()
      : new Date("2024-01-01T00:00:00.000Z");
    const bisDate = bis
      ? (() => {
          const parts = bis.split("-").map(Number);
          if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return new Date();
          return new Date(parts[0], parts[1], 1);
        })()
      : new Date();
    const vonIso = vonDate.toISOString();
    const bisIso = bisDate.toISOString();

    type Row = {
      kundeId: number; name: string; firma: string | null; kategorie: string | null;
      umsatz: number | null; marge: number | null; anzahl: number; letzteLieferung: string | null;
    };
    type KatRow = { kategorie: string | null };

    const katFilter = kategorie && kategorie !== "alle";
    const params: unknown[] = [vonIso, bisIso];
    let where = `l.status = 'geliefert' AND l.datum >= ? AND l.datum < ?`;
    if (katFilter) { where += ` AND k.kategorie = ?`; params.push(kategorie); }

    const [zeilen, katsRaw] = await Promise.all([
      prisma.$queryRawUnsafe<Row[]>(
        `SELECT
           k.id as kundeId, k.name, k.firma, k.kategorie,
           CAST(SUM(lp.menge * lp.verkaufspreis) AS REAL) as umsatz,
           CAST(SUM(lp.menge * (lp.verkaufspreis - lp.einkaufspreis)) AS REAL) as marge,
           COUNT(DISTINCT l.id) as anzahl,
           MAX(l.datum) as letzteLieferung
         FROM Kunde k
         JOIN Lieferung l ON l.kundeId = k.id
         JOIN Lieferposition lp ON lp.lieferungId = l.id
         WHERE ${where}
         GROUP BY k.id, k.name, k.firma, k.kategorie
         ORDER BY umsatz DESC
         LIMIT 200`,
        ...params
      ),
      prisma.$queryRawUnsafe<KatRow[]>(
        `SELECT DISTINCT kategorie FROM Kunde WHERE kategorie IS NOT NULL AND kategorie != '' ORDER BY kategorie`
      ),
    ]);

    const r2 = (n: number | null | undefined) => Math.round((n ?? 0) * 100) / 100;
    const kunden = zeilen.map((z) => {
      const umsatz = r2(z.umsatz);
      const marge = r2(z.marge);
      return {
        kundeId: z.kundeId,
        name: z.name,
        firma: z.firma,
        kategorie: z.kategorie,
        umsatz,
        marge,
        margeProzent: umsatz > 0 ? Math.round((marge / umsatz) * 1000) / 10 : 0,
        anzahlLieferungen: Number(z.anzahl) || 0,
        letzteLieferung: z.letzteLieferung,
      };
    });

    return NextResponse.json({
      kunden,
      kategorien: katsRaw.map((k) => k.kategorie).filter((k): k is string => !!k),
      summe: {
        umsatz: r2(kunden.reduce((s, k) => s + k.umsatz, 0)),
        marge: r2(kunden.reduce((s, k) => s + k.marge, 0)),
        anzahlKunden: kunden.length,
      },
    });
  } catch (e) {
    console.error("Statistik/Kunden API Fehler:", e);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
