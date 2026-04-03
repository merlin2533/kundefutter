import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ kunden: [], artikel: [], lieferungen: [] });

  // Lieferung search stays as Prisma contains (rechnungNr is already indexed)
  const lieferungenPromise = prisma.lieferung.findMany({
    where: {
      OR: [
        { rechnungNr: { contains: q } },
        { kunde: { name: { contains: q } } },
        { kunde: { firma: { contains: q } } },
      ],
    },
    select: {
      id: true,
      datum: true,
      status: true,
      rechnungNr: true,
      kunde: { select: { name: true, firma: true } },
    },
    orderBy: { datum: "desc" },
    take: 5,
  });

  // Try FTS5 for Kunden and Artikel; fall back to contains if tables don't exist yet
  try {
    const ftsQuery = q + "*";

    const [kundenFts, artikelFts, lieferungen] = await Promise.all([
      prisma.$queryRawUnsafe<
        { id: number; name: string; firma: string | null; plz: string | null; ort: string | null }[]
      >(
        `SELECT k.id, k.name, k.firma, k.plz, k.ort
         FROM kunden_fts f
         JOIN Kunde k ON k.id = f.rowid
         WHERE kunden_fts MATCH ? AND k.aktiv = 1
         ORDER BY rank
         LIMIT 5`,
        ftsQuery
      ),
      prisma.$queryRawUnsafe<
        { id: number; name: string; artikelnummer: string; kategorie: string }[]
      >(
        `SELECT a.id, a.name, a.artikelnummer, a.kategorie
         FROM artikel_fts f
         JOIN Artikel a ON a.id = f.rowid
         WHERE artikel_fts MATCH ? AND a.aktiv = 1
         ORDER BY rank
         LIMIT 5`,
        ftsQuery
      ),
      lieferungenPromise,
    ]);

    return NextResponse.json({ kunden: kundenFts, artikel: artikelFts, lieferungen });
  } catch {
    // FTS5 tables not available yet — fall back to original contains-based search
    const [kunden, artikel, lieferungen] = await Promise.all([
      prisma.kunde.findMany({
        where: {
          aktiv: true,
          OR: [
            { name: { contains: q } },
            { firma: { contains: q } },
            { plz: { contains: q } },
          ],
        },
        select: { id: true, name: true, firma: true, plz: true, ort: true },
        take: 5,
      }),
      prisma.artikel.findMany({
        where: {
          aktiv: true,
          OR: [
            { name: { contains: q } },
            { artikelnummer: { contains: q } },
            { kategorie: { contains: q } },
            { inhaltsstoffe: { some: { name: { contains: q } } } },
          ],
        },
        select: { id: true, name: true, artikelnummer: true, kategorie: true },
        take: 5,
      }),
      lieferungenPromise,
    ]);

    return NextResponse.json({ kunden, artikel, lieferungen });
  }
}
