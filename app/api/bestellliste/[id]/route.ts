import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/bestellliste/[id] — Status ändern: bestellen | geliefert | stornieren | zurueck
export async function PATCH(req: NextRequest, ctx: Params) {
  const { id } = await ctx.params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const VALID_STATUS = ["offen", "bestellt", "geliefert", "storniert"];
  const { status, notiz } = body as { status?: string; notiz?: string };

  if (status && !VALID_STATUS.includes(status)) {
    return NextResponse.json({ error: `Ungültiger Status: ${status}` }, { status: 400 });
  }

  try {
    const updateData: Record<string, unknown> = {};
    if (status) {
      updateData.status = status;
      if (status === "bestellt") updateData.bestelltAm = new Date();
      if (status === "geliefert") updateData.geliefertAm = new Date();
      if (status === "offen") { updateData.bestelltAm = null; updateData.geliefertAm = null; }
    }
    if (notiz !== undefined) updateData.notiz = notiz || null;

    const pos = await prisma.bestellposition.update({
      where: { id: numId },
      data: updateData,
      include: {
        lieferant: { select: { id: true, name: true } },
        artikel: { select: { id: true, name: true } },
        kunde: { select: { id: true, name: true, firma: true } },
      },
    });
    return NextResponse.json(pos);
  } catch {
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

// DELETE /api/bestellliste/[id]
export async function DELETE(_req: NextRequest, ctx: Params) {
  const { id } = await ctx.params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    await prisma.bestellposition.delete({ where: { id: numId } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }
}
