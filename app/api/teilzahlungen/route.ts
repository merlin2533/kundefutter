import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lieferungIdParam = searchParams.get("lieferungId");
  const sammelrechnungIdParam = searchParams.get("sammelrechnungId");

  const lieferungId = lieferungIdParam ? parseInt(lieferungIdParam, 10) : null;
  const sammelrechnungId = sammelrechnungIdParam ? parseInt(sammelrechnungIdParam, 10) : null;

  if (lieferungId && isNaN(lieferungId))
    return NextResponse.json({ error: "Ungültige lieferungId" }, { status: 400 });
  if (sammelrechnungId && isNaN(sammelrechnungId))
    return NextResponse.json({ error: "Ungültige sammelrechnungId" }, { status: 400 });

  if (!lieferungId && !sammelrechnungId)
    return NextResponse.json({ error: "lieferungId oder sammelrechnungId erforderlich" }, { status: 400 });

  try {
    const teilzahlungen = await prisma.teilzahlung.findMany({
      where: {
        ...(lieferungId ? { lieferungId } : {}),
        ...(sammelrechnungId ? { sammelrechnungId } : {}),
      },
      orderBy: { datum: "asc" },
      take: 200,
    });
    return NextResponse.json(teilzahlungen);
  } catch (e) {
    console.error("Teilzahlungen GET error:", e);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const lieferungId = b.lieferungId != null ? parseInt(String(b.lieferungId), 10) : null;
  const sammelrechnungId = b.sammelrechnungId != null ? parseInt(String(b.sammelrechnungId), 10) : null;
  const betrag = Number(b.betrag);
  const notiz = b.notiz != null ? String(b.notiz) : null;

  if (!lieferungId && !sammelrechnungId)
    return NextResponse.json({ error: "lieferungId oder sammelrechnungId erforderlich" }, { status: 400 });
  if (lieferungId && isNaN(lieferungId))
    return NextResponse.json({ error: "Ungültige lieferungId" }, { status: 400 });
  if (sammelrechnungId && isNaN(sammelrechnungId))
    return NextResponse.json({ error: "Ungültige sammelrechnungId" }, { status: 400 });
  if (!betrag || isNaN(betrag) || betrag <= 0)
    return NextResponse.json({ error: "Betrag muss eine positive Zahl sein" }, { status: 400 });

  const datum = b.datum ? new Date(String(b.datum)) : new Date();
  if (isNaN(datum.getTime()))
    return NextResponse.json({ error: "Ungültiges Datum" }, { status: 400 });

  try {
    const teilzahlung = await prisma.teilzahlung.create({
      data: {
        ...(lieferungId ? { lieferungId } : {}),
        ...(sammelrechnungId ? { sammelrechnungId } : {}),
        betrag,
        datum,
        notiz,
      },
    });
    return NextResponse.json(teilzahlung, { status: 201 });
  } catch (err) {
    console.error("Teilzahlung POST error:", err);
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
