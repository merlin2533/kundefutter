import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// @sentry/nextjs muss VOR dem Import von lib/logger gemockt werden.
type SentryOptionen = {
  level?: string;
  extra?: Record<string, unknown>;
  fingerprint?: string[];
};

// Generische vi.fn-Form: typisiert mock.calls, ohne ungenutzte Parameter zu
// deklarieren.
const captureException = vi.fn<(fehler: unknown, optionen?: SentryOptionen) => string>(
  () => "event-exc"
);
const captureMessage = vi.fn<(meldung: string, optionen?: SentryOptionen) => string>(
  () => "event-msg"
);

vi.mock("@sentry/nextjs", () => ({
  captureException: (fehler: unknown, optionen?: SentryOptionen) =>
    captureException(fehler, optionen),
  captureMessage: (meldung: string, optionen?: SentryOptionen) =>
    captureMessage(meldung, optionen),
}));

/** Optionen des n-ten Aufrufs — schlägt lesbar fehl, wenn es den nicht gibt. */
function optionenVon(
  mock: typeof captureException | typeof captureMessage,
  index = 0
): SentryOptionen {
  const aufruf = mock.mock.calls[index];
  if (!aufruf) throw new Error(`Kein Aufruf mit Index ${index}`);
  return (aufruf[1] ?? {}) as SentryOptionen;
}

import { log, logEreignis, zuFehler } from "@/lib/logger";

type Spies = {
  debug: ReturnType<typeof vi.spyOn>;
  info: ReturnType<typeof vi.spyOn>;
  warn: ReturnType<typeof vi.spyOn>;
  error: ReturnType<typeof vi.spyOn>;
};

let spies: Spies;

beforeEach(() => {
  captureException.mockClear();
  captureMessage.mockClear();
  spies = {
    debug: vi.spyOn(console, "debug").mockImplementation(() => {}),
    info: vi.spyOn(console, "info").mockImplementation(() => {}),
    warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
    error: vi.spyOn(console, "error").mockImplementation(() => {}),
  };
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Log-Strom vs. Issue-Strom", () => {
  it("info/warn schreiben nur Log, erzeugen KEIN Issue", () => {
    log.info("hallo");
    log.warn("achtung");
    expect(spies.info).toHaveBeenCalledOnce();
    expect(spies.warn).toHaveBeenCalledOnce();
    expect(captureException).not.toHaveBeenCalled();
    expect(captureMessage).not.toHaveBeenCalled();
  });

  it("error schreibt Log UND erzeugt genau ein Issue", () => {
    const err = new Error("kaputt");
    const id = log.error("Speichern fehlgeschlagen", err, { kundeId: 7 });
    expect(id).toBe("event-exc");
    expect(captureException).toHaveBeenCalledOnce();
    expect(captureMessage).not.toHaveBeenCalled();
    expect(spies.error).toHaveBeenCalledOnce();
  });

  it("übergibt den Originalfehler an captureException (Stacktrace bleibt erhalten)", () => {
    const err = new Error("original");
    log.error("Kontext", err);
    expect(captureException.mock.calls[0]?.[0]).toBe(err);
  });

  it("baut ohne echten Fehler KEIN synthetisches Error, sondern nutzt captureMessage", () => {
    // Sonst zeigte der Stacktrace auf lib/logger.ts und GlitchTip würde
    // unzusammenhängende Meldungen zu einem Issue zusammenfassen.
    log.error("nur eine Meldung");
    expect(captureException).not.toHaveBeenCalled();
    expect(captureMessage).toHaveBeenCalledOnce();
    expect(optionenVon(captureMessage).fingerprint).toEqual([
      "logger",
      "nur eine Meldung",
    ]);
  });

  it("fatal schreibt auf console.error (console kennt kein 'fatal')", () => {
    log.fatal("Abbruch", new Error("x"));
    expect(spies.error).toHaveBeenCalledOnce();
    expect(optionenVon(captureException).level).toBe("fatal");
  });

  it("übersetzt warn auf Sentrys 'warning' (SeverityLevel kennt kein 'warn')", () => {
    logEreignis({ level: "warn", meldung: "w", issue: true });
    expect(optionenVon(captureMessage).level).toBe("warning");
  });
});

