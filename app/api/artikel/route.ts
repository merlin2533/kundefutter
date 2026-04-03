import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const kategorie = searchParams.get("kategorie");
  const search = searchParams.get("search");
  const aktiv = searchParams.get("aktiv");

  const where: Record<string, unknown> = {};
  if (kategorie) where.kategorie = kategorie;
  if (aktiv !== null) where.aktiv = aktiv === "true";
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { artikelnummer: { contains: search } },
    ];
  }

  try {
    const artikel = await prisma.artikel.findMany({
      where,
      include: {
        lieferanten: { include: { lieferant: true } },
        dokumente: true,
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(artikel);
  } catch {
    return NextResponse.json({ error: "Datenbankfehler beim Laden der Artikel" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const { lieferanten, ...data } = body;

  if (!data.name || typeof data.name !== "string" || !data.name.trim()) {
    return NextResponse.json({ error: "Name ist erforderlich" }, { status: 400 });
  }

  try {
    // Auto-Artikelnummer wenn nicht gesetzt
    if (!data.artikelnummer) {
      const count = await prisma.artikel.count();
      data.artikelnummer = `ART-${String(count + 1).padStart(5, "0")}`;
    }

    if (data.mwstSatz !== undefined) data.mwstSatz = Number(data.mwstSatz);
    else data.mwstSatz = 19;

    const artikel = await prisma.artikel.create({
      data: {
        ...data,
        lieferanten: lieferanten?.length
          ? { create: lieferanten }
          : undefined,
      },
      include: {
        lieferanten: { include: { lieferant: true } },
        dokumente: true,
      },
    });
    return NextResponse.json(artikel, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
