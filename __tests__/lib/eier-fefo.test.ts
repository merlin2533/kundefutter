import { describe, it, expect } from "vitest";
import { berechneChargenRest, bewerteFefo } from "@/lib/eier-fefo";

const JETZT = new Date("2026-09-20T12:00:00Z");
const tage = (n: number) => new Date(JETZT.getTime() + n * 86400000);

describe("berechneChargenRest", () => {
  it("zieht Verkäufe ab, filtert leere Chargen und sortiert nach Legedatum", () => {
    const c = berechneChargenRest(
      [
        { chargeNr: "B", menge: 100, legedatum: tage(-5) },
        { chargeNr: "A", menge: 100, legedatum: tage(-10) },
        { chargeNr: "C", menge: 50, legedatum: tage(-20) },
      ],
      new Map([["C", 50], ["A", 30]]),
    );
    expect(c.map((x) => x.chargeNr)).toEqual(["A", "B"]);
    expect(c[0].rest).toBe(70);
  });

  it("fasst mehrere Positionen einer Charge zusammen und nimmt das früheste Legedatum", () => {
    const c = berechneChargenRest(
      [
        { chargeNr: "A", menge: 10, legedatum: tage(-3) },
        { chargeNr: "A", menge: 20, legedatum: tage(-9) },
      ],
      new Map(),
    );
    expect(c).toHaveLength(1);
    expect(c[0].rest).toBe(30);
    expect(c[0].legedatum).toEqual(tage(-9));
  });

  it("stellt Chargen ohne Legedatum ans Ende", () => {
    const c = berechneChargenRest(
      [{ chargeNr: "X", menge: 5, legedatum: null }, { chargeNr: "Y", menge: 5, legedatum: tage(-1) }],
      new Map(),
    );
    expect(c.map((x) => x.chargeNr)).toEqual(["Y", "X"]);
  });
});

describe("bewerteFefo", () => {
  const frisch = { chargeNr: "NEU", legedatum: tage(-2), rest: 100 };
  const alt = { chargeNr: "ALT", legedatum: tage(-15), rest: 40 };

  it("liefert nichts ohne Chargen", () => {
    expect(bewerteFefo([], null, JETZT).hinweis).toBeNull();
  });

  it("zeigt ohne gewählte Charge die älteste als Info", () => {
    const b = bewerteFefo([alt, frisch], null, JETZT);
    expect(b.stufe).toBe("info");
    expect(b.hinweis).toContain("ALT");
  });

  it("warnt, wenn eine jüngere statt der ältesten Charge gewählt wird", () => {
    const b = bewerteFefo([alt, frisch], "NEU", JETZT);
    expect(b.stufe).toBe("warnung");
    expect(b.hinweis).toContain("ALT");
  });

  it("bleibt still, wenn die älteste Charge gewählt ist", () => {
    const b = bewerteFefo([alt, frisch], "ALT", JETZT);
    expect(b.hinweis).toBeNull();
  });

  it("warnt bei abgelaufener gewählter Charge (MHD = Legedatum + 28 Tage)", () => {
    const abgelaufen = { chargeNr: "OLD", legedatum: tage(-40), rest: 5 };
    const b = bewerteFefo([abgelaufen], "OLD", JETZT);
    expect(b.stufe).toBe("warnung");
    expect(b.hinweis).toContain("abgelaufen");
  });

  it("warnt bei abgelaufener ältester Charge auch ohne Auswahl", () => {
    const abgelaufen = { chargeNr: "OLD", legedatum: tage(-40), rest: 5 };
    const b = bewerteFefo([abgelaufen, frisch], null, JETZT);
    expect(b.stufe).toBe("warnung");
  });

  it("warnt nicht, wenn die gewählte Charge unbekannt (nicht im Bestand) ist", () => {
    const b = bewerteFefo([alt], "ANDERE", JETZT);
    expect(b.hinweis).toBeNull();
  });
});
