import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const nId = parseInt(id, 10);
  if (isNaN(nId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const record = await prisma.psmAusbringung.findUnique({
      where: { id: nId },
      include: {
        kunde: { select: { id: true, name: true, firma: true } },
        schlag: { select: { id: true, name: true, flaeche: true } },
      },
    });
    if (!record) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json(record);
  } catch (err) {
    console.error("PSM GET [id] error:", err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const nId = parseInt(id, 10);
  if (isNaN(nId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (body.datum !== undefined) data.datum = new Date(body.datum);
  if (body.mittel !== undefined) data.mittel = String(body.mittel);
  if (body.wirkstoff !== undefined) data.wirkstoff = body.wirkstoff || null;
  if (body.menge !== undefined) data.menge = Number(body.menge);
  if (body.einheit !== undefined) data.einheit = String(body.einheit);
  if (body.kultur !== undefined) data.kultur = body.kultur || null;
  if (body.flaeche !== undefined) data.flaeche = body.flaeche != null ? Number(body.flaeche) : null;
  if (body.anwendungsgrund !== undefined) data.anwendungsgrund = body.anwendungsgrund || null;
  if (body.wartezeit !== undefined) data.wartezeit = body.wartezeit != null ? parseInt(String(body.wartezeit), 10) : null;
  if (body.notiz !== undefined) data.notiz = body.notiz || null;
  if (body.schlagId !== undefined) {
    const sid = body.schlagId ? parseInt(String(body.schlagId), 10) : null;
    data.schlagId = sid && !isNaN(sid) ? sid : null;
  }

  try {
    const record = await prisma.psmAusbringung.update({
      where: { id: nId },
      data,
      include: {
        kunde: { select: { id: true, name: true, firma: true } },
        schlag: { select: { id: true, name: true, flaeche: true } },
      },
    });
    return NextResponse.json(record);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "P2025") return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    console.error("PSM PUT error:", err);
    const isDev = process.env.NODE_ENV === "development";
    const message = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const nId = parseInt(id, 10);
  if (isNaN(nId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    await prisma.psmAusbringung.delete({ where: { id: nId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "P2025") return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    console.error("PSM DELETE error:", err);
    return NextResponse.json({ error: "Interner Fehler" }, { status: 500 });
  }
}
