import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const STATUS_WHITELIST = new Set(["LAUFEND", "ABGESCHLOSSEN"]);

export async function GET(_req: NextRequest, ctx: Params) {
  const { id } = await ctx.params;
  const versuchId = parseInt(id, 10);
  if (isNaN(versuchId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const v = await prisma.sortenversuch.findUnique({
      where: { id: versuchId },
      include: {
        positionen: true,
        kunde: { select: { id: true, name: true, firma: true } },
        schlag: { select: { id: true, name: true } },
      },
    });
    if (!v) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json(v);
  } catch {
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, ctx: Params) {
  const { id } = await ctx.params;
  const versuchId = parseInt(id, 10);
  if (isNaN(versuchId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = String(body.name).trim();
    if (body.kultur !== undefined) data.kultur = String(body.kultur).trim();
    if (body.jahr !== undefined) data.jahr = parseInt(String(body.jahr), 10);
    if (body.standort !== undefined) data.standort = body.standort?.trim() || null;
    if (body.flaeche !== undefined) data.flaeche = body.flaeche != null && body.flaeche !== "" ? Number(body.flaeche) : null;
    if (body.startDatum !== undefined) data.startDatum = body.startDatum ? new Date(body.startDatum) : null;
    if (body.endeDatum !== undefined) data.endeDatum = body.endeDatum ? new Date(body.endeDatum) : null;
    if (body.notiz !== undefined) data.notiz = body.notiz?.trim() || null;
    if (body.status !== undefined) {
      if (!STATUS_WHITELIST.has(body.status)) return NextResponse.json({ error: "Ungültiger Status" }, { status: 400 });
      data.status = body.status;
    }

    if (Array.isArray(body.positionen)) {
      // Vollständiger Replace der Positionen
      await prisma.$transaction([
        prisma.sortenversuchPosition.deleteMany({ where: { versuchId } }),
        prisma.sortenversuch.update({
          where: { id: versuchId },
          data: {
            ...data,
            positionen: {
              create: body.positionen
                .filter((p: { sorte?: string }) => p.sorte?.trim())
                .map((p: Record<string, unknown>) => ({
                  sorte: String(p.sorte).trim(),
                  saatstaerke: numOrNull(p.saatstaerke),
                  ertragDtHa: numOrNull(p.ertragDtHa),
                  feuchteProzent: numOrNull(p.feuchteProzent),
                  proteinProzent: numOrNull(p.proteinProzent),
                  hektolitergew: numOrNull(p.hektolitergew),
                  bonitur: intOrNull(p.bonitur),
                  reife: typeof p.reife === "string" ? p.reife : null,
                  notiz: typeof p.notiz === "string" ? p.notiz : null,
                })),
            },
          },
        }),
      ]);
    } else if (Object.keys(data).length > 0) {
      await prisma.sortenversuch.update({ where: { id: versuchId }, data });
    }

    const updated = await prisma.sortenversuch.findUnique({
      where: { id: versuchId },
      include: { positionen: true },
    });
    return NextResponse.json(updated);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "P2025") return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Datenbankfehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Params) {
  const { id } = await ctx.params;
  const versuchId = parseInt(id, 10);
  if (isNaN(versuchId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    await prisma.sortenversuch.delete({ where: { id: versuchId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "P2025") return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

function numOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}
function intOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = parseInt(String(v), 10);
  return isNaN(n) ? null : n;
}
