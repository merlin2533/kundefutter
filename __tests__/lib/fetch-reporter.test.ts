import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const logEreignis = vi.fn();
vi.mock("@/lib/logger", () => ({
  logEreignis: (...args: unknown[]) => logEreignis(...(args as [])),
}));

import { installFetchReporter } from "@/lib/fetch-reporter";

type Ereignis = {
  level: string;
  meldung: string;
  ctx?: Record<string, unknown>;
  issue?: boolean;
  fehler?: unknown;
};

const ORIGIN = "https://app.example.test";

let originalFetch: ReturnType<typeof vi.fn>;

/** Baut ein minimales window/navigator-Doppel für die Node-Testumgebung. */
function fensterAufbauen() {
  originalFetch = vi.fn(
    async () => new Response("ok", { status: 200, headers: { "content-length": "2" } })
  );
  const fenster = {
    fetch: originalFetch,
    location: { origin: ORIGIN, pathname: "/" },
  };
  vi.stubGlobal("window", fenster);
  vi.stubGlobal("navigator", { onLine: true });
  return fenster as unknown as Window & { fetch: typeof fetch };
}

function antwort(status: number, body = "", headers: Record<string, string> = {}) {
  return new Response(status === 204 ? null : body, { status, headers });
}

function ereignisse(): Ereignis[] {
  return logEreignis.mock.calls.map((c) => c[0] as Ereignis);
}

/** Wartet auf Microtasks, damit das nicht-awaitete fehlerDetail() durchläuft. */
const abwarten = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  logEreignis.mockClear();
  vi.useRealTimers();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Geltungsbereich", () => {
  it("meldet einen 500er auf /api/* mit Pfad, Methode und Status", async () => {
    const f = fensterAufbauen();
    originalFetch.mockResolvedValueOnce(antwort(500, "boom", { "content-length": "4" }));
    installFetchReporter();

    await f.fetch(`${ORIGIN}/api/kunden`, { method: "POST" });
    await abwarten();

    const e = ereignisse();
    expect(e).toHaveLength(1);
    expect(e[0].level).toBe("error");
    expect(e[0].meldung).toBe("HTTP 500 POST /api/kunden");
    expect(e[0].ctx).toMatchObject({ pfad: "/api/kunden", methode: "POST", status: 500 });
  });

  it("erzeugt NIE ein Issue — den Fehler hat der Server schon gemeldet", async () => {
    const f = fensterAufbauen();
    originalFetch.mockResolvedValueOnce(antwort(500, "x", { "content-length": "1" }));
    installFetchReporter();
    await f.fetch(`${ORIGIN}/api/x`);
    await abwarten();
    expect(ereignisse().every((e) => e.issue === false)).toBe(true);
  });

  it("stuft 4xx als warn und 5xx als error ein", async () => {
    const f = fensterAufbauen();
    originalFetch.mockResolvedValueOnce(antwort(422, "x", { "content-length": "1" }));
    installFetchReporter();
    await f.fetch(`${ORIGIN}/api/a`);
    originalFetch.mockResolvedValueOnce(antwort(503, "x", { "content-length": "1" }));
    await f.fetch(`${ORIGIN}/api/b`);
    await abwarten();
    expect(ereignisse().map((e) => e.level)).toEqual(["warn", "error"]);
  });

  it("ignoriert erfolgreiche Antworten", async () => {
    const f = fensterAufbauen();
    installFetchReporter();
    await f.fetch(`${ORIGIN}/api/kunden`);
    expect(logEreignis).not.toHaveBeenCalled();
  });

  it("ignoriert Fremd-Hosts — insbesondere den GlitchTip-Envelope (Rückkopplungsschutz)", async () => {
    const f = fensterAufbauen();
    originalFetch.mockResolvedValue(antwort(500, "x", { "content-length": "1" }));
    installFetchReporter();
    await f.fetch("https://glitchtip.resqio.io/api/2/envelope/", { method: "POST" });
    await f.fetch("https://nominatim.openstreetmap.org/search");
    await abwarten();
    expect(logEreignis).not.toHaveBeenCalled();
  });

  it("ignoriert Nicht-API-Pfade wie /_next/ und RSC-Anfragen", async () => {
    const f = fensterAufbauen();
    originalFetch.mockResolvedValue(antwort(500, "x", { "content-length": "1" }));
    installFetchReporter();
    await f.fetch(`${ORIGIN}/_next/static/chunk.js`);
    await f.fetch(`${ORIGIN}/kunden?_rsc=abc`);
    await abwarten();
    expect(logEreignis).not.toHaveBeenCalled();
  });

  it("nimmt 401 generell aus — die Middleware liefert das für JEDEN /api/*-Pfad", async () => {
    const f = fensterAufbauen();
    originalFetch.mockResolvedValue(antwort(401, "x", { "content-length": "1" }));
    installFetchReporter();
    await f.fetch(`${ORIGIN}/api/dashboard`);
    await f.fetch(`${ORIGIN}/api/auth/me`);
    await abwarten();
    expect(logEreignis).not.toHaveBeenCalled();
  });

  it("nimmt 404 nur bei Lookup-Endpunkten aus", async () => {
    const f = fensterAufbauen();
    originalFetch.mockResolvedValue(antwort(404, "x", { "content-length": "1" }));
    installFetchReporter();
    await f.fetch(`${ORIGIN}/api/suche?q=ab`);
    expect(logEreignis).not.toHaveBeenCalled();
    await f.fetch(`${ORIGIN}/api/kunden/9999`);
    await abwarten();
    expect(ereignisse()).toHaveLength(1);
  });
});

