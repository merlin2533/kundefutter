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
    // Ein Zahlenstring weit außerhalb des plausiblen Excel-Serial-Bereichs (Jahre 2000–2099)
    // ist eher eine andere numerische Angabe (z.B. eine Belegnummer) als ein Datum.
    expect(parseImportDatum({ Datum: "999999" }, "Datum")).toBeNull();
  });

  it("respektiert die Spalten-Alias-Priorität wie pickCol", () => {
    const d = parseImportDatum({ Sortierdatum: "01.01.2026" }, "Datum", "Sortierdatum");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
  });

  it("lehnt einen ungültigen Tag/Monat ab statt ihn stillschweigend in den Folgemonat zu rollen (31.02.)", () => {
    expect(parseImportDatum({ Datum: "31.02.2026" }, "Datum")).toBeNull();
    expect(parseImportDatum({ Datum: "2026-02-31" }, "Datum")).toBeNull();
    // Ein gültiges Datum bleibt davon unberührt
    expect(parseImportDatum({ Datum: "28.02.2026" }, "Datum")).not.toBeNull();
  });

  it("lehnt einen 3-stelligen Jahreswert ab statt ihn als Jahr 202 zu interpretieren", () => {
    expect(parseImportDatum({ Datum: "12.09.202" }, "Datum")).toBeNull();
  });

  it("lehnt einen bloßen Jahres-/Wochenwert als Excel-Seriencode ab (Bereich ist auf plausible Jahre 2000-2099 begrenzt)", () => {
    // "2025" läge unterhalb des plausiblen Seriencode-Bereichs (2000-01-01 = 36526) und wäre
    // sonst fälschlich als Datum im Jahr 1905 interpretiert worden.
    expect(parseImportDatum({ Datum: 2025 }, "Datum")).toBeNull();
    expect(parseImportDatum({ Datum: "36525" }, "Datum")).toBeNull(); // 1999-12-31, knapp außerhalb
    expect(parseImportDatum({ Datum: 36526 }, "Datum")).not.toBeNull(); // 2000-01-01, knapp innerhalb
  });

  it("toleriert einen optionalen Zeitanteil bei DD.MM.YYYY und ISO (typisch für Waagen-/Sortiermaschinen-CSV-Exporte)", () => {
    // Seit raw:true beim CSV-Lesen (siehe app/api/{anlieferungen,eiersortierung}/import*) landet
    // z.B. "12.09.2026 08:30:00" als Text hier, statt von SheetJS bereits zu einem Seriencode
    // aufgelöst zu werden — ohne Zeit-Toleranz würde eine ganz normale Uhrzeitangabe die Zeile
    // fälschlich als "Datum ungültig" ablehnen.
    const dmyMitZeit = parseImportDatum({ Datum: "12.09.2026 08:30:00" }, "Datum");
    expect(dmyMitZeit).not.toBeNull();
    expect(dmyMitZeit!.getFullYear()).toBe(2026);
    expect(dmyMitZeit!.getMonth()).toBe(8);
    expect(dmyMitZeit!.getDate()).toBe(12);

    const isoMitZeit = parseImportDatum({ Datum: "2026-09-12T08:30" }, "Datum");
    expect(isoMitZeit).not.toBeNull();
    expect(isoMitZeit!.getDate()).toBe(12);

    const dmyOhneSekunden = parseImportDatum({ Datum: "12.09.2026 08:30" }, "Datum");
    expect(dmyOhneSekunden).not.toBeNull();
  });
});
