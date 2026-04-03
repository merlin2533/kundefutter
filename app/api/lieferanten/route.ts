import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search");

  const where: Record<string, unknown> = { aktiv: true };
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { ort: { contains: search } },
    ];
  }

  try {
    const lieferanten = await prisma.lieferant.findMany({
      where,
      include: {
        artikelZuordnungen: { include: { artikel: true } },
        _count: { select: { artikelZuordnungen: true } },
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(lieferanten);
  } catch {
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "Name ist erforderlich" }, { status: 400 });
  }

  try {
    const lieferant = await prisma.lieferant.create({ data: body });
    return NextResponse.json(lieferant, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
