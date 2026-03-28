import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const kategorie = searchParams.get("kategorie");
  const search = searchParams.get("search");
  const aktiv = searchParams.get("aktiv");

  const where: Record<string, unknown> = {};
  if (kategorie) where.kategorie = kategorie;
  if (aktiv !== null) where.aktiv = aktiv === "true";
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { artikelnummer: { contains: search } },
    ];
  }

  const artikel = await prisma.artikel.findMany({
    where,
    include: {
      lieferanten: { include: { lieferant: true } },
      dokumente: true,
    },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(artikel);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { lieferanten, ...data } = body;

  // Auto-Artikelnummer wenn nicht gesetzt
  if (!data.artikelnummer) {
    const count = await prisma.artikel.count();
    data.artikelnummer = `ART-${String(count + 1).padStart(5, "0")}`;
  }

  if (data.mwstSatz !== undefined) data.mwstSatz = Number(data.mwstSatz);
  else data.mwstSatz = 19;

  const artikel = await prisma.artikel.create({
    data: {
      ...data,
      lieferanten: lieferanten?.length
        ? { create: lieferanten }
        : undefined,
    },
    include: {
      lieferanten: { include: { lieferant: true } },
      dokumente: true,
    },
  });
  return NextResponse.json(artikel, { status: 201 });
}