describe("Deckel gegen Dauerfeuer", () => {
  it("meldet dieselbe Meldung innerhalb des Fensters nur einmal", async () => {
    // Die App pollt an drei Stellen im Minutentakt; ohne Deckel erzeugte ein
    // offener Tab bei DB-Ausfall unbegrenzt Einträge.
    const f = fensterAufbauen();
    originalFetch.mockResolvedValue(antwort(500, "x", { "content-length": "1" }));
    installFetchReporter();
    for (let i = 0; i < 5; i++) await f.fetch(`${ORIGIN}/api/dashboard`);
    await abwarten();
    expect(ereignisse()).toHaveLength(1);
  });

  it("unterscheidet dabei nach Pfad, Methode und Status", async () => {
    const f = fensterAufbauen();
    installFetchReporter();
    originalFetch.mockResolvedValueOnce(antwort(500, "x", { "content-length": "1" }));
    await f.fetch(`${ORIGIN}/api/a`);
    originalFetch.mockResolvedValueOnce(antwort(500, "x", { "content-length": "1" }));
    await f.fetch(`${ORIGIN}/api/b`);
    originalFetch.mockResolvedValueOnce(antwort(503, "x", { "content-length": "1" }));
    await f.fetch(`${ORIGIN}/api/a`);
    originalFetch.mockResolvedValueOnce(antwort(500, "x", { "content-length": "1" }));
    await f.fetch(`${ORIGIN}/api/a`, { method: "POST" });
    await abwarten();
    expect(ereignisse()).toHaveLength(4);
  });
});

