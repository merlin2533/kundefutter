import { describe, it, expect } from "vitest";
import { DEFAULT_MODUL_CONFIG, MODUL_KEYS, modulConfigAusMap, modulSettingKey } from "@/lib/modul-keys";

describe("modulConfigAusMap", () => {
  it("liefert für eine leere Map exakt die Standardwerte", () => {
    expect(modulConfigAusMap({})).toEqual(DEFAULT_MODUL_CONFIG);
    expect(modulConfigAusMap(null)).toEqual(DEFAULT_MODUL_CONFIG);
  });

  it('wertet "false" und "0" als aus, alles andere als an', () => {
    expect(modulConfigAusMap({ "modul.bodenproben": "false" }).bodenproben).toBe(false);
    expect(modulConfigAusMap({ "modul.bodenproben": "0" }).bodenproben).toBe(false);
    expect(modulConfigAusMap({ "modul.eierhandel": "true" }).eierhandel).toBe(true);
    expect(modulConfigAusMap({ "modul.eierhandel": "1" }).eierhandel).toBe(true);
  });

  it("akzeptiert Keys mit und ohne modul.-Präfix", () => {
    expect(modulConfigAusMap({ eierhandel: "true" }).eierhandel).toBe(true);
  });

  it("lässt nicht genannte Module auf ihrem Standardwert", () => {
    const config = modulConfigAusMap({ "modul.bodenproben": "false" });
    expect(config.rationsberechnung).toBe(DEFAULT_MODUL_CONFIG.rationsberechnung);
  });

  it("MODUL_KEYS deckt jedes Feld der Standardkonfiguration ab", () => {
    expect([...MODUL_KEYS].sort()).toEqual(Object.keys(DEFAULT_MODUL_CONFIG).sort());
  });

  it("modulSettingKey bildet den Einstellung-Key", () => {
    expect(modulSettingKey("eierhandel")).toBe("modul.eierhandel");
  });
});
