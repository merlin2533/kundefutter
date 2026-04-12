import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const kategorie = searchParams.get("kategorie");
  const search = searchParams.get("search");
  const aktiv = searchParams.get("aktiv");

  const where: Record<string, unknown> = {};
  if (kategorie) where.kategorie = kategorie;
  // Standardmäßig nur aktive Artikel anzeigen; explizit ?aktiv=false für inaktive, ?aktiv=alle für alle
  if (aktiv === null) where.aktiv = true;
  else if (aktiv !== "alle") where.aktiv = aktiv === "true";
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { artikelnummer: { contains: search } },
      { inhaltsstoffe: { some: { name: { contains: search } } } },
    ];
  }

  try {
    const artikel = await prisma.artikel.findMany({
      where,
      include: {
        inhaltsstoffe: true,
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

  const { lieferanten, inhaltsstoffe, ...data } = body;

  if (!data.name || typeof data.name !== "string" || !data.name.trim()) {
    return NextResponse.json({ error: "Name ist erforderlich" }, { status: 400 });
  }

  try {
    // Auto-Artikelnummer wenn nicht gesetzt
    if (!data.artikelnummer) {
      const nummernkreisRaw = await prisma.einstellung.findUnique({ where: { key: "artikel.nummernkreis" } });
      const nk = nummernkreisRaw?.value
        ? (() => { try { return JSON.parse(nummernkreisRaw.value); } catch { return null; } })()
        : null;
      const prefix = nk?.prefix ?? "ART-";
      const laenge = Number(nk?.laenge) || 5;
      const naechste = Number(nk?.naechste) || 1;
      data.artikelnummer = `${prefix}${String(naechste).padStart(laenge, "0")}`;
      await prisma.einstellung.upsert({
        where: { key: "artikel.nummernkreis" },
        update: { value: JSON.stringify({ prefix, laenge, naechste: naechste + 1 }) },
        create: { key: "artikel.nummernkreis", value: JSON.stringify({ prefix, laenge, naechste: naechste + 1 }) },
      });
    }

    if (data.mwstSatz !== undefined) data.mwstSatz = Number(data.mwstSatz);
    else data.mwstSatz = 19;

    const artikel = await prisma.artikel.create({
      data: {
        ...data,
        lieferanten: lieferanten?.length
          ? { create: lieferanten }
          : undefined,
        inhaltsstoffe: inhaltsstoffe?.length
          ? { create: (inhaltsstoffe as { name: string; menge?: number | null; einheit?: string | null }[]).map((i) => ({
              name: i.name,
              menge: i.menge ?? null,
              einheit: i.einheit ?? null,
            })) }
          : undefined,
      },
      include: {
        inhaltsstoffe: true,
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
