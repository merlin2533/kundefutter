"use client";
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://3a30aed56b4e4dd58ee5710244be23dc@glitchtip.resqio.io/2",
  tracesSampleRate: 0.01,
  environment: process.env.NODE_ENV ?? "production",
  // Replays not supported by GlitchTip — keep disabled
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
});
