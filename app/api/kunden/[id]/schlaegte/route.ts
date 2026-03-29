import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

// GET /api/kunden/[id]/schlaegte
export async function GET(_req: NextRequest, ctx: Params) {
  const { id } = await ctx.params;
  const kundeId = Number(id);
  if (!kundeId) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  const schlaegte = await prisma.kundeSchlag.findMany({
    where: { kundeId },
    orderBy: { erstellt: "desc" },
  });
  return NextResponse.json(schlaegte);
}

// POST /api/kunden/[id]/schlaegte
export async function POST(req: NextRequest, ctx: Params) {
  const { id } = await ctx.params;
  const kundeId = Number(id);
  if (!kundeId) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  const body = await req.json();
  const { name, flaeche, fruchtart, sorte, vorfrucht, aussaatJahr, aussaatMenge, notiz } = body;

  if (!name?.trim() || flaeche == null) {
    return NextResponse.json({ error: "name und flaeche sind erforderlich" }, { status: 400 });
  }

  const schlag = await prisma.kundeSchlag.create({
    data: {
      kundeId,
      name: name.trim(),
      flaeche: Number(flaeche),
      fruchtart: fruchtart || null,
      sorte: sorte || null,
      vorfrucht: vorfrucht || null,
      aussaatJahr: aussaatJahr ? Number(aussaatJahr) : null,
      aussaatMenge: aussaatMenge != null ? Number(aussaatMenge) : null,
      notiz: notiz || null,
    },
  });
  return NextResponse.json(schlag, { status: 201 });
}

// DELETE /api/kunden/[id]/schlaegte?schlagId=X
export async function DELETE(req: NextRequest, ctx: Params) {
  const { id } = await ctx.params;
  const kundeId = Number(id);
  if (!kundeId) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const schlagId = Number(searchParams.get("schlagId"));
  if (!schlagId) return NextResponse.json({ error: "schlagId fehlt" }, { status: 400 });

  const existing = await prisma.kundeSchlag.findFirst({ where: { id: schlagId, kundeId } });
  if (!existing) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  await prisma.kundeSchlag.delete({ where: { id: schlagId } });
  return NextResponse.json({ ok: true });
}
