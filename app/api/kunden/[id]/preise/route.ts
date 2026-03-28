import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const preise = await prisma.kundeArtikelPreis.findMany({
    where: { kundeId: Number(id) },
    include: { artikel: true },
  });
  return NextResponse.json(preise);
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { artikelId, preis, rabatt } = await req.json();

  const eintrag = await prisma.kundeArtikelPreis.upsert({
    where: { kundeId_artikelId: { kundeId: Number(id), artikelId } },
    update: { preis, rabatt: rabatt ?? 0 },
    create: { kundeId: Number(id), artikelId, preis, rabatt: rabatt ?? 0 },
    include: { artikel: true },
  });
  return NextResponse.json(eintrag);
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { artikelId } = await req.json();
  await prisma.kundeArtikelPreis.delete({
    where: { kundeId_artikelId: { kundeId: Number(id), artikelId } },
  });
  return NextResponse.json({ ok: true });
}
