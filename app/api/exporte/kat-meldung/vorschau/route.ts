import { NextRequest, NextResponse } from "next/server";
import { sammleKatMeldung } from "@/lib/kat-meldung";
import { getModulConfig, requireModul } from "@/lib/modul-config";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";

// ~2 Jahre — analog MAX_TAGE_SPANNE in app/api/statistik/eier/route.ts, verhindert eine
// versehentliche Vollscan-Query (sammleKatMeldung() hat kein eigenes take-Limit).
const MAX_TAGE_SPANNE = 366 * 2;

export async function GET(req: NextRequest) {
  try {
    const modul = await getModulConfig();
    const denyModul = requireModul(modul, "eierhandel");
    if (denyModul) return denyModul;

    const { searchParams } = new URL(req.url);
    const vonStr = searchParams.get("von");
    const bisStr = searchParams.get("bis");

    const today = new Date();
    let von = vonStr ? new Date(vonStr) : new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7);
    const bis = bisStr ? new Date(bisStr) : today;
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

    const zeilen = await sammleKatMeldung(von, bis);

    return NextResponse.json({
      anzahl: zeilen.length,
      zeilen,
      summeSortiert: zeilen.reduce((s, z) => s + z.mengeSortiert, 0),
      summeVerkauft: zeilen.reduce((s, z) => s + z.mengeVerkauft, 0),
    });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "KAT-Meldungs-Vorschau fehlgeschlagen" }, { status: 500 });
  }
}
