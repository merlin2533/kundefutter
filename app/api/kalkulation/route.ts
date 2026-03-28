import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const artikelList = await prisma.artikel.findMany({
    where: { aktiv: true },
    include: {
      lieferanten: {
        include: { lieferant: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const result = artikelList.map((a) => {
    const einkaufspreis = a.standardpreis;
    // verkaufspreis: use standardpreis as the sell price base
    // The schema has standardpreis as the main price field
    // We treat standardpreis as the VK price and derive EK from lieferanten
    // Actually from schema: standardpreis is the base price on Artikel
    // We use it as verkaufspreis, and lieferanten provide einkaufspreise
    const verkaufspreis = a.standardpreis;

    // bestesEinkaufsAngebot = min einkaufspreis across all ArtikelLieferant entries
    const lieferantenPreise = a.lieferanten;
    const bestesEinkaufsAngebot =
      lieferantenPreise.length > 0
        ? Math.min(...lieferantenPreise.map((l) => l.einkaufspreis))
        : null;

    // Use bevorzugter Lieferant einkaufspreis, or min lieferant price, or 0 as EK
    const bevorzugterLieferant = lieferantenPreise.find((l) => l.bevorzugt) ?? lieferantenPreise[0];
    const aktuellerEinkaufspreis =
      bevorzugterLieferant?.einkaufspreis ?? 0;

    const marge = verkaufspreis - aktuellerEinkaufspreis;
    const margePercent =
      verkaufspreis > 0 ? (marge / verkaufspreis) * 100 : 0;

    const potenzielleErsparnis =
      bestesEinkaufsAngebot !== null && bestesEinkaufsAngebot < aktuellerEinkaufspreis
        ? aktuellerEinkaufspreis - bestesEinkaufsAngebot
        : 0;

    return {
      id: a.id,
      artikelnummer: a.artikelnummer,
      name: a.name,
      einheit: a.einheit,
      kategorie: a.kategorie,
      einkaufspreis: aktuellerEinkaufspreis,
      verkaufspreis,
      marge,
      margePercent,
      lieferantenPreise,
      bestesEinkaufsAngebot,
      potenzielleErsparnis,
    };
  });

  return NextResponse.json(result);
}
