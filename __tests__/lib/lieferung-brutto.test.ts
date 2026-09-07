import { describe, it, expect } from "vitest";
import { berechneLieferungBrutto, berechneGutschriftBrutto } from "@/lib/lieferung-brutto";

describe("berechneGutschriftBrutto", () => {
  it("rechnet MwSt auf den Netto-Positionsbetrag auf (Menge × Preis × (1+MwSt%))", () => {
    // Realer Fall: Gutschrift GS-2026-0010 — 75 kg à 2,95 € (netto 221,25 €), 7% MwSt.
    const brutto = berechneGutschriftBrutto([
      { menge: 75, preis: 2.95, artikel: { mwstSatz: 7 } },
    ]);
    expect(brutto).toBeCloseTo(236.7375, 4);
  });

  it("summiert mehrere Positionen mit unterschiedlichem MwSt-Satz korrekt", () => {
    const brutto = berechneGutschriftBrutto([
      { menge: 10, preis: 10, artikel: { mwstSatz: 19 } }, // 100 netto -> 119
      { menge: 5, preis: 4, artikel: { mwstSatz: 7 } }, // 20 netto -> 21.4
    ]);
    expect(brutto).toBeCloseTo(140.4, 4);
  });

  it("fällt bei fehlendem Artikel-MwSt-Satz auf 19% zurück", () => {
    const brutto = berechneGutschriftBrutto([{ menge: 1, preis: 100, artikel: null }]);
    expect(brutto).toBeCloseTo(119, 4);
  });

  it("liefert einen strikt höheren Betrag als die reine Netto-Summe (Regression: Brutto/Netto-Vermischung)", () => {
    const positionen = [{ menge: 75, preis: 2.95, artikel: { mwstSatz: 7 } }];
    const netto = positionen.reduce((s, p) => s + p.menge * p.preis, 0);
    const brutto = berechneGutschriftBrutto(positionen);
    expect(brutto).toBeGreaterThan(netto);
    expect(brutto - netto).toBeCloseTo(15.4875, 4); // exakt der MwSt-Anteil
  });
});

describe("berechneLieferungBrutto (Referenz für die gemischte Brutto-Basis)", () => {
  it("bleibt unverändert brutto (Rabatt inklusive MwSt)", () => {
    const brutto = berechneLieferungBrutto({
      positionen: [{ menge: 1, verkaufspreis: 100, rabattProzent: 0, mwstSatz: 19 }],
    });
    expect(brutto).toBeCloseTo(119, 4);
  });
});
