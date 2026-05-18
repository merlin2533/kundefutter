import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

const STATUS_WHITELIST = new Set(["geplant", "ausgesaet", "geerntet", "abgebrochen"]);

// GET /api/anbauplanung?kundeId=&schlagId=&jahr=
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const kundeId = parseInt(searchParams.get("kundeId") ?? "", 10);
  const schlagId = parseInt(searchParams.get("schlagId") ?? "", 10);
  const jahr = parseInt(searchParams.get("jahr") ?? "", 10);

  const where: Record<string, unknown> = {};
  if (!isNaN(kundeId)) where.kundeId = kundeId;
  if (!isNaN(schlagId)) where.schlagId = schlagId;
  if (!isNaN(jahr)) where.jahr = jahr;

  try {
    const plaene = await prisma.anbauplan.findMany({
      where,
      include: {
        schlag: { select: { id: true, name: true, flaeche: true, fruchtart: true } },
        kunde: { select: { id: true, name: true, firma: true } },
      },
      orderBy: [{ jahr: "desc" }, { schlagId: "asc" }],
      take: 200,
    });

    return NextResponse.json(plaene);
  } catch {
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

// POST /api/anbauplanung
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const kundeId = parseInt(String(body.kundeId), 10);
    const schlagId = parseInt(String(body.schlagId), 10);
    const jahr = parseInt(String(body.jahr), 10);

    if (isNaN(kundeId)) return NextResponse.json({ error: "kundeId erforderlich" }, { status: 400 });
    if (isNaN(schlagId)) return NextResponse.json({ error: "schlagId erforderlich" }, { status: 400 });
    if (isNaN(jahr)) return NextResponse.json({ error: "jahr erforderlich" }, { status: 400 });
    if (!body.fruchtart?.trim()) return NextResponse.json({ error: "fruchtart erforderlich" }, { status: 400 });

    const status = body.status ?? "geplant";
    if (!STATUS_WHITELIST.has(status)) {
      return NextResponse.json({ error: "Ungültiger Status" }, { status: 400 });
    }

    const plan = await prisma.anbauplan.create({
      data: {
        schlagId,
        kundeId,
        jahr,
        fruchtart: body.fruchtart.trim(),
        sorte: body.sorte?.trim() || null,
        aussaatDatum: body.aussaatDatum ? new Date(body.aussaatDatum) : null,
        ernteDatum: body.ernteDatum ? new Date(body.ernteDatum) : null,
        status,
        notiz: body.notiz?.trim() || null,
      },
      include: {
        schlag: { select: { id: true, name: true, flaeche: true } },
        kunde: { select: { id: true, name: true, firma: true } },
      },
    });

    return NextResponse.json(plan, { status: 201 });
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/anbauplanung?id=
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = parseInt(searchParams.get("id") ?? "", 10);
  if (isNaN(id)) return NextResponse.json({ error: "id fehlt" }, { status: 400 });

  try {
    await prisma.anbauplan.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "P2025") return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
