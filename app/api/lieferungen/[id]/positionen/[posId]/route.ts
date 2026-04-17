import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string; posId: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id, posId } = await ctx.params;
  const lieferungId = parseInt(id, 10);
  const positionId = parseInt(posId, 10);
  if (isNaN(lieferungId) || isNaN(positionId)) {
    return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  // Nur ausgewählte Felder zulassen
  const updateData: Record<string, unknown> = {};
  if (body.rabattProzent !== undefined) {
    const r = Number(body.rabattProzent);
    if (isNaN(r) || r < 0 || r > 100) {
      return NextResponse.json({ error: "Rabatt muss zwischen 0 und 100 liegen" }, { status: 400 });
    }
    updateData.rabattProzent = r;
  }
  if (body.verkaufspreis !== undefined) {
    const v = Number(body.verkaufspreis);
    if (isNaN(v) || v < 0) {
      return NextResponse.json({ error: "Verkaufspreis ungültig" }, { status: 400 });
    }
    updateData.verkaufspreis = v;
  }
  if (body.einkaufspreis !== undefined) {
    const e = Number(body.einkaufspreis);
    if (isNaN(e) || e < 0) {
      return NextResponse.json({ error: "Einkaufspreis ungültig" }, { status: 400 });
    }
    updateData.einkaufspreis = e;
  }
  if (body.menge !== undefined) {
    const m = Number(body.menge);
    if (isNaN(m) || m <= 0) {
      return NextResponse.json({ error: "Menge muss größer als 0 sein" }, { status: 400 });
    }
    updateData.menge = m;
  }
  if (body.notiz !== undefined) {
    updateData.notiz = typeof body.notiz === "string" ? body.notiz.trim() || null : null;
  }
  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "Keine Felder zum Aktualisieren" }, { status: 400 });
  }

  try {
    const pos = await prisma.lieferposition.findUnique({
      where: { id: positionId },
      select: { lieferungId: true },
    });
    if (!pos || pos.lieferungId !== lieferungId) {
      return NextResponse.json({ error: "Position nicht gefunden" }, { status: 404 });
    }
    const updated = await prisma.lieferposition.update({
      where: { id: positionId },
      data: updateData,
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
