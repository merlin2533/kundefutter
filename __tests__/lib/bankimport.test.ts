import { describe, it, expect } from "vitest";
import { parseKontoauszug } from "@/lib/bankimport";

describe("parseKontoauszug", () => {
  it("erkennt das Sparkassen-Format und parst deutsche Datums-/Betragsformate", () => {
    const csv =
      "Buchungstag;Wertstellung;Buchungstext;Verwendungszweck;Betrag;Währung\n" +
      "01.03.2026;01.03.2026;Überweisung;Rechnung RE-100;1.234,56;EUR\n" +
      "02.03.2026;03.03.2026;Lastschrift;Beitrag;-45,00;EUR\n";

    const buchungen = parseKontoauszug(csv, "umsaetze.csv");
    expect(buchungen).toHaveLength(2);

    // "1.234,56" (Punkt = Tausendertrennzeichen, Komma = Dezimaltrennzeichen) -> 1234.56
    expect(buchungen[0].betrag).toBeCloseTo(1234.56, 2);
    expect(buchungen[0].verwendungszweck).toBe("Rechnung RE-100");
    expect(buchungen[0].waehrung).toBe("EUR");
    expect(buchungen[0].buchungsdatum.toISOString().slice(0, 10)).toBe("2026-03-01");

    // negativer Betrag mit Komma-Dezimaltrennzeichen ohne Tausenderpunkt
    expect(buchungen[1].betrag).toBeCloseTo(-45, 2);
    expect(buchungen[1].wertstellung?.toISOString().slice(0, 10)).toBe("2026-03-03");
  });

  it("fällt bei unbekanntem Format auf den generischen Spalten-Parser zurück (Punkt-Dezimalformat)", () => {
    const csv =
      "Datum;Verwendungszweck;Betrag\n" +
      "15.01.2026;Wareneingang;-500.00\n" +
      "16.01.2026;Kundenzahlung;750.25\n";

    const buchungen = parseKontoauszug(csv, "generic.csv");
    expect(buchungen).toHaveLength(2);
    expect(buchungen[0].betrag).toBeCloseTo(-500, 2);
    expect(buchungen[0].verwendungszweck).toBe("Wareneingang");
    expect(buchungen[1].betrag).toBeCloseTo(750.25, 2);
  });

  it("überspringt Zeilen ohne parsbares Datum und liefert bei fehlenden Pflichtspalten ein leeres Ergebnis", () => {
    const ohnePflichtspalten = "Name;Ort\nMax;Berlin\n";
    expect(parseKontoauszug(ohnePflichtspalten, "leer.csv")).toEqual([]);

    const mitLeerzeile =
      "Datum;Verwendungszweck;Betrag\n" +
      "\n" +
      "20.02.2026;Test;10,00\n";
    const buchungen = parseKontoauszug(mitLeerzeile, "mit-leerzeile.csv");
    expect(buchungen).toHaveLength(1);
    expect(buchungen[0].betrag).toBeCloseTo(10, 2);
  });
});
