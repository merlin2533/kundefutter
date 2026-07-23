import { NextResponse } from "next/server";
import { isNextcloudKonfiguriert } from "@/lib/nextcloud";
import { starteBackfillFallsMoeglich } from "@/lib/nextcloud-backfill";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";

/**
 * POST /api/nextcloud/backfill
 * Startet den einmaligen Backfill-Job (überträgt alle bestehenden lokalen
 * Dokumente + bereits erzeugten Rechnungen/Lieferscheine/Gutschriften nach
 * Nextcloud). Läuft im Hintergrund weiter, Fortschritt via
 * GET /api/nextcloud/backfill/status abrufbar. 409, falls bereits ein Lauf aktiv ist.
 */
export async function POST() {
  try {
    const konfiguriert = await isNextcloudKonfiguriert();
    if (!konfiguriert) {
      return NextResponse.json({ error: "Nextcloud nicht konfiguriert", nichtKonfiguriert: true }, { status: 503 });
    }

    const gestartet = await starteBackfillFallsMoeglich();
    if (!gestartet) {
      return NextResponse.json({ error: "Es läuft bereits ein Backfill-Job" }, { status: 409 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err);
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Backfill konnte nicht gestartet werden";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
