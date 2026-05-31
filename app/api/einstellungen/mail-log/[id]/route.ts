import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// GET /api/einstellungen/mail-log/[id] — vollständiger Log-Eintrag inkl. htmlBody
export async function GET(_req: NextRequest, ctx: Params) {
  const { id: idStr } = await ctx.params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });
  try {
    const log = await prisma.mailLog.findUnique({ where: { id } });
    if (!log) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json(log);
  } catch {
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
