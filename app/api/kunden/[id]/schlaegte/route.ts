import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

// GET /api/kunden/[id]/schlaegte
export async function GET(_req: NextRequest, ctx: Params) {
  const { id } = await ctx.params;
  const kundeId = parseInt(id, 10);
  if (isNaN(kundeId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const schlaegte = await prisma.kundeSchlag.findMany({
      where: { kundeId },
      orderBy: { erstellt: "desc" },
    });
    return NextResponse.json(schlaegte);
  } catch {
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

// POST /api/kunden/[id]/schlaegte
export async function POST(req: NextRequest, ctx: Params) {
  const { id } = await ctx.params;
  const kundeId = parseInt(id, 10);
  if (isNaN(kundeId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const body = await req.json();
    const { name, flaeche, fruchtart, sorte, vorfrucht, aussaatJahr, aussaatMenge, notiz } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Name ist erforderlich" }, { status: 400 });
    }
    const flaecheNum = Number(flaeche);
    if (isNaN(flaecheNum) || flaecheNum <= 0 || flaecheNum > 100000) {
      return NextResponse.json({ error: "Ungültige Fläche (0–100.000 ha)" }, { status: 400 });
    }
    const jahrNum = aussaatJahr ? parseInt(String(aussaatJahr), 10) : null;
    if (jahrNum !== null && (isNaN(jahrNum) || jahrNum < 1900 || jahrNum > 2100)) {
      return NextResponse.json({ error: "Ungültiges Aussaat-Jahr" }, { status: 400 });
    }
    const mengeNum = aussaatMenge != null && aussaatMenge !== "" ? Number(aussaatMenge) : null;
    if (mengeNum !== null && (isNaN(mengeNum) || mengeNum < 0)) {
      return NextResponse.json({ error: "Ungültige Aussaatmenge" }, { status: 400 });
    }

    const schlag = await prisma.kundeSchlag.create({
      data: {
        kundeId,
        name: name.trim(),
        flaeche: flaecheNum,
        fruchtart: fruchtart?.trim() || null,
        sorte: sorte?.trim() || null,
        vorfrucht: vorfrucht?.trim() || null,
        aussaatJahr: jahrNum,
        aussaatMenge: mengeNum,
        notiz: notiz?.trim() || null,
      },
    });
    return NextResponse.json(schlag, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

// DELETE /api/kunden/[id]/schlaegte?schlagId=X
export async function DELETE(req: NextRequest, ctx: Params) {
  const { id } = await ctx.params;
  const kundeId = parseInt(id, 10);
  if (isNaN(kundeId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const schlagId = parseInt(searchParams.get("schlagId") ?? "", 10);
  if (isNaN(schlagId)) return NextResponse.json({ error: "schlagId fehlt oder ungültig" }, { status: 400 });

  try {
    const existing = await prisma.kundeSchlag.findFirst({ where: { id: schlagId, kundeId } });
    if (!existing) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    await prisma.kundeSchlag.delete({ where: { id: schlagId } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
