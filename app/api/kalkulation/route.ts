import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
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
      const verkaufspreis = a.standardpreis;

      const lieferantenPreise = a.lieferanten;
      const bestesEinkaufsAngebot =
        lieferantenPreise.length > 0
          ? Math.min(...lieferantenPreise.map((l) => l.einkaufspreis))
          : null;

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
  } catch {
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
