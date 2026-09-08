import { NextRequest, NextResponse } from "next/server";
import { sammleKatMeldung } from "@/lib/kat-meldung";
import { getModulConfig, requireModul } from "@/lib/modul-config";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const modul = await getModulConfig();
    const denyModul = requireModul(modul, "eierhandel");
    if (denyModul) return denyModul;

    const { searchParams } = new URL(req.url);
    const vonStr = searchParams.get("von");
    const bisStr = searchParams.get("bis");

    const today = new Date();
    const von = vonStr ? new Date(vonStr) : new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7);
    von.setHours(0, 0, 0, 0);
    const bis = bisStr ? new Date(bisStr) : today;
    bis.setHours(23, 59, 59, 999);

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
