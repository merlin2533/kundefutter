import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";


type Params = { params: Promise<{ id: string }> };

// GET: alte Forderungen eines Kunden. ?offen=true filtert auf noch nicht erledigte.
export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const nurOffen = req.nextUrl.searchParams.get("offen") === "true";
  try {
    const forderungen = await prisma.kundeForderung.findMany({
      where: { kundeId: Number(id), ...(nurOffen ? { erledigt: false } : {}) },
      include: {
        quelleLieferung: { select: { id: true, rechnungNr: true, datum: true } },
        erledigtBeiLieferung: { select: { id: true, rechnungNr: true, datum: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(forderungen);
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

// POST: neue offene Forderung erfassen (z.B. Restdifferenz aus einer Unterzahlung im
// Bankabgleich) — wird automatisch auf die nächste Rechnung dieses Kunden übernommen
// (siehe injiziereAlteForderungen() in lib/lieferung.ts, aufgerufen bei rechnung_erstellen).
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  let body;
  try {
    body = await req.json();
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const { betrag, grund, quelleLieferungId } = body;
  if (typeof betrag !== "number" || !Number.isFinite(betrag) || betrag <= 0) {
    return NextResponse.json({ error: "Betrag muss größer als 0 sein" }, { status: 400 });
  }
  if (!grund || typeof grund !== "string" || !grund.trim()) {
    return NextResponse.json({ error: "Grund ist erforderlich" }, { status: 400 });
  }

  try {
    const forderung = await prisma.kundeForderung.create({
      data: {
        kundeId: Number(id),
        betrag,
        grund: grund.trim(),
        quelleLieferungId: quelleLieferungId ? Number(quelleLieferungId) : null,
      },
      include: {
        quelleLieferung: { select: { id: true, rechnungNr: true, datum: true } },
      },
    });
    return NextResponse.json(forderung, { status: 201 });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Fehler beim Speichern der Forderung" }, { status: 500 });
  }
}

// DELETE ?forderungId=: nur solange noch nicht erledigt (sonst steckt sie bereits in
// einer Rechnung und darf nicht rückwirkend verschwinden).
export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const forderungIdRaw = req.nextUrl.searchParams.get("forderungId");
  const forderungId = forderungIdRaw ? parseInt(forderungIdRaw, 10) : NaN;
  if (isNaN(forderungId)) {
    return NextResponse.json({ error: "forderungId fehlt" }, { status: 400 });
  }

  try {
    const bestehende = await prisma.kundeForderung.findUnique({ where: { id: forderungId } });
    if (!bestehende || bestehende.kundeId !== Number(id)) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }
    if (bestehende.erledigt) {
      return NextResponse.json({ error: "Bereits auf einer Rechnung aufgeführt — kann nicht mehr gelöscht werden" }, { status: 400 });
    }
    await prisma.kundeForderung.delete({ where: { id: forderungId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Fehler beim Löschen" }, { status: 500 });
  }
}
