import { NextRequest, NextResponse } from "next/server";
import { Sentry } from "@/lib/sentry";
import { log } from "@/lib/logger";
import { parseDsn, resolveSentryDsn, sentryDsnHerkunft } from "@/lib/sentry-dsn";
export const dynamic = "force-dynamic";

// GET: reines Konfigurations-Check — welche DSN ist zur Laufzeit WIRKLICH aktiv?
// Kein Netzwerkzugriff auf GlitchTip. Der Public-Key wird bewusst NICHT
// ausgegeben; Host und Projekt-ID genügen zur Diagnose.
export async function GET() {
  try {
    const dsn = resolveSentryDsn();
    const teile = parseDsn(dsn);

    return NextResponse.json({
      dsnAktiv: Boolean(dsn),
      // "default" = fest im Image hinterlegt, "env" = per SENTRY_DSN übersteuert,
      // "off" = bewusst abgeschaltet.
      herkunft: sentryDsnHerkunft(),
      host: teile?.host ?? null,
      projektId: teile?.projectId ?? null,
    });
  } catch (err) {
    log.error("Sentry-Status konnte nicht ermittelt werden", err);
    return NextResponse.json({ error: "Status nicht verfügbar" }, { status: 500 });
  }
}

// POST: erzeugt einen echten Test-Event serverseitig und schickt ihn an
// GlitchTip. Liefert die Sentry-eventId zurück — taucht sie in GlitchTip
// nicht auf, liegt es an DSN/Netzwerk/Projekt-Konfiguration, nicht am Code.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch((err) => {
      // Kein gültiger JSON-Body ist hier unkritisch (das Feld ist optional),
      // wird aber gemeldet statt still verworfen.
      log.warn("Sentry-Test: Body konnte nicht gelesen werden", {
        fehler: err instanceof Error ? err.message : String(err),
      });
      return {} as Record<string, unknown>;
    });
    const note = typeof body?.note === "string" ? body.note.slice(0, 200) : undefined;

    const dsn = resolveSentryDsn();

    const eventId = Sentry.captureException(
      new Error(`GlitchTip-Verbindungstest von /einstellungen/system${note ? ` (${note})` : ""}`)
    );

    // Zusätzlich den LOG-Pfad testen: er läuft über console.* +
    // consoleLoggingIntegration und ist damit ein anderer Transportweg als das
    // Issue oben. Erscheint nur eins von beiden in GlitchTip, weiß man sofort,
    // welcher Kanal klemmt.
    log.info("GlitchTip-Log-Test von /einstellungen/system", {
      quelle: "sentry-test",
      note,
    });

    // Sicherstellen, dass Event UND Log tatsächlich rausgehen, bevor wir
    // antworten — flush() leert beide Puffer.
    const gesendet = await Sentry.flush(3000);

    return NextResponse.json({
      ok: true,
      dsnAktiv: Boolean(dsn),
      herkunft: sentryDsnHerkunft(),
      eventId,
      gesendet,
    });
  } catch (err) {
    log.error("Sentry-Testevent fehlgeschlagen", err);
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Test fehlgeschlagen";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
