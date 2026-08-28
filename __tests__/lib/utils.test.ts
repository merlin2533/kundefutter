import { describe, it, expect } from "vitest";
import { rundeKaufmaennisch, formatEuro, formatPreis, formatMenge, umlautSchreibweisen, resolveBevorzugtenLieferanten, resolveBevorzugtenEK } from "@/lib/utils";

describe("rundeKaufmaennisch", () => {
  it("rundet 0,5 Cent kaufmännisch auf (nicht round-half-to-even)", () => {
    expect(rundeKaufmaennisch(1.005, 2)).toBeCloseTo(1.01, 10);
    expect(rundeKaufmaennisch(1.015, 2)).toBeCloseTo(1.02, 10);
    expect(rundeKaufmaennisch(1.025, 2)).toBeCloseTo(1.03, 10);
  });

  it("rundet negative Beträge (Gutschriften/Storno) symmetrisch weg von Null", () => {
    expect(rundeKaufmaennisch(-1.005, 2)).toBeCloseTo(-1.01, 10);
    expect(rundeKaufmaennisch(-1.004, 2)).toBeCloseTo(-1.0, 10);
  });

  it("rundet auf beliebige Stellenzahl (Standard: 2)", () => {
    expect(rundeKaufmaennisch(0.21449, 3)).toBeCloseTo(0.214, 10);
    expect(rundeKaufmaennisch(0.2145, 3)).toBeCloseTo(0.215, 10);
    expect(rundeKaufmaennisch(19.999)).toBeCloseTo(20, 10);
  });

  it("lässt 0 unverändert", () => {
    expect(rundeKaufmaennisch(0)).toBe(0);
  });
});

describe("formatEuro", () => {
  it("formatiert Endbeträge standardmäßig zweistellig, kaufmännisch gerundet", () => {
    expect(formatEuro(1234.5)).toBe("1.234,50 €");
    expect(formatEuro(1.005)).toBe("1,01 €");
  });

  it("unterstützt explizite Nachkommastellen für Sonderfälle", () => {
    expect(formatEuro(0.2145, 3)).toBe("0,215 €");
  });
});

describe("formatPreis", () => {
  it("zeigt Einzel-/Bezugspreise mit drei Nachkommastellen, um Rundungsfehler bei Menge × Preis zu vermeiden", () => {
    expect(formatPreis(0.215)).toBe("0,215 €");
    expect(formatPreis(1.2)).toBe("1,200 €");
  });
});

describe("formatMenge", () => {
  it("zeigt Mengen mit bis zu drei Nachkommastellen", () => {
    expect(formatMenge(0.12)).toBe("0,12");
    expect(formatMenge(12.3456)).toBe("12,346");
  });
});

describe("umlautSchreibweisen", () => {
  it("liefert nur den Suchbegriff selbst zurück, wenn keine Umlaute enthalten sind", () => {
    expect(umlautSchreibweisen("rettich")).toEqual(["rettich"]);
  });

  it("erzeugt beide Schreibweisen bei einem Umlaut", () => {
    expect(umlautSchreibweisen("ölrettich").sort()).toEqual(["Ölrettich", "ölrettich"].sort());
  });

  it("erzeugt alle 4 Kombinationen bei zwei Umlauten im Suchbegriff", () => {
    const varianten = umlautSchreibweisen("örtükei");
    expect(varianten.sort()).toEqual(["örtükei", "örtÜkei", "Örtükei", "ÖrtÜkei"].sort());
  });

  it("behält die Groß-/Kleinschreibung der übrigen (nicht-Umlaut) Buchstaben bei", () => {
    const varianten = umlautSchreibweisen("Öl");
    expect(varianten).toContain("Öl");
    expect(varianten).toContain("öl");
    expect(varianten.every((v) => v.endsWith("l"))).toBe(true);
  });
});

describe("resolveBevorzugtenLieferanten / resolveBevorzugtenEK", () => {
  it("wählt den bevorzugten Lieferanten, wenn dieser einen Preis hat", () => {
    const lieferanten = [
      { id: 1, einkaufspreis: 10, bevorzugt: true },
      { id: 2, einkaufspreis: 8, bevorzugt: false },
    ];
    expect(resolveBevorzugtenLieferanten(lieferanten)?.id).toBe(1);
    expect(resolveBevorzugtenEK(lieferanten)).toBe(10);
  });

  it("weicht auf einen Lieferanten MIT gepflegtem Preis aus, wenn der bevorzugte keinen hat (Kernfall des Bugs)", () => {
    const lieferanten = [
      { id: 1, einkaufspreis: 0, bevorzugt: true },
      { id: 2, einkaufspreis: 8, bevorzugt: false },
    ];
    expect(resolveBevorzugtenLieferanten(lieferanten)?.id).toBe(2);
    expect(resolveBevorzugtenEK(lieferanten)).toBe(8);
  });

  it("fällt auf den bevorzugten (auch ohne Preis) zurück, wenn NIEMAND einen Preis gepflegt hat", () => {
    const lieferanten = [
      { id: 1, einkaufspreis: 0, bevorzugt: false },
      { id: 2, einkaufspreis: 0, bevorzugt: true },
    ];
    expect(resolveBevorzugtenLieferanten(lieferanten)?.id).toBe(2);
    expect(resolveBevorzugtenEK(lieferanten)).toBe(0);
  });

  it("fällt auf den ersten Lieferanten zurück, wenn niemand bevorzugt ist und niemand einen Preis hat", () => {
    const lieferanten = [
      { id: 1, einkaufspreis: 0, bevorzugt: false },
      { id: 2, einkaufspreis: 0, bevorzugt: false },
    ];
    expect(resolveBevorzugtenLieferanten(lieferanten)?.id).toBe(1);
  });

  it("liefert null / 0 bei leerer oder fehlender Lieferantenliste", () => {
    expect(resolveBevorzugtenLieferanten([])).toBeNull();
    expect(resolveBevorzugtenLieferanten(null)).toBeNull();
    expect(resolveBevorzugtenLieferanten(undefined)).toBeNull();
    expect(resolveBevorzugtenEK([])).toBe(0);
  });
});
