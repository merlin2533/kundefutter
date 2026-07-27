import * as Sentry from "@sentry/nextjs";
import { resolveSentryDsn } from "@/lib/sentry-dsn";

const dsn = resolveSentryDsn();

if (!dsn) {
  // Siehe sentry.server.config.ts — dieselbe Meldung für die Edge-Runtime
  // (middleware.ts läuft hier, meldet aber laut AGENTS.md-Ausnahme ohnehin nicht).
  console.warn("[sentry] Edge-Fehler-Reporting ist per SENTRY_DSN abgeschaltet.");
}

Sentry.init({
  dsn,
  tracesSampleRate: 0.01,
  environment: process.env.NODE_ENV ?? "production",
  release: `${process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0"}+${process.env.NEXT_PUBLIC_BUILD_ID ?? "dev"}`,

  // Console-Integration hier bewusst NICHT: middleware.ts loggt praktisch nicht,
  // und der Edge-Bundle soll klein bleiben. Issues (captureException) laufen
  // unabhängig davon.
  enableLogs: true,
});
