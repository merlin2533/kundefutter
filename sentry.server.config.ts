import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN || "";

if (!dsn) {
  // Bewusst laut: ohne SENTRY_DSN meldet die Anwendung serverseitig KEINEN
  // einzigen Fehler an GlitchTip — captureException()-Aufrufe laufen dann
  // überall unbemerkt ins Leere. Diese Zeile landet in `docker logs`, damit
  // eine fehlende DSN sofort auffällt statt sich als "GlitchTip bekommt nichts"
  // erst viel später bemerkbar zu machen.
  console.warn(
    "[sentry] SENTRY_DSN ist nicht gesetzt — server-seitiges Fehler-Reporting an GlitchTip ist deaktiviert. " +
      "In der .env neben docker-compose(.prod).yml setzen und den Container neu erzeugen (docker compose up -d)."
  );
}

Sentry.init({
  dsn,
  tracesSampleRate: 0.01,
  environment: process.env.NODE_ENV ?? "production",
});
