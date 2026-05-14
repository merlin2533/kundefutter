import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseYearMonth, parseBisYearMonth } from "@/lib/utils";
export const dynamic = "force-dynamic";

// GET /api/statistik/artikel?von=YYYY-MM&bis=YYYY-MM&kategorie=Futter
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const von = searchParams.get("von");
    const bis = searchParams.get("bis");
    const kategorie = searchParams.get("kategorie");

    const vonDate = parseYearMonth(von);
    const bisDate = parseBisYearMonth(bis);
    const vonIso = vonDate.toISOString();
    const bisIso = bisDate.toISOString();

    type Row = {
      artikelId: number; name: string; kategorie: string | null; einheit: string | null;
      menge: number | null; umsatz: number | null; marge: number | null; anzahl: number;
    };
    type KatRow = { kategorie: string | null };

    const katFilter = kategorie && kategorie !== "alle";
    const params: unknown[] = [vonIso, bisIso];
    let where = `l.status = 'geliefert' AND l.datum >= ? AND l.datum < ?`;
    if (katFilter) { where += ` AND a.kategorie = ?`; params.push(kategorie); }

    const [zeilen, katsRaw] = await Promise.all([
      prisma.$queryRawUnsafe<Row[]>(
        `SELECT
           a.id as artikelId, a.name, a.kategorie, a.einheit,
           CAST(SUM(lp.menge) AS REAL) as menge,
           CAST(SUM(lp.menge * lp.verkaufspreis) AS REAL) as umsatz,
           CAST(SUM(lp.menge * (lp.verkaufspreis - lp.einkaufspreis)) AS REAL) as marge,
           COUNT(DISTINCT l.id) as anzahl
         FROM Artikel a
         JOIN Lieferposition lp ON lp.artikelId = a.id
         JOIN Lieferung l ON l.id = lp.lieferungId
         WHERE ${where}
         GROUP BY a.id, a.name, a.kategorie, a.einheit
         ORDER BY umsatz DESC
         LIMIT 200`,
        ...params
      ),
      prisma.$queryRawUnsafe<KatRow[]>(
        `SELECT DISTINCT kategorie FROM Artikel WHERE kategorie IS NOT NULL AND kategorie != '' ORDER BY kategorie`
      ),
    ]);

    const r2 = (n: number | null | undefined) => Math.round((n ?? 0) * 100) / 100;
    const artikel = zeilen.map((z) => {
      const umsatz = r2(z.umsatz);
      const marge = r2(z.marge);
      return {
        artikelId: z.artikelId,
        name: z.name,
        kategorie: z.kategorie,
        einheit: z.einheit,
        menge: r2(z.menge),
        umsatz,
        marge,
        margeProzent: umsatz > 0 ? Math.round((marge / umsatz) * 1000) / 10 : 0,
        anzahlLieferungen: Number(z.anzahl) || 0,
      };
    });

    return NextResponse.json({
      artikel,
      kategorien: katsRaw.map((k) => k.kategorie).filter((k): k is string => !!k),
      summe: {
        umsatz: r2(artikel.reduce((s, a) => s + a.umsatz, 0)),
        marge: r2(artikel.reduce((s, a) => s + a.marge, 0)),
        anzahlArtikel: artikel.length,
      },
    });
  } catch (e) {
    console.error("Statistik/Artikel API Fehler:", e);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
