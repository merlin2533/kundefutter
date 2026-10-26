import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { normalisiereSuche, fasseKundenZusammen, type RueckverfolgungLieferung } from "@/lib/eier-rueckverfolgung";

const lief = (o: Partial<RueckverfolgungLieferung>): RueckverfolgungLieferung => ({
  positionId: 1,
  lieferungId: 1,
  datum: new Date("2026-09-01"),
  status: "geliefert",
  rechnungNr: null,
  kundeId: 1,
  kundeName: "Markt A",
  kundeOrt: "Bielefeld",
  artikel: "EI-A-M",
  menge: 100,
  einheit: "Stück",
  chargeNr: "CH-1",
  erzeugercode: "1-DE-0123451",
  legedatum: null,
  ...o,
});

describe("normalisiereSuche", () => {
  it("trimmt und akzeptiert Charge oder Erzeugercode", () => {
    expect(normalisiereSuche("  CH-1 ", null)).toEqual({ charge: "CH-1", erzeugercode: "" });
    expect(normalisiereSuche(null, " 1-DE-01 ")).toEqual({ charge: "", erzeugercode: "1-DE-01" });
    expect(normalisiereSuche("CH-1", "1-DE-01")).toEqual({ charge: "CH-1", erzeugercode: "1-DE-01" });
  });

  it("lehnt zu kurze oder leere Eingaben ab", () => {
    expect(normalisiereSuche("", "")).toBeNull();
    expect(normalisiereSuche("a", "b")).toBeNull();
    expect(normalisiereSuche(undefined, undefined)).toBeNull();
  });

  it("ignoriert ein zu kurzes Feld, wenn das andere ausreicht", () => {
    expect(normalisiereSuche("x", "1-DE-01")).toEqual({ charge: "", erzeugercode: "1-DE-01" });
  });
});

describe("fasseKundenZusammen", () => {
  it("summiert je Kunde und zählt Lieferungen nur einmal", () => {
    const k = fasseKundenZusammen([
      lief({ positionId: 1, lieferungId: 10, menge: 100 }),
      lief({ positionId: 2, lieferungId: 10, menge: 50 }),
      lief({ positionId: 3, lieferungId: 11, menge: 30 }),
    ]);
    expect(k).toHaveLength(1);
    expect(k[0].menge).toBe(180);
    expect(k[0].lieferungen).toBe(2);
  });

  it("ignoriert stornierte Lieferungen", () => {
    const k = fasseKundenZusammen([lief({ status: "storniert" }), lief({ positionId: 2, kundeId: 2, kundeName: "B", menge: 5 })]);
    expect(k.map((x) => x.kundeId)).toEqual([2]);
  });

  it("sortiert nach Menge absteigend", () => {
    const k = fasseKundenZusammen([
      lief({ kundeId: 1, kundeName: "A", menge: 10 }),
      lief({ positionId: 2, lieferungId: 2, kundeId: 2, kundeName: "B", menge: 99 }),
    ]);
    expect(k.map((x) => x.kundeName)).toEqual(["B", "A"]);
  });
});
