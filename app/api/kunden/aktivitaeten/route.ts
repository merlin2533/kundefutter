import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/kunden/aktivitaeten?kundeId=X  — Liste
// GET /api/kunden/aktivitaeten?offene=1   — alle offenen Aufgaben/Aktivitäten
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const kundeId = searchParams.get("kundeId");
  const offene = searchParams.get("offene");

  if (offene) {
    const items = await prisma.kundeAktivitaet.findMany({
      where: { erledigt: false },
      include: { kunde: { select: { id: true, name: true, firma: true } } },
      orderBy: [{ faelligAm: "asc" }, { datum: "desc" }],
      take: 100,
    });
    return NextResponse.json(items);
  }

  if (!kundeId) {
    return NextResponse.json({ error: "kundeId fehlt" }, { status: 400 });
  }

  const items = await prisma.kundeAktivitaet.findMany({
    where: { kundeId: Number(kundeId) },
    orderBy: { datum: "desc" },
  });
  return NextResponse.json(items);
}

// POST /api/kunden/aktivitaeten
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { kundeId, typ, betreff, inhalt, datum, faelligAm } = body;

  if (!kundeId || !typ || !betreff?.trim()) {
    return NextResponse.json({ error: "kundeId, typ und betreff sind erforderlich" }, { status: 400 });
  }

  const TYPEN = ["besuch", "anruf", "email", "notiz", "aufgabe"];
  if (!TYPEN.includes(typ)) {
    return NextResponse.json({ error: `typ muss einer von: ${TYPEN.join(", ")} sein` }, { status: 400 });
  }

  const item = await prisma.kundeAktivitaet.create({
    data: {
      kundeId: Number(kundeId),
      typ,
      betreff: betreff.trim(),
      inhalt: inhalt?.trim() || null,
      datum: datum ? new Date(datum) : new Date(),
      faelligAm: faelligAm ? new Date(faelligAm) : null,
    },
  });
  return NextResponse.json(item, { status: 201 });
}

// PATCH /api/kunden/aktivitaeten?id=X
export async function PATCH(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id fehlt" }, { status: 400 });

  const body = await req.json();
  const allowed: Record<string, unknown> = {};
  if ("erledigt" in body) allowed.erledigt = Boolean(body.erledigt);
  if ("betreff" in body && body.betreff?.trim()) allowed.betreff = body.betreff.trim();
  if ("inhalt" in body) allowed.inhalt = body.inhalt?.trim() || null;
  if ("faelligAm" in body) allowed.faelligAm = body.faelligAm ? new Date(body.faelligAm) : null;

  const existing = await prisma.kundeAktivitaet.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  const updated = await prisma.kundeAktivitaet.update({ where: { id }, data: allowed });
  return NextResponse.json(updated);
}

// DELETE /api/kunden/aktivitaeten?id=X
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id fehlt" }, { status: 400 });

  const existing = await prisma.kundeAktivitaet.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  await prisma.kundeAktivitaet.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
