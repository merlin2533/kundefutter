import { NextRequest, NextResponse } from "next/server";
import { sammleEierStatistik, verdichteEierStatistik } from "@/lib/kat-meldung";
import { getModulConfig, requireModul } from "@/lib/modul-config";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";

// GET /api/statistik/eier?von=&bis= — Berichte: Güte-/Gewichtsklassen-Verteilung, Top-Erzeuger.
// Nutzt dieselbe Aggregation wie /api/exporte/kat-meldung/vorschau (sammleEierStatistik ruft
// intern sammleKatMeldung auf), nur zusätzlich über Woche/Erzeuger verdichtet.
export async function GET(req: NextRequest) {
  try {
    const modul = await getModulConfig();
    const denyModul = requireModul(modul, "eierhandel");
    if (denyModul) return denyModul;

    const { searchParams } = new URL(req.url);
    const vonStr = searchParams.get("von");
    const bisStr = searchParams.get("bis");

    const today = new Date();
    const von = vonStr ? new Date(vonStr) : new Date(today.getFullYear(), today.getMonth() - 3, today.getDate());
    von.setHours(0, 0, 0, 0);
    const bis = bisStr ? new Date(bisStr) : today;
    bis.setHours(23, 59, 59, 999);

    const zeilen = await sammleEierStatistik(von, bis);
    return NextResponse.json(verdichteEierStatistik(zeilen));
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Eier-Statistik fehlgeschlagen" }, { status: 500 });
  }
}
