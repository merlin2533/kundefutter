import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const kunde = await prisma.kunde.findUnique({
    where: { id: Number(id) },
    include: {
      kontakte: true,
      bedarfe: { include: { artikel: true } },
      artikelPreise: { include: { artikel: true } },
      lieferungen: {
        include: { positionen: { include: { artikel: true } } },
        orderBy: { datum: "desc" },
        take: 100,
      },
    },
  });
  if (!kunde) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  return NextResponse.json(kunde);
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const { kontakte, name, firma, kategorie, strasse, plz, ort, land, lat, lng, notizen, aktiv } = body;

  // Nur erlaubte Felder uebernehmen
  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (firma !== undefined) updateData.firma = firma || null;
  if (kategorie !== undefined) updateData.kategorie = kategorie;
  if (strasse !== undefined) updateData.strasse = strasse || null;
  if (plz !== undefined) updateData.plz = plz || null;
  if (ort !== undefined) updateData.ort = ort || null;
  if (land !== undefined) updateData.land = land || "Deutschland";
  if (lat !== undefined) updateData.lat = lat != null ? Number(lat) : null;
  if (lng !== undefined) updateData.lng = lng != null ? Number(lng) : null;
  if (notizen !== undefined) updateData.notizen = notizen || null;
  if (aktiv !== undefined) updateData.aktiv = Boolean(aktiv);

  if (kontakte !== undefined) {
    updateData.kontakte = {
      deleteMany: {},
      create: Array.isArray(kontakte)
        ? kontakte.map((k: { typ: string; wert: string; label?: string }) => ({
            typ: k.typ,
            wert: k.wert,
            label: k.label || null,
          }))
        : [],
    };
  }

  try {
    const kunde = await prisma.kunde.update({
      where: { id: Number(id) },
      data: updateData,
      include: { kontakte: true },
    });
    return NextResponse.json(kunde);
  } catch {
    return NextResponse.json({ error: "Kunde nicht gefunden" }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    await prisma.kunde.update({
      where: { id: Number(id) },
      data: { aktiv: false },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Kunde nicht gefunden" }, { status: 404 });
  }
}
