import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    await prisma.teilzahlung.delete({ where: { id: numId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("P2025")) {
      return NextResponse.json({ error: "Teilzahlung nicht gefunden" }, { status: 404 });
    }
    console.error("Teilzahlung DELETE error:", err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
