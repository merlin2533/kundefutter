import { describe, it, expect } from "vitest";
import { berechneFehlendeFelderEingangsrechnung, parseBelegKiErgebnis } from "@/lib/eingangsrechnung-matching";

describe("berechneFehlendeFelderEingangsrechnung", () => {
  it("liefert ein leeres Array, wenn alle Pflichtfelder vorhanden sind", () => {
    const felder = berechneFehlendeFelderEingangsrechnung({
      lieferantKonfidenz: "hoch",
      nummer: "RE-123",
      datum: "2026-09-01",
      betragNetto: 100,
    });
    expect(felder).toEqual([]);
  });

  it("meldet einen unsicheren/fehlenden Lieferanten-Treffer", () => {
    expect(
      berechneFehlendeFelderEingangsrechnung({ lieferantKonfidenz: "keine", nummer: "X", datum: "2026-09-01", betragNetto: 1 })
    ).toContain("Lieferant nicht eindeutig zugeordnet");
    expect(
      berechneFehlendeFelderEingangsrechnung({ lieferantKonfidenz: "niedrig", nummer: "X", datum: "2026-09-01", betragNetto: 1 })
    ).toContain("Lieferant nicht eindeutig zugeordnet");
    expect(
      berechneFehlendeFelderEingangsrechnung({ lieferantKonfidenz: null, nummer: "X", datum: "2026-09-01", betragNetto: 1 })
    ).toContain("Lieferant nicht eindeutig zugeordnet");
  });

  it("meldet fehlendes Datum/Betrag/Nummer einzeln", () => {
    const felder = berechneFehlendeFelderEingangsrechnung({ lieferantKonfidenz: "hoch", nummer: null, datum: null, betragNetto: null });
    expect(felder).toContain("Rechnungsdatum fehlt");
    expect(felder).toContain("Betrag fehlt");
    expect(felder).toContain("Rechnungsnummer fehlt");
  });

  it("behandelt einen Betrag von 0 oder negativ als fehlend", () => {
    expect(
      berechneFehlendeFelderEingangsrechnung({ lieferantKonfidenz: "hoch", nummer: "X", datum: "2026-09-01", betragNetto: 0 })
    ).toContain("Betrag fehlt");
    expect(
      berechneFehlendeFelderEingangsrechnung({ lieferantKonfidenz: "hoch", nummer: "X", datum: "2026-09-01", betragNetto: -5 })
    ).toContain("Betrag fehlt");
  });
});

describe("parseBelegKiErgebnis", () => {
  it("übernimmt gültige Felder unverändert", () => {
    const ergebnis = parseBelegKiErgebnis({
      datum: "2026-09-01",
      belegNr: "RE-2026-0042",
      faelligAm: "2026-09-30",
      beschreibung: "Diesel",
      betragNetto: 100.456,
      betragBrutto: 119.5432,
      mwstSatz: 19,
      lieferant: "Agrarhandel Mustermann",
      iban: "DE89 3704 0044 0532 0130 00",
      bic: "cobadeffxxx",
    });
    expect(ergebnis.datum).toBe("2026-09-01");
    expect(ergebnis.betragNetto).toBe(100.46);
    expect(ergebnis.betragBrutto).toBe(119.54);
    expect(ergebnis.iban).toBe("DE89370400440532013000");
    expect(ergebnis.bic).toBe("COBADEFFXXX");
  });

  it("fällt bei ungültigem MwSt-Satz auf 19% zurück", () => {
    expect(parseBelegKiErgebnis({ mwstSatz: 13 }).mwstSatz).toBe(19);
    expect(parseBelegKiErgebnis({}).mwstSatz).toBe(19);
    expect(parseBelegKiErgebnis({ mwstSatz: 0 }).mwstSatz).toBe(0);
    expect(parseBelegKiErgebnis({ mwstSatz: 7 }).mwstSatz).toBe(7);
  });

  it("verwirft ein ungültiges Datumsformat statt es stillschweigend zu übernehmen", () => {
    expect(parseBelegKiErgebnis({ datum: "01.09.2026" }).datum).toBeNull();
    expect(parseBelegKiErgebnis({ datum: "2026-9-1" }).datum).toBeNull();
  });

  it("verwirft eine erkennbar ungültige IBAN", () => {
    expect(parseBelegKiErgebnis({ iban: "nicht erkennbar!" }).iban).toBeNull();
    expect(parseBelegKiErgebnis({ iban: "123456" }).iban).toBeNull(); // kein 2-Buchstaben-Ländercode
    expect(parseBelegKiErgebnis({ iban: "" }).iban).toBeNull();
  });

  it("erfindet keine Werte für fehlende Felder (null statt Platzhalter)", () => {
    const ergebnis = parseBelegKiErgebnis({});
    expect(ergebnis.datum).toBeNull();
    expect(ergebnis.belegNr).toBeNull();
    expect(ergebnis.lieferant).toBeNull();
    expect(ergebnis.betragNetto).toBeNull();
  });
});
