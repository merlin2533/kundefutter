import { NextResponse } from "next/server";
import { isNextcloudKonfiguriert, testVerbindung } from "@/lib/nextcloud";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";


export async function GET() {
  try {
    const konfiguriert = await isNextcloudKonfiguriert();
    if (!konfiguriert) {
      return NextResponse.json({ konfiguriert: false, verbunden: false });
    }

    const result = await testVerbindung();
    return NextResponse.json({ konfiguriert: true, verbunden: result.ok, fehler: result.fehler });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Verbindungstest fehlgeschlagen" }, { status: 500 });
  }
}
