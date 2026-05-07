import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; lieferantId: string }> };

export async function DELETE(_req: NextRequest, ctx: Params) {
  const { id, lieferantId } = await ctx.params;
  const artikelId = parseInt(id, 10);
  const lId = parseInt(lieferantId, 10);
  if (isNaN(artikelId) || isNaN(lId)) {
    return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });
  }
  try {
    await prisma.artikelLieferant.delete({
      where: { artikelId_lieferantId: { artikelId, lieferantId: lId } },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("ArtikelLieferant DELETE error:", err);
    return NextResponse.json({ error: "Löschen fehlgeschlagen" }, { status: 500 });
  }
}
