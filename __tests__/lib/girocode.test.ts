import { describe, it, expect } from "vitest";
import { erzeugeGiroCodePayload, normalisiereIban, normalisiereBic } from "@/lib/girocode";

// Wir prüfen nur die synchrone Payload-Erzeugung (Struktur/Format nach EPC069-12),
// nicht das asynchrone QR-Rendering (erzeugeGiroCodeDataUrl) — das wäre reines
// Rendering-Detail der "qrcode"-Bibliothek und kein Rechenkern.

describe("erzeugeGiroCodePayload", () => {
  const basisInput = {
    empfaenger: "Agrarhandel Muster GmbH",
    iban: "DE89 3704 0044 0532 0130 00",
    bic: "COBADEFFXXX",
    betrag: 123.45,
    verwendungszweck: "Rechnung RE-2026-001",
  };

  it("erzeugt eine BCD/EPC-Payload mit den 11 vorgeschriebenen Feldern in der richtigen Reihenfolge", () => {
    const payload = erzeugeGiroCodePayload(basisInput);
    expect(payload).not.toBeNull();
    const zeilen = payload!.split("\n");
    expect(zeilen).toEqual([
      "BCD",
      "002",
      "1",
      "SCT",
      "COBADEFFXXX",
      "Agrarhandel Muster GmbH",
      "DE89370400440532013000", // IBAN normalisiert (keine Leerzeichen)
      "EUR123.45",
      "", // Purpose
      "", // Structured Reference
      "Rechnung RE-2026-001",
    ]);
  });

  it("lässt das BIC-Feld leer, wenn keine BIC angegeben wird", () => {
    const payload = erzeugeGiroCodePayload({ ...basisInput, bic: undefined });
    const zeilen = payload!.split("\n");
    expect(zeilen[4]).toBe("");
  });

  it("formatiert den Betrag immer mit 'EUR'-Präfix und zwei Nachkommastellen", () => {
    const payload = erzeugeGiroCodePayload({ ...basisInput, betrag: 50 });
    expect(payload).toContain("EUR50.00");
  });

  it("kürzt den Verwendungszweck auf maximal 140 Zeichen", () => {
    const langerText = "X".repeat(200);
    const payload = erzeugeGiroCodePayload({ ...basisInput, verwendungszweck: langerText });
    const zeilen = payload!.split("\n");
    expect(zeilen[zeilen.length - 1]).toHaveLength(140);
  });

  it("liefert null bei ungültiger IBAN", () => {
    expect(erzeugeGiroCodePayload({ ...basisInput, iban: "NOTANIBAN" })).toBeNull();
  });

  it("liefert null bei Betrag <= 0", () => {
    expect(erzeugeGiroCodePayload({ ...basisInput, betrag: 0 })).toBeNull();
    expect(erzeugeGiroCodePayload({ ...basisInput, betrag: -5 })).toBeNull();
  });

  it("liefert null bei fehlendem Empfängernamen", () => {
    expect(erzeugeGiroCodePayload({ ...basisInput, empfaenger: "   " })).toBeNull();
  });
});

describe("normalisiereIban / normalisiereBic", () => {
  it("entfernt Leerzeichen und wandelt in Großbuchstaben um", () => {
    expect(normalisiereIban("de89 3704 0044 0532 0130 00")).toBe("DE89370400440532013000");
    expect(normalisiereBic("cobadeff xxx")).toBe("COBADEFFXXX");
  });
});
