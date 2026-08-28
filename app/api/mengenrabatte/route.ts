import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";


export async function GET() {
  try {
    const rabatte = await prisma.mengenrabatt.findMany({
      include: {
        artikel: { select: { id: true, name: true, artikelnummer: true, kategorie: true } },
        kunde: { select: { id: true, name: true, firma: true } },
      },
      orderBy: { id: "desc" },
      take: 200,
    });
    return NextResponse.json(rabatte);
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
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

  const { kundeId, artikelId, kategorie, vonMenge, preis, rabattProzent, aktiv } = body;

  if (vonMenge === undefined || vonMenge === null) {
    return NextResponse.json({ error: "vonMenge ist erforderlich" }, { status: 400 });
  }
  const hatPreis = preis !== undefined && preis !== null && preis !== "";
  const hatRabattProzent = rabattProzent !== undefined && rabattProzent !== null && rabattProzent !== "";
  if (!hatPreis && !hatRabattProzent) {
    return NextResponse.json({ error: "preis ist erforderlich" }, { status: 400 });
  }
  if (hatPreis && Number(preis) < 0) {
    return NextResponse.json({ error: "preis darf nicht negativ sein" }, { status: 400 });
  }
  if (hatRabattProzent && (Number(rabattProzent) < 0 || Number(rabattProzent) > 100)) {
    return NextResponse.json({ error: "rabattProzent muss zwischen 0 und 100 liegen" }, { status: 400 });
  }
  if (!artikelId && !kategorie) {
    return NextResponse.json({ error: "Entweder artikelId oder kategorie muss angegeben werden" }, { status: 400 });
  }

  try {
    const rabatt = await prisma.mengenrabatt.create({
      data: {
        kundeId: kundeId ? Number(kundeId) : null,
        artikelId: artikelId ? Number(artikelId) : null,
        kategorie: artikelId ? null : kategorie,
        vonMenge: Number(vonMenge),
        // preis ist die primäre, neue Eingabeart — rabattProzent bleibt nur für per API/Skript
        // direkt gesetzte Legacy-Staffeln nutzbar, das UI (/mengenrabatte/neu) sendet nur preis.
        preis: hatPreis ? Number(preis) : null,
        rabattProzent: hatPreis ? 0 : Number(rabattProzent),
        aktiv: aktiv !== undefined ? Boolean(aktiv) : true,
      },
      include: {
        artikel: { select: { id: true, name: true, artikelnummer: true, kategorie: true } },
        kunde: { select: { id: true, name: true, firma: true } },
      },
    });
    return NextResponse.json(rabatt, { status: 201 });
  } catch (err) {
    Sentry.captureException(err);
    console.error("Mengenrabatt POST error:", err);
    const isDev = process.env.NODE_ENV === "development";
    const message = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id fehlt" }, { status: 400 });
  }
  try {
    await prisma.mengenrabatt.delete({ where: { id: Number(id) } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Mengenrabatt nicht gefunden" }, { status: 404 });
  }
}
