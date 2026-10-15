import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import {
  isoWoche,
  haltungsformAusErzeugercode,
  buildKatMeldungCsv,
  verdichteEierStatistik,
  type KatMeldungZeile,
} from "@/lib/kat-meldung";

const zeile = (o: Partial<KatMeldungZeile>): KatMeldungZeile => ({
  woche: "2026-W37",
  erzeugercode: "1-DE-0123451",
  haltungsform: "Freiland",
  gueteklasse: "A",
  gewichtsklasse: "M",
  mengeSortiert: 0,
  mengeVerkauft: 0,
  ...o,
});

describe("isoWoche", () => {
  it("ordnet Tage um den Jahreswechsel der richtigen ISO-Woche zu", () => {
    expect(isoWoche(new Date(2026, 11, 31))).toBe("2026-W53"); // Do 31.12.2026
    expect(isoWoche(new Date(2027, 0, 1))).toBe("2026-W53"); // Fr 01.01.2027
    expect(isoWoche(new Date(2027, 0, 4))).toBe("2027-W01"); // Mo 04.01.2027
    expect(isoWoche(new Date(2024, 11, 30))).toBe("2025-W01"); // Mo 30.12.2024
  });

  it("liefert eine normale Woche mitten im Jahr", () => {
    expect(isoWoche(new Date(2026, 8, 14))).toBe("2026-W38"); // Mo 14.09.2026
  });
});

describe("haltungsformAusErzeugercode", () => {
  it("leitet die Haltungsform aus der ersten Ziffer ab", () => {
    expect(haltungsformAusErzeugercode("0-DE-0123451")).toBeTruthy();
    expect(haltungsformAusErzeugercode("1-DE-0123451")).toBeTruthy();
    expect(haltungsformAusErzeugercode("1-DE-0123451")).not.toBe(haltungsformAusErzeugercode("3-DE-0123451"));
  });

  it("liefert null ohne oder mit ungültigem Code", () => {
    expect(haltungsformAusErzeugercode(null)).toBeNull();
    expect(haltungsformAusErzeugercode("")).toBeNull();
    expect(haltungsformAusErzeugercode("X-DE-1")).toBeNull();
  });
});

describe("buildKatMeldungCsv", () => {
  it("schreibt Header und Zeilen mit Semikolon", () => {
    const csv = buildKatMeldungCsv([zeile({ mengeSortiert: 100, mengeVerkauft: 40 })]);
    const [header, row] = csv.split("\n");
    expect(header).toBe("Woche;Erzeugercode;Haltungsform;Güteklasse;Gewichtsklasse;Menge sortiert;Menge verkauft");
    expect(row).toBe("2026-W37;1-DE-0123451;Freiland;A;M;100;40");
  });

  it("quotet Felder mit Semikolon oder Anführungszeichen", () => {
    const csv = buildKatMeldungCsv([zeile({ erzeugercode: 'AB;"C"' })]);
    expect(csv.split("\n")[1].startsWith('2026-W37;"AB;""C""";')).toBe(true);
  });
});

describe("verdichteEierStatistik", () => {
  it("summiert je Güte-/Gewichtsklasse und schließt „—“ aus den Top-Erzeugern aus", () => {
    const stat = verdichteEierStatistik([
      zeile({ mengeSortiert: 100, mengeVerkauft: 10 }),
      zeile({ gueteklasse: "B", mengeSortiert: 50 }),
      zeile({ erzeugercode: "—", haltungsform: null, mengeSortiert: 999 }),
    ]);
    expect(stat.summeSortiert).toBe(1149);
    expect(stat.summeVerkauft).toBe(10);
    expect(stat.gueteklassen.find((g) => g.key === "A")?.mengeSortiert).toBe(1099);
    expect(stat.topErzeuger.map((e) => e.erzeugercode)).toEqual(["1-DE-0123451"]);
  });

  it("begrenzt die Top-Erzeuger auf 10 und sortiert nach sortierter Menge", () => {
    const zeilen = Array.from({ length: 12 }, (_, i) =>
      zeile({ erzeugercode: `1-DE-${String(i).padStart(7, "0")}`, mengeSortiert: i + 1 }),
    );
    const top = verdichteEierStatistik(zeilen).topErzeuger;
    expect(top).toHaveLength(10);
    expect(top[0].mengeSortiert).toBe(12);
  });
});
