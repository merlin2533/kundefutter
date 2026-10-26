import { describe, it, expect, vi, afterEach } from "vitest";
import { berechneEierMhd, eierMhdStatus } from "@/lib/eier-mhd";

describe("berechneEierMhd", () => {
  it("addiert 28 Tage innerhalb eines Monats", () => {
    const mhd = berechneEierMhd(new Date(2026, 8, 1)); // 01.09.2026
    expect(mhd.getFullYear()).toBe(2026);
    expect(mhd.getMonth()).toBe(8);
    expect(mhd.getDate()).toBe(29);
  });

  it("rollt über die Jahresgrenze", () => {
    const mhd = berechneEierMhd(new Date(2026, 11, 15)); // 15.12.2026
    expect(mhd.getFullYear()).toBe(2027);
    expect(mhd.getMonth()).toBe(0);
    expect(mhd.getDate()).toBe(12);
  });

  it("berücksichtigt das Schaltjahr", () => {
    const mhd = berechneEierMhd(new Date(2028, 1, 10)); // 10.02.2028 (Schaltjahr)
    expect(mhd.getMonth()).toBe(2);
    expect(mhd.getDate()).toBe(9);
  });

  it("verändert das Eingabedatum nicht", () => {
    const lege = new Date(2026, 8, 1);
    berechneEierMhd(lege);
    expect(lege.getDate()).toBe(1);
  });
});

describe("eierMhdStatus", () => {
  afterEach(() => vi.useRealTimers());

  // Legedatum so wählen, dass das MHD genau `tage` Tage nach "jetzt" liegt.
  function legedatumMitRestlaufzeit(jetzt: Date, tage: number): string {
    const d = new Date(jetzt);
    d.setDate(d.getDate() + tage - 28);
    return d.toISOString();
  }

  it("liefert unbekannt ohne Legedatum", () => {
    expect(eierMhdStatus(null)).toBe("unbekannt");
  });

  it("Grenzen: 8 Tage gültig, 7 und 0 Tage ablaufend, -1 Tag abgelaufen", () => {
    const jetzt = new Date("2026-09-15T12:00:00Z");
    vi.useFakeTimers();
    vi.setSystemTime(jetzt);
    expect(eierMhdStatus(legedatumMitRestlaufzeit(jetzt, 8))).toBe("gueltig");
    expect(eierMhdStatus(legedatumMitRestlaufzeit(jetzt, 7))).toBe("ablaufend");
    expect(eierMhdStatus(legedatumMitRestlaufzeit(jetzt, 0))).toBe("ablaufend");
    expect(eierMhdStatus(legedatumMitRestlaufzeit(jetzt, -1))).toBe("abgelaufen");
  });
});
