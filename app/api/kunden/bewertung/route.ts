import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Math.max(1, parseInt(limitParam, 10) || 100) : undefined;

  const zwolfMonate = new Date();
  zwolfMonate.setFullYear(zwolfMonate.getFullYear() - 1);

  // Load all active customers
  const kunden = await prisma.kunde.findMany({
    where: { aktiv: true },
    select: {
      id: true,
      name: true,
      firma: true,
      flaeche: true,
      lieferungen: {
        where: { datum: { gte: zwolfMonate } },
        select: {
          id: true,
          rechnungDatum: true,
          bezahltAm: true,
          positionen: {
            select: { menge: true, verkaufspreis: true },
          },
        },
      },
      antragDaten: {
        select: { gesamtBetrag: true },
        orderBy: { gesamtBetrag: "desc" },
        take: 1,
      },
    },
    orderBy: { name: "asc" },
    ...(limit ? { take: limit } : {}),
  });

  // Calculate revenue per customer
  const umsaetze = kunden.map((k) => {
    const umsatz = k.lieferungen.reduce((sum, l) => {
      return (
        sum +
        l.positionen.reduce((s, p) => s + p.menge * p.verkaufspreis, 0)
      );
    }, 0);
    return umsatz;
  });

  const maxUmsatz = Math.max(...umsaetze, 0);

  // Score each customer
  const scored = kunden.map((k, idx) => {
    const lieferungen = k.lieferungen;
    const umsatz = umsaetze[idx];

    // 1. Umsatz: proportional to max, top = 20
    const umsatzScore =
      maxUmsatz > 0 ? Math.round((umsatz / maxUmsatz) * 20) : 0;

    // 2. Bestellhäufigkeit
    const anzahl = lieferungen.length;
    let haeufigkeitScore = 0;
    if (anzahl >= 12) haeufigkeitScore = 20;
    else if (anzahl >= 6) haeufigkeitScore = 15;
    else if (anzahl >= 3) haeufigkeitScore = 10;
    else if (anzahl >= 1) haeufigkeitScore = 5;

    // 3. Zahlungsmoral: average days between rechnungDatum and bezahltAm
    const bezahltLieferungen = lieferungen.filter(
      (l) => l.rechnungDatum && l.bezahltAm
    );
    let zahlungsmoralScore = 0;
    if (bezahltLieferungen.length > 0) {
      const avgTage =
        bezahltLieferungen.reduce((sum, l) => {
          const diff =
            (new Date(l.bezahltAm!).getTime() -
              new Date(l.rechnungDatum!).getTime()) /
            (1000 * 60 * 60 * 24);
          return sum + Math.max(0, diff);
        }, 0) / bezahltLieferungen.length;

      if (avgTage <= 14) zahlungsmoralScore = 20;
      else if (avgTage <= 30) zahlungsmoralScore = 15;
      else if (avgTage <= 60) zahlungsmoralScore = 10;
      else zahlungsmoralScore = 5;
    }

    // 4. Fläche (ha)
    const flaeche = k.flaeche ?? 0;
    let flaecheScore = 0;
    if (flaeche >= 500) flaecheScore = 20;
    else if (flaeche >= 200) flaecheScore = 15;
    else if (flaeche >= 100) flaecheScore = 10;
    else if (flaeche >= 50) flaecheScore = 5;

    // 5. AFIG-Betrag
    const afigBetrag = k.antragDaten[0]?.gesamtBetrag ?? 0;
    let afigScore = 0;
    if (afigBetrag >= 100000) afigScore = 20;
    else if (afigBetrag >= 50000) afigScore = 15;
    else if (afigBetrag >= 20000) afigScore = 10;
    else if (afigBetrag >= 5000) afigScore = 5;

    const score = umsatzScore + haeufigkeitScore + zahlungsmoralScore + flaecheScore + afigScore;

    return {
      kundeId: k.id,
      kundeName: k.name,
      firma: k.firma ?? null,
      score,
      details: {
        umsatz: umsatzScore,
        umsatzWert: umsatz,
        haeufigkeit: haeufigkeitScore,
        haeufigkeitWert: anzahl,
        zahlungsmoral: zahlungsmoralScore,
        flaeche: flaecheScore,
        flaecheWert: flaeche,
        afig: afigScore,
        afigWert: afigBetrag,
      },
    };
  });

  scored.sort((a, b) => b.score - a.score);

  return NextResponse.json(scored);
}
