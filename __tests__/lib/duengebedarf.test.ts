import { describe, it, expect } from "vitest";
import {
  berechneDuengebedarf,
  ableiteVersorgungsklasseP,
  ableiteVersorgungsklasseK,
  ableiteVersorgungsklasseMg,
} from "@/lib/duengebedarf";

describe("berechneDuengebedarf", () => {
  it("rechnet Ertragskorrektur, Nmin- und Vorfrucht-Abzug korrekt für Winterweizen A/B", () => {
    const r = berechneDuengebedarf({
      fruchtart: "Winterweizen A/B",
      ertragsZiel: 90,
      vorfrucht: "Raps",
      nMin: 40,
      versorgungsklasseP: "C",
      versorgungsklasseK: "C",
    });

    // nBasis 230 + (90-80)*2.0 Ertragskorrektur - 40 Nmin - 10 Vorfrucht(Raps) = 200
    expect(r.nBedarf).toBe(200);
    expect(r.rechenweg.nErtragsKorrektur).toBe(20);
    expect(r.rechenweg.nVorfruchtAbzug).toBe(10);
    expect(r.rechenweg.nMinAbzug).toBe(40);

    // P/K bei Versorgungsklasse C (Korrekturfaktor 1.0) = reiner Entzugswert
    expect(r.pBedarf).toBe(72); // 0.8 * 90
    expect(r.kBedarf).toBe(50); // 0.55 * 90 gerundet
    expect(r.hinweise).toHaveLength(0);
  });

  it("setzt P-Bedarf auf 0 bei Versorgungsklasse E und erhöht K-Bedarf bei Klasse A", () => {
    const r = berechneDuengebedarf({
      fruchtart: "Winterraps",
      ertragsZiel: 40,
      nMin: 20,
      versorgungsklasseP: "E",
      versorgungsklasseK: "A",
    });

    // Versorgungsklasse E => Korrekturfaktor 0 => kein P
    expect(r.pBedarf).toBe(0);
    expect(r.hinweise).toContain("P-Versorgungsklasse E → keine P-Düngung empfohlen.");

    // Versorgungsklasse A => Korrekturfaktor 1.25 => Aufdüngung, K-Bedarf über Entzugswert
    expect(r.rechenweg.kKorrektur).toBe(1.25);
    expect(r.kBedarf).toBe(50); // 40 (kBasis) * 1.25
    expect(r.rechenweg.kBasis).toBe(40);

    // kein Vorfruchtabzug angegeben -> voller Basisbedarf abzüglich Nmin
    expect(r.nBedarf).toBe(180); // 200 Basis - 20 Nmin
  });

  it("klemmt einen rechnerisch negativen N-Bedarf auf 0 und weist darauf hin", () => {
    const r = berechneDuengebedarf({
      fruchtart: "Sommergerste",
      ertragsZiel: 55,
      nMin: 200, // deutlich über dem Basisbedarf von 140
    });

    expect(r.nBedarf).toBe(0);
    expect(r.hinweise).toContain("Rechnerischer Bedarf negativ — keine N-Düngung erforderlich.");
    // P/K-Bedarf bleibt unabhängig vom N-Bedarf bestehen
    expect(r.pBedarf).toBe(44);
    expect(r.kBedarf).toBe(30);
  });

  it("wirft bei unbekannter Fruchtart einen Fehler", () => {
    expect(() => berechneDuengebedarf({ fruchtart: "Nichtvorhandene Frucht" })).toThrow(
      "Unbekannte Fruchtart",
    );
  });
});

describe("ableiteVersorgungsklasseP (VDLUFA-Grenzwerte)", () => {
  it("ordnet Phosphorwerte den richtigen Klassen A-F zu", () => {
    expect(ableiteVersorgungsklasseP(2)).toBe("A");
    expect(ableiteVersorgungsklasseP(10)).toBe("C"); // Standard-Testfall aus der Praxis
    expect(ableiteVersorgungsklasseP(40)).toBe("F");
    expect(ableiteVersorgungsklasseP(null)).toBeNull();
  });

  it("behandelt Klassengrenzen als exklusiv am oberen Ende (< statt <=)", () => {
    // Grenze B/C liegt bei 6: 5.9 noch B, 6 bereits C
    expect(ableiteVersorgungsklasseP(5.9)).toBe("B");
    expect(ableiteVersorgungsklasseP(6)).toBe("C");
  });
});

describe("ableiteVersorgungsklasseK / ableiteVersorgungsklasseMg", () => {
  it("leitet Kalium-Versorgungsklassen korrekt ab", () => {
    expect(ableiteVersorgungsklasseK(4)).toBe("A");
    expect(ableiteVersorgungsklasseK(5)).toBe("B");
    expect(ableiteVersorgungsklasseK(9.9)).toBe("B");
  });

  it("leitet Magnesium-Versorgungsklassen korrekt ab und liefert null ohne Messwert", () => {
    expect(ableiteVersorgungsklasseMg(2)).toBe("A");
    expect(ableiteVersorgungsklasseMg(null)).toBeNull();
  });
});
