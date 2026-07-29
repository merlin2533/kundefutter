import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";

const listInclude = {
  kunde: { select: { id: true, name: true, firma: true } },
  eintraege: {
    select: {
      lieferung: {
        select: {
          id: true,
          rechnungNr: true,
          rechnungDatum: true,
          datum: true,
          positionen: { select: { menge: true, verkaufspreis: true, rabattProzent: true } },
        },
      },
    },
  },
} as const;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const kundeId = searchParams.get("kundeId");

  const where: Record<string, unknown> = {};
  if (kundeId) {
    const id = parseInt(kundeId, 10);
    if (isNaN(id)) return NextResponse.json({ error: "Ungültige kundeId" }, { status: 400 });
    where.kundeId = id;
  }

  try {
    const uebersichten = await prisma.rechnungsuebersicht.findMany({
      where,
      include: listInclude,
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return NextResponse.json(uebersichten);
  } catch (err) {
    Sentry.captureException(err);
    console.error("Rechnungsuebersicht GET error:", err);
    return NextResponse.json({ error: "Interner Fehler" }, { status: 500 });
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

  const { kundeId, titel, notiz, lieferungIds } = body as {
    kundeId?: number;
    titel?: string;
    notiz?: string;
    lieferungIds?: number[];
  };

  if (!kundeId || typeof kundeId !== "number") {
    return NextResponse.json({ error: "kundeId ist erforderlich" }, { status: 400 });
  }
  if (!Array.isArray(lieferungIds) || lieferungIds.length === 0) {
    return NextResponse.json({ error: "Mindestens eine Rechnung muss ausgewählt werden" }, { status: 400 });
  }
  if (lieferungIds.some((id) => typeof id !== "number" || isNaN(id))) {
    return NextResponse.json({ error: "lieferungIds müssen Zahlen sein" }, { status: 400 });
  }

  try {
    const kunde = await prisma.kunde.findUnique({ where: { id: kundeId }, select: { id: true } });
    if (!kunde) return NextResponse.json({ error: "Kunde nicht gefunden" }, { status: 404 });

    // Nur bereits ausgestellte Einzelrechnungen (rechnungNr gesetzt) des angegebenen Kunden
    // dürfen in eine Übersicht aufgenommen werden — die Übersicht fasst Bestehendes
    // zusammen, statt neue Rechnungen zu erzeugen.
    const lieferungen = await prisma.lieferung.findMany({
      where: { id: { in: lieferungIds } },
      select: { id: true, kundeId: true, rechnungNr: true },
    });
    if (lieferungen.length !== lieferungIds.length) {
      return NextResponse.json({ error: "Mindestens eine Lieferung wurde nicht gefunden" }, { status: 404 });
    }
    const ungueltig = lieferungen.filter((l) => l.kundeId !== kundeId || !l.rechnungNr);
    if (ungueltig.length > 0) {
      return NextResponse.json(
        { error: `Lieferungen [${ungueltig.map((l) => l.id).join(", ")}] gehören nicht zum Kunden oder haben noch keine Rechnungsnummer` },
        { status: 400 },
      );
    }

    const uebersicht = await prisma.rechnungsuebersicht.create({
      data: {
        kundeId,
        titel: titel?.trim() || null,
        notiz: notiz?.trim() || null,
        eintraege: { create: lieferungIds.map((lieferungId) => ({ lieferungId })) },
      },
      include: listInclude,
    });

    return NextResponse.json(uebersicht, { status: 201 });
  } catch (err) {
    Sentry.captureException(err);
    console.error("Rechnungsuebersicht POST error:", err);
    const isDev = process.env.NODE_ENV === "development";
    const message = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
