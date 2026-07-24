import * as Sentry from "@sentry/nextjs";

// GlitchTip-DSN ist ein Write-only-Ingest-Key (kein Secret) — fest als Standard
// hinterlegt, damit Fehler-Reporting immer aktiv ist, auch ohne separate
// Umgebungsvariable pro Deployment. Per SENTRY_DSN weiterhin überschreibbar.
const GLITCHTIP_DSN = "https://3a30aed56b4e4dd58ee5710244be23dc@glitchtip.resqio.io/2";

Sentry.init({
  dsn: process.env.SENTRY_DSN || GLITCHTIP_DSN,
  tracesSampleRate: 0.01,
  environment: process.env.NODE_ENV ?? "production",
});
