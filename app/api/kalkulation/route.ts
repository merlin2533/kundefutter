import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loeseArtikelPreiseFuerJahr, loeseJahrespreisAuf } from "@/lib/jahrespreis";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";


export async function GET(req: NextRequest) {
  try {
    const artikelList = await prisma.artikel.findMany({
      where: { aktiv: true },
      include: {
        lieferanten: {
          include: { lieferant: true },
        },
      },
      orderBy: { name: "asc" },
      take: 2000,
    });

    // Optional: Preise für ein bestimmtes Jahr auflösen (Jahresgültigkeiten)
    const jahrParam = req.nextUrl.searchParams.get("jahr");
    const jahr = jahrParam ? parseInt(jahrParam, 10) : null;

    const verkaufAufloesungen = jahr && !isNaN(jahr)
      ? await loeseArtikelPreiseFuerJahr(artikelList.map((a) => ({ id: a.id, standardpreis: a.standardpreis })), jahr)
      : null;

    const alleArtikelLieferantIds = artikelList.flatMap((a) => a.lieferanten.map((l) => l.id));
    const einkaufJahrespreise = jahr && !isNaN(jahr) && alleArtikelLieferantIds.length > 0
      ? await prisma.artikelLieferantJahrespreis.findMany({
          where: { artikelLieferantId: { in: alleArtikelLieferantIds } },
          select: { artikelLieferantId: true, jahr: true, einkaufspreis: true },
        })
      : [];
    const einkaufByArtikelLieferant = new Map<number, { jahr: number; preis: number }[]>();
    for (const e of einkaufJahrespreise) {
      if (!einkaufByArtikelLieferant.has(e.artikelLieferantId)) einkaufByArtikelLieferant.set(e.artikelLieferantId, []);
      einkaufByArtikelLieferant.get(e.artikelLieferantId)!.push({ jahr: e.jahr, preis: e.einkaufspreis });
    }

    const result = artikelList.map((a) => {
      const verkaufAufloesung = verkaufAufloesungen?.get(a.id) ?? null;
      const verkaufspreis = verkaufAufloesung?.preis ?? a.standardpreis;

      const lieferantenPreise = a.lieferanten;
      const einkaufspreisFuer = (lieferantId: number, basis: number) =>
        jahr && !isNaN(jahr)
          ? loeseJahrespreisAuf(einkaufByArtikelLieferant.get(lieferantId) ?? [], jahr, basis).preis
          : basis;

      const einkaufspreiseAufgeloest = lieferantenPreise.map((l) => einkaufspreisFuer(l.id, l.einkaufspreis));
      const bestesEinkaufsAngebot = einkaufspreiseAufgeloest.length > 0 ? Math.min(...einkaufspreiseAufgeloest) : null;

      const bevorzugtIndex = lieferantenPreise.findIndex((l) => l.bevorzugt);
      const gewaehlterIndex = bevorzugtIndex >= 0 ? bevorzugtIndex : 0;
      const aktuellerEinkaufspreis = lieferantenPreise.length > 0 ? einkaufspreiseAufgeloest[gewaehlterIndex] : 0;

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
        verkaufspreisInterpoliert: verkaufAufloesung?.interpoliert ?? false,
        verkaufspreisQuelleJahr: verkaufAufloesung?.quelleJahr ?? null,
        marge,
        margePercent,
        lieferantenPreise,
        bestesEinkaufsAngebot,
        potenzielleErsparnis,
      };
    });

    return NextResponse.json(result);
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
