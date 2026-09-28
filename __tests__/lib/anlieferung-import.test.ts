import { describe, it, expect } from "vitest";
import { parseAnlieferungZeile } from "@/lib/anlieferung-import";

describe("parseAnlieferungZeile", () => {
  it("parst eine vollständige Zeile korrekt", () => {
    const result = parseAnlieferungZeile(
      {
        Erzeuger: "Hof Brandes",
        Artikel: "Winterweizen",
        Menge: "12,5",
        Datum: "14.09.2026",
        Einheit: "t",
        Feuchte: "14,2",
        Qualität: "A-Qualität",
        Preis: "22,50",
        Notiz: "Testzeile",
        Belegnummer: "WS-2026-001",
      },
      2,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.zeile.kundeName).toBe("Hof Brandes");
      expect(result.zeile.artikelRef).toBe("Winterweizen");
      expect(result.zeile.menge).toBe(12.5);
      expect(result.zeile.datum.getFullYear()).toBe(2026);
      expect(result.zeile.feuchte).toBe(14.2);
      expect(result.zeile.qualitaet).toBe("A-Qualität");
      expect(result.zeile.preisProEinheit).toBe(22.5);
      expect(result.zeile.externeNr).toBe("WS-2026-001");
    }
  });

  it("fällt auf das aktuelle Datum zurück, wenn keine Datumsspalte vorhanden ist", () => {
    const result = parseAnlieferungZeile({ Erzeuger: "Hof Brandes", Artikel: "Weizen", Menge: "5" }, 3);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.zeile.datum).toBeInstanceOf(Date);
      expect(isNaN(result.zeile.datum.getTime())).toBe(false);
    }
  });

  it("lehnt eine Zeile ohne Kunde/Erzeuger ab", () => {
    const result = parseAnlieferungZeile({ Artikel: "Weizen", Menge: "5" }, 4);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fehler.grund).toContain("Erzeuger");
  });

  it("lehnt eine Zeile ohne Artikel ab", () => {
    const result = parseAnlieferungZeile({ Erzeuger: "Hof Brandes", Menge: "5" }, 5);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fehler.grund).toContain("Artikel");
  });

  it("lehnt eine Zeile mit fehlender oder ungültiger Menge ab", () => {
    const ohne = parseAnlieferungZeile({ Erzeuger: "Hof Brandes", Artikel: "Weizen" }, 6);
    expect(ohne.ok).toBe(false);
    const negativ = parseAnlieferungZeile({ Erzeuger: "Hof Brandes", Artikel: "Weizen", Menge: "-5" }, 7);
    expect(negativ.ok).toBe(false);
  });

  it("lehnt eine Zeile mit ungültigem Datum ab, statt ein unsinniges Datum zu übernehmen", () => {
    const result = parseAnlieferungZeile(
      { Erzeuger: "Hof Brandes", Artikel: "Weizen", Menge: "5", Datum: "nicht-lesbar" },
      8,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fehler.grund).toContain("Datum");
  });

  it("erkennt einen Excel-Datums-Seriencode als Legedatum-relevanten Wert", () => {
    const result = parseAnlieferungZeile({ Erzeuger: "Hof Brandes", Artikel: "Weizen", Menge: "5", Datum: 45912 }, 9);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.zeile.datum.getFullYear()).toBe(2025);
      expect(result.zeile.datum.getMonth()).toBe(8);
      expect(result.zeile.datum.getDate()).toBe(12);
    }
  });
});
