import { NextRequest, NextResponse } from "next/server";
import { ladeKampagnePotenzial, buildKampagnePotenzialCsv } from "@/lib/kampagne-potenzial";
import { getModulConfig, requireModul } from "@/lib/modul-config";
import { Sentry } from "@/lib/sentry";

export const dynamic = "force-dynamic";

// GET /api/exporte/kampagne?kampagneId=X — Zielkunden-Liste mit Umsatzpotenzial als CSV,
// z.B. für eine Mailing-Aktion außerhalb von AGRI-Office.
export async function GET(req: NextRequest) {
  const modul = await getModulConfig();
  const denyModul = requireModul(modul, "kampagnen");
  if (denyModul) return denyModul;

  const { searchParams } = new URL(req.url);
  const kampagneId = Number(searchParams.get("kampagneId"));
  if (!Number.isInteger(kampagneId) || kampagneId <= 0) {
    return NextResponse.json({ error: "Ungültige kampagneId" }, { status: 400 });
  }

  try {
    const ergebnis = await ladeKampagnePotenzial(kampagneId);
    if (!ergebnis) return NextResponse.json({ error: "Kampagne nicht gefunden" }, { status: 404 });

    const csv = buildKampagnePotenzialCsv(ergebnis);
    const safeName = ergebnis.kampagne.name.replace(/[^A-Za-z0-9\-_]/g, "_");
    const filename = `kampagne_${safeName}_zielkunden.csv`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Kampagne-Export fehlgeschlagen" }, { status: 500 });
  }
}
