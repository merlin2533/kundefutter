import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, ctx: Params) {
  try {
    const { id } = await ctx.params;
    const numId = parseInt(id, 10);
    if (isNaN(numId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

    const body = await req.json();
    const { gelesen } = body;

    const item = await prisma.benachrichtigung.update({
      where: { id: numId },
      data: { gelesen: gelesen === true },
    });

    return NextResponse.json(item);
  } catch (e: unknown) {
    const isDev = process.env.NODE_ENV === "development";
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2025") {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }
    const msg = isDev && e instanceof Error ? e.message : "Interner Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Params) {
  try {
    const { id } = await ctx.params;
    const numId = parseInt(id, 10);
    if (isNaN(numId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

    await prisma.benachrichtigung.delete({ where: { id: numId } });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const isDev = process.env.NODE_ENV === "development";
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2025") {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }
    const msg = isDev && e instanceof Error ? e.message : "Interner Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
