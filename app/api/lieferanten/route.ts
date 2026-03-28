import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search");

  const where: Record<string, unknown> = { aktiv: true };
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { ort: { contains: search } },
    ];
  }

  const lieferanten = await prisma.lieferant.findMany({
    where,
    include: {
      artikelZuordnungen: { include: { artikel: true } },
    },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(lieferanten);
}

export async function POST(req: NextRequest) {
  const data = await req.json();
  const lieferant = await prisma.lieferant.create({ data });
  return NextResponse.json(lieferant, { status: 201 });
}
