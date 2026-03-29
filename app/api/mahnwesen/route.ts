import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function mahnstufe(tageUeberfaellig: number): 1 | 2 | 3 {
  if (tageUeberfaellig >= 42) return 3;
  if (tageUeberfaellig >= 28) return 2;
  return 1; // ab 14 Tagen überfällig
}

export async function GET() {
  try {
    const heute = new Date();
    heute.setHours(0, 0, 0, 0);

    // Alle gelieferten, unbezahlten Lieferungen mit Rechnung laden
    const offene = await prisma.lieferung.findMany({
      where: { status: "geliefert", bezahltAm: null, rechnungNr: { not: null } },
      include: {
        kunde: { select: { id: true, name: true, firma: true } },
        positionen: { select: { menge: true, verkaufspreis: true } },
      },
      orderBy: { datum: "asc" },
      take: 500,
    });

    const result = [];

    for (const l of offene) {
      const zahlungstageFrist = l.zahlungsziel ?? 30;
      const basisDatum = l.rechnungDatum ?? l.datum;
      const faelligAm = new Date(new Date(basisDatum).getTime() + zahlungstageFrist * 24 * 60 * 60 * 1000);
      faelligAm.setHours(0, 0, 0, 0);

      if (heute <= faelligAm) continue; // noch nicht überfällig

      const tageUeberfaellig = Math.floor((heute.getTime() - faelligAm.getTime()) / (24 * 60 * 60 * 1000));

      // Mahnstufen: Stufe 1 ab 14 Tagen, Stufe 2 ab 28 Tagen, Stufe 3 ab 42 Tagen
      if (tageUeberfaellig < 14) continue; // noch keine Mahnstufe fällig
      const stufe = mahnstufe(tageUeberfaellig);

      const betrag = l.positionen.reduce((s, p) => s + p.menge * p.verkaufspreis, 0);

      result.push({
        lieferung: { id: l.id, datum: l.datum, notiz: l.notiz },
        kunde: l.kunde,
        rechnungNr: l.rechnungNr,
        rechnungDatum: l.rechnungDatum ?? l.datum,
        betrag: Math.round(betrag * 100) / 100,
        tageUeberfaellig,
        mahnstufe: stufe,
      });
    }

    // Sortieren: höchste Mahnstufe / älteste zuerst
    result.sort((a, b) => b.tageUeberfaellig - a.tageUeberfaellig);

    return NextResponse.json(result);
  } catch (err) {
    console.error("Mahnwesen GET:", err);
    return NextResponse.json({ error: "Interner Fehler" }, { status: 500 });
  }
}
