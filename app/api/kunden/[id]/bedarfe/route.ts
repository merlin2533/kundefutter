import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { artikelSafeSelect } from "@/lib/artikel-select";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const bedarfe = await prisma.kundeBedarf.findMany({
      where: { kundeId: Number(id) },
      include: { artikel: { select: artikelSafeSelect } },
    });
    return NextResponse.json(bedarfe);
  } catch {
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const { artikelId, menge, intervallTage, notiz } = body;
  if (!artikelId || typeof artikelId !== "number") {
    return NextResponse.json({ error: "artikelId ist erforderlich" }, { status: 400 });
  }

  try {
    const bedarf = await prisma.kundeBedarf.upsert({
      where: { kundeId_artikelId: { kundeId: Number(id), artikelId } },
      update: { menge, intervallTage, notiz },
      create: { kundeId: Number(id), artikelId, menge, intervallTage, notiz },
      include: { artikel: { select: artikelSafeSelect } },
    });
    return NextResponse.json(bedarf);
  } catch {
    return NextResponse.json({ error: "Fehler beim Speichern des Bedarfs" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const { artikelId } = body;
  if (!artikelId) {
    return NextResponse.json({ error: "artikelId ist erforderlich" }, { status: 400 });
  }

  try {
    await prisma.kundeBedarf.delete({
      where: { kundeId_artikelId: { kundeId: Number(id), artikelId } },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Bedarf nicht gefunden" }, { status: 404 });
  }
}
