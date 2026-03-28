import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lieferantId = searchParams.get("lieferantId");

  const wareneingaenge = await prisma.wareneingang.findMany({
    where: lieferantId ? { lieferantId: Number(lieferantId) } : undefined,
    include: {
      lieferant: true,
      positionen: { include: { artikel: true } },
    },
    orderBy: { datum: "desc" },
    take: 100,
  });
  return NextResponse.json(wareneingaenge);
}

export async function POST(req: NextRequest) {
  const { lieferantId, datum, notiz, positionen } = await req.json();

  const wareneingang = await prisma.$transaction(async (tx) => {
    const we = await tx.wareneingang.create({
      data: {
        lieferantId,
        datum: datum ? new Date(datum) : new Date(),
        notiz,
        positionen: { create: positionen },
      },
      include: { positionen: { include: { artikel: true } } },
    });

    // Bestand erhöhen + Lagerbewegung anlegen
    for (const pos of we.positionen) {
      const artikel = await tx.artikel.findUnique({ where: { id: pos.artikelId } });
      if (!artikel) continue;
      const neuerBestand = artikel.aktuellerBestand + pos.menge;
      await tx.artikel.update({
        where: { id: pos.artikelId },
        data: { aktuellerBestand: neuerBestand },
      });
      await tx.lagerbewegung.create({
        data: {
          artikelId: pos.artikelId,
          typ: "eingang",
          menge: pos.menge,
          bestandNach: neuerBestand,
          wareneingangId: we.id,
          notiz: `Wareneingang von ${we.id}`,
        },
      });
      // Einkaufspreis beim Lieferanten aktualisieren (optional)
      await tx.artikelLieferant.updateMany({
        where: { artikelId: pos.artikelId, lieferantId },
        data: { einkaufspreis: pos.einkaufspreis },
      });
    }

    return we;
  });

  return NextResponse.json(wareneingang, { status: 201 });
}
