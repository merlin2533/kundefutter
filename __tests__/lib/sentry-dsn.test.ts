import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_SENTRY_DSN,
  parseDsn,
  resolveSentryDsn,
  sentryDsnHerkunft,
  sentrySecurityReportUrl,
  sentryStoreUrl,
} from "@/lib/sentry-dsn";

const WURZEL = join(__dirname, "..", "..");

function lies(relativerPfad: string): string {
  return readFileSync(join(WURZEL, relativerPfad), "utf8");
}

describe("resolveSentryDsn", () => {
  const vorher = { ...process.env };

  beforeEach(() => {
    delete process.env.SENTRY_DSN;
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;
  });

  afterEach(() => {
    process.env = { ...vorher };
  });

  it("liefert ohne jede Env-Variable den fest hinterlegten Standard-DSN", () => {
    // Kernanforderung: jeder Container dieses Images meldet ohne Konfiguration.
    expect(resolveSentryDsn()).toBe(DEFAULT_SENTRY_DSN);
  });

  it("behandelt ein leeres SENTRY_DSN wie 'nicht gesetzt'", () => {
    // docker-compose setzt `SENTRY_DSN=${SENTRY_DSN:-}` — also einen LEEREN
    // String, nicht undefined. Der darf den Default nicht aushebeln.
    process.env.SENTRY_DSN = "";
    expect(resolveSentryDsn()).toBe(DEFAULT_SENTRY_DSN);
  });

  it("lässt eine eigene DSN gewinnen", () => {
    process.env.SENTRY_DSN = "https://abc123@glitchtip.example.org/7";
    expect(resolveSentryDsn()).toBe("https://abc123@glitchtip.example.org/7");
    expect(sentryDsnHerkunft()).toBe("env");
  });

  it("fällt auf NEXT_PUBLIC_SENTRY_DSN zurück, wenn SENTRY_DSN leer ist", () => {
    process.env.SENTRY_DSN = "";
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://xyz@glitchtip.example.org/9";
    expect(resolveSentryDsn()).toBe("https://xyz@glitchtip.example.org/9");
  });

  it.each(["off", "OFF", "none", "false", "0", "disabled", "aus", " off "])(
    "schaltet das Reporting bei SENTRY_DSN=%s ab",
    (wert) => {
      process.env.SENTRY_DSN = wert;
      expect(resolveSentryDsn()).toBe("");
      expect(sentryDsnHerkunft()).toBe("off");
    }
  );

  it("meldet den Standard-DSN als Herkunft 'default', auch wenn er explizit gesetzt ist", () => {
    process.env.SENTRY_DSN = DEFAULT_SENTRY_DSN;
    expect(sentryDsnHerkunft()).toBe("default");
  });

  it("bevorzugt ein explizites Argument vor der Umgebung", () => {
    process.env.SENTRY_DSN = "https://env@host.example/1";
    expect(resolveSentryDsn("https://arg@host.example/2")).toBe(
      "https://arg@host.example/2"
    );
  });
});

describe("parseDsn", () => {
  it("zerlegt den Standard-DSN korrekt", () => {
    expect(parseDsn(DEFAULT_SENTRY_DSN)).toEqual({
      key: "3a30aed56b4e4dd58ee5710244be23dc",
      host: "glitchtip.resqio.io",
      projectId: "2",
    });
  });

  it.each([undefined, null, "", "kein-dsn", "https://host.example/2", "https://key@host"])(
    "liefert null für ungültige Eingabe %s",
    (wert) => {
      expect(parseDsn(wert as string | undefined)).toBeNull();
    }
  );
});

describe("abgeleitete Endpunkte", () => {
  it("baut den CSP-Security-Endpunkt genau so, wie GlitchTip ihn erwartet", () => {
    expect(sentrySecurityReportUrl(DEFAULT_SENTRY_DSN)).toBe(
      "https://glitchtip.resqio.io/api/2/security/?glitchtip_key=3a30aed56b4e4dd58ee5710244be23dc"
    );
  });

  it("baut den Store-Endpunkt für Prozesse ohne SDK", () => {
    expect(sentryStoreUrl(DEFAULT_SENTRY_DSN)).toBe(
      "https://glitchtip.resqio.io/api/2/store/"
    );
  });

  it("liefert leere Endpunkte, wenn das Reporting abgeschaltet ist", () => {
    expect(sentrySecurityReportUrl("")).toBe("");
    expect(sentryStoreUrl("")).toBe("");
  });

  it("enthält kein Semikolon (würde die CSP-Direktivenliste zerreißen)", () => {
    expect(sentrySecurityReportUrl(DEFAULT_SENTRY_DSN)).not.toContain(";");
  });
});

/**
 * Drift-Guard: Shell-Skripte, der Service Worker und der PID-1-Reporter können
 * das TS-Modul nicht importieren und tragen den DSN deshalb als Literal. Dieser
 * Test stellt sicher, dass alle Kopien identisch bleiben.
 */
describe("DSN-Literale bleiben synchron", () => {
  it.each([
    "docker-entrypoint.sh",
    ".github/scripts/report-to-sentry.sh",
    "scripts/sentry-store-report.cjs",
    "public/sw.js",
  ])("%s enthält denselben Standard-DSN", (pfad) => {
    expect(lies(pfad)).toContain(DEFAULT_SENTRY_DSN);
  });
});
