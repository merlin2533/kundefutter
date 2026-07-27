import * as Sentry from "@sentry/nextjs";
import { log } from "@/lib/logger";

let registered = false;
let beendetSich = false;

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
    // Reentranz-Schutz: wirft der Handler selbst (oder tritt während des
    // Herunterfahrens eine weitere Exception auf), nicht erneut alles anstoßen.
    if (beendetSich) return;
    beendetSich = true;

    log.fatal("[instrumentation] uncaughtException", err);

    // WICHTIG: Nach einer uncaught Exception ist der Prozesszustand
    // undefiniert. Node beendet sich hier standardmäßig mit Code 1, worauf
    // Docker den Container neu startet. Registriert man einen Handler, entfällt
    // dieses Verhalten — der Server würde kaputt weiterlaufen. Deshalb wird das
    // Beenden hier explizit nachgeholt, nur eben erst NACH dem flush(), damit
    // der Event GlitchTip noch erreicht.
    Sentry.flush(2000)
      .catch(() => {
        // flush() selbst darf hier nichts mehr werfen.
      })
      .finally(() => {
        process.exit(1);
      });
  });

  process.on("unhandledRejection", (reason) => {
    // Bewusst KEIN exit: eine unbehandelte Rejection lässt den Prozess in
    // einem definierten Zustand zurück, und Nexts Default-Verhalten dafür
    // wollen wir nicht verschärfen.
    log.error("[instrumentation] unhandledRejection", reason);
    void Sentry.flush(2000).catch(() => {
      /* siehe oben */
    });
  });
}
