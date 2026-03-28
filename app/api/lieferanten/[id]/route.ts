import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const lieferant = await prisma.lieferant.findUnique({
    where: { id: Number(id) },
    include: {
      artikelZuordnungen: { include: { artikel: true } },
      wareneingaenge: {
        include: { positionen: { include: { artikel: true } } },
        orderBy: { datum: "desc" },
        take: 20,
      },
    },
  });
  if (!lieferant) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  return NextResponse.json(lieferant);
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const data = await req.json();
  const lieferant = await prisma.lieferant.update({
    where: { id: Number(id) },
    data,
  });
  return NextResponse.json(lieferant);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  await prisma.lieferant.update({ where: { id: Number(id) }, data: { aktiv: false } });
  return NextResponse.json({ ok: true });
}
