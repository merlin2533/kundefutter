import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ kunden: [], artikel: [], lieferungen: [] });

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
        ],
      },
      select: { id: true, name: true, artikelnummer: true, kategorie: true },
      take: 5,
    }),
    prisma.lieferung.findMany({
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
    }),
  ]);

  return NextResponse.json({ kunden, artikel, lieferungen });
}
