import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { berechneLieferungBrutto, berechneSammelrechnungBrutto } from "@/lib/lieferung-brutto";
import { Sentry } from "@/lib/sentry";

export const dynamic = "force-dynamic";

const TAKE = 15;

export interface DoppelzahlungTreffer {
  zielTyp: "lieferung" | "sammelrechnung";
  zielId: number;
  kundeId: number;
  kundeName: string;
  rechnungNr: string;
  betrag: number;
  rechnungDatum: string | null;
  bezahlt: boolean;
}

/**
 * Sucht Rechnungen für den Bankabgleich-Doppelzahlungs-Flow — bewusst OHNE den
 * `bezahltAm: null`-Filter, den jede andere Kandidatensuche in lib/bankabgleich-kandidaten.ts
 * hat (siehe dortiger Architektur-Kommentar). Eine Doppelzahlung betrifft per Definition genau
 * die Rechnung, die durch die ERSTE Zahlung bereits als bezahlt markiert wurde — deshalb ein
 * eigener, schmaler Endpunkt statt einer Änderung an der geteilten Kandidaten-Suche, die von
 * Massen-Abgleich und normalen Zuordnungsvorschlägen genutzt wird.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json([]);

  try {
    const [lieferungen, sammelrechnungen] = await Promise.all([
      prisma.lieferung.findMany({
        where: {
          rechnungNr: { not: null },
          OR: [{ rechnungNr: { contains: q } }, { kunde: { name: { contains: q } } }],
        },
        include: {
          kunde: { select: { id: true, name: true } },
          positionen: { include: { artikel: { select: { mwstSatz: true } } } },
        },
        take: TAKE,
        orderBy: { rechnungDatum: "desc" },
      }),
      prisma.sammelrechnung.findMany({
        where: {
          rechnungNr: { not: null },
          OR: [{ rechnungNr: { contains: q } }, { kunde: { name: { contains: q } } }],
        },
        include: {
          kunde: { select: { id: true, name: true } },
          lieferungen: { include: { positionen: { include: { artikel: { select: { mwstSatz: true } } } } } },
        },
        take: TAKE,
        orderBy: { rechnungDatum: "desc" },
      }),
    ]);

    const treffer: DoppelzahlungTreffer[] = [
      ...lieferungen.map((l) => ({
        zielTyp: "lieferung" as const,
        zielId: l.id,
        kundeId: l.kunde.id,
        kundeName: l.kunde.name,
        rechnungNr: l.rechnungNr as string,
        betrag: berechneLieferungBrutto(l),
        rechnungDatum: l.rechnungDatum ? l.rechnungDatum.toISOString().slice(0, 10) : null,
        bezahlt: !!l.bezahltAm,
      })),
      ...sammelrechnungen.map((s) => ({
        zielTyp: "sammelrechnung" as const,
        zielId: s.id,
        kundeId: s.kunde.id,
        kundeName: s.kunde.name,
        rechnungNr: s.rechnungNr as string,
        betrag: berechneSammelrechnungBrutto(s),
        rechnungDatum: s.rechnungDatum ? s.rechnungDatum.toISOString().slice(0, 10) : null,
        bezahlt: !!s.bezahltAm,
      })),
    ];
    treffer.sort((a, b) => (b.rechnungDatum ?? "").localeCompare(a.rechnungDatum ?? ""));

    return NextResponse.json(treffer.slice(0, TAKE));
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
