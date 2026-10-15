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
