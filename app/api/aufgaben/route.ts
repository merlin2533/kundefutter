import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const VALID_PRIORITAETEN = ["niedrig", "normal", "hoch", "kritisch"] as const;
const VALID_TYPEN = ["aufgabe", "anruf", "besuch", "email"] as const;

// GET /api/aufgaben?status=offen|erledigt|alle&kundeId=X&tag=X&prioritaet=X&faelligBis=DATE&limit=200&page=1
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "offen";
  const kundeId = searchParams.get("kundeId");
  const tag = searchParams.get("tag");
  const prioritaet = searchParams.get("prioritaet");
  const faelligBis = searchParams.get("faelligBis");

  const limit = Math.min(500, Math.max(1, parseInt(searchParams.get("limit") ?? "200", 10) || 200));
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);

  const where: Record<string, unknown> = {};
  if (status === "offen") where.erledigt = false;
  else if (status === "erledigt") where.erledigt = true;

  if (kundeId) {
    const kid = parseInt(kundeId, 10);
    if (isNaN(kid)) return NextResponse.json({ error: "Ungültige kundeId" }, { status: 400 });
    where.kundeId = kid;
  }
  if (prioritaet && VALID_PRIORITAETEN.includes(prioritaet as never)) {
    where.prioritaet = prioritaet;
  }
  if (faelligBis) {
    const d = new Date(faelligBis);
    if (!isNaN(d.getTime())) where.faelligAm = { lte: d };
  }

  // Tag-Filter DB-seitig: JSON-Array wird als String gespeichert, wir suchen
  // nach dem quoted-Literal. Das ist nicht case-insensitive, aber um Größenordnungen
  // effizienter als alle Zeilen in JS zu parsen.
  if (tag) {
    const safe = tag.replace(/["\\]/g, "").slice(0, 50);
    if (safe) where.tags = { contains: `"${safe}"` };
  }

  try {
    const aufgaben = await prisma.aufgabe.findMany({
      where,
      include: { kunde: { select: { id: true, name: true, firma: true } } },
      orderBy: [
        { erledigt: "asc" },
        { faelligAm: "asc" },
        { erstellt: "desc" },
      ],
      skip: (page - 1) * limit,
      take: limit,
    });

    return NextResponse.json(aufgaben);
  } catch (e) {
    console.error("Aufgaben GET error:", e);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

// POST /api/aufgaben
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { betreff, beschreibung, faelligAm, prioritaet, tags, typ, kundeId } = body;

    if (!betreff?.trim()) {
      return NextResponse.json({ error: "Betreff ist erforderlich" }, { status: 400 });
    }

    const prio = VALID_PRIORITAETEN.includes(prioritaet) ? prioritaet : "normal";
    const typVal = VALID_TYPEN.includes(typ) ? typ : "aufgabe";
    let kid: number | null = null;
    if (kundeId !== undefined && kundeId !== null && kundeId !== "") {
      kid = parseInt(String(kundeId), 10);
      if (isNaN(kid)) return NextResponse.json({ error: "Ungültige kundeId" }, { status: 400 });
    }

    let faelligDate: Date | null = null;
    if (faelligAm) {
      faelligDate = new Date(faelligAm);
      if (isNaN(faelligDate.getTime())) faelligDate = null;
    }

    const aufgabe = await prisma.aufgabe.create({
      data: {
        betreff: betreff.trim(),
        beschreibung: beschreibung?.trim() || null,
        faelligAm: faelligDate,
        prioritaet: prio,
        tags: tags ?? "[]",
        typ: typVal,
        kundeId: kid,
      },
      include: { kunde: { select: { id: true, name: true, firma: true } } },
    });
    return NextResponse.json(aufgabe, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
