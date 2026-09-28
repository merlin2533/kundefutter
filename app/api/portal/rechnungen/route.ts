import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPortalSession } from "@/lib/portal-auth";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getPortalSession();
  if (!session) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  try {
    const lieferungen = await prisma.lieferung.findMany({
      where: {
        kundeId: session.kundeId,
        rechnungNr: { not: null },
      },
      select: {
        id: true,
        datum: true,
        rechnungNr: true,
        rechnungDatum: true,
        status: true,
        bezahltAm: true,
        positionen: {
          select: {
            menge: true,
            verkaufspreis: true,
            rabattProzent: true,
          },
        },
      },
      orderBy: { datum: "desc" },
      take: 50,
    });

    const result = lieferungen.map((l) => {
      // verkaufspreis ist der Listenpreis (siehe lib/lieferung.ts) — ohne rabattProzent
      // einzurechnen zeigt die Rechnungsliste im Kundenportal bei jeder rabattierten Position
      // (Mengenstaffel/manuell) einen zu hohen Betrag.
      const gesamtBetrag = l.positionen.reduce(
        (sum, p) => sum + p.menge * p.verkaufspreis * (1 - (p.rabattProzent ?? 0) / 100),
        0,
      );
      return {
        id: l.id,
        datum: l.datum,
        rechnungNr: l.rechnungNr,
        rechnungDatum: l.rechnungDatum,
        status: l.status,
        bezahlt: !!l.bezahltAm,
        gesamtBetrag,
      };
    });

    return NextResponse.json(result);
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
