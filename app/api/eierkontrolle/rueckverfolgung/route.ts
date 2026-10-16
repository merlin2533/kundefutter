import { NextRequest, NextResponse } from "next/server";
import { getModulConfig, requireModul } from "@/lib/modul-config";
import { normalisiereSuche, sucheRueckverfolgung, RUECKVERFOLGUNG_MIN_ZEICHEN } from "@/lib/eier-rueckverfolgung";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";

// GET /api/eierkontrolle/rueckverfolgung?charge=&erzeugercode= — Rückruf-Rückverfolgung:
// Sortierungen (Eingang) und belieferte Kunden (Ausgang) zu einer Charge bzw. einem Erzeugercode.
export async function GET(req: NextRequest) {
  try {
    const modul = await getModulConfig();
    const denyModul = requireModul(modul, "eierhandel");
    if (denyModul) return denyModul;

    const { searchParams } = new URL(req.url);
    const suche = normalisiereSuche(searchParams.get("charge"), searchParams.get("erzeugercode"));
    if (!suche) {
      return NextResponse.json(
        { error: `Bitte Chargennummer oder Erzeugercode mit mindestens ${RUECKVERFOLGUNG_MIN_ZEICHEN} Zeichen angeben` },
        { status: 400 },
      );
    }
    return NextResponse.json(await sucheRueckverfolgung(suche));
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Rückverfolgung fehlgeschlagen" }, { status: 500 });
  }
}
