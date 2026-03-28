import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const bewegungen = await prisma.lagerbewegung.findMany({
    where: { typ: "UMBUCHUNG" },
    include: {
      artikel: { select: { id: true, name: true, einheit: true } },
    },
    orderBy: { datum: "desc" },
    take: 50,
  });
  return NextResponse.json(bewegungen);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { artikelId, menge, vonLagerort, nachLagerort, bemerkung } = body;

  if (!artikelId) {
    return NextResponse.json({ error: "artikelId ist erforderlich" }, { status: 400 });
  }
  if (!menge || Number(menge) <= 0) {
    return NextResponse.json({ error: "Menge muss größer als 0 sein" }, { status: 400 });
  }
  if (!vonLagerort || !vonLagerort.trim()) {
    return NextResponse.json({ error: "Von-Lagerort ist erforderlich" }, { status: 400 });
  }
  if (!nachLagerort || !nachLagerort.trim()) {
    return NextResponse.json({ error: "Nach-Lagerort ist erforderlich" }, { status: 400 });
  }
  if (vonLagerort.trim() === nachLagerort.trim()) {
    return NextResponse.json({ error: "Von- und Nach-Lagerort dürfen nicht gleich sein" }, { status: 400 });
  }

  const artikel = await prisma.artikel.findUnique({ where: { id: Number(artikelId) } });
  if (!artikel) {
    return NextResponse.json({ error: "Artikel nicht gefunden" }, { status: 404 });
  }

  // Create ONE Lagerbewegung with typ=UMBUCHUNG, menge=0 (no net change to total stock)
  // We store the transfer quantity in the notiz field for display purposes
  const notizText = bemerkung
    ? `${Number(menge)} ${artikel.einheit} umgebucht – ${bemerkung}`
    : `${Number(menge)} ${artikel.einheit} umgebucht`;

  const bewegung = await prisma.lagerbewegung.create({
    data: {
      artikelId: Number(artikelId),
      typ: "UMBUCHUNG",
      menge: 0,
      bestandNach: artikel.aktuellerBestand,
      notiz: notizText,
      lagerortVon: vonLagerort.trim(),
      lagerortNach: nachLagerort.trim(),
    },
    include: {
      artikel: { select: { id: true, name: true, einheit: true } },
    },
  });

  return NextResponse.json(bewegung, { status: 201 });
}
