import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

// GET /api/fruehbezugsstaffel?saison=Frühjahr+2026&aktiv=1
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const saison = searchParams.get("saison");
  const aktiv = searchParams.get("aktiv");

  try {
    const where: { saison?: string; aktiv?: boolean } = {};
    if (saison) where.saison = saison;
    if (aktiv === "1") where.aktiv = true;

    const liste = await prisma.fruehbezugsStaffel.findMany({
      where,
      include: { artikel: { select: { id: true, name: true, kategorie: true } } },
      orderBy: [{ saison: "desc" }, { bestellfrist: "asc" }],
      take: 500,
    });
    return NextResponse.json(liste);
  } catch {
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

// POST /api/fruehbezugsstaffel
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.saison?.trim()) return NextResponse.json({ error: "Saison erforderlich" }, { status: 400 });
    if (!body.bestellfrist) return NextResponse.json({ error: "Bestellfrist erforderlich" }, { status: 400 });
    const rabatt = Number(body.rabattProzent);
    if (isNaN(rabatt) || rabatt < 0 || rabatt > 100) {
      return NextResponse.json({ error: "Rabatt 0-100%" }, { status: 400 });
    }

    const eintrag = await prisma.fruehbezugsStaffel.create({
      data: {
        saison: body.saison.trim(),
        kategorie: body.kategorie?.trim() || null,
        artikelId: body.artikelId ? parseInt(String(body.artikelId), 10) : null,
        bestellfrist: new Date(body.bestellfrist),
        rabattProzent: rabatt,
        beschreibung: body.beschreibung?.trim() || null,
        aktiv: body.aktiv !== false,
      },
    });
    return NextResponse.json(eintrag, { status: 201 });
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PUT /api/fruehbezugsstaffel?id=X
export async function PUT(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = parseInt(searchParams.get("id") ?? "", 10);
  if (isNaN(id)) return NextResponse.json({ error: "id fehlt" }, { status: 400 });

  try {
    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (body.saison !== undefined) data.saison = String(body.saison).trim();
    if (body.kategorie !== undefined) data.kategorie = body.kategorie?.trim() || null;
    if (body.artikelId !== undefined) data.artikelId = body.artikelId ? parseInt(String(body.artikelId), 10) : null;
    if (body.bestellfrist !== undefined) data.bestellfrist = new Date(body.bestellfrist);
    if (body.rabattProzent !== undefined) {
      const rabatt = Number(body.rabattProzent);
      if (isNaN(rabatt) || rabatt < 0 || rabatt > 100) {
        return NextResponse.json({ error: "Rabatt 0-100%" }, { status: 400 });
      }
      data.rabattProzent = rabatt;
    }
    if (body.beschreibung !== undefined) data.beschreibung = body.beschreibung?.trim() || null;
    if (body.aktiv !== undefined) data.aktiv = !!body.aktiv;

    const eintrag = await prisma.fruehbezugsStaffel.update({ where: { id }, data });
    return NextResponse.json(eintrag);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "P2025") return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

// DELETE /api/fruehbezugsstaffel?id=X
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = parseInt(searchParams.get("id") ?? "", 10);
  if (isNaN(id)) return NextResponse.json({ error: "id fehlt" }, { status: 400 });
  try {
    await prisma.fruehbezugsStaffel.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "P2025") return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
