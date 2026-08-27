import { describe, it, expect } from "vitest";
import { berechneVerzugszinsen, mahngebuehr, DEFAULT_MAHNWESEN_CONFIG, mahnungTextBausteine, MAHNUNG_BETREFF } from "@/lib/mahnwesen-config";

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

describe("mahnungTextBausteine — zentrale Textquelle für PDF (generiereMahnungPdf) UND E-Mail (mahnungEmail)", () => {
  it("nutzt auf Stufe 1 die firmenbezogene Anrede, wenn der Kunde eine Firma hinterlegt hat", () => {
    const { anrede } = mahnungTextBausteine(1, "RE-2026-0001", "1.1.2026", "Musterhof GmbH");
    expect(anrede).toBe("Sehr geehrtes Team von Musterhof GmbH!");
  });

  it("fällt ohne Firma auf die neutrale Anrede zurück — auch auf Stufe 2/3 immer neutral", () => {
    expect(mahnungTextBausteine(1, "RE-2026-0001", "1.1.2026", null).anrede).toBe("Sehr geehrte Damen und Herren,");
    expect(mahnungTextBausteine(2, "RE-2026-0001", "1.1.2026", "Musterhof GmbH").anrede).toBe("Sehr geehrte Damen und Herren,");
    expect(mahnungTextBausteine(3, "RE-2026-0001", "1.1.2026", "Musterhof GmbH").anrede).toBe("Sehr geehrte Damen und Herren,");
  });

  it("liefert je Mahnstufe unterschiedliche, die Rechnungsnummer enthaltende Absätze", () => {
    for (const stufe of [1, 2, 3] as const) {
      const { absaetze } = mahnungTextBausteine(stufe, "RE-2026-0042", "5.1.2026");
      expect(absaetze.length).toBeGreaterThan(0);
      expect(absaetze[0]).toContain("RE-2026-0042");
      expect(absaetze[0]).toContain("5.1.2026");
    }
  });

  it("MAHNUNG_BETREFF deckt alle drei Mahnstufen ab", () => {
    expect(MAHNUNG_BETREFF[1]).toBe("Freundliche Zahlungserinnerung");
    expect(MAHNUNG_BETREFF[2]).toBe("1. Mahnung");
    expect(MAHNUNG_BETREFF[3]).toBe("2. Mahnung / Letzte Mahnung");
  });
});
