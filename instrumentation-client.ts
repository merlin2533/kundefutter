/**
 * Browser-seitige Sentry/GlitchTip-Initialisierung.
 *
 * Ersetzt die frühere `sentry.client.config.ts`: die ist ab @sentry/nextjs 9
 * deprecated und greift unter Turbopack (Next-16-Standard für `next dev`)
 * gar nicht mehr — der Browser hätte dort nie gemeldet.
 */
import * as Sentry from "@sentry/nextjs";
import { resolveClientSentryDsn } from "@/lib/sentry-dsn";
import { installFetchReporter } from "@/lib/fetch-reporter";

const dsn = resolveClientSentryDsn();

if (!dsn && typeof window !== "undefined") {
  // Nur noch erreichbar, wenn NEXT_PUBLIC_SENTRY_DSN beim Build bewusst auf
  // einen Abschalt-Wert ("off") gesetzt wurde — ohne Konfiguration greift der
  // fest hinterlegte Standard-DSN aus lib/sentry-dsn.ts.
  console.warn(
    "[sentry] Browser-Fehler-Reporting ist per NEXT_PUBLIC_SENTRY_DSN abgeschaltet."
  );
}

Sentry.init({
  dsn,
  tracesSampleRate: 0.01,
  environment: process.env.NODE_ENV ?? "production",
  release: `${process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0"}+${process.env.NEXT_PUBLIC_BUILD_ID ?? "dev"}`,

  // console.* landet als GlitchTip-Log (nicht als Issue) — deckt den gesamten
  // Altbestand an console-Aufrufen ab und ist der Transportweg von lib/logger.ts.
  enableLogs: true,
  integrations: [
    // debug/log bewusst NICHT: das wäre reines Bibliotheks-Rauschen im
    // Browser-Bundle. Volumen ist bei Logs der knappe Faktor.
    Sentry.consoleLoggingIntegration({ levels: ["info", "warn", "error"] }),
  ],

  // Replays not supported by GlitchTip — keep disabled
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,

  beforeSend(event, hint) {
    const err = hint?.originalException;

    // Filter known benign browser-extension hydration noise
    if (err instanceof Error) {
      const msg = err.message ?? "";
      // React hydration errors from browser extensions (e.g. password managers, ad blockers)
      // that inject attributes into <html>/<body> — not an app bug, suppressed for now.
      if (
        msg.includes("Minified React error #418") ||
        msg.includes("Minified React error #423") ||
        msg.includes("Minified React error #425")
      ) {
        // Still send to GlitchTip so we can track frequency, but mark as info-level
        event.level = "info";
        event.tags = { ...event.tags, hydration_noise: "true" };
      }
    }

    return event;
  },
});

// Globales Netz für fehlgeschlagene API-Aufrufe — muss NACH Sentry.init()
// laufen und darf den Seitenstart unter keinen Umständen verhindern.
try {
  installFetchReporter();
} catch (err) {
  Sentry.captureException(err);
}

// Erfasst Navigations-Übergänge des App Routers (ersetzt die frühere
// automatische Instrumentierung).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
