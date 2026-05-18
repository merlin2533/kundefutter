import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

const STATUS_WHITELIST = new Set(["geplant", "ausgesaet", "geerntet", "abgebrochen"]);

type Ctx = { params: Promise<{ id: string }> };

// PUT /api/anbauplanung/[id]
export async function PUT(req: NextRequest, ctx: Ctx) {
  const { id: idStr } = await ctx.params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const body = await req.json();
    const data: Record<string, unknown> = {};

    if (body.fruchtart !== undefined) data.fruchtart = String(body.fruchtart).trim();
    if (body.sorte !== undefined) data.sorte = body.sorte?.trim() || null;
    if (body.ertragDt !== undefined) data.ertragDt = body.ertragDt !== null ? parseFloat(body.ertragDt) : null;
    if (body.aussaatDatum !== undefined) data.aussaatDatum = body.aussaatDatum ? new Date(body.aussaatDatum) : null;
    if (body.ernteDatum !== undefined) data.ernteDatum = body.ernteDatum ? new Date(body.ernteDatum) : null;
    if (body.notiz !== undefined) data.notiz = body.notiz?.trim() || null;
    if (body.status !== undefined) {
      if (!STATUS_WHITELIST.has(body.status)) {
        return NextResponse.json({ error: "Ungültiger Status" }, { status: 400 });
      }
      data.status = body.status;
    }

    const plan = await prisma.anbauplan.update({
      where: { id },
      data,
      include: {
        schlag: { select: { id: true, name: true, flaeche: true } },
        kunde: { select: { id: true, name: true, firma: true } },
      },
    });

    return NextResponse.json(plan);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "P2025") return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Datenbankfehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
