import { NextRequest, NextResponse } from "next/server";
import { sammleEierStatistik, verdichteEierStatistik } from "@/lib/kat-meldung";
import { getModulConfig, requireModul } from "@/lib/modul-config";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";

// ~2 Jahre — deckt jeden sinnvollen Berichtszeitraum ab, verhindert aber eine versehentliche
// Vollscan-Query über die komplette Historie (sammleKatMeldung() hat kein eigenes take-Limit,
// siehe lib/kat-meldung.ts), analog MAX_TAGE_SPANNE in lib/kategorie-verlauf.ts.
const MAX_TAGE_SPANNE = 366 * 2;

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
    let von = vonStr ? new Date(vonStr) : new Date(today.getFullYear(), today.getMonth() - 3, today.getDate());
    let bis = bisStr ? new Date(bisStr) : today;
    if (isNaN(von.getTime()) || isNaN(bis.getTime())) {
      return NextResponse.json({ error: "Ungültiges Datum (von/bis)" }, { status: 400 });
    }
    if (von > bis) {
      return NextResponse.json({ error: "'von' darf nicht nach 'bis' liegen" }, { status: 400 });
    }
    von.setHours(0, 0, 0, 0);
    bis.setHours(23, 59, 59, 999);
    const spanneTage = (bis.getTime() - von.getTime()) / 86_400_000;
    if (spanneTage > MAX_TAGE_SPANNE) {
      von = new Date(bis.getTime() - MAX_TAGE_SPANNE * 86_400_000);
    }

    const zeilen = await sammleEierStatistik(von, bis);
    return NextResponse.json(verdichteEierStatistik(zeilen));
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Eier-Statistik fehlgeschlagen" }, { status: 500 });
  }
}
