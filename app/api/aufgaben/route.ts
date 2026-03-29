import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

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
  if (kundeId) where.kundeId = Number(kundeId);
  if (prioritaet) where.prioritaet = prioritaet;
  if (faelligBis) where.faelligAm = { lte: new Date(faelligBis) };

  let aufgaben = await prisma.aufgabe.findMany({
    where,
    include: { kunde: { select: { id: true, name: true, firma: true } } },
    orderBy: [
      { erledigt: "asc" },
      { faelligAm: "asc" },
      { erstellt: "desc" },
    ],
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
}

// POST /api/aufgaben
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { betreff, beschreibung, faelligAm, prioritaet, tags, typ, kundeId } = body;
  if (!betreff?.trim()) {
    return NextResponse.json({ error: "Betreff ist erforderlich" }, { status: 400 });
  }
  const aufgabe = await prisma.aufgabe.create({
    data: {
      betreff: betreff.trim(),
      beschreibung: beschreibung?.trim() || null,
      faelligAm: faelligAm ? new Date(faelligAm) : null,
      prioritaet: prioritaet ?? "normal",
      tags: tags ?? "[]",
      typ: typ ?? "aufgabe",
      kundeId: kundeId ? Number(kundeId) : null,
    },
    include: { kunde: { select: { id: true, name: true, firma: true } } },
  });
  return NextResponse.json(aufgabe, { status: 201 });
}
