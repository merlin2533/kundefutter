import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  fetchEurostatQuarterly,
  fetchEurostatOutput,
  PRODUKT_MAPPING,
} from "@/lib/eurostat";

const CACHE_MAX_AGE_DAYS = 7;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const kategorie = searchParams.get("kategorie");
    const force = searchParams.get("force") === "true";

    // Check if cache needs refreshing (input prices)
    let needsRefresh = force;

    if (!needsRefresh) {
      const latestEntry = await prisma.marktpreisCache.findFirst({
        where: { dataset: "apri_pi15_inq" },
        orderBy: { abgerufenAm: "desc" },
      });

      if (!latestEntry) {
        needsRefresh = true;
      } else {
        const ageMs =
          Date.now() - new Date(latestEntry.abgerufenAm).getTime();
        const ageDays = ageMs / (1000 * 60 * 60 * 24);
        needsRefresh = ageDays > CACHE_MAX_AGE_DAYS;
      }
    }

    // Refresh cache from Eurostat if needed
    if (needsRefresh) {
      try {
        // Fetch input prices
        const entries = await fetchEurostatQuarterly(2020);

        if (entries.length > 0) {
          const inputOps = entries.map((entry) =>
            prisma.marktpreisCache.upsert({
              where: {
                dataset_produktCode_zeitraum_land: {
                  dataset: "apri_pi15_inq",
                  produktCode: entry.produktCode,
                  zeitraum: entry.zeitraum,
                  land: "DE",
                },
              },
              update: {
                produktName: entry.produktName,
                indexWert: entry.indexWert,
                abgerufenAm: new Date(),
              },
              create: {
                dataset: "apri_pi15_inq",
                produktCode: entry.produktCode,
                produktName: entry.produktName,
                zeitraum: entry.zeitraum,
                indexWert: entry.indexWert,
                einheit: "I15",
                land: "DE",
              },
            })
          );
          await prisma.$transaction(inputOps);
        }

        // Fetch output prices - fail gracefully if unavailable
        try {
          const outputEntries = await fetchEurostatOutput(2020);
          if (outputEntries.length > 0) {
            const outputOps = outputEntries.map((entry) =>
              prisma.marktpreisCache.upsert({
                where: {
                  dataset_produktCode_zeitraum_land: {
                    dataset: "apri_pi15_outq",
                    produktCode: entry.produktCode,
                    zeitraum: entry.zeitraum,
                    land: "DE",
                  },
                },
                update: {
                  produktName: entry.produktName,
                  indexWert: entry.indexWert,
                  abgerufenAm: new Date(),
                },
                create: {
                  dataset: "apri_pi15_outq",
                  produktCode: entry.produktCode,
                  produktName: entry.produktName,
                  zeitraum: entry.zeitraum,
                  indexWert: entry.indexWert,
                  einheit: "I15",
                  land: "DE",
                },
              })
            );
            await prisma.$transaction(outputOps);
          }
        } catch (outputErr) {
          console.warn("Eurostat Output-Preise nicht verfügbar:", outputErr);
        }
      } catch (refreshErr) {
        console.warn("Eurostat-Aktualisierung fehlgeschlagen, nutze Cache:", refreshErr);
        // Fall through to return cached data
      }
    }

    // Build filter for query
    const inputWhere: Record<string, unknown> = { dataset: "apri_pi15_inq" };

    if (kategorie) {
      const codes = Object.entries(PRODUKT_MAPPING)
        .filter(([, info]) => info.kategorie === kategorie)
        .map(([code]) => code);

      if (codes.length > 0) {
        inputWhere.produktCode = { in: codes };
      }
    }

    // Fetch both input and output data
    const [inputDaten, outputDaten] = await Promise.all([
      prisma.marktpreisCache.findMany({
        where: inputWhere,
        orderBy: [{ produktCode: "asc" }, { zeitraum: "desc" }],
      }),
      prisma.marktpreisCache.findMany({
        where: { dataset: "apri_pi15_outq" },
        orderBy: [{ produktCode: "asc" }, { zeitraum: "desc" }],
      }),
    ]);

    const daten = [...inputDaten, ...outputDaten];

    // Determine last update time
    const letzteAktualisierung =
      daten.length > 0
        ? daten.reduce((latest, entry) => {
            const entryDate = new Date(entry.abgerufenAm);
            return entryDate > latest ? entryDate : latest;
          }, new Date(0))
        : new Date();

    return NextResponse.json({
      daten,
      letzteAktualisierung: letzteAktualisierung.toISOString(),
      quelle: "Eurostat apri_pi15_inq + apri_pi15_outq",
    });
  } catch (error) {
    console.error("Marktpreise API Fehler:", error);
    return NextResponse.json(
      {
        error: "Fehler beim Abrufen der Marktpreise",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
