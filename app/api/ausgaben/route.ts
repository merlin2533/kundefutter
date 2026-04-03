import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const KATEGORIEN = [
  "Wareneinkauf",
  "Betriebsbedarf",
  "Fahrtkosten",
  "Bürobedarf",
  "Telefon/Internet",
  "Versicherung",
  "Miete",
  "Sonstige",
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const von = searchParams.get("von");
  const bis = searchParams.get("bis");
  const kategorie = searchParams.get("kategorie");
  const lieferantId = searchParams.get("lieferantId");
  const unbezahlt = searchParams.get("unbezahlt") === "true";

  const where: Record<string, unknown> = {};

  if (von || bis) {
    where.datum = {
      ...(von ? { gte: new Date(von) } : {}),
      ...(bis ? { lte: new Date(new Date(bis).setHours(23, 59, 59, 999)) } : {}),
    };
  }
  if (kategorie) where.kategorie = kategorie;
  if (lieferantId) {
    const id = parseInt(lieferantId, 10);
    if (!isNaN(id)) where.lieferantId = id;
  }
  if (unbezahlt) where.bezahltAm = null;

  try {
    const ausgaben = await prisma.ausgabe.findMany({
      where,
      include: { lieferant: { select: { id: true, name: true } } },
      orderBy: { datum: "desc" },
      take: 500,
    });
    return NextResponse.json(ausgaben);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { datum, belegNr, beschreibung, betragNetto, mwstSatz, kategorie, lieferantId, bezahltAm, notiz } = body;

    if (!beschreibung || betragNetto === undefined) {
      return NextResponse.json({ error: "Beschreibung und Betrag sind erforderlich" }, { status: 400 });
    }
    const betrag = parseFloat(betragNetto);
    if (isNaN(betrag) || betrag < 0) {
      return NextResponse.json({ error: "Ungültiger Betrag" }, { status: 400 });
    }
    const mwst = parseFloat(mwstSatz ?? "19");
    if (isNaN(mwst) || ![0, 7, 19].includes(mwst)) {
      return NextResponse.json({ error: "Ungültiger MwSt-Satz" }, { status: 400 });
    }
    if (kategorie && !KATEGORIEN.includes(kategorie)) {
      return NextResponse.json({ error: "Ungültige Kategorie" }, { status: 400 });
    }

    const ausgabe = await prisma.ausgabe.create({
      data: {
        datum: datum ? new Date(datum) : new Date(),
        belegNr: belegNr || null,
        beschreibung: String(beschreibung).trim(),
        betragNetto: betrag,
        mwstSatz: mwst,
        kategorie: kategorie || "Sonstige",
        lieferantId: lieferantId ? parseInt(lieferantId, 10) : null,
        bezahltAm: bezahltAm ? new Date(bezahltAm) : null,
        notiz: notiz || null,
      },
      include: { lieferant: { select: { id: true, name: true } } },
    });

    return NextResponse.json(ausgabe, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
