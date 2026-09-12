import { describe, it, expect } from "vitest";
import { BETRIEBSARTEN, MODUL_BEREICHE, MODUL_LABELS, findeBetriebsart, navProfilFuer, parseBetriebsart } from "@/lib/betriebsart";
import { DEFAULT_MODUL_CONFIG, MODUL_KEYS } from "@/lib/modul-keys";

describe("parseBetriebsart", () => {
  it("fällt bei fehlendem oder unbekanntem Wert auf agrarhandel zurück", () => {
    expect(parseBetriebsart(null)).toBe("agrarhandel");
    expect(parseBetriebsart(undefined)).toBe("agrarhandel");
    expect(parseBetriebsart("")).toBe("agrarhandel");
    expect(parseBetriebsart("hühnerhof")).toBe("agrarhandel");
  });

  it("erkennt die definierten Betriebsarten", () => {
    for (const art of BETRIEBSARTEN) expect(parseBetriebsart(art.key)).toBe(art.key);
  });
});

describe("BETRIEBSARTEN", () => {
  it("setzt ausschließlich bekannte Modul-Keys", () => {
    for (const art of BETRIEBSARTEN) {
      for (const key of Object.keys(art.config)) {
        expect(MODUL_KEYS).toContain(key);
      }
    }
  });

  it("eierbetrieb schaltet Eierhandel an und die Ackerbau-Module aus", () => {
    const art = findeBetriebsart("eierbetrieb")!;
    expect(art.config.eierhandel).toBe(true);
    expect(art.config.bodenproben).toBe(false);
    expect(art.config.psm_ausbringung).toBe(false);
    expect(art.config.sortenversuche).toBe(false);
    expect(art.config.rationsberechnung).toBe(true);
  });

  it("saatguthandel schaltet Pflanzenbau an und Tier/Eier aus", () => {
    const art = findeBetriebsart("saatguthandel")!;
    expect(art.config.sortenversuche).toBe(true);
    expect(art.config.bodenproben).toBe(true);
    expect(art.config.rationsberechnung).toBe(false);
    expect(art.config.eierhandel).toBe(false);
  });

  it("agrarhandel entspricht dem heutigen Standard (keine Verhaltensänderung für Bestandskunden)", () => {
    const art = findeBetriebsart("agrarhandel")!;
    for (const [key, wert] of Object.entries(art.config)) {
      expect(wert).toBe(DEFAULT_MODUL_CONFIG[key as keyof typeof DEFAULT_MODUL_CONFIG]);
    }
  });

  it("individuell ändert nichts und hat kein Nav-Profil", () => {
    expect(findeBetriebsart("individuell")!.config).toEqual({});
    expect(navProfilFuer("individuell")).toBeUndefined();
    expect(navProfilFuer("agrarhandel")).toBeUndefined();
  });

  it("das Eierbetrieb-Nav-Profil nennt jede herausgelöste Gruppe auch in der Reihenfolge", () => {
    const profil = navProfilFuer("eierbetrieb")!;
    for (const g of profil.eigeneGruppen ?? []) {
      expect(profil.reihenfolge).toContain(g.label);
    }
    // umbenannte Gruppen müssen unter ihrem NEUEN Namen sortiert werden
    for (const neu of Object.values(profil.gruppenLabels ?? {})) {
      expect(profil.reihenfolge).toContain(neu);
    }
  });
});

describe("MODUL_BEREICHE", () => {
  it("ordnet jedes Modul genau einem Bereich zu", () => {
    const zugeordnet = MODUL_BEREICHE.flatMap((b) => b.module);
    expect([...zugeordnet].sort()).toEqual([...MODUL_KEYS].sort());
  });

  it("hat für jedes Modul eine Beschriftung", () => {
    for (const key of MODUL_KEYS) expect(MODUL_LABELS[key]?.label).toBeTruthy();
  });
});
