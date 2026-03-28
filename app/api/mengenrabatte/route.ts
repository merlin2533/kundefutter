import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const rabatte = await prisma.mengenrabatt.findMany({
    include: {
      artikel: { select: { id: true, name: true, artikelnummer: true, kategorie: true } },
      kunde: { select: { id: true, name: true, firma: true } },
    },
    orderBy: { id: "desc" },
  });
  return NextResponse.json(rabatte);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { kundeId, artikelId, kategorie, vonMenge, rabattProzent, aktiv } = body;

  if (!vonMenge || !rabattProzent) {
    return NextResponse.json({ error: "vonMenge und rabattProzent sind erforderlich" }, { status: 400 });
  }
  if (!artikelId && !kategorie) {
    return NextResponse.json({ error: "Entweder artikelId oder kategorie muss angegeben werden" }, { status: 400 });
  }

  const rabatt = await prisma.mengenrabatt.create({
    data: {
      kundeId: kundeId ? Number(kundeId) : null,
      artikelId: artikelId ? Number(artikelId) : null,
      kategorie: artikelId ? null : kategorie,
      vonMenge: Number(vonMenge),
      rabattProzent: Number(rabattProzent),
      aktiv: aktiv !== undefined ? Boolean(aktiv) : true,
    },
    include: {
      artikel: { select: { id: true, name: true, artikelnummer: true, kategorie: true } },
      kunde: { select: { id: true, name: true, firma: true } },
    },
  });
  return NextResponse.json(rabatt, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id fehlt" }, { status: 400 });
  }
  await prisma.mengenrabatt.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
