import { describe, it, expect } from "vitest";
import {
  runNormalMatch,
  tokenSimilarity,
  receiptNumberHit,
  normalizeText,
  type BankBuchung,
  type ReconCandidate,
} from "@/lib/bankabgleich-matching";

describe("normalizeText / tokenSimilarity / receiptNumberHit", () => {
  it("löst Umlaute auf und ignoriert Groß-/Kleinschreibung", () => {
    expect(normalizeText("Müller GmbH")).toBe("mueller gmbh");
  });

  it("erkennt hohe Ähnlichkeit auch wenn der Buchungstext kürzer ist als der Verwendungszweck (Overlap statt Jaccard)", () => {
    const score = tokenSimilarity("Müller", "Überweisung von Müller Landhandel GmbH für Rechnung RE-2026-0001");
    expect(score).toBe(1);
  });

  it("erkennt eine im Verwendungszweck enthaltene Rechnungsnummer als starkes Signal", () => {
    expect(receiptNumberHit("Zahlung RE-2026-0001 danke", "RE-2026-0001")).toBe(1);
    expect(receiptNumberHit("Zahlung ohne Referenz", "RE-2026-0001")).toBe(0);
  });

  it("erkennt auch die bloße laufende Nummer ohne Präfix/Jahr als Rechnungsnummer-Hinweis (Kunden geben im Verwendungszweck oft nur diese an)", () => {
    expect(receiptNumberHit("Rechnung 361 danke", "RE-2026-0361")).toBeCloseTo(0.85, 5);
    expect(receiptNumberHit("ReNr 0361", "RE-2026-0361")).toBeCloseTo(0.85, 5);
  });

  it("matcht die kurze Nummer nur als eigenständiges Token, nicht als Teilzeichenkette (kein Treffer in einer IBAN o.Ä.)", () => {
    expect(receiptNumberHit("DE893610001234567890", "RE-2026-0361")).toBe(0);
  });
});

