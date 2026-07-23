import * as Sentry from "@sentry/nextjs";

let registered = false;

/**
 * Fängt Fehler ab, die außerhalb jedes Request-Kontexts auftreten (Timer,
 * fire-and-forget Promises, der Node-Prozess selbst) — onRequestError deckt
 * das nicht ab. Nur für die Node.js-Laufzeit; in eine eigene Datei ausgelagert
 * und ausschließlich dynamisch importiert, damit Turbopack `process.on` nicht
 * fälschlich in den Edge-Runtime-Bundle-Graph zieht.
 */
export function registerProcessErrorHandlers() {
  if (registered) return;
  registered = true;

  process.on("uncaughtException", (err) => {
    Sentry.captureException(err);
    console.error("[instrumentation] uncaughtException:", err);
  });
  process.on("unhandledRejection", (reason) => {
    Sentry.captureException(reason);
    console.error("[instrumentation] unhandledRejection:", reason);
  });
}
