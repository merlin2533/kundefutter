import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Params) {
  const { id: idStr } = await ctx.params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const anlieferung = await prisma.anlieferung.findUnique({
      where: { id },
      include: {
        kunde: { select: { id: true, name: true, firma: true } },
        artikel: { select: { id: true, name: true, einheit: true } },
        gutschrift: { select: { id: true, nummer: true, status: true } },
      },
    });
    if (!anlieferung) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json(anlieferung);
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    return NextResponse.json(
      { error: isDev && err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest, ctx: Params) {
  const { id: idStr } = await ctx.params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const body = await req.json();
    const { datum, menge, einheit, feuchte, qualitaet, preisProEinheit, notiz } = body;

    const gesamtBetrag =
      preisProEinheit != null && menge != null
        ? Math.round(parseFloat(String(preisProEinheit)) * parseFloat(String(menge)) * 100) / 100
        : null;

    const updated = await prisma.anlieferung.update({
      where: { id },
      data: {
        ...(datum ? { datum: new Date(datum) } : {}),
        ...(menge != null ? { menge: parseFloat(String(menge)) } : {}),
        ...(einheit ? { einheit } : {}),
        feuchte: feuchte != null ? parseFloat(String(feuchte)) : null,
        qualitaet: qualitaet ?? null,
        preisProEinheit: preisProEinheit != null ? parseFloat(String(preisProEinheit)) : null,
        gesamtBetrag,
        notiz: notiz ?? null,
      },
      include: {
        kunde: { select: { id: true, name: true, firma: true } },
        artikel: { select: { id: true, name: true, einheit: true } },
        gutschrift: { select: { id: true, nummer: true, status: true } },
      },
    });
    return NextResponse.json(updated);
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    if (err instanceof Error && err.message.includes("P2025")) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }
    return NextResponse.json(
      { error: isDev && err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, ctx: Params) {
  const { id: idStr } = await ctx.params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    await prisma.anlieferung.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    if (err instanceof Error && err.message.includes("P2025")) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }
    return NextResponse.json(
      { error: isDev && err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 }
    );
  }
}
