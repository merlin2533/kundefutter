import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getModulConfig, requireModul } from "@/lib/modul-config";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";

// Chargen älter als dieses Fenster interessieren die MHD-Ampel nicht mehr (jede Charge ist
// spätestens 28 Tage nach dem Legedatum abgelaufen, siehe lib/eier-mhd.ts) — großzügig auf 60
// Tage bemessen, damit auch eine Charge ohne Legedatum (zählt als "unbekannt", nicht gefiltert)
// sowie kürzlich abgelaufene Chargen noch in der Liste auftauchen. Ohne diesen Filter würde
// `take:500` bei mehr als 500 sortierten Chargen irgendwann nur noch uralte Chargen zeigen und
// aktuelle Chargen verschwänden aus der Ampel — derselbe 500er-Deckel-Bug, der im Projekt bereits
// an mehreren anderen Stellen aufgetreten und behoben worden ist (siehe AGENTS.md Bug-Tabelle).
const CHARGEN_FENSTER_TAGE = 60;

// Präfixe exakt wie in lib/meldepflichten.ts (pruefeMeldepflichten()) — DB-seitig gefiltert statt
// wie zuvor `take:500` + In-Memory-Substring-Filter, damit bei mehr als 500 offenen Aufgaben keine
// Meldepflicht unter den Tisch fällt und ein normaler Nutzer-Task mit "Tierseuchenkasse" irgendwo
// im Freitext nicht fälschlich mitgezählt wird.
export async function GET() {
  try {
    const modul = await getModulConfig();
    const denyModul = requireModul(modul, "eierhandel");
    if (denyModul) return denyModul;

    const chargenAb = new Date();
    chargenAb.setDate(chargenAb.getDate() - CHARGEN_FENSTER_TAGE);

    const meldepflichtenWhere = {
      erledigt: false,
      OR: [
        { betreff: { startsWith: "Tierseuchenkasse-Meldung" } },
        { betreff: { startsWith: "KAT-Wochenmeldung erfassen" } },
      ],
    };

    const [chargen, erzeuger, meldepflichten, meldepflichtenUeberfaellig] = await Promise.all([
      prisma.eierSortierungPosition.findMany({
        where: { OR: [{ legedatum: null }, { legedatum: { gte: chargenAb } }] },
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
        orderBy: { legedatum: "desc" },
        take: 500,
      }),
      prisma.kunde.findMany({
        where: { aktiv: true, OR: [{ erzeugercode: { not: null } }, { haltungsform: { not: null } }] },
        select: { id: true, name: true, firma: true, erzeugercode: true, haltungsform: true },
        orderBy: { name: "asc" },
        take: 500,
      }),
      prisma.aufgabe.count({ where: meldepflichtenWhere }),
      prisma.aufgabe.count({ where: { ...meldepflichtenWhere, faelligAm: { lt: new Date() } } }),
    ]);

    return NextResponse.json({
      chargen,
      erzeuger,
      meldepflichtenOffen: meldepflichten,
      meldepflichtenUeberfaellig,
    });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Kontroll-Daten konnten nicht geladen werden" }, { status: 500 });
  }
}
