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

  it("lässt einen völlig unbekannten Wert unverändert, statt ihn auf Futter zu erzwingen (Bugreport: Pflanzenhilfsmittel/Stallzubehör wurden fälschlich nach Futter verschoben)", () => {
    // DEFAULT_ARTIKEL_KATEGORIEN/system.artikelkategorien ist eine Vorschlagsliste, keine
    // abschließende Enum-Definition — ein Kunde kann jederzeit weitere, eigene Kategorien
    // (z.B. "Pflanzenhilfsmittel", "Stallzubehör") direkt beim Import/Anlegen einführen.
    expect(resolveKategorie("Zubehör", null, KATEGORIEN, UNTERKATEGORIEN)).toEqual({
      kategorie: "Zubehör",
      unterkategorie: null,
    });
    expect(resolveKategorie("Pflanzenhilfsmittel", null, KATEGORIEN, UNTERKATEGORIEN)).toEqual({
      kategorie: "Pflanzenhilfsmittel",
      unterkategorie: null,
    });
    expect(resolveKategorie("Stallzubehör", null, KATEGORIEN, UNTERKATEGORIEN)).toEqual({
      kategorie: "Stallzubehör",
      unterkategorie: null,
    });
  });

  it("lässt eine bereits gültige Unterkategorie unangetastet, wenn die Kategorie schon stimmt", () => {
    expect(resolveKategorie("Duenger", "irgendwas", KATEGORIEN, UNTERKATEGORIEN)).toEqual({
      kategorie: "Duenger",
      unterkategorie: "irgendwas",
    });
  });

  it("erkennt \"Dünger\" (natürliche deutsche Schreibweise mit Umlaut) als die intern ASCII-gespeicherte Kategorie \"Duenger\" (Bugreport: Schwefellinsen etc. fielen sonst systematisch auf Futter zurück)", () => {
    expect(resolveKategorie("Dünger", "Schwefel", KATEGORIEN, UNTERKATEGORIEN)).toEqual({
      kategorie: "Duenger",
      unterkategorie: "Schwefel",
    });
  });
});
