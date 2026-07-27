import * as Sentry from "@sentry/nextjs";
import { log } from "@/lib/logger";

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
    log.fatal("[instrumentation] uncaughtException", err);
    // Ohne flush() kann der Event mit dem sterbenden Prozess verloren gehen.
    // Bewusst fire-and-forget: der Handler darf nicht blockieren.
    void Sentry.flush(2000).catch(() => {
      // flush() selbst darf hier nichts mehr werfen — sonst Endlosschleife
      // über denselben uncaughtException-Handler.
    });
  });

  process.on("unhandledRejection", (reason) => {
    log.error("[instrumentation] unhandledRejection", reason);
    void Sentry.flush(2000).catch(() => {
      /* siehe oben */
    });
  });
}
