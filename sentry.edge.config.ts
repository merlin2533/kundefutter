import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN || "";

if (!dsn) {
  // Siehe sentry.server.config.ts — dieselbe Warnung für die Edge-Runtime
  // (middleware.ts läuft hier, meldet aber laut AGENTS.md-Ausnahme ohnehin nicht).
  console.warn("[sentry] SENTRY_DSN ist nicht gesetzt — Edge-Fehler-Reporting an GlitchTip ist deaktiviert.");
}

Sentry.init({
  dsn,
  tracesSampleRate: 0.01,
});
