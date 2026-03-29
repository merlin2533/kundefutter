import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

// GET /api/aufgaben/[id]
export async function GET(_req: NextRequest, ctx: Params) {
  const { id } = await ctx.params;
  const aufgabe = await prisma.aufgabe.findUnique({
    where: { id: Number(id) },
    include: { kunde: { select: { id: true, name: true, firma: true } } },
  });
  if (!aufgabe) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  return NextResponse.json(aufgabe);
}

// PUT /api/aufgaben/[id]
export async function PUT(req: NextRequest, ctx: Params) {
  const { id } = await ctx.params;
  const body = await req.json();
  const { betreff, beschreibung, faelligAm, prioritaet, tags, typ, kundeId, erledigt } = body;

  const data: Record<string, unknown> = {};
  if (betreff !== undefined) {
    if (!betreff?.trim()) return NextResponse.json({ error: "Betreff ist erforderlich" }, { status: 400 });
    data.betreff = betreff.trim();
  }
  if (beschreibung !== undefined) data.beschreibung = beschreibung?.trim() || null;
  if (faelligAm !== undefined) data.faelligAm = faelligAm ? new Date(faelligAm) : null;
  if (prioritaet !== undefined) data.prioritaet = prioritaet;
  if (tags !== undefined) data.tags = tags;
  if (typ !== undefined) data.typ = typ;
  if (kundeId !== undefined) data.kundeId = kundeId ? Number(kundeId) : null;
  if (erledigt !== undefined) {
    data.erledigt = erledigt;
    data.erledigtAm = erledigt ? new Date() : null;
  }

  const aufgabe = await prisma.aufgabe.update({
    where: { id: Number(id) },
    data,
    include: { kunde: { select: { id: true, name: true, firma: true } } },
  });
  return NextResponse.json(aufgabe);
}

// DELETE /api/aufgaben/[id]
export async function DELETE(_req: NextRequest, ctx: Params) {
  const { id } = await ctx.params;
  await prisma.aufgabe.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
