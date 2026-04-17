import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const lieferungId = parseInt(id, 10);
  if (isNaN(lieferungId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const { artikelId, menge, verkaufspreis, einkaufspreis, chargeNr } = body;

  if (!artikelId || typeof artikelId !== "number") {
    return NextResponse.json({ error: "artikelId fehlt" }, { status: 400 });
  }
  const mengeNum = Number(menge);
  if (isNaN(mengeNum) || mengeNum <= 0) {
    return NextResponse.json({ error: "Menge ungültig" }, { status: 400 });
  }

  try {
    const lieferung = await prisma.lieferung.findUnique({
      where: { id: lieferungId },
      select: { status: true },
    });
    if (!lieferung) return NextResponse.json({ error: "Lieferung nicht gefunden" }, { status: 404 });
    if (lieferung.status !== "geplant") {
      return NextResponse.json({ error: "Positionen können nur bei geplanten Lieferungen bearbeitet werden" }, { status: 400 });
    }

    const artikel = await prisma.artikel.findUnique({
      where: { id: artikelId },
      include: { lieferanten: { take: 1, orderBy: { createdAt: "asc" } } },
    });
    if (!artikel) return NextResponse.json({ error: "Artikel nicht gefunden" }, { status: 404 });

    const vk = verkaufspreis !== undefined ? Number(verkaufspreis) : artikel.standardpreis;
    const ek = einkaufspreis !== undefined ? Number(einkaufspreis) : (artikel.lieferanten[0]?.einkaufspreis ?? 0);

    const pos = await prisma.lieferposition.create({
      data: {
        lieferungId,
        artikelId,
        menge: mengeNum,
        verkaufspreis: vk,
        einkaufspreis: ek,
        chargeNr: chargeNr ?? null,
      },
      include: { artikel: true },
    });
    return NextResponse.json(pos, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
