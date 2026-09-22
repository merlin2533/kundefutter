import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mitRetryBei429, parseJsonFromText } from "@/lib/ai";

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

// Regressionstest für GlitchTip AGRI-1C ("SDKError: API error occurred:
// Status 429", 12 Vorkommen, ausgelöst über die KI-Batch-Belegerkennung):
// ein von Mistral kurzzeitig gedrosselter Aufruf (Rate Limit) landete bisher
// sofort als Fehlschlag beim Nutzer und als GlitchTip-Issue, obwohl ein
// erneuter Versuch nach kurzer Wartezeit praktisch immer durchgeht.
// `mitRetryBei429()` ist der einzige Ort, an dem diese Wiederholung passiert.
describe("mitRetryBei429", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function rateLimitFehler(headers?: Headers) {
    return Object.assign(new Error("Status 429"), { statusCode: 429, headers });
  }

  it("gibt das Ergebnis beim ersten Versuch zurück, ohne zu warten", async () => {
    const aufruf = vi.fn().mockResolvedValue("ok");
    await expect(mitRetryBei429(aufruf)).resolves.toBe("ok");
    expect(aufruf).toHaveBeenCalledTimes(1);
  });

  it("wiederholt bei HTTP 429 und liefert danach das Ergebnis", async () => {
    const aufruf = vi
      .fn()
      .mockRejectedValueOnce(rateLimitFehler())
      .mockResolvedValueOnce("ok-nach-retry");
    const promise = mitRetryBei429(aufruf);
    await vi.advanceTimersByTimeAsync(1000);
    await expect(promise).resolves.toBe("ok-nach-retry");
    expect(aufruf).toHaveBeenCalledTimes(2);
  });

  it("wirft einen Nicht-429-Fehler sofort weiter, ohne es erneut zu versuchen", async () => {
    const authFehler = Object.assign(new Error("Status 401"), { statusCode: 401 });
    const aufruf = vi.fn().mockRejectedValue(authFehler);
    await expect(mitRetryBei429(aufruf)).rejects.toBe(authFehler);
    expect(aufruf).toHaveBeenCalledTimes(1);
  });

  it("gibt nach Ausschöpfen aller Versuche den letzten 429-Fehler weiter", async () => {
    const fehler = rateLimitFehler();
    const aufruf = vi.fn().mockRejectedValue(fehler);
    const promise = mitRetryBei429(aufruf);
    const erwartung = expect(promise).rejects.toBe(fehler);
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(3000);
    await erwartung;
    expect(aufruf).toHaveBeenCalledTimes(3);
  });

  it("respektiert den Retry-After-Header statt der festen Verzögerung", async () => {
    const fehler = rateLimitFehler(new Headers({ "retry-after": "5" }));
    const aufruf = vi.fn().mockRejectedValueOnce(fehler).mockResolvedValueOnce("ok");
    const promise = mitRetryBei429(aufruf);
    await vi.advanceTimersByTimeAsync(4999);
    expect(aufruf).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(promise).resolves.toBe("ok");
    expect(aufruf).toHaveBeenCalledTimes(2);
  });
});

// Regressionstest für GlitchTip AGRI-1I ("Unexpected non-whitespace character
// after JSON at position …") und AGRI-1K ("SyntaxError: Unexpected token '`'"):
// Mistral haengt einer sonst gueltigen JSON-Antwort haeufig erklaerenden
// Freitext an (vor UND hinter der eigentlichen JSON-Struktur, teils in einer
// Markdown-Huelle). Ein einzelner gescheiterter Parse-Versuch darf dafuer
// keine Meldung ausloesen, solange eine der nachgelagerten Strategien noch
// ein valides Ergebnis liefert — siehe parseJsonFromText() in lib/ai.ts.
describe("parseJsonFromText", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("parst reines JSON ohne jede Meldung", async () => {
    const Sentry = await import("@sentry/nextjs");
    const ergebnis = parseJsonFromText('{"betrag": 42}');
    expect(ergebnis).toEqual({ betrag: 42 });
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("parst JSON mit angehängtem Freitext danach, ohne Meldung", async () => {
    const Sentry = await import("@sentry/nextjs");
    const ergebnis = parseJsonFromText(
      '{"betrag": 42} Hinweis: Der Betrag wurde aus Brutto und MwSt berechnet.'
    );
    expect(ergebnis).toEqual({ betrag: 42 });
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("parst JSON aus einem Markdown-Codeblock, ohne Meldung", async () => {
    const Sentry = await import("@sentry/nextjs");
    const ergebnis = parseJsonFromText('```json\n{"betrag": 42}\n```');
    expect(ergebnis).toEqual({ betrag: 42 });
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("meldet erst, wenn wirklich jede Parse-Strategie scheitert", async () => {
    const Sentry = await import("@sentry/nextjs");
    const ergebnis = parseJsonFromText("Das ist gar kein JSON, sondern reiner Fließtext.");
    expect(ergebnis).toEqual({ rawText: "Das ist gar kein JSON, sondern reiner Fließtext." });
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });
});
