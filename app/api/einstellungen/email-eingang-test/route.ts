import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission, P } from "@/lib/permissions";
import { Sentry } from "@/lib/sentry";
import { ladeEmailEingangConfig, istEmailEingangVollstaendigKonfiguriert } from "@/lib/email-eingang-config";
import { testeImapVerbindung, testeM365Verbindung } from "@/lib/email-eingang-abruf";

export const dynamic = "force-dynamic";

// Testet die bereits gespeicherte Konfiguration (analog /api/einstellungen/smtp-test) — die
// Settings-Seite speichert vor dem Test immer erst, damit hier dieselben Werte geprüft werden,
// die auch der Cron-Job später verwendet.
export async function POST() {
  const me = await getCurrentUser();
  const deny = requirePermission(me, P.EINSTELLUNGEN_BEARBEITEN);
  if (deny) return deny;

  try {
    const cfg = await ladeEmailEingangConfig();
    if (!istEmailEingangVollstaendigKonfiguriert(cfg)) {
      return NextResponse.json({ error: "Zugangsdaten unvollständig" }, { status: 422 });
    }

    if (cfg.provider === "imap") {
      await testeImapVerbindung(cfg.imap);
    } else {
      await testeM365Verbindung(cfg.m365);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err);
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Verbindung fehlgeschlagen";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
