import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseMahnwesenConfig } from "@/lib/mahnwesen-config";
import { berechneLieferungBrutto } from "@/lib/lieferung-brutto";
import { Sentry } from "@/lib/sentry";
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
      where: { status: "geliefert", bezahltAm: null, rechnungNr: { not: null }, rechnungStorniert: null },
      include: {
        kunde: { select: { id: true, name: true, firma: true, kontakte: { where: { typ: "email" }, select: { wert: true }, take: 1 } } },
        positionen: {
          select: {
            menge: true, verkaufspreis: true, rabattProzent: true,
            artikel: { select: { mwstSatz: true } },
          },
        },
      },
      orderBy: { datum: "asc" },
      take: 500,
    });

    // manuelleMahnstufe ist im include oben nicht selektierbar eingeschränkt (voller Datensatz) —
    // Prisma liefert das Feld automatisch mit, da kein explizites `select` verwendet wird.

    const result = [];

    for (const l of offene) {
      const zahlungstageFrist = l.zahlungsziel ?? 30;
      const basisDatum = l.rechnungDatum ?? l.datum;
      const faelligAm = new Date(new Date(basisDatum).getTime() + zahlungstageFrist * 24 * 60 * 60 * 1000);
      faelligAm.setHours(0, 0, 0, 0);

      if (heute <= faelligAm) continue; // noch nicht überfällig

      const tageUeberfaellig = Math.floor((heute.getTime() - faelligAm.getTime()) / (24 * 60 * 60 * 1000));

      // Mahnstufen-Fristen aus den Einstellungen (system.mahnwesen)
      const automatischeStufe = mahnstufe(tageUeberfaellig);
      // Manueller Override (z.B. um ohne Mahngebühr auf Stufe 1 zurückzustufen) hat Vorrang vor der
      // automatischen Berechnung. Ist kein Override gesetzt UND die automatische Stufe noch nicht
      // erreicht, taucht der Eintrag (wie bisher) gar nicht erst in der Liste auf.
      if (l.manuelleMahnstufe === null && tageUeberfaellig < cfg.stufe1Tage) continue;
      const stufe = (l.manuelleMahnstufe ?? automatischeStufe) as 1 | 2 | 3;

      const betrag = berechneLieferungBrutto({ positionen: l.positionen });

      result.push({
        lieferung: { id: l.id, datum: l.datum, notiz: l.notiz },
        kunde: l.kunde,
        rechnungNr: l.rechnungNr,
        rechnungDatum: l.rechnungDatum ?? l.datum,
        betrag: Math.round(betrag * 100) / 100,
        tageUeberfaellig,
        mahnstufe: stufe,
        automatischeMahnstufe: automatischeStufe,
        mahnstufeManuell: l.manuelleMahnstufe !== null,
      });
    }

    // Sortieren: höchste Mahnstufe / älteste zuerst
    result.sort((a, b) => b.tageUeberfaellig - a.tageUeberfaellig);

    return NextResponse.json(result);
  } catch (err) {
    Sentry.captureException(err);
    console.error("Mahnwesen GET:", err);
    return NextResponse.json({ error: "Interner Fehler" }, { status: 500 });
  }
}
