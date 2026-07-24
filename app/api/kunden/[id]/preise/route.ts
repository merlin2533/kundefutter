import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { artikelSafeSelect } from "@/lib/artikel-select";
import { loeseKundePreiseFuerJahr } from "@/lib/jahrespreis";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";


type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const preise = await prisma.kundeArtikelPreis.findMany({
      where: { kundeId: Number(id) },
      include: { artikel: { select: artikelSafeSelect } },
    });

    const jahrParam = req.nextUrl.searchParams.get("jahr");
    const jahr = jahrParam ? parseInt(jahrParam, 10) : null;
    if (!jahr || isNaN(jahr)) return NextResponse.json(preise);

    const aufloesungen = await loeseKundePreiseFuerJahr(preise, jahr);
    const ergebnis = preise.map((p) => {
      const auf = aufloesungen.get(p.id);
      if (!auf) return p;
      return {
        ...p,
        preisJahr: auf.preis,
        preisJahrInterpoliert: auf.interpoliert,
        preisJahrQuelleJahr: auf.quelleJahr,
        preisJahrRichtung: auf.richtung,
      };
    });
    return NextResponse.json(ergebnis);
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  let body;
  try {
    body = await req.json();
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const { artikelId, preis, rabatt } = body;
  if (!artikelId || typeof artikelId !== "number") {
    return NextResponse.json({ error: "artikelId ist erforderlich" }, { status: 400 });
  }
  if (preis === undefined || preis === null || typeof preis !== "number") {
    return NextResponse.json({ error: "preis ist erforderlich" }, { status: 400 });
  }

  try {
    const eintrag = await prisma.kundeArtikelPreis.upsert({
      where: { kundeId_artikelId: { kundeId: Number(id), artikelId } },
      update: { preis, rabatt: rabatt ?? 0 },
      create: { kundeId: Number(id), artikelId, preis, rabatt: rabatt ?? 0 },
      include: { artikel: { select: artikelSafeSelect } },
    });
    return NextResponse.json(eintrag);
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Fehler beim Speichern des Sonderpreises" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  let body;
  try {
    body = await req.json();
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const { artikelId } = body;
  if (!artikelId) {
    return NextResponse.json({ error: "artikelId ist erforderlich" }, { status: 400 });
  }

  try {
    await prisma.kundeArtikelPreis.delete({
      where: { kundeId_artikelId: { kundeId: Number(id), artikelId } },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Sonderpreis nicht gefunden" }, { status: 404 });
  }
}
