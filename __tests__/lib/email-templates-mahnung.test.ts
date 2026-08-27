import { describe, it, expect } from "vitest";
import { mahnungEmail, type MahnungMailData } from "@/lib/email-templates";
import { mahnungTextBausteine, MAHNUNG_BETREFF } from "@/lib/mahnwesen-config";
import type { FirmaDaten } from "@/lib/firma";

const FIRMA: FirmaDaten = {
  name: "Musterhof GmbH",
  zusatz: "",
  strasse: "Hauptstraße 1",
  plzOrt: "12345 Musterstadt",
  telefon: "",
  email: "",
  steuernummer: "",
  iban: "DE12345678901234567890",
  bic: "TESTDEXX",
  bank: "Musterbank",
  emailFooterText: "",
  portalImpressumUrl: "",
  datenschutzUrl: "",
  primaryColor: "#2d6a4f",
  primaryLight: "#d1fae5",
};

function baseData(overrides: Partial<MahnungMailData> = {}): MahnungMailData {
  return {
    rechnungNr: "RE-2026-0042",
    rechnungDatum: new Date("2026-01-05"),
    faelligAm: new Date("2026-02-04"),
    offenerBetrag: 500,
    mahnstufe: 1,
    tageUeberfaellig: 20,
    mahngebuehr: 0,
    verzugszinsen: 0,
    kundeFirma: "Musterhof GmbH",
    firma: FIRMA,
    ...overrides,
  };
}

describe("mahnungEmail — Text muss aus derselben Quelle wie die PDF (mahnungTextBausteine) kommen", () => {
  it("enthält für jede Mahnstufe exakt dieselben Absätze wie mahnungTextBausteine()", () => {
    for (const stufe of [1, 2, 3] as const) {
      const data = baseData({ mahnstufe: stufe });
      const { text } = mahnungEmail(data);
      const { anrede, absaetze } = mahnungTextBausteine(stufe, data.rechnungNr, "5.1.2026", data.kundeFirma);
      expect(text).toContain(anrede);
      for (const absatz of absaetze) {
        expect(text).toContain(absatz);
      }
    }
  });

  it("verwendet MAHNUNG_BETREFF für den Betreff (identisch zur PDF-Titelzeile)", () => {
    for (const stufe of [1, 2, 3] as const) {
      const { subject } = mahnungEmail(baseData({ mahnstufe: stufe }));
      expect(subject).toContain(MAHNUNG_BETREFF[stufe]);
    }
  });

  it("zeigt Mahngebühr/Verzugszinsen/Gesamtforderung nur wenn > 0 (analog PDF)", () => {
    const ohne = mahnungEmail(baseData());
    expect(ohne.text).not.toContain("Mahngebühr");
    expect(ohne.text).not.toContain("Gesamtforderung");

    const mit = mahnungEmail(baseData({ mahnstufe: 2, mahngebuehr: 5, verzugszinsen: 3.5 }));
    expect(mit.text).toContain("Mahngebühr");
    expect(mit.text).toContain("Verzugszinsen");
    expect(mit.text).toContain("Gesamtforderung");
    expect(mit.text).toContain("508,50"); // 500 + 5 + 3,5
  });

  it("nutzt den Ansprechpartner-Namen als Unterschrift, falls angegeben, sonst den Firmennamen", () => {
    const mitAp = mahnungEmail(baseData({ ansprechpartnerName: "Max Mustermann" }));
    expect(mitAp.text.trim().endsWith("Max Mustermann")).toBe(true);

    const ohneAp = mahnungEmail(baseData());
    expect(ohneAp.text.trim().endsWith("Musterhof GmbH")).toBe(true);
  });
});
