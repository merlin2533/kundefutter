import { describe, it, expect } from "vitest";
import { berechneRation } from "@/lib/rationsberechnung";

// Rechenkern ist reine Funktion (kein Prisma/IO) — direkt testbar.
// Erwartungswerte wurden aus der tatsächlichen Implementierung ermittelt und
// gegen die zugrundeliegenden Formeln (bedarfRind/bedarfPferd/bedarfSchwein in
// lib/tierbedarf.ts) nachgerechnet.

describe("berechneRation — Milchkuh laktierend", () => {
  const basisEingabe = {
    tierart: "Rind" as const,
    nutzungsart: "Milchkuh laktierend",
    modus: "simple" as const,
    gewicht: 650,
    leistung: 25,
    fettProzent: 4.0,
    eiweissProzent: 3.4,
  };

  it("erkennt eine überversorgte Ration (Energie/Protein-Überschuss, enges Ca:P)", () => {
    const r = berechneRation({
      ...basisEingabe,
      positionen: [
        { futter: "Grassilage", quelle: "standard", fmKg: 35, tmGehalt: 350, werte: { me: 9.0, nel: 6.36, rohprotein: 180, nxp: 143, andfom: 465, ca: 6.5, p: 4.0, mg: 2.4, na: 0.7 } },
        { futter: "Maissilage", quelle: "standard", fmKg: 20, tmGehalt: 350, werte: { me: 10.9, nel: 6.69, rohprotein: 82, nxp: 134, andfom: 485, ca: 2.0, p: 2.2, mg: 1.3, na: 0.3 } },
        { futter: "Gerste", quelle: "standard", fmKg: 4, tmGehalt: 880, werte: { me: 13.0, nel: 8.3, rohprotein: 120, nxp: 165, andfom: 200, ca: 0.7, p: 4.0, mg: 1.3, na: 0.3 } },
        { futter: "Sojaextraktionsschrot", quelle: "standard", fmKg: 3, tmGehalt: 880, werte: { me: 13.4, nel: 8.6, rohprotein: 500, nxp: 290, andfom: 130, ca: 3.5, p: 7.0, mg: 3.0, na: 0.3 } },
        { futter: "Mineralfutter Milchvieh", quelle: "standard", fmKg: 0.15, tmGehalt: 950, werte: { ca: 210, p: 40, mg: 70, na: 80 } },
      ],
    });

    // TM-Aufnahme und Bedarf plausibel (Bedarf = lw*0.032 + milch*0.1 = 23.3 kg)
    expect(r.tmAufnahme).toBeCloseTo(25.55, 2);
    expect(r.bedarf.tmBedarf).toBeCloseTo(23.3, 2);

    // Energie- und Proteindeckung deutlich über 100 % -> keine Unterversorgungs-Hinweise
    expect(r.deckung.nel).toBeGreaterThan(100);
    expect(r.deckung.nxp).toBeGreaterThan(100);
    expect(r.hinweise.some((h) => h.includes("Energie unterversorgt"))).toBe(false);
    expect(r.hinweise.some((h) => h.includes("Protein unterversorgt"))).toBe(false);

    // Ca:P-Verhältnis 1.32:1 liegt unter dem Wiederkäuer-Sollbereich (1.5–2.5) -> Warnhinweis
    expect(r.caPVerhaeltnis).toBeCloseTo(1.32, 2);
    expect(r.hinweise.some((h) => h.includes("Ca:P-Verhältnis 1.32:1 zu eng"))).toBe(true);

    // RNB deutlich positiv (N-Überschuss) bei diesem eiweißreichen Mix
    expect(r.rnb).toBeCloseTo(77.6, 1);
    expect(r.hinweise.some((h) => h.includes("RNB 77.6 g hoch"))).toBe(true);
  });

  it("erkennt eine unterversorgte Ration (reines Stroh) über mehrere Nährstoffachsen", () => {
    const r = berechneRation({
      ...basisEingabe,
      positionen: [
        { futter: "Stroh", quelle: "standard", fmKg: 12, tmGehalt: 860, werte: { me: 6.62, nel: 3.3, rohprotein: 45, nxp: 74, andfom: 785, ca: 4.0, p: 0.8, mg: 0.9, na: 1.0 } },
      ],
    });

    expect(r.tmAufnahme).toBeCloseTo(10.32, 2);
    expect(r.bilanz.nel).toBeLessThan(0);
    expect(r.bilanz.nxp).toBeLessThan(0);
    expect(r.deckung.nel).toBeCloseTo(28.4, 1);

    // TM-Aufnahme < 90% des Bedarfs -> expliziter "füllt das Tier nicht aus"-Hinweis
    expect(r.hinweise.some((h) => h.includes("liegt deutlich unter dem Bedarf"))).toBe(true);
    expect(r.hinweise.some((h) => h.includes("Energie unterversorgt"))).toBe(true);
    expect(r.hinweise.some((h) => h.includes("Protein unterversorgt"))).toBe(true);

    // Ca:P bei reinem Stroh viel zu weit (5:1, Soll 1.5–2.5) -> "zu weit"-Hinweis
    expect(r.caPVerhaeltnis).toBeCloseTo(5, 1);
    expect(r.hinweise.some((h) => h.includes("Ca:P-Verhältnis 5:1 zu weit"))).toBe(true);

    // RNB deutlich negativ (Protein-/N-Mangel im Pansen)
    expect(r.rnb).toBeLessThan(-10);
    expect(r.hinweise.some((h) => h.includes("RNB -47.9 g negativ"))).toBe(true);
  });
});