describe("Antwortkörper", () => {
  it("liest den Body NICHT, wenn content-length fehlt (chunked/gestreamt)", async () => {
    // Sonst würde `Number(null ?? "0")` = 0 den 8-KB-Deckel unterlaufen und der
    // komplette Body gepuffert — genau bei Next.js-500-HTML-Seiten.
    const f = fensterAufbauen();
    originalFetch.mockResolvedValueOnce(antwort(500, "x".repeat(50_000)));
    installFetchReporter();
    await f.fetch(`${ORIGIN}/api/gross`);
    await abwarten();
    expect(ereignisse()[0].ctx).not.toHaveProperty("detail");
  });

  it("liest kleine Fehlerkörper als Diagnose-Kontext mit", async () => {
    const f = fensterAufbauen();
    originalFetch.mockResolvedValueOnce(
      antwort(500, "Interner Fehler", { "content-length": "15" })
    );
    installFetchReporter();
    await f.fetch(`${ORIGIN}/api/klein`);
    await abwarten();
    expect(ereignisse()[0].ctx?.detail).toBe("Interner Fehler");
  });

  it("überspringt Körper über 8 KB", async () => {
    const f = fensterAufbauen();
    originalFetch.mockResolvedValueOnce(
      antwort(500, "y".repeat(20_000), { "content-length": "20000" })
    );
    installFetchReporter();
    await f.fetch(`${ORIGIN}/api/zugross`);
    await abwarten();
    expect(ereignisse()[0].ctx).not.toHaveProperty("detail");
  });

  it("lässt den Body für die Aufrufstelle unangetastet", async () => {
    const f = fensterAufbauen();
    originalFetch.mockResolvedValueOnce(
      antwort(500, '{"error":"x"}', { "content-length": "13" })
    );
    installFetchReporter();
    const res = await f.fetch(`${ORIGIN}/api/body`);
    // Würde der Reporter das Original statt eines clone() lesen, wäre der
    // Stream hier bereits verbraucht.
    await expect(res.json()).resolves.toEqual({ error: "x" });
  });
});

describe("Netzwerkfehler", () => {
  it("meldet einen echten Netzwerkfehler als error und wirft weiter", async () => {
    const f = fensterAufbauen();
    const fehler = new TypeError("Failed to fetch");
    originalFetch.mockRejectedValueOnce(fehler);
    installFetchReporter();

    await expect(f.fetch(`${ORIGIN}/api/weg`)).rejects.toBe(fehler);
    const e = ereignisse();
    expect(e).toHaveLength(1);
    expect(e[0].level).toBe("error");
    expect(e[0].fehler).toBe(fehler);
  });

  it("stuft AbortError als info ein (gewollter Abbruch)", async () => {
    const f = fensterAufbauen();
    const abbruch = Object.assign(new Error("aborted"), { name: "AbortError" });
    originalFetch.mockRejectedValueOnce(abbruch);
    installFetchReporter();
    await expect(f.fetch(`${ORIGIN}/api/ab`)).rejects.toBe(abbruch);
    expect(ereignisse()[0].level).toBe("info");
  });

  it("stuft Offline als warn ein", async () => {
    const f = fensterAufbauen();
    vi.stubGlobal("navigator", { onLine: false });
    originalFetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    installFetchReporter();
    await expect(f.fetch(`${ORIGIN}/api/off`)).rejects.toThrow();
    const e = ereignisse()[0];
    expect(e.level).toBe("warn");
    expect(e.ctx).toMatchObject({ offline: true });
  });
});

describe("Installation", () => {
  it("ist idempotent — mehrfaches Installieren stapelt keine Wrapper", async () => {
    const f = fensterAufbauen();
    installFetchReporter();
    const nachErstem = f.fetch;
    installFetchReporter();
    expect(f.fetch).toBe(nachErstem);

    originalFetch.mockResolvedValueOnce(antwort(500, "x", { "content-length": "1" }));
    await f.fetch(`${ORIGIN}/api/einmal`);
    await abwarten();
    expect(ereignisse()).toHaveLength(1);
  });

  it("tut ohne window nichts (Server-Rendering)", () => {
    vi.stubGlobal("window", undefined);
    expect(() => installFetchReporter()).not.toThrow();
  });

  it("reicht Request-Objekte samt Methode korrekt durch", async () => {
    const f = fensterAufbauen();
    originalFetch.mockResolvedValueOnce(antwort(500, "x", { "content-length": "1" }));
    installFetchReporter();
    await f.fetch(new Request(`${ORIGIN}/api/req`, { method: "DELETE" }));
    await abwarten();
    expect(ereignisse()[0].ctx).toMatchObject({ methode: "DELETE", pfad: "/api/req" });
  });
});
