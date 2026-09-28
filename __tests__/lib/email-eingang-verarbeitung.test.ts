import { describe, it, expect } from "vitest";
import { erkenneDateityp, matchLieferant } from "@/lib/email-eingang-verarbeitung";

const PDF_HEADER = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // "%PDF-1.4"
const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const WEBP_HEADER = Buffer.concat([Buffer.from("RIFF"), Buffer.from([0, 0, 0, 0]), Buffer.from("WEBP")]);

describe("erkenneDateityp", () => {
  it("erkennt PDF/PNG/JPG/WebP an den Magic Bytes, unabhängig vom Dateinamen", () => {
    expect(erkenneDateityp(PDF_HEADER, "rechnung.jpg")).toBe("pdf"); // absichtlich falscher Name
    expect(erkenneDateityp(PNG_HEADER, "beleg.dat")).toBe("png");
    expect(erkenneDateityp(JPG_HEADER, "foto")).toBe("jpg");
    expect(erkenneDateityp(WEBP_HEADER, "bild")).toBe("webp");
  });

  it("erkennt XML nur, wenn Dateiname UND Inhalt darauf hindeuten (kein fixes Magic-Byte-Muster)", () => {
    const xml = Buffer.from('<?xml version="1.0"?><Invoice></Invoice>');
    expect(erkenneDateityp(xml, "rechnung.xml")).toBe("xml");
    expect(erkenneDateityp(xml, "rechnung.pdf")).toBeNull(); // Dateiname deutet nicht auf XML hin
    expect(erkenneDateityp(Buffer.from("Hallo Welt"), "notiz.xml")).toBeNull(); // kein XML-Inhalt
  });

  it("liefert null für einen nicht unterstützten/erkennbaren Dateityp (z.B. .docx/.zip)", () => {
    expect(erkenneDateityp(Buffer.from([0x50, 0x4b, 0x03, 0x04]), "dokument.docx")).toBeNull();
    expect(erkenneDateityp(Buffer.alloc(0), "leer.bin")).toBeNull();
  });
});

describe("matchLieferant", () => {
  const lieferanten = [
    { id: 1, name: "Agrarhandel Mustermann", iban: "DE89370400440532013000" },
    { id: 2, name: "Landtechnik Meier", iban: null },
  ];

  it("nutzt einen exakten IBAN-Treffer vor dem Namensabgleich (deterministisch, fälschungsresistent)", () => {
    const ergebnis = matchLieferant(
      { lieferant: "Ein völlig anderer Name GmbH", iban: "DE89 3704 0044 0532 0130 00" },
      lieferanten,
      new Map()
    );
    expect(ergebnis.lieferantId).toBe(1);
    expect(ergebnis.konfidenz).toBe("hoch");
  });

  it("fällt ohne IBAN-Treffer auf den Namens-Fuzzy-Matcher zurück", () => {
    const ergebnis = matchLieferant({ lieferant: "Agrarhandel Mustermann", iban: null }, lieferanten, new Map());
    expect(ergebnis.lieferantId).toBe(1);
  });

  it("liefert keinen Treffer, wenn weder IBAN noch Name passen", () => {
    const ergebnis = matchLieferant({ lieferant: "Unbekannte Firma XYZ", iban: null }, lieferanten, new Map());
    expect(ergebnis.lieferantId).toBeNull();
    expect(ergebnis.konfidenz).toBe("keine");
  });
});
