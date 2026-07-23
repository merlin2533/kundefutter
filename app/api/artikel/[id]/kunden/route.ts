import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Sentry } from "@/lib/sentry";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

type Quelle = "lieferung" | "vorbestellung" | "angebot";

export interface Vorgang {
  quelle: Quelle;
  status: string;
  kundeId: number;
  kundeName: string;
  kundeOrt: string | null;
  menge: number;
  einheit: string | null;
  datum: string;
  referenzId: number;
  referenzNr: string | null;
  chargeNr: string | null;
}

const isDev = process.env.NODE_ENV === "development";

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const artikelId = parseInt(id, 10);
  if (isNaN(artikelId)) {
    return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });
  }

  try {
    const artikel = await prisma.artikel.findUnique({
      where: { id: artikelId },
      select: { id: true, name: true },
    });
    if (!artikel) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    const [lieferpositionen, vorbestellPositionen, angebotPositionen] = await Promise.all([
      prisma.lieferposition.findMany({
        where: { artikelId, lieferung: { status: { in: ["geplant", "geliefert"] } } },
        select: {
          menge: true,
          chargeNr: true,
          lieferung: {
            select: {
              id: true,
              kundeId: true,
              datum: true,
              lieferDatum: true,
              status: true,
              kunde: { select: { id: true, name: true, ort: true } },
            },
          },
        },
        orderBy: { lieferung: { datum: "desc" } },
        take: 2000,
      }),
      prisma.vorbestellungPosition.findMany({
        where: { artikelId, vorbestellung: { status: { in: ["OFFEN", "BESTAETIGT"] } } },
        select: {
          menge: true,
          einheit: true,
          vorbestellung: {
            select: {
              id: true,
              nummer: true,
              status: true,
              bestelldatum: true,
              kundeId: true,
              kunde: { select: { id: true, name: true, ort: true } },
            },
          },
        },
        take: 1000,
      }),
      prisma.angebotPosition.findMany({
        where: { artikelId, angebot: { status: "OFFEN" } },
        select: {
          menge: true,
          einheit: true,
          angebot: {
            select: {
              id: true,
              nummer: true,
              status: true,
              datum: true,
              kundeId: true,
              kunde: { select: { id: true, name: true, ort: true } },
            },
          },
        },
        take: 1000,
      }),
    ]);

    const vorgaenge: Vorgang[] = [
      ...lieferpositionen.map((p): Vorgang => ({
        quelle: "lieferung",
        status: p.lieferung.status,
        kundeId: p.lieferung.kunde.id,
        kundeName: p.lieferung.kunde.name,
        kundeOrt: p.lieferung.kunde.ort,
        menge: p.menge,
        einheit: null,
        datum: (p.lieferung.lieferDatum ?? p.lieferung.datum).toISOString(),
        referenzId: p.lieferung.id,
        referenzNr: null,
        chargeNr: p.chargeNr,
      })),
      ...vorbestellPositionen.map((p): Vorgang => ({
        quelle: "vorbestellung",
        status: p.vorbestellung.status,
        kundeId: p.vorbestellung.kunde.id,
        kundeName: p.vorbestellung.kunde.name,
        kundeOrt: p.vorbestellung.kunde.ort,
        menge: p.menge,
        einheit: p.einheit,
        datum: p.vorbestellung.bestelldatum.toISOString(),
        referenzId: p.vorbestellung.id,
        referenzNr: p.vorbestellung.nummer,
        chargeNr: null,
      })),
      ...angebotPositionen.map((p): Vorgang => ({
        quelle: "angebot",
        status: p.angebot.status,
        kundeId: p.angebot.kunde.id,
        kundeName: p.angebot.kunde.name,
        kundeOrt: p.angebot.kunde.ort,
        menge: p.menge,
        einheit: p.einheit,
        datum: p.angebot.datum.toISOString(),
        referenzId: p.angebot.id,
        referenzNr: p.angebot.nummer,
        chargeNr: null,
      })),
    ].sort((a, b) => (a.datum < b.datum ? 1 : -1));

    return NextResponse.json({ artikel, vorgaenge });
  } catch (err) {
    Sentry.captureException(err);
    const message = isDev && err instanceof Error ? err.message : "Interner Fehler";
    console.error("Artikel/kunden GET error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
