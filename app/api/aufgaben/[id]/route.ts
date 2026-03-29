import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

const VALID_PRIORITAETEN = ["niedrig", "normal", "hoch", "kritisch"];
const VALID_TYPEN = ["aufgabe", "anruf", "besuch", "email"];

function parseId(raw: string): number | null {
  const n = parseInt(raw, 10);
  return isNaN(n) ? null : n;
}

// GET /api/aufgaben/[id]
export async function GET(_req: NextRequest, ctx: Params) {
  const { id } = await ctx.params;
  const numId = parseId(id);
  if (!numId) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });
  try {
    const aufgabe = await prisma.aufgabe.findUnique({
      where: { id: numId },
      include: { kunde: { select: { id: true, name: true, firma: true } } },
    });
    if (!aufgabe) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json(aufgabe);
  } catch {
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

// PUT /api/aufgaben/[id]
export async function PUT(req: NextRequest, ctx: Params) {
  const { id } = await ctx.params;
  const numId = parseId(id);
  if (!numId) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const body = await req.json();
    const { betreff, beschreibung, faelligAm, prioritaet, tags, typ, kundeId, erledigt } = body;

    const data: Record<string, unknown> = {};
    if (betreff !== undefined) {
      if (!betreff?.trim()) return NextResponse.json({ error: "Betreff ist erforderlich" }, { status: 400 });
      data.betreff = betreff.trim();
    }
    if (beschreibung !== undefined) data.beschreibung = beschreibung?.trim() || null;
    if (faelligAm !== undefined) {
      if (faelligAm) {
        const d = new Date(faelligAm);
        data.faelligAm = isNaN(d.getTime()) ? null : d;
      } else {
        data.faelligAm = null;
      }
    }
    if (prioritaet !== undefined && VALID_PRIORITAETEN.includes(prioritaet)) {
      data.prioritaet = prioritaet;
    }
    if (tags !== undefined) data.tags = tags;
    if (typ !== undefined && VALID_TYPEN.includes(typ)) data.typ = typ;
    if (kundeId !== undefined) {
      if (kundeId === null || kundeId === "") {
        data.kundeId = null;
      } else {
        const kid = parseInt(String(kundeId), 10);
        if (isNaN(kid)) return NextResponse.json({ error: "Ungültige kundeId" }, { status: 400 });
        data.kundeId = kid;
      }
    }
    if (erledigt !== undefined) {
      if (typeof erledigt !== "boolean") return NextResponse.json({ error: "erledigt muss boolean sein" }, { status: 400 });
      data.erledigt = erledigt;
      data.erledigtAm = erledigt ? new Date() : null;
    }

    const aufgabe = await prisma.aufgabe.update({
      where: { id: numId },
      data,
      include: { kunde: { select: { id: true, name: true, firma: true } } },
    });
    return NextResponse.json(aufgabe);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "P2025") return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

// DELETE /api/aufgaben/[id]
export async function DELETE(_req: NextRequest, ctx: Params) {
  const { id } = await ctx.params;
  const numId = parseId(id);
  if (!numId) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });
  try {
    await prisma.aufgabe.delete({ where: { id: numId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "P2025") return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
