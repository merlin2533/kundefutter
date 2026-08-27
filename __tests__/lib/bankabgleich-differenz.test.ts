import { describe, it, expect } from "vitest";
import { istSkontoBetrag } from "@/lib/bankabgleich-differenz";

describe("istSkontoBetrag", () => {
  it("erkennt den exakten Skonto-reduzierten Betrag", () => {
    expect(istSkontoBetrag(980, 1000, 2)).toBe(true);
  });

  it("toleriert kleine Rundungsabweichungen (±0,50€)", () => {
    expect(istSkontoBetrag(979.7, 1000, 2)).toBe(true);
    expect(istSkontoBetrag(980.3, 1000, 2)).toBe(true);
  });

  it("lehnt eine größere Abweichung ab (echter Fehlbetrag, kein Skonto)", () => {
    expect(istSkontoBetrag(900, 1000, 2)).toBe(false);
  });

  it("gibt false zurück, wenn kein Skonto hinterlegt ist", () => {
    expect(istSkontoBetrag(980, 1000, null)).toBe(false);
  });

  it("erkennt auch den vollen (unreduzierten) Betrag nicht fälschlich als Skonto-Treffer", () => {
    expect(istSkontoBetrag(1000, 1000, 2)).toBe(false);
  });
});
