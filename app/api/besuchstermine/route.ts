import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/besuchstermine?kundeId=X  — geplante Besuche (KundeAktivitaet typ="besuch", datum >= heute)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const kundeId = searchParams.get("kundeId");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const where: Record<string, unknown> = {
    typ: "besuch",
    datum: { gte: today },
  };

  if (kundeId) {
    where.kundeId = Number(kundeId);
  }

  try {
    const items = await prisma.kundeAktivitaet.findMany({
      where,
      include: {
        kunde: {
          select: {
            id: true,
            name: true,
            firma: true,
            plz: true,
            ort: true,
            strasse: true,
            lat: true,
            lng: true,
          },
        },
      },
      orderBy: { datum: "asc" },
    });

    return NextResponse.json(items);
  } catch {
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

// POST /api/besuchstermine — geplanten Besuch anlegen
export async function POST(req: NextRequest) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const { kundeId, datum, betreff, notiz } = body;

  if (!kundeId || !datum || !betreff?.trim()) {
    return NextResponse.json(
      { error: "kundeId, datum und betreff sind erforderlich" },
      { status: 400 }
    );
  }

  try {
    const item = await prisma.kundeAktivitaet.create({
      data: {
        kundeId: Number(kundeId),
        typ: "besuch",
        betreff: betreff.trim(),
        inhalt: notiz?.trim() || null,
        datum: new Date(datum),
      },
      include: {
        kunde: {
          select: {
            id: true,
            name: true,
            firma: true,
            plz: true,
            ort: true,
            strasse: true,
            lat: true,
            lng: true,
          },
        },
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Fehler beim Erstellen des Besuchstermins" }, { status: 500 });
  }
}

// DELETE /api/besuchstermine?id=X
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id fehlt" }, { status: 400 });

  try {
    const existing = await prisma.kundeAktivitaet.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    await prisma.kundeAktivitaet.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Fehler beim Löschen" }, { status: 500 });
  }
}
