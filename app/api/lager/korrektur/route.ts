import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { artikelId, neuerBestand, notiz } = await req.json();

  if (!notiz || notiz.trim() === "") {
    return NextResponse.json(
      { error: "Begründung ist Pflichtfeld bei Lagerkorrektur" },
      { status: 400 }
    );
  }

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
}
