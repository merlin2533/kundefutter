import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; eid: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id, eid } = await params;
  const kundeId = parseInt(id, 10);
  const erklaerungId = parseInt(eid, 10);
  if (isNaN(kundeId) || isNaN(erklaerungId)) {
    return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });
  }

  try {
    await prisma.kundeSprengstoffErklaerung.delete({
      where: { id: erklaerungId, kundeId },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "P2025") return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
