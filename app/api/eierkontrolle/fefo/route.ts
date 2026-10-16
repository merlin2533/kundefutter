import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getModulConfig, requireModul } from "@/lib/modul-config";
import { berechneChargenRest, bewerteFefo } from "@/lib/eier-fefo";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";

// Nur Chargen der letzten Zeit betrachten — jede Charge ist spätestens 28 Tage nach dem Legedatum
// abgelaufen (lib/eier-mhd.ts); großzügig mehr, damit auch kürzlich abgelaufene Reste auffallen.
const FENSTER_TAGE = 90;

// GET /api/eierkontrolle/fefo?artikelId=&chargeNr= — nicht blockierender FEFO-Hinweis für die
// Lieferungserfassung (siehe lib/eier-fefo.ts).
export async function GET(req: NextRequest) {
  try {
    const modul = await getModulConfig();
    const denyModul = requireModul(modul, "eierhandel");
    if (denyModul) return denyModul;

    const { searchParams } = new URL(req.url);
    const artikelId = parseInt(searchParams.get("artikelId") ?? "", 10);
    if (isNaN(artikelId)) return NextResponse.json({ error: "Ungültige artikelId" }, { status: 400 });
    const gewaehlt = searchParams.get("chargeNr")?.trim() || null;

    const ab = new Date();
    ab.setDate(ab.getDate() - FENSTER_TAGE);

    const sortiert = await prisma.eierSortierungPosition.findMany({
      where: { artikelId, chargeNr: { not: null }, sortierung: { datum: { gte: ab } } },
      select: { chargeNr: true, menge: true, legedatum: true },
      take: 5000,
    });
    const chargeNrs = [...new Set(sortiert.map((p) => p.chargeNr as string))];
    if (chargeNrs.length === 0) return NextResponse.json({ stufe: null, hinweis: null, aelteste: null });

    const verkauft = await prisma.lieferposition.groupBy({
      by: ["chargeNr"],
      where: { artikelId, chargeNr: { in: chargeNrs }, lieferung: { status: { not: "storniert" } } },
      _sum: { menge: true },
    });
    const verkauftMap = new Map(verkauft.map((v) => [v.chargeNr as string, v._sum.menge ?? 0]));

    const chargen = berechneChargenRest(
      sortiert.map((p) => ({ chargeNr: p.chargeNr as string, menge: p.menge, legedatum: p.legedatum })),
      verkauftMap,
    );
    return NextResponse.json(bewerteFefo(chargen, gewaehlt));
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "FEFO-Prüfung fehlgeschlagen" }, { status: 500 });
  }
}
