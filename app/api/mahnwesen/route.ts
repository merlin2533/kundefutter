import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseMahnwesenConfig } from "@/lib/mahnwesen-config";
export const dynamic = "force-dynamic";


export async function GET() {
  try {
    const heute = new Date();
    heute.setHours(0, 0, 0, 0);

    const cfgSetting = await prisma.einstellung.findUnique({
      where: { key: "system.mahnwesen" },
    });
    const cfg = parseMahnwesenConfig(cfgSetting?.value);
    const mahnstufe = (tage: number): 1 | 2 | 3 =>
      tage >= cfg.stufe3Tage ? 3 : tage >= cfg.stufe2Tage ? 2 : 1;

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

      // Mahnstufen-Fristen aus den Einstellungen (system.mahnwesen)
      if (tageUeberfaellig < cfg.stufe1Tage) continue; // noch keine Mahnstufe fällig
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
