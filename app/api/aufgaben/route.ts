import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const VALID_PRIORITAETEN = ["niedrig", "normal", "hoch", "kritisch"] as const;
const VALID_TYPEN = ["aufgabe", "anruf", "besuch", "email"] as const;

// GET /api/aufgaben?status=offen|erledigt|alle&kundeId=X&tag=X&prioritaet=X&faelligBis=DATE
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "offen";
  const kundeId = searchParams.get("kundeId");
  const tag = searchParams.get("tag");
  const prioritaet = searchParams.get("prioritaet");
  const faelligBis = searchParams.get("faelligBis");

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

  try {
    let aufgaben = await prisma.aufgabe.findMany({
      where,
      include: { kunde: { select: { id: true, name: true, firma: true } } },
      orderBy: [
        { erledigt: "asc" },
        { faelligAm: "asc" },
        { erstellt: "desc" },
      ],
      take: 1000,
    });

    // Tag-Filter in JS (JSON array stored as string)
    if (tag) {
      aufgaben = aufgaben.filter((a) => {
        try {
          const tags: string[] = JSON.parse(a.tags);
          return tags.some((t) => t.toLowerCase().includes(tag.toLowerCase()));
        } catch { return false; }
      });
    }

    return NextResponse.json(aufgaben);
  } catch {
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
