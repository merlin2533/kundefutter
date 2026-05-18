import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

const TYPEN_WHITELIST = new Set([
  "QS", "GlobalGAP", "Bio/Öko", "Cross-Compliance", "Ernte-Plus", "DLG", "Sonstige",
]);

const STATUS_WHITELIST = new Set(["aktiv", "abgelaufen", "gesperrt"]);

// GET /api/zertifizierungen?kundeId=&abgelaufen=1&ablaufendIn=90&typ=
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const kundeId = parseInt(searchParams.get("kundeId") ?? "", 10);
  const abgelaufen = searchParams.get("abgelaufen") === "1";
  const ablaufendIn = parseInt(searchParams.get("ablaufendIn") ?? "", 10);
  const typ = searchParams.get("typ") ?? "";

  const where: Record<string, unknown> = {};
  if (!isNaN(kundeId)) where.kundeId = kundeId;
  if (typ && TYPEN_WHITELIST.has(typ)) where.typ = typ;

  const now = new Date();
  if (abgelaufen) {
    where.ablaufdatum = { lt: now };
  } else if (!isNaN(ablaufendIn)) {
    const grenz = new Date(now.getTime() + ablaufendIn * 86400000);
    where.ablaufdatum = { gte: now, lte: grenz };
  }

  try {
    const zertifizierungen = await prisma.zertifizierung.findMany({
      where,
      include: { kunde: { select: { id: true, name: true, firma: true } } },
      orderBy: [{ ablaufdatum: "asc" }, { createdAt: "desc" }],
      take: 200,
    });

    return NextResponse.json(zertifizierungen);
  } catch {
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

// POST /api/zertifizierungen
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

    const ablaufdatum = body.ablaufdatum ? new Date(body.ablaufdatum) : null;
    const now = new Date();
    const status = ablaufdatum && ablaufdatum < now ? "abgelaufen" : "aktiv";

    const zertifizierung = await prisma.zertifizierung.create({
      data: {
        kundeId,
        typ: body.typ,
        nummer: body.nummer?.trim() || null,
        ausstellerOrg: body.ausstellerOrg?.trim() || null,
        ausstellungsdatum: body.ausstellungsdatum ? new Date(body.ausstellungsdatum) : null,
        ablaufdatum,
        status,
        notiz: body.notiz?.trim() || null,
      },
      include: { kunde: { select: { id: true, name: true, firma: true } } },
    });

    return NextResponse.json(zertifizierung, { status: 201 });
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
