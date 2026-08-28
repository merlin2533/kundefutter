import { describe, it, expect } from "vitest";
import { matchArtikel, normalisiereArtikelnummer, type MatchableArtikel } from "@/lib/kiMatching";

const ARTIKEL: MatchableArtikel[] = [
  { id: 1, name: "Ölrettich Gelbsenf Mischung", artikelnummer: "A-100" },
  { id: 2, name: "Maiskleber Trocken 25kg", artikelnummer: "A-200" },
  { id: 3, name: "Weizen Saatgut", artikelnummer: "A-300" },
];

describe("normalisiereArtikelnummer", () => {
  it("entfernt Leerzeichen/Bindestriche und vereinheitlicht Groß-/Kleinschreibung", () => {
    expect(normalisiereArtikelnummer(" ab-100 ")).toBe("AB100");
    expect(normalisiereArtikelnummer("12 345")).toBe("12345");
  });
});

describe("matchArtikel", () => {
  it("liefert 'keine' bei leerer Artikelliste oder fehlendem Namen", () => {
    expect(matchArtikel({ name: "Weizen" }, []).konfidenz).toBe("keine");
    expect(matchArtikel({ name: "" as unknown as string }, ARTIKEL).konfidenz).toBe("keine");
  });

  it("gelernt exakt schlägt jede andere Stufe (auch wenn Lieferanten-Artikelnummer UND eigene Artikelnummer ebenfalls träfen)", () => {
    const gelernt = new Map([["maiskleber trocken", 3]]);
    const lieferantenArtNrMap = new Map([["A200", 2]]);
    const { artikel, konfidenz } = matchArtikel(
      { name: "Maiskleber Trocken", artikelnummer: "A-200" },
      ARTIKEL,
      gelernt,
      lieferantenArtNrMap
    );
    expect(konfidenz).toBe("gelernt");
    expect(artikel?.id).toBe(3);
  });

  it("Lieferanten-Artikelnummer wird VOR der eigenen Artikelnummer geprüft und liefert den korrekten Artikel, obwohl die eigene Artikelnummer auf einen anderen Artikel zeigen würde", () => {
    // Die KI liest "A-300" vom Beleg — das ist zufällig die interne Artikelnummer von Artikel 3,
    // aber für DIESEN Lieferanten ist "A-300" tatsächlich seine eigene Nummer für Artikel 2.
    const lieferantenArtNrMap = new Map([["A300", 2]]);
    const { artikel, konfidenz } = matchArtikel(
      { name: "irgendein Name ohne Bezug", artikelnummer: "A-300" },
      ARTIKEL,
      undefined,
      lieferantenArtNrMap
    );
    expect(konfidenz).toBe("hoch");
    expect(artikel?.id).toBe(2);
  });

  it("fällt ohne Lieferanten-Artikelnummer-Treffer auf die eigene Artikelnummer zurück", () => {
    const { artikel, konfidenz } = matchArtikel({ name: "x", artikelnummer: "A-300" }, ARTIKEL);
    expect(konfidenz).toBe("hoch");
    expect(artikel?.id).toBe(3);
  });

  it("gelernt näherungsweise (fuzzy): toleriert OCR-Rauschen (Leerzeichen, Umlaut-Kodierung) gegenüber dem gespeicherten Suchtext", () => {
    const gelernt = new Map([["oelrettich gelbsenf mischung", 1]]);
    const { artikel, konfidenz } = matchArtikel(
      { name: "Ölrettich  Gelbsenf Mischung" }, // Doppel-Leerzeichen + Umlaut statt "oe"
      ARTIKEL,
      gelernt
    );
    expect(konfidenz).toBe("gelernt");
    expect(artikel?.id).toBe(1);
  });

  it("Best-Pick-Prinzip: bewertet ALLE Kandidaten und wählt den besten Treffer, nicht den ersten Teilstring-Treffer im Array", () => {
    // "Weizen" ist ein Teilstring-Wort von "Weizen Saatgut" (Index 2), aber ein viel schlechterer
    // Treffer als der vollständige Name an Index 0 — konstruiert so, dass ein reines
    // Erster-Treffer-Verfahren den falschen (früheren, schwächeren) Kandidaten liefern würde.
    const kandidaten: MatchableArtikel[] = [
      { id: 10, name: "Weizen", artikelnummer: "B-1" },
      { id: 11, name: "Sommerweizen Saatgut Premium Qualitaet 2026", artikelnummer: "B-2" },
    ];
    const { artikel } = matchArtikel({ name: "Sommerweizen Saatgut Premium Qualitaet" }, kandidaten);
    expect(artikel?.id).toBe(11);
  });

  it("liefert 'mittel' bei hoher, aber nicht exakter Namensähnlichkeit (kurzer Name vollständig im Artikelnamen enthalten)", () => {
    const { artikel, konfidenz } = matchArtikel({ name: "Weizen" }, ARTIKEL);
    expect(konfidenz).toBe("mittel");
    expect(artikel?.id).toBe(3);
  });

  it("liefert 'niedrig' bei schwacher Namensähnlichkeit genau an der Mindestschwelle (Score 0.5)", () => {
    const kandidaten: MatchableArtikel[] = [{ id: 20, name: "Kartoffeln Speisekartoffeln", artikelnummer: "C-1" }];
    const { artikel, konfidenz } = matchArtikel({ name: "Kartoffeln Sonstiges Anderes Ding" }, kandidaten);
    expect(konfidenz).toBe("niedrig");
    expect(artikel?.id).toBe(20);
  });

  it("liefert 'keine', wenn die Ähnlichkeit knapp unter der Mindestschwelle liegt", () => {
    const kandidaten: MatchableArtikel[] = [{ id: 21, name: "Kartoffeln Speisekartoffeln Extra", artikelnummer: "C-2" }];
    const { konfidenz } = matchArtikel({ name: "Kartoffeln Sonstiges Anderes Ganz Verschieden" }, kandidaten);
    expect(konfidenz).toBe("keine");
  });

  it("liefert 'keine', wenn kein Kandidat auch nur annähernd passt", () => {
    const { artikel, konfidenz } = matchArtikel({ name: "Voellig unbekanntes Produkt Xyz" }, ARTIKEL);
    expect(artikel).toBeNull();
    expect(konfidenz).toBe("keine");
  });
});
