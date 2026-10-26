import { describe, it, expect } from "vitest";
import {
  validiereEierSortierungPositionen,
  EierSortierungValidierungsFehler,
  type EierSortierungPositionInput,
} from "@/lib/eiersortierung";

const pos = (o: Partial<EierSortierungPositionInput> = {}): EierSortierungPositionInput => ({
  artikelId: 1,
  gueteklasse: "A",
  gewichtsklasse: "M",
  menge: 100,
  chargeNr: null,
  legedatum: null,
  erzeugercode: null,
  ...o,
});

describe("validiereEierSortierungPositionen", () => {
  it("akzeptiert eine gültige Position", () => {
    expect(() => validiereEierSortierungPositionen([pos()])).not.toThrow();
  });

  it("lehnt eine leere Liste ab", () => {
    expect(() => validiereEierSortierungPositionen([])).toThrow(EierSortierungValidierungsFehler);
  });

  it.each([
    ["Menge 0", { menge: 0 }],
    ["negative Menge", { menge: -5 }],
    ["NaN-Menge", { menge: NaN }],
    ["artikelId 0", { artikelId: 0 }],
    ["Güteklasse C", { gueteklasse: "C" }],
    ["Gewichtsklasse XXL", { gewichtsklasse: "XXL" }],
    ["ungültiges Legedatum", { legedatum: new Date("kaputt") }],
    ["Erzeugercode-Format", { erzeugercode: "kein-code" }],
  ])("lehnt %s ab", (_name, override) => {
    expect(() => validiereEierSortierungPositionen([pos(override)])).toThrow(EierSortierungValidierungsFehler);
  });
});

import { berechneMengenDeltas, parsePositionenInput } from "@/lib/eiersortierung";

describe("berechneMengenDeltas", () => {
  it("liefert die Nettoänderung je Artikel", () => {
    const d = berechneMengenDeltas(
      [{ artikelId: 1, menge: 100 }, { artikelId: 2, menge: 50 }],
      [{ artikelId: 1, menge: 120 }, { artikelId: 2, menge: 50 }, { artikelId: 3, menge: 10 }],
    );
    expect(d.get(1)).toBe(20);
    expect(d.has(2)).toBe(false);
    expect(d.get(3)).toBe(10);
  });

  it("erkennt entfernte Positionen als negative Änderung", () => {
    const d = berechneMengenDeltas([{ artikelId: 1, menge: 100 }], []);
    expect(d.get(1)).toBe(-100);
  });

  it("fasst mehrere Positionen desselben Artikels zusammen und ignoriert Float-Reste", () => {
    const d = berechneMengenDeltas(
      [{ artikelId: 1, menge: 0.3 }],
      [{ artikelId: 1, menge: 0.1 }, { artikelId: 1, menge: 0.2 }],
    );
    expect(d.size).toBe(0);
  });
});

describe("parsePositionenInput", () => {
  it("normalisiert Klassen, trimmt und macht leere Strings zu null", () => {
    const [p] = parsePositionenInput([
      { artikelId: "5", gueteklasse: " a ", gewichtsklasse: "m", menge: "10", chargeNr: "  ", legedatum: "2026-09-01", erzeugercode: " 1-DE-0123451 " },
    ]);
    expect(p.artikelId).toBe(5);
    expect(p.gueteklasse).toBe("A");
    expect(p.gewichtsklasse).toBe("M");
    expect(p.menge).toBe(10);
    expect(p.chargeNr).toBeNull();
    expect(p.legedatum).toBeInstanceOf(Date);
    expect(p.erzeugercode).toBe("1-DE-0123451");
  });
});
