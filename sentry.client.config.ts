"use client";
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://3a30aed56b4e4dd58ee5710244be23dc@glitchtip.resqio.io/2",
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
