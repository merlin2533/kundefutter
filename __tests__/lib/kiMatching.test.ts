import { describe, it, expect } from "vitest";
import { matchArtikel, normalisiereArtikelnummer, istGleicherName, type MatchableArtikel } from "@/lib/kiMatching";

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

describe("istGleicherName", () => {
  it("gilt bei exakt normalisiertem Text als gleich", () => {
    expect(istGleicherName("Weizen Saatgut", "  weizen saatgut  ")).toBe(true);
  });

  it("toleriert OCR-Rauschen (Leerzeichen, Umlaut-Kodierung) bei sonst identischem Wortinhalt", () => {
    expect(istGleicherName("Ölrettich  Gelbsenf Mischung", "oelrettich gelbsenf mischung")).toBe(true);
  });

  it("gilt NICHT als gleich, wenn ein kurzer Name nur zufällig in einem viel längeren, andersartigen Namen steckt (Kernfall des Overlap-Koeffizient-Bugs)", () => {
    // Ohne Jaccard-Korrektur würde ein reiner Overlap-Koeffizient hier 1.0 liefern, weil "weizen"
    // vollständig in der Wortmenge des zweiten Textes steckt — und damit jeden Artikel treffen,
    // der irgendwo das Wort "Weizen" enthält.
    expect(istGleicherName("Weizen", "Weizen Saatgut Premium Sondermischung Herbst")).toBe(false);
  });

  it("liefert false bei leerem Text", () => {
    expect(istGleicherName("", "Weizen")).toBe(false);
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

  it("gelernt näherungsweise HIJACKT NICHT jeden Artikel, der das gelernte (kurze) Wort nur enthält — Regressionstest für den Overlap-Koeffizient-Bug", () => {
    // Nutzer hat einmal eine Position namens "Weizen" auf Artikel 3 gelernt. Ein KOMPLETT
    // ANDERER, viel ausführlicherer erkannter Name, der das Wort nur zufällig enthält, darf
    // dadurch NICHT automatisch (und schon gar nicht mit der höchsten Vertrauensstufe) auf
    // denselben Artikel gemappt werden.
    const gelernt = new Map([["weizen", 3]]);
    const andereArtikel: MatchableArtikel[] = [
      { id: 50, name: "Weizenkleie lose", artikelnummer: "D-1" },
      { id: 51, name: "Weizen Saatgut Premium Elixer Herbstsaat", artikelnummer: "D-2" },
    ];
    const { konfidenz } = matchArtikel({ name: "Weizen Saatgut Premium Elixer Herbstsaat" }, andereArtikel, gelernt);
    expect(konfidenz).not.toBe("gelernt");
  });

  it("Best-Pick-Prinzip: bewertet ALLE Kandidaten und wählt den besten Treffer, nicht den ersten Teilstring-Treffer im Array", () => {
    // "Weizen" ist als Buchstabenfolge Teil von "Sommerweizen" (Index 0), aber KEIN eigenständiges
    // Wort-Token davon und damit ein viel schlechterer Treffer als der fast identische, vollständige
    // Name an Index 1 — konstruiert so, dass sowohl ein Erster-Treffer-Verfahren als auch ein roher
    // (nicht Token-basierter) Teilstring-Vergleich den falschen Kandidaten liefern würden.
    const kandidaten: MatchableArtikel[] = [
      { id: 10, name: "Weizen", artikelnummer: "B-1" },
      { id: 11, name: "Sommerweizen Saatgut Premium Qualitaet 2026", artikelnummer: "B-2" },
    ];
    const { artikel } = matchArtikel({ name: "Sommerweizen Saatgut Premium Qualitaet" }, kandidaten);
    expect(artikel?.id).toBe(11);
  });

  it("ein exakter Namenstreffer gewinnt immer gegen einen Enthaltungs-Treffer, auch wenn der Enthaltungs-Treffer zuerst im Array steht (Regressionstest: beide konnten früher denselben Score 1 erreichen)", () => {
    const kandidaten: MatchableArtikel[] = [
      { id: 1, name: "Weizen Saatgut", artikelnummer: "E-1" }, // nur Enthaltungs-Treffer
      { id: 2, name: "Weizen", artikelnummer: "E-2" }, // exakter Treffer
    ];
    const { artikel, konfidenz } = matchArtikel({ name: "Weizen" }, kandidaten);
    expect(artikel?.id).toBe(2);
    expect(konfidenz).toBe("mittel"); // ARTIKEL-übergreifend "mittel", nicht "gelernt"/"exakt"
  });

  it("reine Zahlen-Token (Gebindegrößen) werden bei der Ähnlichkeit ignoriert, damit zwei unterschiedliche Produkte nicht allein über eine gemeinsame Zahl als ähnlich gelten", () => {
    const kandidaten: MatchableArtikel[] = [
      { id: 1, name: "Ferkelfutter 25", artikelnummer: "F-1" },
      { id: 2, name: "Sauenfutter Premium", artikelnummer: "F-2" },
    ];
    const { artikel } = matchArtikel({ name: "Sauenfutter 25" }, kandidaten);
    expect(artikel?.id).toBe(2);
  });

  it("die Enthaltungs-Regel greift NICHT, wenn ein kurzer Name nur als Buchstabenfolge (nicht als eigenständiges Wort-Token) in einem Artikelnamen steckt", () => {
    const kandidaten: MatchableArtikel[] = [{ id: 1, name: "Öl", artikelnummer: "G-1" }, { id: 2, name: "Kalk", artikelnummer: "G-2" }];
    const { artikel, konfidenz } = matchArtikel({ name: "Ölrettich Gelbsenf Mischung" }, kandidaten);
    expect(artikel).toBeNull();
    expect(konfidenz).toBe("keine");
  });

  it("liefert 'mittel' bei hoher, aber nicht exakter Namensähnlichkeit (kurzer Name vollständig als Wort-Token im Artikelnamen enthalten)", () => {
    const { artikel, konfidenz } = matchArtikel({ name: "Weizen" }, ARTIKEL);
    expect(konfidenz).toBe("mittel");
    expect(artikel?.id).toBe(3);
  });

  it("liefert 'niedrig' bei schwacher Namensähnlichkeit oberhalb der Mindestschwelle", () => {
    const kandidaten: MatchableArtikel[] = [{ id: 20, name: "Kartoffeln Speisekartoffeln", artikelnummer: "C-1" }];
    const { artikel, konfidenz } = matchArtikel({ name: "Kartoffeln Sonstiges" }, kandidaten);
    expect(konfidenz).toBe("niedrig");
    expect(artikel?.id).toBe(20);
  });

  it("liefert 'keine', wenn die Ähnlichkeit unter der Mindestschwelle liegt", () => {
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
