import * as Sentry from "@sentry/nextjs";
import { resolveSentryDsn } from "@/lib/sentry-dsn";

const dsn = resolveSentryDsn();

if (!dsn) {
  // Nur noch erreichbar, wenn SENTRY_DSN bewusst auf einen Abschalt-Wert
  // ("off"/"none"/…) gesetzt wurde. Ohne jede Konfiguration greift der fest
  // hinterlegte Standard-DSN aus lib/sentry-dsn.ts — dieses Image meldet also
  // immer, ohne dass jemand etwas setzen muss.
  console.warn(
    "[sentry] Server-Fehler-Reporting ist per SENTRY_DSN abgeschaltet — " +
      "captureException() läuft ins Leere. SENTRY_DSN entfernen (oder auf eine " +
      "eigene DSN setzen), um das Reporting wieder zu aktivieren."
  );
}

Sentry.init({
  dsn,
  tracesSampleRate: 0.01,
  environment: process.env.NODE_ENV ?? "production",
  release: `${process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0"}+${process.env.NEXT_PUBLIC_BUILD_ID ?? "dev"}`,

  // console.* landet als GlitchTip-Log (nicht als zusätzliches Issue) — deckt
  // den gesamten Altbestand an console-Aufrufen ab und ist gleichzeitig der
  // Transportweg von lib/logger.ts.
  enableLogs: true,
  integrations: [
    // debug/log/trace bewusst NICHT: das wäre überwiegend Bibliotheks-Rauschen.
    // Volumen ist bei Logs der knappe Faktor.
    Sentry.consoleLoggingIntegration({ levels: ["info", "warn", "error"] }),
  ],
});
