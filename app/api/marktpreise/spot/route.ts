import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchMatifPreise, linearForecast, type MatifProdukt } from "@/lib/matif";

/** Cache gilt 4 Stunden (Futures handeln tagsüber) */
const CACHE_STUNDEN = 4;

function buildResponse(
  preise: MatifProdukt[],
  letzteAktualisierung: Date,
  frisch: boolean
) {
  return NextResponse.json({
    preise,
    letzteAktualisierung: letzteAktualisierung.toISOString(),
    quelle: "Yahoo Finance (Euronext MATIF)",
    frisch,
  });
}

export async function GET(request: NextRequest) {
  try {
    const force = request.nextUrl.searchParams.get("force") === "true";

    // Cache-Alter prüfen
    const letzterEintrag = await prisma.marktpreisCache.findFirst({
      where: { dataset: "matif" },
      orderBy: { abgerufenAm: "desc" },
    });

    const alterMs = letzterEintrag
      ? Date.now() - new Date(letzterEintrag.abgerufenAm).getTime()
      : Infinity;
    const needsRefresh = force || alterMs > CACHE_STUNDEN * 3_600_000;

    if (needsRefresh) {
      const preise = await fetchMatifPreise();

      if (preise.length > 0) {
        // Tagespreise in DB speichern
        for (const p of preise) {
          for (const punkt of p.verlauf) {
            await prisma.marktpreisCache.upsert({
              where: {
                dataset_produktCode_zeitraum_land: {
                  dataset:     "matif",
                  produktCode: p.produktCode,
                  zeitraum:    punkt.datum,
                  land:        "EU",
                },
              },
              update: {
                indexWert:   punkt.preis,
                abgerufenAm: new Date(),
              },
              create: {
                dataset:     "matif",
                produktCode: p.produktCode,
                produktName: p.produktName,
                zeitraum:    punkt.datum,
                indexWert:   punkt.preis,
                einheit:     "EUR/t",
                land:        "EU",
              },
            });
          }
        }

        return buildResponse(preise, new Date(), true);
      }
      // Fallback: aus Cache lesen wenn Live-Abruf leer
    }

    // Aus DB-Cache aufbauen
    const cached = await prisma.marktpreisCache.findMany({
      where: { dataset: "matif" },
      orderBy: [{ produktCode: "asc" }, { zeitraum: "asc" }],
    });

    if (cached.length === 0) {
      // Noch gar kein Cache → direkt versuchen
      const preise = await fetchMatifPreise();
      return buildResponse(preise, new Date(), false);
    }

    // Gruppieren nach produktCode
    const grouped: Record<
      string,
      Array<{ zeitraum: string; indexWert: number; produktName: string }>
    > = {};
    for (const e of cached) {
      if (!grouped[e.produktCode]) grouped[e.produktCode] = [];
      grouped[e.produktCode].push({
        zeitraum:    e.zeitraum,
        indexWert:   e.indexWert,
        produktName: e.produktName,
      });
    }

    const preise: MatifProdukt[] = Object.entries(grouped).map(
      ([code, eintraege]) => {
        const sorted = eintraege.sort((a, b) =>
          a.zeitraum.localeCompare(b.zeitraum)
        );
        const verlauf = sorted.map((e) => ({
          datum: e.zeitraum,
          preis: e.indexWert,
        }));
        const aktuell  = verlauf[verlauf.length - 1];
        const vwIdx    = Math.max(0, verlauf.length - 6);
        const vorwoche = verlauf.length >= 2 ? verlauf[vwIdx] : null;

        return {
          symbol:      "",
          produktCode: code,
          produktName: sorted[0].produktName,
          preis:       aktuell.preis,
          vorwoche:    vorwoche?.preis ?? null,
          veraenderung:
            vorwoche != null
              ? Math.round((aktuell.preis - vorwoche.preis) * 10) / 10
              : null,
          datum:       aktuell.datum,
          verlauf:     verlauf.slice(-20),
          prognose1W:  linearForecast(verlauf),
        };
      }
    );

    const letzteAktualisierung = letzterEintrag
      ? new Date(letzterEintrag.abgerufenAm)
      : new Date();

    return buildResponse(preise, letzteAktualisierung, false);
  } catch (error) {
    console.error("Marktpreise/Spot Fehler:", error);
    return NextResponse.json(
      { error: "Fehler beim Abrufen der MATIF-Daten", preise: [] },
      { status: 500 }
    );
  }
}