describe("runNormalMatch — Näherungserkennung", () => {
  it("matcht exakten Betrag mit Datum innerhalb der Toleranz sofort (Pass 1)", () => {
    const bank: BankBuchung[] = [
      { id: 1, date: "2026-07-01", amount: 119, purpose: "Zahlung RE-2026-0001", name: "Testhof Müller" },
    ];
    const candidates: ReconCandidate[] = [
      { kind: "lieferung", id: 1, date: "2026-07-01", amount: 119, description: "Lieferung", counterparty: "Testhof Müller", receiptNumber: "RE-2026-0001" },
    ];
    const result = runNormalMatch(bank, candidates);
    expect(result.matched).toHaveLength(1);
    expect(result.matched[0].candidate.id).toBe(1);
  });

  it("toleriert eine Datumsabweichung innerhalb der Standardtoleranz (5 Tage) weiterhin als sicheren Treffer", () => {
    const bank: BankBuchung[] = [
      { id: 2, date: "2026-07-08", amount: 59.5, purpose: "Überweisung Duenger", name: "Testhof Mueller" },
    ];
    const candidates: ReconCandidate[] = [
      { kind: "lieferung", id: 2, date: "2026-07-05", amount: 59.5, description: "Lieferung", counterparty: "Testhof Müller", receiptNumber: "RE-2026-0002" },
    ];
    const result = runNormalMatch(bank, candidates);
    expect(result.matched).toHaveLength(1);
    expect(result.matched[0].dayDiff).toBe(3);
    expect(result.deviations).toHaveLength(0);
  });

  it("stuft eine echte Betragsabweichung als 'deviation' ein, nicht als sicheren Treffer", () => {
    const bank: BankBuchung[] = [{ id: 10, date: "2026-08-01", amount: 99.7, purpose: "Teilzahlung", name: "Kunde X" }];
    const candidates: ReconCandidate[] = [
      { kind: "lieferung", id: 100, date: "2026-08-01", amount: 100, description: "Lieferung RE-X", counterparty: "Kunde X" },
    ];
    const result = runNormalMatch(bank, candidates, { amountTolerance: 0.5 });
    expect(result.matched).toHaveLength(0);
    expect(result.deviations).toHaveLength(1);
    expect(result.deviations[0].amountDiff).toBeCloseTo(0.3, 2);
  });

  it("erkennt eine Splitzahlung (N:1-Aggregation) über mehrere Bankbuchungen", () => {
    const bank: BankBuchung[] = [
      { id: 11, date: "2026-08-05", amount: 60, purpose: "Anzahlung", name: "Kunde Y" },
      { id: 12, date: "2026-08-06", amount: 40, purpose: "Restzahlung", name: "Kunde Y" },
    ];
    const candidates: ReconCandidate[] = [
      { kind: "lieferung", id: 101, date: "2026-08-05", amount: 100, description: "Lieferung RE-Y", counterparty: "Kunde Y" },
    ];
    const result = runNormalMatch(bank, candidates);
    expect(result.aggregated).toHaveLength(1);
    expect(result.aggregated[0].candidate.id).toBe(101);
    expect(result.aggregated[0].banks.map((b) => b.id).sort()).toEqual([11, 12]);
  });

  it("matcht ausschließlich innerhalb desselben Betragsvorzeichens (Verkauf vs. Einkauf)", () => {
    const bank: BankBuchung[] = [{ id: 20, date: "2026-07-12", amount: -119, purpose: "LR-9001", name: "Agro Lieferant" }];
    const candidates: ReconCandidate[] = [
      { kind: "eingangsrechnung", id: 1, date: "2026-07-12", amount: -119, description: "Rechnung LR-9001", counterparty: "Agro Lieferant", receiptNumber: "LR-9001" },
      { kind: "lieferung", id: 1, date: "2026-07-12", amount: 119, description: "Lieferung", counterparty: "Agro Lieferant" },
    ];
    const result = runNormalMatch(bank, candidates);
    expect(result.matched).toHaveLength(1);
    expect(result.matched[0].candidate.kind).toBe("eingangsrechnung");
  });

  it("wählt bei zwei offenen Rechnungen mit identischem Betrag die per Rechnungsnummer im Verwendungszweck referenzierte statt der zeitlich näheren (Pass 2)", () => {
    const bank: BankBuchung[] = [
      { id: 30, date: "2026-07-30", amount: 500, purpose: "Zahlung Rechnung 361 danke", name: "Speckmann Detlef" },
    ];
    const candidates: ReconCandidate[] = [
      // Die per Nummer referenzierte Rechnung liegt zeitlich WEITER weg als die andere —
      // vorher gewann trotz Rechnungsnummer-Treffer die zeitlich nähere Rechnung 399.
      { kind: "lieferung", id: 361, date: "2026-06-15", amount: 500, description: "Lieferung RE-2026-0361", counterparty: "Speckmann Detlef", receiptNumber: "RE-2026-0361" },
      { kind: "lieferung", id: 399, date: "2026-07-01", amount: 500, description: "Lieferung RE-2026-0399", counterparty: "Speckmann Detlef", receiptNumber: "RE-2026-0399" },
    ];
    const result = runNormalMatch(bank, candidates);
    expect(result.deviations).toHaveLength(1);
    expect(result.deviations[0].candidate.id).toBe(361);
  });

  it("lässt unpassende Bankbuchungen und Kandidaten unverändert in bankOnly/candidateOnly", () => {
    const bank: BankBuchung[] = [{ id: 5, date: "2026-07-15", amount: 777.77, purpose: "Unbekannte Zahlung", name: "Unbekannt" }];
    const candidates: ReconCandidate[] = [
      { kind: "lieferung", id: 999, date: "2026-01-01", amount: 5, description: "Lieferung", counterparty: "Anderer Kunde" },
    ];
    const result = runNormalMatch(bank, candidates);
    expect(result.bankOnly).toHaveLength(1);
    expect(result.candidateOnly).toHaveLength(1);
    expect(result.bankOnly[0].nearestCandidate?.id).toBe(999);
  });
});
