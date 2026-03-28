import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const bedarfe = await prisma.kundeBedarf.findMany({
    where: { kundeId: Number(id) },
    include: { artikel: true },
  });
  return NextResponse.json(bedarfe);
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { artikelId, menge, intervallTage, notiz } = await req.json();

  const bedarf = await prisma.kundeBedarf.upsert({
    where: { kundeId_artikelId: { kundeId: Number(id), artikelId } },
    update: { menge, intervallTage, notiz },
    create: { kundeId: Number(id), artikelId, menge, intervallTage, notiz },
    include: { artikel: true },
  });
  return NextResponse.json(bedarf);
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { artikelId } = await req.json();
  await prisma.kundeBedarf.delete({
    where: { kundeId_artikelId: { kundeId: Number(id), artikelId } },
  });
  return NextResponse.json({ ok: true });
}
