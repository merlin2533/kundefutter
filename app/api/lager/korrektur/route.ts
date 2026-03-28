import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const artikelId = Number(body.artikelId);
  const neuerBestand = Number(body.neuerBestand);
  const { notiz } = body;

  if (!Number.isInteger(artikelId) || artikelId <= 0) {
    return NextResponse.json({ error: "Ungültige artikelId" }, { status: 400 });
  }
  if (!Number.isFinite(neuerBestand)) {
    return NextResponse.json({ error: "neuerBestand muss eine Zahl sein" }, { status: 400 });
  }
  if (neuerBestand < 0) {
    return NextResponse.json({ error: "Lagerbestand kann nicht negativ sein" }, { status: 400 });
  }

  if (!notiz || notiz.trim() === "") {
    return NextResponse.json(
      { error: "Begründung ist bei Korrekturen Pflicht" },
      { status: 400 }
    );
  }

  try {
  const result = await prisma.$transaction(async (tx) => {
    const artikel = await tx.artikel.findUnique({ where: { id: artikelId } });
    if (!artikel) throw new Error("Artikel nicht gefunden");

    const diff = neuerBestand - artikel.aktuellerBestand;
    await tx.artikel.update({
      where: { id: artikelId },
      data: { aktuellerBestand: neuerBestand },
    });
    const bewegung = await tx.lagerbewegung.create({
      data: {
        artikelId,
        typ: "korrektur",
        menge: diff,
        bestandNach: neuerBestand,
        notiz,
      },
    });
    return { artikel: { ...artikel, aktuellerBestand: neuerBestand }, bewegung };
  });

  return NextResponse.json(result, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Fehler beim Buchen der Korrektur" }, { status: 500 });
  }
}
