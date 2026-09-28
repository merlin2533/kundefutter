import { describe, it, expect } from "vitest";
import { berechneLieferungBrutto, berechneGutschriftBrutto } from "@/lib/lieferung-brutto";
import { effektiverMengenstaffelRabatt, type MengenrabattEintrag } from "@/lib/utils";

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

  it("Regression: Mengenstaffel-Position (verkaufspreis = Listenpreis + echter Rabatt) wird nur EINMAL rabattiert, nicht doppelt", () => {
    // Vorher: app/lieferungen/neu/page.tsx speicherte den bereits rabattierten Staffelpreis
    // direkt als verkaufspreis UND zusätzlich rabattProzent zur Anzeige — berechneLieferungBrutto()
    // zog den Rabatt dann ein zweites Mal ab. Seit dem Fix ist verkaufspreis immer der
    // Listenpreis, sodass genau EINE Anwendung von rabattProzent den korrekten Staffelpreis ergibt.
    const listenpreis = 20;
    const staffel: MengenrabattEintrag = { kundeId: null, artikelId: 1, kategorie: null, vonMenge: 50, preis: 18, rabattProzent: 0, aktiv: true };
    const rabatt = effektiverMengenstaffelRabatt(listenpreis, staffel); // 10
    const brutto = berechneLieferungBrutto({
      positionen: [{ menge: 3, verkaufspreis: listenpreis, rabattProzent: rabatt, mwstSatz: 19 }],
    });
    // 3 × 18 € (Staffelpreis) × 1,19 MwSt — NICHT 3 × 20 € × 0,9 × 1,19 (das wäre nochmal falsch)
    // und erst recht nicht 3 × 18 € × 0,9 × 1,19 (der ursprüngliche Doppelrabatt-Bug).
    expect(brutto).toBeCloseTo(3 * 18 * 1.19, 4);
  });
});
