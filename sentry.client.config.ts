"use client";
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || "";

if (!dsn && typeof window !== "undefined") {
  // NEXT_PUBLIC_* wird beim Docker-Build eingebacken (nicht zur Laufzeit lesbar) —
  // fehlt sie hier, war sie beim `docker build` nicht gesetzt (siehe Dockerfile ARG
  // NEXT_PUBLIC_SENTRY_DSN / GitHub-Actions-Secret SENTRY_DSN), nicht zur Laufzeit nachrüstbar.
  console.warn(
    "[sentry] NEXT_PUBLIC_SENTRY_DSN war beim Build nicht gesetzt — Browser-seitiges " +
      "Fehler-Reporting an GlitchTip ist deaktiviert. Muss als Build-ARG bzw. GitHub-Actions-Secret " +
      "SENTRY_DSN gesetzt sein, ein Neustart des Containers allein genügt hier NICHT."
  );
}

Sentry.init({
  dsn,
  tracesSampleRate: 0.01,
  environment: process.env.NODE_ENV ?? "production",
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
