import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const aktiv = searchParams.get("aktiv");
  const search = searchParams.get("search");
  const karte = searchParams.get("karte"); // nur Kunden mit Koordinaten

  const where: Record<string, unknown> = {};
  if (aktiv !== null) where.aktiv = aktiv === "true";
  if (karte === "true") {
    where.lat = { not: null };
    where.lng = { not: null };
  }
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { firma: { contains: search } },
      { ort: { contains: search } },
      { plz: { contains: search } },
    ];
  }

  const kunden = await prisma.kunde.findMany({
    where,
    include: { kontakte: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(kunden);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { kontakte, ...data } = body;

  const kunde = await prisma.kunde.create({
    data: {
      ...data,
      kontakte: kontakte?.length
        ? { create: kontakte }
        : undefined,
    },
    include: { kontakte: true },
  });
  return NextResponse.json(kunde, { status: 201 });
}
