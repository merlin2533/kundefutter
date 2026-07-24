import { describe, it, expect } from "vitest";
import { loeseJahrespreisAuf } from "@/lib/jahrespreis";

describe("loeseJahrespreisAuf", () => {
  it("gibt den exakten Preis zurück, wenn das Zieljahr erfasst ist", () => {
    const r = loeseJahrespreisAuf([{ jahr: 2025, preis: 100 }, { jahr: 2026, preis: 110 }], 2026, 999);
    expect(r).toEqual({ preis: 110, jahr: 2026, quelleJahr: 2026, interpoliert: false, richtung: null });
  });

  it("fällt ohne jegliche Jahrespreise auf den Basispreis zurück, ohne als interpoliert zu gelten", () => {
    const r = loeseJahrespreisAuf([], 2026, 42);
    expect(r).toEqual({ preis: 42, jahr: 2026, quelleJahr: null, interpoliert: false, richtung: null });
  });

  it("übernimmt den Preis aus einem älteren Jahr, wenn kein Preis für das Zieljahr existiert", () => {
    const r = loeseJahrespreisAuf([{ jahr: 2023, preis: 90 }, { jahr: 2024, preis: 95 }], 2026, 0);
    expect(r).toEqual({ preis: 95, jahr: 2026, quelleJahr: 2024, interpoliert: true, richtung: "aelter" });
  });

  it("übernimmt den Preis aus einem jüngeren Jahr, wenn nur zukünftige Preise vorliegen", () => {
    const r = loeseJahrespreisAuf([{ jahr: 2028, preis: 130 }], 2026, 0);
    expect(r).toEqual({ preis: 130, jahr: 2026, quelleJahr: 2028, interpoliert: true, richtung: "juenger" });
  });

  it("bevorzugt bei Gleichstand der Distanz das ältere Jahr", () => {
    // 2024 und 2028 sind beide 2 Jahre von 2026 entfernt
    const r = loeseJahrespreisAuf([{ jahr: 2024, preis: 80 }, { jahr: 2028, preis: 140 }], 2026, 0);
    expect(r.quelleJahr).toBe(2024);
    expect(r.preis).toBe(80);
    expect(r.richtung).toBe("aelter");
  });

  it("wählt unter mehreren älteren Jahren das nächstgelegene", () => {
    const r = loeseJahrespreisAuf(
      [{ jahr: 2020, preis: 50 }, { jahr: 2024, preis: 95 }, { jahr: 2022, preis: 70 }],
      2026,
      0,
    );
    expect(r.quelleJahr).toBe(2024);
    expect(r.preis).toBe(95);
  });
});