describe("berechneRation — Pferd, Ca:P-Grenzfall innerhalb des Sollbereichs", () => {
  it("gibt bei Ca:P im Sollbereich (1.2–2.0) keinen Ca:P-Hinweis aus, meldet aber Energie-/Proteindefizit", () => {
    const r = berechneRation({
      tierart: "Pferd",
      nutzungsart: "Warmblut Erhaltung",
      modus: "simple",
      gewicht: 600,
      positionen: [
        { futter: "Heu", quelle: "standard", fmKg: 8, tmGehalt: 860, werte: { me: 7.2, dp: 55, rohfaser: 315, andfom: 605, ca: 4.0, p: 2.5, mg: 1.6, na: 0.4 } },
        { futter: "Mineralfutter Pferd", quelle: "standard", fmKg: 0.05, tmGehalt: 950, werte: { ca: 150, p: 80, mg: 50, na: 60 } },
      ],
    });

    // Ca:P = 1.65:1 liegt innerhalb des Pferde-Sollbereichs [1.2, 2.0] -> kein "zu eng"/"zu weit"-Hinweis
    expect(r.caPVerhaeltnis).toBeCloseTo(1.65, 2);
    expect(r.hinweise.some((h) => h.includes("Ca:P-Verhältnis") && (h.includes("zu eng") || h.includes("zu weit")))).toBe(false);

    // Trotzdem Energie- und Proteindefizit, weil nur Heu ohne Kraftfutter gefüttert wird
    expect(r.bilanz.me).toBeLessThan(0);
    expect(r.hinweise.some((h) => h.includes("Energie unterversorgt"))).toBe(true);
    expect(r.hinweise.some((h) => h.includes("Protein unterversorgt"))).toBe(true);

    // Wiederkäuer-spezifische RNB darf beim Pferd nicht berechnet werden
    expect(r.rnb).toBeNull();
  });
});

describe("berechneRation — Schwein, limitierende Aminosäuren", () => {
  it("markiert Lysin und Methionin als 'mangel', wenn nur Gerste gefüttert wird", () => {
    const r = berechneRation({
      tierart: "Schwein",
      nutzungsart: "Mastschwein Endmast",
      modus: "simple",
      gewicht: 90,
      positionen: [
        { futter: "Gerste", quelle: "standard", fmKg: 2.5, tmGehalt: 880, werte: { me: 13.0, rohprotein: 120, rohfaser: 55, andfom: 200, lysin: 4.3, methionin: 2.0, ca: 0.7, p: 4.0, mg: 1.3, na: 0.3 } },
      ],
    });

    const lysin = r.aminosaeuren.find((a) => a.naehrstoff === "lysin");
    const methionin = r.aminosaeuren.find((a) => a.naehrstoff === "methionin");
    expect(lysin?.status).toBe("mangel");
    expect(lysin?.deckung).toBeCloseTo(45, 0);
    expect(methionin?.status).toBe("mangel");
    expect(methionin?.deckung).toBeCloseTo(67.7, 1);

    expect(r.hinweise.some((h) => h.includes("Lysin unterversorgt"))).toBe(true);
    expect(r.hinweise.some((h) => h.includes("Methionin unterversorgt"))).toBe(true);
  });
});
