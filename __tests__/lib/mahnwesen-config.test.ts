import { describe, it, expect } from "vitest";
import { berechneVerzugszinsen, mahngebuehr, DEFAULT_MAHNWESEN_CONFIG } from "@/lib/mahnwesen-config";

describe("berechneVerzugszinsen", () => {
  it("berechnet auf Mahnstufe 2/3 taggenaue Verzugszinsen", () => {
    const zinsen = berechneVerzugszinsen(1000, 30, 12.37, 2);
    expect(zinsen).toBeCloseTo((1000 * 0.1237 / 365) * 30, 5);
  });

  it("gibt auf Mahnstufe 1 (Zahlungserinnerung) immer 0 zurück, auch bei überfälligem Betrag", () => {
    expect(berechneVerzugszinsen(1000, 71, 12.37, 1)).toBe(0);
  });

  it("gibt 0 zurück wenn noch nicht überfällig, unabhängig von der Mahnstufe", () => {
    expect(berechneVerzugszinsen(1000, 0, 12.37, 3)).toBe(0);
    expect(berechneVerzugszinsen(1000, -5, 12.37, 2)).toBe(0);
  });
});

describe("mahngebuehr", () => {
  it("liefert 0 als Standard für alle Stufen (Betrieb legt eigene Werte fest)", () => {
    expect(mahngebuehr(DEFAULT_MAHNWESEN_CONFIG, 1)).toBe(0);
    expect(mahngebuehr(DEFAULT_MAHNWESEN_CONFIG, 2)).toBe(0);
    expect(mahngebuehr(DEFAULT_MAHNWESEN_CONFIG, 3)).toBe(0);
  });
});
