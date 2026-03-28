import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const inventuren = await prisma.inventur.findMany({
    orderBy: { datum: "desc" },
    include: {
      _count: { select: { positionen: true } },
    },
  });
  return NextResponse.json(inventuren);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { bezeichnung } = body as { bezeichnung?: string };

  const aktivArtikel = await prisma.artikel.findMany({
    where: { aktiv: true },
    orderBy: { name: "asc" },
  });

  const inventur = await prisma.inventur.create({
    data: {
      bezeichnung: bezeichnung?.trim() || null,
      positionen: {
        create: aktivArtikel.map((a) => ({
          artikelId: a.id,
          sollBestand: a.aktuellerBestand,
        })),
      },
    },
    include: {
      _count: { select: { positionen: true } },
    },
  });

  return NextResponse.json(inventur, { status: 201 });
}
