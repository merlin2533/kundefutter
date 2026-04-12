import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const rabatte = await prisma.mengenrabatt.findMany({
      include: {
        artikel: { select: { id: true, name: true, artikelnummer: true, kategorie: true } },
        kunde: { select: { id: true, name: true, firma: true } },
      },
      orderBy: { id: "desc" },
      take: 200,
    });
    return NextResponse.json(rabatte);
  } catch {
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const { kundeId, artikelId, kategorie, vonMenge, rabattProzent, aktiv } = body;

  if (vonMenge === undefined || vonMenge === null || rabattProzent === undefined || rabattProzent === null) {
    return NextResponse.json({ error: "vonMenge und rabattProzent sind erforderlich" }, { status: 400 });
  }
  if (Number(rabattProzent) < 0 || Number(rabattProzent) > 100) {
    return NextResponse.json({ error: "rabattProzent muss zwischen 0 und 100 liegen" }, { status: 400 });
  }
  if (!artikelId && !kategorie) {
    return NextResponse.json({ error: "Entweder artikelId oder kategorie muss angegeben werden" }, { status: 400 });
  }

  try {
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
  } catch (err) {
    const message = err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id fehlt" }, { status: 400 });
  }
  try {
    await prisma.mengenrabatt.delete({ where: { id: Number(id) } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Mengenrabatt nicht gefunden" }, { status: 404 });
  }
}
