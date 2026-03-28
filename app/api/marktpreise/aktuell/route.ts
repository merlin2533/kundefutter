import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { PRODUKT_MAPPING } from "@/lib/eurostat";

// Main category codes for the summary view
const HAUPT_KATEGORIEN = [
  { code: "206000", kategorie: "Futter" },
  { code: "203000", kategorie: "Duenger" },
  { code: "201000", kategorie: "Saatgut" },
];

export async function GET(_request: NextRequest) {
  try {
    const kategorien = [];

    for (const { code, kategorie } of HAUPT_KATEGORIEN) {
      const mapping = PRODUKT_MAPPING[code];
      if (!mapping) continue;

      // Fetch the two most recent quarters for this product code
      const recentEntries = await prisma.marktpreisCache.findMany({
        where: {
          dataset: "apri_pi15_inq",
          produktCode: code,
          land: "DE",
        },
        orderBy: { zeitraum: "desc" },
        take: 2,
      });

      if (recentEntries.length === 0) continue;

      const aktuell = recentEntries[0];
      const vorquartal = recentEntries.length > 1 ? recentEntries[1] : null;

      let veraenderungProzent: number | null = null;
      if (vorquartal && vorquartal.indexWert !== 0) {
        veraenderungProzent = parseFloat(
          (
            ((aktuell.indexWert - vorquartal.indexWert) /
              vorquartal.indexWert) *
            100
          ).toFixed(2)
        );
      }

      kategorien.push({
        kategorie,
        produktCode: code,
        produktName: mapping.name,
        aktuell: {
          zeitraum: aktuell.zeitraum,
          indexWert: aktuell.indexWert,
        },
        vorquartal: vorquartal
          ? {
              zeitraum: vorquartal.zeitraum,
              indexWert: vorquartal.indexWert,
            }
          : null,
        veraenderungProzent,
      });
    }

    // Determine last update time from all entries
    const latestEntry = await prisma.marktpreisCache.findFirst({
      where: { dataset: "apri_pi15_inq" },
      orderBy: { abgerufenAm: "desc" },
    });

    return NextResponse.json({
      kategorien,
      letzteAktualisierung: latestEntry
        ? new Date(latestEntry.abgerufenAm).toISOString()
        : new Date().toISOString(),
    });
  } catch (error) {
    console.error("Marktpreise Aktuell API Fehler:", error);
    return NextResponse.json(
      {
        error: "Fehler beim Abrufen der aktuellen Marktpreise",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
