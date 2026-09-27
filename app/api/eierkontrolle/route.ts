import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getModulConfig, requireModul } from "@/lib/modul-config";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";

function istEierhandelMeldung(betreff: string) {
  return betreff.includes("Tierseuchenkasse") || betreff.includes("KAT-Wochenmeldung");
}

// GET /api/eierkontrolle — aggregierte Kontroll-Daten für /eierkontrolle: MHD-Ampel-Chargen,
// Erzeuger-Stammdaten (für die Erzeugercode-Validierung) und Meldepflichten-Zählung. Bündelt
// drei fachlich getrennte Modelle (EierSortierungPosition/Kunde/Aufgabe) — bewusst eine eigene
// Route statt Erweiterung von /api/eiersortierung, das ausschließlich die Sortierprotokoll-CRUD
// verantwortet.
export async function GET() {
  try {
    const modul = await getModulConfig();
    const denyModul = requireModul(modul, "eierhandel");
    if (denyModul) return denyModul;

    const [chargen, erzeuger, aufgaben] = await Promise.all([
      prisma.eierSortierungPosition.findMany({
        select: {
          id: true,
          sortierungId: true,
          gueteklasse: true,
          gewichtsklasse: true,
          menge: true,
          chargeNr: true,
          legedatum: true,
          erzeugercode: true,
        },
        orderBy: { legedatum: "asc" },
        take: 500,
      }),
      prisma.kunde.findMany({
        where: { OR: [{ erzeugercode: { not: null } }, { haltungsform: { not: null } }] },
        select: { id: true, name: true, firma: true, erzeugercode: true, haltungsform: true },
        orderBy: { name: "asc" },
        take: 500,
      }),
      prisma.aufgabe.findMany({
        where: { erledigt: false },
        select: { betreff: true, faelligAm: true },
        take: 500,
      }),
    ]);

    const meldepflichten = aufgaben.filter((a) => istEierhandelMeldung(a.betreff));
    const meldepflichtenOffen = meldepflichten.length;
    const meldepflichtenUeberfaellig = meldepflichten.filter(
      (a) => a.faelligAm && new Date(a.faelligAm).getTime() < Date.now()
    ).length;

    return NextResponse.json({ chargen, erzeuger, meldepflichtenOffen, meldepflichtenUeberfaellig });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Kontroll-Daten konnten nicht geladen werden" }, { status: 500 });
  }
}
