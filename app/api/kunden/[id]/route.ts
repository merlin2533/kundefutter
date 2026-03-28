import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const kunde = await prisma.kunde.findUnique({
    where: { id: Number(id) },
    include: {
      kontakte: true,
      bedarfe: { include: { artikel: true } },
      artikelPreise: { include: { artikel: true } },
      lieferungen: {
        include: { positionen: { include: { artikel: true } } },
        orderBy: { datum: "desc" },
        take: 100,
      },
    },
  });
  if (!kunde) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  return NextResponse.json(kunde);
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const { kontakte, ...data } = body;

  const kunde = await prisma.kunde.update({
    where: { id: Number(id) },
    data: {
      ...data,
      ...(kontakte !== undefined && {
        kontakte: {
          deleteMany: {},
          create: kontakte,
        },
      }),
    },
    include: { kontakte: true },
  });
  return NextResponse.json(kunde);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  await prisma.kunde.update({
    where: { id: Number(id) },
    data: { aktiv: false },
  });
  return NextResponse.json({ ok: true });
}
