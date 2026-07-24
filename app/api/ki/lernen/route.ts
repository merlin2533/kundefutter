import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Sentry } from "@/lib/sentry";
import { normalisiereSuchtext } from "@/lib/kiMatching";

const GUELTIGE_TYPEN = ["artikel", "kunde", "lieferant"];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const typ = searchParams.get("typ");
  if (!typ || !GUELTIGE_TYPEN.includes(typ)) {
    return NextResponse.json({ error: "Ungültiger oder fehlender Parameter typ" }, { status: 400 });
  }

  try {
    const eintraege = await prisma.kiLernZuordnung.findMany({
      where: { typ },
      select: { suchtext: true, zielId: true, trefferAnzahl: true },
      take: 5000,
    });
    return NextResponse.json({ eintraege });
  } catch (e) {
    Sentry.captureException(e);
    console.error("KiLernZuordnung GET error:", e);
    return NextResponse.json({ error: "Datenbankfehler beim Laden der gelernten Zuordnungen" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body;
  try {
    body = await req.json();
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const { typ, suchtext } = body;
  const zielId = Number(body.zielId);

  if (!typ || !GUELTIGE_TYPEN.includes(typ)) {
    return NextResponse.json({ error: "Ungültiger oder fehlender Parameter typ" }, { status: 400 });
  }
  if (typeof suchtext !== "string" || !suchtext.trim()) {
    return NextResponse.json({ error: "suchtext erforderlich" }, { status: 400 });
  }
  if (!zielId || isNaN(zielId)) {
    return NextResponse.json({ error: "Ungültige zielId" }, { status: 400 });
  }

  const normalisiert = normalisiereSuchtext(suchtext).slice(0, 200);

  try {
    const eintrag = await prisma.kiLernZuordnung.upsert({
      where: { typ_suchtext: { typ, suchtext: normalisiert } },
      update: { zielId, trefferAnzahl: { increment: 1 }, letzteVerwendung: new Date() },
      create: { typ, suchtext: normalisiert, zielId },
    });
    return NextResponse.json(eintrag, { status: 201 });
  } catch (e) {
    Sentry.captureException(e);
    console.error("KiLernZuordnung POST error:", e);
    return NextResponse.json({ error: "Gelernte Zuordnung konnte nicht gespeichert werden" }, { status: 500 });
  }
}
