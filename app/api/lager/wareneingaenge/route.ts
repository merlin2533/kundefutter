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
  const body = await req.json();
  const { lieferantId, datum, notiz } = body;

  if (!body.lieferantId || !Array.isArray(body.positionen) || body.positionen.length === 0) {
    return NextResponse.json({ error: "lieferantId und positionen erforderlich" }, { status: 400 });
  }
  // Sanitise positionen — only allow known fields
  const positionen = body.positionen.map((p: { artikelId: unknown; menge: unknown; einkaufspreis: unknown; chargeNr?: unknown }) => ({
    artikelId: Number(p.artikelId),
    menge: Number(p.menge),
    einkaufspreis: Number(p.einkaufspreis ?? 0),
    chargeNr: typeof p.chargeNr === "string" ? p.chargeNr : null,
  })).filter((p: { artikelId: number; menge: number; einkaufspreis: number; chargeNr: string | null }) => Number.isInteger(p.artikelId) && p.artikelId > 0 && Number.isFinite(p.menge) && p.menge > 0);

  if (positionen.length === 0) {
    return NextResponse.json({ error: "Keine gültigen Positionen" }, { status: 400 });
  }

  try {
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
      // Einkaufspreis beim Lieferanten aktualisieren + Preishistorie
      const artLief = await tx.artikelLieferant.findFirst({
        where: { artikelId: pos.artikelId, lieferantId },
      });
      if (artLief && artLief.einkaufspreis !== pos.einkaufspreis) {
        await tx.artikelPreisHistorie.create({
          data: {
            artikelId: pos.artikelId,
            alterPreis: artLief.einkaufspreis,
            neuerPreis: pos.einkaufspreis,
            notiz: `Wareneingang #${we.id} — Einkaufspreis aktualisiert`,
          },
        });
      }
      await tx.artikelLieferant.updateMany({
        where: { artikelId: pos.artikelId, lieferantId },
        data: { einkaufspreis: pos.einkaufspreis },
      });
    }

    return we;
  });

  return NextResponse.json(wareneingang, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Fehler beim Speichern des Wareneingangs" }, { status: 500 });
  }
}
