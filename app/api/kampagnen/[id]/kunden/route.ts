import { NextRequest, NextResponse } from "next/server";
import { ladeKampagnePotenzial } from "@/lib/kampagne-potenzial";
import { Sentry } from "@/lib/sentry";
import { getModulConfig, requireModul } from "@/lib/modul-config";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/kampagnen/[id]/kunden
 * Returns customers assigned to this campaign with potential volume
 * (sum of their Bedarf for campaign articles)
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const modul = await getModulConfig();
  const denyModul = requireModul(modul, "kampagnen");
  if (denyModul) return denyModul;

  const { id } = await params;
  const nId = parseInt(id, 10);
  if (isNaN(nId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const ergebnis = await ladeKampagnePotenzial(nId);
    if (!ergebnis) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    return NextResponse.json(ergebnis.kunden);
  } catch (err) {
    Sentry.captureException(err);
    console.error("Kampagnen kunden GET error:", err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
