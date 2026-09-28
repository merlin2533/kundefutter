import { describe, it, expect } from "vitest";
import { parseEierSortierungZeile } from "@/lib/eiersortierung-import";

describe("parseEierSortierungZeile", () => {
  it("parst eine vollständige Zeile korrekt", () => {
    const result = parseEierSortierungZeile(
      {
        Artikel: "EI-A-M",
        Güteklasse: "a",
        Gewichtsklasse: "m",
        Menge: "1500",
        Datum: "14.09.2026",
        Anlieferung: "ANL-2026-0007",
        Charge: "CH-001",
        Legedatum: "01.09.2026",
        Erzeugercode: "1-DE-0123451",
        Notiz: "Import-Testzeile",
      },
      2,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.zeile.artikelRef).toBe("EI-A-M");
      // Güte-/Gewichtsklasse werden auf Großbuchstaben normalisiert
      expect(result.zeile.gueteklasse).toBe("A");
      expect(result.zeile.gewichtsklasse).toBe("M");
      expect(result.zeile.menge).toBe(1500);
      expect(result.zeile.datum.getFullYear()).toBe(2026);
      expect(result.zeile.anlieferungRef).toBe("ANL-2026-0007");
      expect(result.zeile.chargeNr).toBe("CH-001");
      expect(result.zeile.legedatum?.getMonth()).toBe(8);
      expect(result.zeile.erzeugercode).toBe("1-DE-0123451");
    }
  });

  it("lehnt eine Zeile ohne Artikel ab", () => {
    const result = parseEierSortierungZeile({ Güteklasse: "A", Gewichtsklasse: "M", Menge: "10" }, 3);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fehler.grund).toContain("Artikel");
  });

  it("lehnt eine Zeile ohne Güteklasse ab", () => {
    const result = parseEierSortierungZeile({ Artikel: "EI-A-M", Gewichtsklasse: "M", Menge: "10" }, 4);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fehler.grund).toContain("Güteklasse");
  });

  it("lehnt eine Zeile ohne Gewichtsklasse ab", () => {
    const result = parseEierSortierungZeile({ Artikel: "EI-A-M", Güteklasse: "A", Menge: "10" }, 5);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fehler.grund).toContain("Gewichtsklasse");
  });

  it("lehnt eine Zeile mit fehlender/ungültiger Menge ab", () => {
    const ohne = parseEierSortierungZeile({ Artikel: "EI-A-M", Güteklasse: "A", Gewichtsklasse: "M" }, 6);
    expect(ohne.ok).toBe(false);
    const null_ = parseEierSortierungZeile({ Artikel: "EI-A-M", Güteklasse: "A", Gewichtsklasse: "M", Menge: "0" }, 7);
    expect(null_.ok).toBe(false);
  });

  it("lehnt eine Zeile mit ungültigem Legedatum ab (kritisch für die MHD-Berechnung)", () => {
    const result = parseEierSortierungZeile(
      { Artikel: "EI-A-M", Güteklasse: "A", Gewichtsklasse: "M", Menge: "10", Legedatum: "unsinn" },
      8,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fehler.grund).toContain("Legedatum");
  });

  it("erkennt einen Excel-Datums-Seriencode als Legedatum", () => {
    const result = parseEierSortierungZeile(
      { Artikel: "EI-A-M", Güteklasse: "A", Gewichtsklasse: "M", Menge: "10", Legedatum: 45912 },
      9,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.zeile.legedatum?.getFullYear()).toBe(2025);
      expect(result.zeile.legedatum?.getDate()).toBe(12);
    }
  });

  it("lässt Anlieferung/Charge/Legedatum/Erzeugercode/Notiz optional weg", () => {
    const result = parseEierSortierungZeile({ Artikel: "EI-A-M", Güteklasse: "A", Gewichtsklasse: "M", Menge: "10" }, 10);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.zeile.anlieferungRef).toBeNull();
      expect(result.zeile.chargeNr).toBeNull();
      expect(result.zeile.legedatum).toBeNull();
      expect(result.zeile.erzeugercode).toBeNull();
      expect(result.zeile.notiz).toBeNull();
    }
  });
});
