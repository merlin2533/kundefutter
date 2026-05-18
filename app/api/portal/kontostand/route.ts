import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPortalSession } from "@/lib/portal-auth";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getPortalSession();
  if (!session) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  try {
    const lieferungen = await prisma.lieferung.findMany({
      where: {
        kundeId: session.kundeId,
        status: { not: "storniert" },
        rechnungNr: { not: null },
        bezahltAm: null,
      },
      select: {
        datum: true,
        rechnungDatum: true,
        positionen: {
          select: { menge: true, verkaufspreis: true },
        },
      },
      take: 200,
    });

    const now = new Date();
    let offen = 0;
    let ueberfaellig = 0;

    for (const l of lieferungen) {
      const betrag = l.positionen.reduce((s, p) => s + p.menge * p.verkaufspreis, 0);
      offen += betrag;
      // Überfällig wenn Rechnungsdatum + 30 Tage in der Vergangenheit
      const basisDatum = l.rechnungDatum ?? l.datum;
      const faellig = new Date(basisDatum.getTime() + 30 * 86400000);
      if (faellig < now) {
        ueberfaellig += betrag;
      }
    }

    return NextResponse.json({ offen, ueberfaellig });
  } catch {
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
