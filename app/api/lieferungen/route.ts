import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { berechneVerkaufspreis } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const kundeId = searchParams.get("kundeId");
  const status = searchParams.get("status");
  const von = searchParams.get("von");
  const bis = searchParams.get("bis");
  const search = searchParams.get("search");

  const where: Record<string, unknown> = {};
  if (kundeId) where.kundeId = Number(kundeId);
  if (status) where.status = status;
  if (search) {
    where.kunde = {
      OR: [
        { name: { contains: search } },
        { firma: { contains: search } },
      ],
    };
  }
  if (von || bis) {
    where.datum = {
      ...(von && { gte: new Date(von) }),
      ...(bis && { lte: new Date(bis) }),
    };
  }

  const lieferungen = await prisma.lieferung.findMany({
    where,
    include: {
      kunde: true,
      positionen: { include: { artikel: true } },
    },
    orderBy: { datum: "desc" },
    take: 200,
  });
  return NextResponse.json(lieferungen);
}

export async function POST(req: NextRequest) {
  const { kundeId, datum, notiz, positionen, wiederkehrend } = await req.json();

  // Verkaufspreise + Einkaufspreise automatisch befüllen falls nicht übergeben
  const angereichert = await Promise.all(
    positionen.map(async (pos: { artikelId: number; menge: number; verkaufspreis?: number; einkaufspreis?: number }) => {
      const artikel = await prisma.artikel.findUnique({ where: { id: pos.artikelId } });
      const kundePreis = await prisma.kundeArtikelPreis.findUnique({
        where: { kundeId_artikelId: { kundeId, artikelId: pos.artikelId } },
      });
      const bevorzugterLieferant = await prisma.artikelLieferant.findFirst({
        where: { artikelId: pos.artikelId, bevorzugt: true },
      });

      return {
        artikelId: pos.artikelId,
        menge: pos.menge,
        verkaufspreis: pos.verkaufspreis ?? berechneVerkaufspreis(artikel!, kundePreis),
        einkaufspreis: pos.einkaufspreis ?? bevorzugterLieferant?.einkaufspreis ?? 0,
      };
    })
  );

  const lieferung = await prisma.lieferung.create({
    data: {
      kundeId,
      datum: datum ? new Date(datum) : new Date(),
      notiz,
      wiederkehrend: wiederkehrend ?? false,
      positionen: { create: angereichert },
    },
    include: {
      kunde: true,
      positionen: { include: { artikel: true } },
    },
  });
  return NextResponse.json(lieferung, { status: 201 });
}