describe("issue-Flag", () => {
  it("issue: false unterdrückt das Issue, behält aber den Log-Eintrag", () => {
    logEreignis({ level: "error", meldung: "nur Log", issue: false });
    expect(captureException).not.toHaveBeenCalled();
    expect(captureMessage).not.toHaveBeenCalled();
    expect(spies.error).toHaveBeenCalledOnce();
  });

  it("issue: true erzwingt ein Issue auch bei warn", () => {
    logEreignis({ level: "warn", meldung: "erzwungen", issue: true });
    expect(captureMessage).toHaveBeenCalledOnce();
  });

  it("debug + issue: true erzeugt das Issue AUCH in Produktion", () => {
    // Regression: ein Early-Return für debug hat den Issue-Zweig zuvor
    // übersprungen — derselbe Aufruf verhielt sich in Dev und Produktion
    // unterschiedlich, und zwar still.
    const id = logEreignis({ level: "debug", meldung: "diag", issue: true });
    expect(captureMessage).toHaveBeenCalledOnce();
    expect(id).toBe("event-msg");
    // Der Log-Eintrag bleibt in Produktion unterdrückt (NODE_ENV=test != development).
    expect(spies.debug).not.toHaveBeenCalled();
  });

  it("debug ohne issue erzeugt außerhalb von Dev gar nichts", () => {
    log.debug("nur lokal");
    expect(spies.debug).not.toHaveBeenCalled();
    expect(captureMessage).not.toHaveBeenCalled();
  });
});

describe("Robustheit", () => {
  it("wirft nicht, wenn Sentry selbst wirft", () => {
    // logEreignis wird fast nur AUS catch-Blöcken gerufen — würde es werfen,
    // ersetzte der Logger-Fehler den Originalfehler.
    captureException.mockImplementationOnce(() => {
      throw new Error("Sentry kaputt");
    });
    expect(() => log.error("trotzdem", new Error("x"))).not.toThrow();
    // Der Log-Eintrag muss trotzdem geschrieben werden.
    expect(spies.error).toHaveBeenCalledOnce();
  });

  it("wirft nicht, wenn console selbst wirft", () => {
    spies.error.mockImplementationOnce(() => {
      throw new Error("console kaputt");
    });
    expect(() => log.error("trotzdem", new Error("x"))).not.toThrow();
  });

  it("hängt die eventId an den Log-Kontext, damit Log und Issue korrelierbar sind", () => {
    log.error("mit id", new Error("x"), { kundeId: 1 });
    const ctx = spies.error.mock.calls[0][1] as Record<string, unknown>;
    expect(ctx).toMatchObject({ kundeId: 1, eventId: "event-exc" });
  });

  it("schreibt ohne Kontext nur die Meldung (ein Argument)", () => {
    logEreignis({ level: "info", meldung: "schlicht" });
    expect(spies.info).toHaveBeenCalledWith("schlicht");
  });
});

describe("zuFehler", () => {
  it("gibt ein Error unverändert zurück", () => {
    const e = new Error("da");
    expect(zuFehler(e, "fallback")).toBe(e);
  });

  it("verpackt Strings und Objekte mit der Fallback-Meldung", () => {
    expect(zuFehler("text", "fallback").message).toBe("fallback: text");
    expect(zuFehler({ a: 1 }, "fallback").message).toBe('fallback: {"a":1}');
  });

  it("verkraftet zyklische Objekte, ohne zu werfen", () => {
    const zyklisch: Record<string, unknown> = {};
    zyklisch.self = zyklisch;
    expect(() => zuFehler(zyklisch, "fallback")).not.toThrow();
  });

  it("nutzt bei null/undefined nur die Fallback-Meldung", () => {
    expect(zuFehler(undefined, "fallback").message).toBe("fallback");
    expect(zuFehler(null, "fallback").message).toBe("fallback");
  });
});
