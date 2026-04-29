import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const preise = await prisma.kundeArtikelPreis.findMany({
      where: { kundeId: Number(id) },
      include: { artikel: { select: artikelSafeSelect } },
    });
    return NextResponse.json(preise);
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

  const { artikelId, preis, rabatt } = body;
  if (!artikelId || typeof artikelId !== "number") {
    return NextResponse.json({ error: "artikelId ist erforderlich" }, { status: 400 });
  }
  if (preis === undefined || preis === null || typeof preis !== "number") {
    return NextResponse.json({ error: "preis ist erforderlich" }, { status: 400 });
  }

  try {
    const eintrag = await prisma.kundeArtikelPreis.upsert({
      where: { kundeId_artikelId: { kundeId: Number(id), artikelId } },
      update: { preis, rabatt: rabatt ?? 0 },
      create: { kundeId: Number(id), artikelId, preis, rabatt: rabatt ?? 0 },
      include: { artikel: { select: artikelSafeSelect } },
    });
    return NextResponse.json(eintrag);
  } catch {
    return NextResponse.json({ error: "Fehler beim Speichern des Sonderpreises" }, { status: 500 });
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
    await prisma.kundeArtikelPreis.delete({
      where: { kundeId_artikelId: { kundeId: Number(id), artikelId } },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Sonderpreis nicht gefunden" }, { status: 404 });
  }
}
