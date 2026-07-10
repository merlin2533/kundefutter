import { describe, it, expect } from "vitest";
import { validiereVvvo, formatiereVvvo } from "@/lib/vvvo";

describe("validiereVvvo", () => {
  it("akzeptiert eine gültige 12-stellige Betriebsnummer (DE + Niedersachsen + Betrieb)", () => {
    const r = validiereVvvo("276031234567");
    expect(r.gueltig).toBe(true);
    expect(r.normalisiert).toBe("276031234567");
    expect(r.bundeslandCode).toBe("03");
    expect(r.bundesland).toBe("Niedersachsen");
  });

  it("normalisiert Eingaben mit Trennzeichen und Leerzeichen identisch", () => {
    const r = validiereVvvo("276 03 1234567");
    expect(r.gueltig).toBe(true);
    expect(r.normalisiert).toBe("276031234567");
  });

  it("ergänzt bei 9-stelliger Eingabe (ohne DE-Präfix) automatisch '276'", () => {
    const r = validiereVvvo("091234567"); // 09 = Bayern + 7-stellige Betriebs-ID
    expect(r.gueltig).toBe(true);
    expect(r.normalisiert).toBe("276091234567");
    expect(r.bundesland).toBe("Bayern");
  });

  it("lehnt ein unbekanntes Bundesland-Präfix ab", () => {
    const r = validiereVvvo("276991234567"); // "99" existiert nicht (01-16)
    expect(r.gueltig).toBe(false);
    expect(r.fehler).toContain("Unbekannter Bundeslandcode 99");
  });

  it("lehnt eine falsche Länge ab", () => {
    const r = validiereVvvo("12345");
    expect(r.gueltig).toBe(false);
    expect(r.fehler).toContain("Ungültige Länge");
  });

  it("lehnt leere/fehlende Eingaben ab", () => {
    expect(validiereVvvo("").gueltig).toBe(false);
    expect(validiereVvvo(null).gueltig).toBe(false);
    expect(validiereVvvo(undefined).gueltig).toBe(false);
  });

  it("lehnt ein 15-stelliges Format ohne DE(276)-Präfix ab", () => {
    const r = validiereVvvo("123456789012345");
    expect(r.gueltig).toBe(false);
    expect(r.fehler).toContain("DE (276");
  });
});

describe("formatiereVvvo", () => {
  it("formatiert eine normalisierte Nummer lesbar mit Bundesland-Code", () => {
    expect(formatiereVvvo("276031234567")).toBe("DE 03 1234567");
  });

  it("gibt die Eingabe unverändert zurück, wenn sie nicht 12-stellig ist", () => {
    expect(formatiereVvvo("12345")).toBe("12345");
  });
});
