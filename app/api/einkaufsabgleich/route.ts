import { NextResponse } from "next/server";
import { Sentry } from "@/lib/sentry";
import { getModulConfig, requireModul } from "@/lib/modul-config";
import { ladeEinkaufsabgleich } from "@/lib/einkaufsabgleich";

export const dynamic = "force-dynamic";

// GET /api/einkaufsabgleich
// Siehe lib/einkaufsabgleich.ts (ladeEinkaufsabgleich) für die eigentliche Aggregation — geteilt
// mit dem Excel-Export GET /api/einkaufsabgleich/export, damit beide nie auseinanderlaufen.
export async function GET() {
  const modul = await getModulConfig();
  const denyModul = requireModul(modul, "fruehbezug");
  if (denyModul) return denyModul;

  try {
    const ergebnis = await ladeEinkaufsabgleich();
    return NextResponse.json(ergebnis);
  } catch (err) {
    Sentry.captureException(err);
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Datenbankfehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
