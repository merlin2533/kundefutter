import { describe, it, expect } from "vitest";
import { normalizeArtikelnummer, parseImportDatum } from "@/lib/import-utils";

// Regressionstest für GlitchTip AGRI-14 ("Unique constraint failed on the fields:
// (`artikelnummer`)", 129 Vorkommen): der Artikel-Import erkannte Mengenstaffel-/
// Preisvariante-Zeilen einer Preisliste (gleiche Artikelnummer, abweichender Name, z.B.
// "… ab 500 kg"/"… ab 750 kg") nicht als Update, weil der Duplikat-Check nur nach normalisiertem
// NAMEN suchte — `artikel.create()` scheiterte dadurch an der @unique-Regel auf Artikelnummer.
// normalizeArtikelnummer() ist die Grundlage des zusätzlichen, in
// app/api/artikel/import/route.ts eingebauten Artikelnummer-Index.
describe("normalizeArtikelnummer", () => {
  it("entfernt Leerzeichen und Bindestriche und vereinheitlicht Groß-/Kleinschreibung", () => {
    expect(normalizeArtikelnummer(" ab-100 ")).toBe("AB100");
    expect(normalizeArtikelnummer("12 345")).toBe("12345");
    expect(normalizeArtikelnummer("A-1000")).toBe(normalizeArtikelnummer("a 1000"));
  });

  it("liefert für zwei unterschiedliche Nummern auch unterschiedliche Ergebnisse", () => {
    expect(normalizeArtikelnummer("A-100")).not.toBe(normalizeArtikelnummer("A-200"));
  });
});

// Regressionstest für den im Eierbetrieb-Stage-2-Plan dokumentierten Fehlermodus: eine als
// Datum formatierte Excel-Zelle liefert über XLSX.utils.sheet_to_json() (ohne cellDates:true)
// eine reine Zahl (Seriencode seit 1899-12-30), nicht einen Text. `new Date(String(45912))`
// würde daraus fälschlich ein Datum im Jahr 45912 statt 2025-09-12 konstruieren — kritisch bei
// einem Legedatum-Import, da es das MHD bestimmt (lib/eier-mhd.ts berechneEierMhd()).
describe("parseImportDatum", () => {
  it("erkennt einen Excel-Datums-Seriencode (Zahl) korrekt statt ein Datum im Jahr 45912 zu erzeugen", () => {
    const d = parseImportDatum({ Datum: 45912 }, "Datum");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2025);
    expect(d!.getMonth()).toBe(8); // September (0-indiziert)
    expect(d!.getDate()).toBe(12);
  });

  it("erkennt DD.MM.YYYY", () => {
    const d = parseImportDatum({ Datum: "14.09.2026" }, "Datum");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(8);
    expect(d!.getDate()).toBe(14);
  });

  it("erkennt ISO YYYY-MM-DD", () => {
    const d = parseImportDatum({ Datum: "2026-09-14" }, "Datum");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(8);
    expect(d!.getDate()).toBe(14);
  });

  it("liefert null bei fehlender Spalte", () => {
    expect(parseImportDatum({}, "Datum")).toBeNull();
  });

  it("liefert null bei einem nicht erkennbaren Wert, statt ein unsinniges Datum zu erzeugen", () => {
    expect(parseImportDatum({ Datum: "keinDatum" }, "Datum")).toBeNull();
    // Ein Zahlenstring weit außerhalb des plausiblen Excel-Serial-Bereichs (~1899–2099)
    // ist eher eine andere numerische Angabe (z.B. eine Belegnummer) als ein Datum.
    expect(parseImportDatum({ Datum: "999999" }, "Datum")).toBeNull();
  });

  it("respektiert die Spalten-Alias-Priorität wie pickCol", () => {
    const d = parseImportDatum({ Sortierdatum: "01.01.2026" }, "Datum", "Sortierdatum");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
  });
});
