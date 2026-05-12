import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const zielId = parseInt(id, 10);
  if (isNaN(zielId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  let body: { zielBetrag?: unknown; notiz?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (body.zielBetrag !== undefined) {
    const v = Number(body.zielBetrag);
    if (isNaN(v) || v < 0) return NextResponse.json({ error: "Ungültiger zielBetrag" }, { status: 400 });
    data.zielBetrag = v;
  }
  if (body.notiz !== undefined) data.notiz = body.notiz ? String(body.notiz) : null;

  try {
    const ziel = await prisma.umsatzziel.update({
      where: { id: zielId },
      data,
    });
    return NextResponse.json(ziel);
  } catch (err) {
    console.error("Budget PUT error:", err);
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Interner Fehler";
    const isNotFound =
      err instanceof Error && err.message.includes("P2025");
    return NextResponse.json({ error: isNotFound ? "Nicht gefunden" : msg }, {
      status: isNotFound ? 404 : 500,
    });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const zielId = parseInt(id, 10);
  if (isNaN(zielId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    await prisma.umsatzziel.delete({ where: { id: zielId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Budget DELETE error:", err);
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Interner Fehler";
    const isNotFound = err instanceof Error && err.message.includes("P2025");
    return NextResponse.json({ error: isNotFound ? "Nicht gefunden" : msg }, {
      status: isNotFound ? 404 : 500,
    });
  }
}
