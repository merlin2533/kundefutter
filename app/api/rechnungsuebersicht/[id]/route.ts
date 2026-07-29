import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const uebersicht = await prisma.rechnungsuebersicht.findUnique({
      where: { id: numId },
      include: {
        kunde: { select: { id: true, name: true, firma: true, strasse: true, plz: true, ort: true } },
        eintraege: {
          select: {
            id: true,
            lieferung: {
              select: {
                id: true,
                rechnungNr: true,
                rechnungDatum: true,
                datum: true,
                bezahltAm: true,
                rechnungStorniert: true,
                positionen: { select: { menge: true, verkaufspreis: true, rabattProzent: true } },
              },
            },
          },
        },
      },
    });
    if (!uebersicht) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json(uebersicht);
  } catch (err) {
    Sentry.captureException(err);
    console.error("Rechnungsuebersicht GET [id]:", err);
    return NextResponse.json({ error: "Interner Fehler" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    // RechnungsuebersichtEintrag hat onDelete: Cascade — die zugrundeliegenden
    // Lieferungen/Rechnungen selbst bleiben unangetastet.
    await prisma.rechnungsuebersicht.delete({ where: { id: numId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err);
    const isNotFound = (err as { code?: string }).code === "P2025";
    if (isNotFound) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    console.error("Rechnungsuebersicht DELETE [id]:", err);
    return NextResponse.json({ error: "Interner Fehler" }, { status: 500 });
  }
}
