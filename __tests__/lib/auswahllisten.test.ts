import { describe, it, expect } from "vitest";
import { resolveKategorie, DEFAULT_ARTIKEL_KATEGORIEN, DEFAULT_UNTERKATEGORIEN } from "@/lib/auswahllisten";

const KATEGORIEN = DEFAULT_ARTIKEL_KATEGORIEN;
const UNTERKATEGORIEN = DEFAULT_UNTERKATEGORIEN;

describe("resolveKategorie", () => {
  it("übernimmt eine gültige Top-Level-Kategorie unverändert", () => {
    expect(resolveKategorie("Saatgut", "Mais", KATEGORIEN, UNTERKATEGORIEN)).toEqual({
      kategorie: "Saatgut",
      unterkategorie: "Mais",
    });
  });

  it("erkennt Groß-/Kleinschreibungs- und Leerzeichenabweichungen bei der Kategorie", () => {
    expect(resolveKategorie(" saatgut ", null, KATEGORIEN, UNTERKATEGORIEN)).toEqual({
      kategorie: "Saatgut",
      unterkategorie: null,
    });
  });

  it("erkennt eine in die Kategorie-Spalte gerutschte Fruchtart und schiebt sie zur Unterkategorie (Artikel-Import-Bug)", () => {
    // Reproduziert den gemeldeten Fall: Import-Datei hat "Getreide" in der Kategorie-Spalte
    // statt "Saatgut" — Getreide ist tatsächlich eine Saatgut-Unterkategorie.
    expect(resolveKategorie("Getreide", "Winterweizen A", KATEGORIEN, UNTERKATEGORIEN)).toEqual({
      kategorie: "Saatgut",
      unterkategorie: "Getreide",
    });
  });

  it("fällt bei völlig unbekanntem Wert auf Futter zurück, ohne die (ebenfalls unbekannte) Unterkategorie zu erfinden", () => {
    expect(resolveKategorie("Zubehör", null, KATEGORIEN, UNTERKATEGORIEN)).toEqual({
      kategorie: "Futter",
      unterkategorie: null,
    });
  });

  it("lässt eine bereits gültige Unterkategorie unangetastet, wenn die Kategorie schon stimmt", () => {
    expect(resolveKategorie("Duenger", "irgendwas", KATEGORIEN, UNTERKATEGORIEN)).toEqual({
      kategorie: "Duenger",
      unterkategorie: "irgendwas",
    });
  });
});
