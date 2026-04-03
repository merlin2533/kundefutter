import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const kundeId = parseInt(id, 10);
  if (isNaN(kundeId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const notizen = await prisma.kundeNotiz.findMany({
      where: { kundeId },
      orderBy: { erstellt: "desc" },
    });
    return NextResponse.json(notizen);
  } catch {
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const kundeId = parseInt(id, 10);
  if (isNaN(kundeId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const { text, thema } = body;
  if (!text?.trim()) return NextResponse.json({ error: "Text fehlt" }, { status: 400 });

  try {
    const notiz = await prisma.kundeNotiz.create({
      data: { kundeId, text: text.trim(), thema: thema || null },
    });
    return NextResponse.json(notiz, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Fehler beim Erstellen der Notiz" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const kundeId = parseInt(id, 10);
  if (isNaN(kundeId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  const notizId = parseInt(req.nextUrl.searchParams.get("notizId") ?? "0", 10);
  if (!notizId || isNaN(notizId)) return NextResponse.json({ error: "notizId fehlt" }, { status: 400 });

  try {
    await prisma.kundeNotiz.deleteMany({ where: { id: notizId, kundeId } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Fehler beim Löschen der Notiz" }, { status: 500 });
  }
}
