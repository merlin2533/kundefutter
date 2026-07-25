import { NextRequest, NextResponse } from "next/server";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";

// GET: reines Konfigurations-Check (welche DSNs sind zur Laufzeit gesetzt),
// kein Netzwerkzugriff auf GlitchTip.
export async function GET() {
  return NextResponse.json({
    serverDsnConfigured: Boolean(process.env.SENTRY_DSN),
    // NEXT_PUBLIC_SENTRY_DSN wird beim Docker-Build eingebacken — dieser
    // Server-Prozess sieht sie nur, wenn sie zusätzlich als Laufzeit-Env
    // gesetzt ist; der eigentliche Nachweis läuft über den Browser-Check.
    buildTimeClientDsnHint: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  });
}

// POST: erzeugt einen echten Test-Event serverseitig und schickt ihn an
// GlitchTip. Liefert die Sentry-eventId zurück — taucht sie in GlitchTip
// nicht auf, liegt es an DSN/Netzwerk/Projekt-Konfiguration, nicht am Code.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const note = typeof body?.note === "string" ? body.note.slice(0, 200) : undefined;

    const dsnConfigured = Boolean(process.env.SENTRY_DSN);

    const eventId = Sentry.captureException(
      new Error(`GlitchTip-Verbindungstest von /einstellungen/system${note ? ` (${note})` : ""}`)
    );

    // Sicherstellen, dass der Event tatsächlich rausgeht, bevor wir antworten
    // — ohne flush() könnte der Prozess theoretisch vorher weitermachen und
    // das Ergebnis wäre nicht aussagekräftig.
    const gesendet = await Sentry.flush(3000);

    return NextResponse.json({
      ok: true,
      dsnConfigured,
      eventId,
      gesendet,
    });
  } catch (err) {
    Sentry.captureException(err);
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Test fehlgeschlagen";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
