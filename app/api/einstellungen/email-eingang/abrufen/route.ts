import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission, P } from "@/lib/permissions";
import { Sentry } from "@/lib/sentry";
import { verarbeiteEingehendeMails } from "@/lib/email-eingang-verarbeitung";

export const dynamic = "force-dynamic";

// Manueller "Jetzt abrufen"-Button auf der Settings-Seite — ruft exakt denselben Orchestrator wie
// der Cron-Job auf (siehe app/api/cron/route.ts jobEmailRechnungseingang()). Braucht zusätzlich
// P.KI_NUTZEN, da die Verarbeitung Mistral-Aufrufe auslöst (Projektregel: jede tatsächlich
// KI-aufrufende Route ist damit gated).
export async function POST() {
  const me = await getCurrentUser();
  const denyEinstellungen = requirePermission(me, P.EINSTELLUNGEN_BEARBEITEN);
  if (denyEinstellungen) return denyEinstellungen;
  const denyKi = requirePermission(me, P.KI_NUTZEN);
  if (denyKi) return denyKi;

  try {
    const ergebnis = await verarbeiteEingehendeMails();
    return NextResponse.json(ergebnis);
  } catch (err) {
    Sentry.captureException(err);
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Abruf fehlgeschlagen";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
