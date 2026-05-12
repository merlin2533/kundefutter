import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const kundeId = searchParams.get("kundeId");
  const schlagId = searchParams.get("schlagId");
  const von = searchParams.get("von");
  const bis = searchParams.get("bis");

  const where: Record<string, unknown> = {};

  if (kundeId) {
    const kid = parseInt(kundeId, 10);
    if (isNaN(kid)) return NextResponse.json({ error: "Ungültige kundeId" }, { status: 400 });
    where.kundeId = kid;
  }
  if (schlagId) {
    const sid = parseInt(schlagId, 10);
    if (isNaN(sid)) return NextResponse.json({ error: "Ungültige schlagId" }, { status: 400 });
    where.schlagId = sid;
  }
  if (von || bis) {
    const datum: Record<string, Date> = {};
    if (von) { const d = new Date(von); if (!isNaN(d.getTime())) datum.gte = d; }
    if (bis) { const d = new Date(bis); if (!isNaN(d.getTime())) datum.lte = d; }
    if (Object.keys(datum).length > 0) where.datum = datum;
  }

  try {
    const list = await prisma.psmAusbringung.findMany({
      where,
      include: {
        kunde: { select: { id: true, name: true, firma: true } },
        schlag: { select: { id: true, name: true, flaeche: true } },
      },
      orderBy: { datum: "desc" },
      take: 200,
    });
    return NextResponse.json(list);
  } catch (err) {
    console.error("PSM GET error:", err);
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

  const kundeId = parseInt(String(body.kundeId), 10);
  if (isNaN(kundeId)) return NextResponse.json({ error: "Ungültige kundeId" }, { status: 400 });
  if (!body.datum) return NextResponse.json({ error: "datum erforderlich" }, { status: 400 });
  if (!body.mittel) return NextResponse.json({ error: "mittel erforderlich" }, { status: 400 });
  const menge = Number(body.menge);
  if (isNaN(menge)) return NextResponse.json({ error: "Ungültige menge" }, { status: 400 });

  const schlagId = body.schlagId ? parseInt(String(body.schlagId), 10) : null;

  try {
    const record = await prisma.psmAusbringung.create({
      data: {
        kundeId,
        schlagId: schlagId && !isNaN(schlagId) ? schlagId : null,
        datum: new Date(body.datum),
        mittel: String(body.mittel),
        wirkstoff: body.wirkstoff ? String(body.wirkstoff) : null,
        menge,
        einheit: body.einheit ? String(body.einheit) : "l/ha",
        kultur: body.kultur ? String(body.kultur) : null,
        flaeche: body.flaeche != null ? Number(body.flaeche) : null,
        anwendungsgrund: body.anwendungsgrund ? String(body.anwendungsgrund) : null,
        wartezeit: body.wartezeit != null ? parseInt(String(body.wartezeit), 10) : null,
        notiz: body.notiz ? String(body.notiz) : null,
      },
      include: {
        kunde: { select: { id: true, name: true, firma: true } },
        schlag: { select: { id: true, name: true, flaeche: true } },
      },
    });
    return NextResponse.json(record, { status: 201 });
  } catch (err) {
    console.error("PSM POST error:", err);
    const isDev = process.env.NODE_ENV === "development";
    const message = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
