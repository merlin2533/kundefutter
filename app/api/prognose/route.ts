import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const zeitraumTage = Number(searchParams.get("zeitraum") ?? "90");
  const zielhorizontTage = Number(searchParams.get("zielhorizont") ?? "30");
  const schwellwertTage = Number(searchParams.get("schwellwert") ?? "21");
  const saisonal = searchParams.get("saisonal") === "true";

  const seit = new Date();
  seit.setDate(seit.getDate() - zeitraumTage);

  const artikel = await prisma.artikel.findMany({
    where: { aktiv: true },
    include: {
      lieferanten: { include: { lieferant: true }, where: { bevorzugt: true } },
      lieferpositionen: {
        where: {
          lieferung: {
            status: "geliefert",
            datum: { gte: seit },
          },
        },
        include: { lieferung: true },
      },
    },
  });

  const aktuellerMonat = new Date().getMonth(); // 0-11

  const prognosen = artikel.map((a) => {
    const gesamtVerbrauch = a.lieferpositionen.reduce((s, p) => s + p.menge, 0);
    const avgTagesverbrauch = gesamtVerbrauch / zeitraumTage;

    let effektiverTagesverbrauch = avgTagesverbrauch;

    // Saisonaler Faktor (einfaches Modell nach Kategorie)
    if (saisonal && avgTagesverbrauch > 0) {
      effektiverTagesverbrauch = avgTagesverbrauch * getSaisonalerFaktor(a.kategorie, aktuellerMonat);
    }

    const reichweiteTage =
      effektiverTagesverbrauch > 0
        ? Math.round(a.aktuellerBestand / effektiverTagesverbrauch)
        : null;

    const bestellvorschlag =
      effektiverTagesverbrauch > 0 &&
      (a.aktuellerBestand <= a.mindestbestand || (reichweiteTage !== null && reichweiteTage < schwellwertTage));

    const bestellmenge = bestellvorschlag
      ? Math.max(
          0,
          Math.ceil(effektiverTagesverbrauch * zielhorizontTage - a.aktuellerBestand)
        )
      : 0;

    const bevorzugterLieferant = a.lieferanten[0] ?? null;

    return {
      artikelId: a.id,
      artikelName: a.name,
      artikelnummer: a.artikelnummer,
      kategorie: a.kategorie,
      einheit: a.einheit,
      aktuellerBestand: a.aktuellerBestand,
      mindestbestand: a.mindestbestand,
      avgTagesverbrauch: Math.round(avgTagesverbrauch * 100) / 100,
      effektiverTagesverbrauch: Math.round(effektiverTagesverbrauch * 100) / 100,
      reichweiteTage,
      bestellvorschlag,
      bestellmenge,
      bevorzugterLieferant: bevorzugterLieferant
        ? {
            lieferantId: bevorzugterLieferant.lieferantId,
            name: bevorzugterLieferant.lieferant.name,
            einkaufspreis: bevorzugterLieferant.einkaufspreis,
            mindestbestellmenge: bevorzugterLieferant.mindestbestellmenge,
            lieferzeitTage: bevorzugterLieferant.lieferzeitTage,
          }
        : null,
    };
  });

  return NextResponse.json(prognosen);
}

function getSaisonalerFaktor(kategorie: string, monat: number): number {
  // Monat 0=Jan ... 11=Dez
  if (kategorie === "Duenger") {
    // Hochsaison März-Mai (2,3,4), Herbst Sep-Okt (8,9)
    if ([2, 3, 4].includes(monat)) return 2.2;
    if ([8, 9].includes(monat)) return 1.4;
    if ([11, 0, 1].includes(monat)) return 0.3;
    return 1.0;
  }
  if (kategorie === "Saatgut") {
    // Frühjahr Feb-Apr (1,2,3), Herbst Aug-Sep (7,8)
    if ([1, 2, 3].includes(monat)) return 2.5;
    if ([7, 8].includes(monat)) return 1.8;
    if ([10, 11, 0].includes(monat)) return 0.4;
    return 1.0;
  }
  // Futter: relativ gleichmäßig, leicht mehr im Winter
  if ([11, 0, 1].includes(monat)) return 1.2;
  if ([5, 6].includes(monat)) return 0.9;
  return 1.0;
}
