/**
 * Zentraler Logger — einziger Einstiegspunkt für Log- und Fehlerausgaben.
 *
 * Zwei Ströme, ein Aufruf:
 *   Log-Strom    → `console.<level>()`. Die in den `sentry.*.config`-Dateien
 *                  aktivierte `consoleLoggingIntegration` greift genau diesen
 *                  Aufruf ab und schickt ihn als GlitchTip-Log raus.
 *   Issue-Strom  → `error`/`fatal` erzeugen zusätzlich ein echtes GlitchTip-Issue
 *                  (abschaltbar per `issue: false`, z.B. für Client-Meldungen,
 *                  deren Ursache der Server schon als Issue gemeldet hat).
 *
 * WICHTIG — hier NICHT `Sentry.logger.*` aufrufen: der Eintrag käme doppelt in
 * GlitchTip an (einmal direkt, einmal über die Console-Integration). Der
 * `console`-Aufruf ist der einzige Weg in den Log-Strom, und er hält
 * gleichzeitig `docker logs` vollständig lesbar.
 *
 * WICHTIG — Reihenfolge der console-Argumente NICHT umstellen: Message zuerst
 * (lesbar in `docker logs`), Kontext-Objekt als zweites Argument. Die
 * Console-Integration übernimmt weitere Argumente als
 * `sentry.message.parameter.N` in die Log-Attribute, bleibt also durchsuchbar.
 *
 * WICHTIG — Import ist `@sentry/nextjs`, NICHT `@/lib/sentry`: dieses Modul
 * wird auch von Client-Komponenten genutzt, und `@/lib/sentry` zöge über
 * `lib/auth.ts` `next/headers` nach (bricht den Client-Build hart).
 */
import * as Sentry from "@sentry/nextjs";

export type LogContext = Record<string, unknown>;

export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

const isDev = process.env.NODE_ENV === "development";

/** Serialisiert einen beliebigen Wert für die Fehlermeldung, ohne zu werfen. */
function beschreibe(wert: unknown): string {
  if (typeof wert === "string") return wert;
  try {
    return JSON.stringify(wert) ?? String(wert);
  } catch {
    return String(wert);
  }
}

/**
 * Normalisiert einen unbekannten catch-Wert auf ein Error-Objekt, damit
 * GlitchTip einen verwertbaren Typ + Stacktrace bekommt.
 */
export function zuFehler(wert: unknown, fallbackMeldung: string): Error {
  if (wert instanceof Error) return wert;
  return new Error(`${fallbackMeldung}: ${beschreibe(wert)}`);
}

export type LogEreignis = {
  level: LogLevel;
  meldung: string;
  /** Der abgefangene Wert. Fehlt er, wird ein Issue ohne Stacktrace erzeugt. */
  fehler?: unknown;
  ctx?: LogContext;
  /** Issue erzeugen? Default: ab `error`. */
  issue?: boolean;
  /** Überschreibt die GlitchTip-Gruppierung. */
  fingerprint?: string[];
};

/**
 * Low-Level-Einstieg. `log.*` ist der bequeme Zucker darüber; direkt genutzt
 * wird das hier nur, wenn `issue`/`fingerprint` gesteuert werden müssen.
 */
export function logEreignis(ereignis: LogEreignis): string | undefined {
  const { level, meldung, fehler, ctx, fingerprint } = ereignis;
  const mitIssue = ereignis.issue ?? (level === "error" || level === "fatal");

  // debug ist reine lokale Diagnose und wird in Produktion nicht ausgegeben.
  if (level === "debug" && !isDev) return undefined;

  let eventId: string | undefined;

  if (mitIssue) {
    // Sentrys SeverityLevel kennt "warning", nicht "warn".
    const sentryLevel: Sentry.SeverityLevel = level === "warn" ? "warning" : level;

    if (fehler !== undefined && fehler !== null) {
      eventId = Sentry.captureException(zuFehler(fehler, meldung), {
        level: sentryLevel,
        extra: { meldung, ...(ctx ?? {}) },
        ...(fingerprint ? { fingerprint } : {}),
      });
    } else {
      // Kein echter Fehler vorhanden: NICHT `new Error(meldung)` bauen — der
      // Stacktrace zeigte dann auf diese Datei, und GlitchTip würde völlig
      // unzusammenhängende Meldungen zu einem Issue zusammenfassen. Stattdessen
      // captureMessage mit explizitem Fingerprint aus der Meldung.
      eventId = Sentry.captureMessage(meldung, {
        level: sentryLevel,
        extra: ctx,
        fingerprint: fingerprint ?? ["logger", meldung],
      });
    }
  }

  // Log-Strom immer schreiben — mit eventId, damit Log und Issue korrelierbar sind.
  const konsolenLevel = level === "fatal" ? "error" : level;
  const konsolenCtx = eventId ? { ...(ctx ?? {}), eventId } : ctx;
  if (konsolenCtx && Object.keys(konsolenCtx).length > 0) {
    console[konsolenLevel](meldung, konsolenCtx);
  } else {
    console[konsolenLevel](meldung);
  }

  return eventId;
}

export const log = {
  /**
   * Nur für lokale Diagnose — wird in Produktion bewusst nicht ausgegeben und
   * erreicht GlitchTip dort deshalb auch nicht.
   */
  debug(meldung: string, ctx?: LogContext): void {
    logEreignis({ level: "debug", meldung, ctx });
  },

  info(meldung: string, ctx?: LogContext): void {
    logEreignis({ level: "info", meldung, ctx });
  },

  /** Auffälligkeit ohne Abbruch — landet im Log-Strom, erzeugt kein Issue. */
  warn(meldung: string, ctx?: LogContext): void {
    logEreignis({ level: "warn", meldung, ctx });
  },

  /**
   * Fehler: Log-Eintrag + GlitchTip-Issue. Rückgabe ist die Sentry-eventId,
   * die z.B. als Referenzcode an den Nutzer weitergegeben werden kann.
   *
   * Nicht zusätzlich `Sentry.captureException()` aufrufen — das wäre
   * Doppel-Reporting; dieser eine Aufruf macht beides.
   */
  error(meldung: string, fehler?: unknown, ctx?: LogContext): string | undefined {
    return logEreignis({ level: "error", meldung, fehler, ctx });
  },

  /** Wie `error`, aber als `fatal` eingestuft (Prozess-/Startabbruch). */
  fatal(meldung: string, fehler?: unknown, ctx?: LogContext): string | undefined {
    return logEreignis({ level: "fatal", meldung, fehler, ctx });
  },
};
