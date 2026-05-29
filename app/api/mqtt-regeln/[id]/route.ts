import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const MODI = ["ki", "direkt"] as const;
const AKTIONEN = ["lieferung", "wareneingang", "benachrichtigung"] as const;

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const regel = await prisma.mqttRegel.findUnique({ where: { id: numId } });
    if (!regel) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json(regel);
  } catch {
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

export async function PUT(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const body = (await req.json()) as {
      name?: string;
      source?: string;
      topicPattern?: string;
      modus?: string;
      aktion?: string;
      aktiv?: boolean;
    };

    if (body.name !== undefined && !body.name.trim())
      return NextResponse.json({ error: "Name darf nicht leer sein" }, { status: 400 });
    if (body.aktion && !AKTIONEN.includes(body.aktion as (typeof AKTIONEN)[number]))
      return NextResponse.json({ error: "Ungültige Aktion" }, { status: 400 });
    if (body.modus && !MODI.includes(body.modus as (typeof MODI)[number]))
      return NextResponse.json({ error: "Ungültiger Modus" }, { status: 400 });

    const updated = await prisma.mqttRegel.update({
      where: { id: numId },
      data: {
        ...(body.name !== undefined && { name: body.name.trim() }),
        ...(body.source !== undefined && { source: body.source.trim() }),
        ...(body.topicPattern !== undefined && { topicPattern: body.topicPattern.trim() }),
        ...(body.modus !== undefined && { modus: body.modus }),
        ...(body.aktion !== undefined && { aktion: body.aktion }),
        ...(body.aktiv !== undefined && { aktiv: body.aktiv }),
      },
    });
    return NextResponse.json(updated);
  } catch (err) {
    if ((err as { code?: string }).code === "P2025")
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    await prisma.mqttRegel.delete({ where: { id: numId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if ((err as { code?: string }).code === "P2025")
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
