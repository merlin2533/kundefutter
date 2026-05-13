import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

// GET /api/bodenproben?schlagId=X&kundeId=Y
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const schlagId = parseInt(searchParams.get("schlagId") ?? "", 10);
  const kundeId = parseInt(searchParams.get("kundeId") ?? "", 10);

  try {
    const where: { schlagId?: number; schlag?: { kundeId: number } } = {};
    if (!isNaN(schlagId)) where.schlagId = schlagId;
    else if (!isNaN(kundeId)) where.schlag = { kundeId };

    const proben = await prisma.bodenprobe.findMany({
      where,
      include: { schlag: { select: { id: true, name: true, kundeId: true } } },
      orderBy: { datum: "desc" },
      take: 500,
    });
    return NextResponse.json(proben);
  } catch {
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

// POST /api/bodenproben
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const schlagId = parseInt(String(body.schlagId), 10);
    if (isNaN(schlagId)) {
      return NextResponse.json({ error: "schlagId erforderlich" }, { status: 400 });
    }
    if (!body.datum) {
      return NextResponse.json({ error: "Datum erforderlich" }, { status: 400 });
    }

    const schlag = await prisma.kundeSchlag.findUnique({ where: { id: schlagId } });
    if (!schlag) {
      return NextResponse.json({ error: "Schlag nicht gefunden" }, { status: 404 });
    }

    const probe = await prisma.bodenprobe.create({
      data: {
        schlagId,
        datum: new Date(body.datum),
        probenNr: body.probenNr?.trim() || null,
        labor: body.labor?.trim() || null,
        tiefe: body.tiefe?.trim() || null,
        pH: numOrNull(body.pH),
        phosphor: numOrNull(body.phosphor),
        kalium: numOrNull(body.kalium),
        magnesium: numOrNull(body.magnesium),
        bor: numOrNull(body.bor),
        humus: numOrNull(body.humus),
        nMin: numOrNull(body.nMin),
        cn: numOrNull(body.cn),
        bodenart: body.bodenart?.trim() || null,
        klasse: body.klasse?.trim() || null,
        notiz: body.notiz?.trim() || null,
      },
    });
    return NextResponse.json(probe, { status: 201 });
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/bodenproben?id=X
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = parseInt(searchParams.get("id") ?? "", 10);
  if (isNaN(id)) return NextResponse.json({ error: "id fehlt" }, { status: 400 });

  try {
    await prisma.bodenprobe.delete({ where: { id } });
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
