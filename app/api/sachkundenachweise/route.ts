import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

const TYPEN_WHITELIST = new Set([
  "PSM-Sachkunde",
  "Spritzgeraetekontrolle",
  "Duengerschulung",
  "Sprengstoff-Sachkunde",
  "Mais-Beize-Sachkunde",
  "Wildlebensmittel-Schulung",
  "Sonstige",
]);

// GET /api/sachkundenachweise?kundeId=X&abgelaufen=1&ablaufendIn=90
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const kundeId = parseInt(searchParams.get("kundeId") ?? "", 10);
  const abgelaufen = searchParams.get("abgelaufen") === "1";
  const ablaufendIn = parseInt(searchParams.get("ablaufendIn") ?? "", 10);

  try {
    const where: { kundeId?: number; gueltigBis?: { lt?: Date; lte?: Date; gte?: Date } } = {};
    if (!isNaN(kundeId)) where.kundeId = kundeId;

    const now = new Date();
    if (abgelaufen) {
      where.gueltigBis = { lt: now };
    } else if (!isNaN(ablaufendIn)) {
      const grenz = new Date(now.getTime() + ablaufendIn * 86400000);
      where.gueltigBis = { gte: now, lte: grenz };
    }

    const liste = await prisma.sachkundenachweis.findMany({
      where,
      include: { kunde: { select: { id: true, name: true, firma: true } } },
      orderBy: [{ gueltigBis: "asc" }, { typ: "asc" }],
      take: 500,
    });
    return NextResponse.json(liste);
  } catch {
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

// POST /api/sachkundenachweise
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const kundeId = parseInt(String(body.kundeId), 10);
    if (isNaN(kundeId)) return NextResponse.json({ error: "kundeId erforderlich" }, { status: 400 });
    if (!body.typ || !TYPEN_WHITELIST.has(body.typ)) {
      return NextResponse.json({ error: "Ungültiger Typ" }, { status: 400 });
    }

    const kunde = await prisma.kunde.findUnique({ where: { id: kundeId } });
    if (!kunde) return NextResponse.json({ error: "Kunde nicht gefunden" }, { status: 404 });

    const eintrag = await prisma.sachkundenachweis.create({
      data: {
        kundeId,
        typ: body.typ,
        nummer: body.nummer?.trim() || null,
        ausstellung: body.ausstellung ? new Date(body.ausstellung) : null,
        gueltigBis: body.gueltigBis ? new Date(body.gueltigBis) : null,
        ausgestelltVon: body.ausgestelltVon?.trim() || null,
        notiz: body.notiz?.trim() || null,
      },
    });
    return NextResponse.json(eintrag, { status: 201 });
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PUT /api/sachkundenachweise?id=X
export async function PUT(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = parseInt(searchParams.get("id") ?? "", 10);
  if (isNaN(id)) return NextResponse.json({ error: "id fehlt" }, { status: 400 });

  try {
    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (body.typ !== undefined) {
      if (!TYPEN_WHITELIST.has(body.typ)) return NextResponse.json({ error: "Ungültiger Typ" }, { status: 400 });
      data.typ = body.typ;
    }
    if (body.nummer !== undefined) data.nummer = body.nummer?.trim() || null;
    if (body.ausstellung !== undefined) data.ausstellung = body.ausstellung ? new Date(body.ausstellung) : null;
    if (body.gueltigBis !== undefined) data.gueltigBis = body.gueltigBis ? new Date(body.gueltigBis) : null;
    if (body.ausgestelltVon !== undefined) data.ausgestelltVon = body.ausgestelltVon?.trim() || null;
    if (body.notiz !== undefined) data.notiz = body.notiz?.trim() || null;

    const eintrag = await prisma.sachkundenachweis.update({ where: { id }, data });
    return NextResponse.json(eintrag);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "P2025") return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

// DELETE /api/sachkundenachweise?id=X
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = parseInt(searchParams.get("id") ?? "", 10);
  if (isNaN(id)) return NextResponse.json({ error: "id fehlt" }, { status: 400 });
  try {
    await prisma.sachkundenachweis.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "P2025") return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
