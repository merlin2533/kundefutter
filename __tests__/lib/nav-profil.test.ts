import { describe, it, expect } from "vitest";
import { wendeNavProfilAn, type NavProfilGroup } from "@/lib/nav-profil";

const GRUPPEN: NavProfilGroup[] = [
  { label: "Dashboard", href: "/" },
  {
    label: "Lieferungen",
    children: [
      { href: "/lieferungen", label: "Lieferungen", section: "Lieferungen" },
      { href: "/eiersortierung", label: "Ei-Sortierprotokoll", section: "Eierhandel" },
      { href: "/meldepflichten", label: "Meldepflichten", section: "Eierhandel" },
      { href: "/bestellliste", label: "Bestellliste", section: "Einkauf" },
    ],
  },
  { label: "Pflanze & Tier", children: [{ href: "/rationsberechnung", label: "Rationsberechnung" }] },
  { label: "Finanzen", children: [{ href: "/rechnungen", label: "Rechnungen" }] },
];

describe("wendeNavProfilAn", () => {
  it("gibt die Gruppen unverändert zurück, wenn kein Profil gesetzt ist", () => {
    expect(wendeNavProfilAn(GRUPPEN, undefined)).toBe(GRUPPEN);
  });

  it("benennt Gruppen um", () => {
    const out = wendeNavProfilAn(GRUPPEN, { gruppenLabels: { "Pflanze & Tier": "Tier & Futter" } });
    expect(out.map((g) => g.label)).toContain("Tier & Futter");
    expect(out.map((g) => g.label)).not.toContain("Pflanze & Tier");
  });

  it("löst eine Section in eine eigene Gruppe heraus und lässt die Quellgruppe intakt", () => {
    const out = wendeNavProfilAn(GRUPPEN, {
      eigeneGruppen: [{ label: "Eierhandel", ausGruppe: "Lieferungen", section: "Eierhandel" }],
    });
    const eier = out.find((g) => g.label === "Eierhandel");
    expect(eier?.children?.map((c) => c.href)).toEqual(["/eiersortierung", "/meldepflichten"]);

    const quelle = out.find((g) => g.label === "Lieferungen");
    expect(quelle?.children?.map((c) => c.href)).toEqual(["/lieferungen", "/bestellliste"]);
    // direkt hinter der Quellgruppe einsortiert
    expect(out.indexOf(eier!)).toBe(out.indexOf(quelle!) + 1);
  });

  it("absorbiert mit auchAusGruppe eine zweite Gruppe und entfernt sie", () => {
    const out = wendeNavProfilAn(GRUPPEN, {
      eigeneGruppen: [
        { label: "Eier & Futter", ausGruppe: "Lieferungen", section: "Eierhandel", auchAusGruppe: "Pflanze & Tier" },
      ],
    });
    const neu = out.find((g) => g.label === "Eier & Futter");
    expect(neu?.children?.map((c) => c.href)).toEqual([
      "/eiersortierung",
      "/meldepflichten",
      "/rationsberechnung",
    ]);
    expect(out.find((g) => g.label === "Pflanze & Tier")).toBeUndefined();
    expect(out.find((g) => g.label === "Lieferungen")?.children?.map((c) => c.href))
      .toEqual(["/lieferungen", "/bestellliste"]);
  });

  it("lässt eine Section ohne Treffer unangetastet (keine leere Gruppe)", () => {
    const out = wendeNavProfilAn(GRUPPEN, {
      eigeneGruppen: [{ label: "Nichts", ausGruppe: "Finanzen", section: "GibtEsNicht" }],
    });
    expect(out.find((g) => g.label === "Nichts")).toBeUndefined();
    expect(out).toHaveLength(GRUPPEN.length);
  });

  it("sortiert genannte Gruppen nach vorn und hängt ungenannte hinten an", () => {
    const out = wendeNavProfilAn(GRUPPEN, { reihenfolge: ["Finanzen", "Dashboard"] });
    expect(out.map((g) => g.label)).toEqual(["Finanzen", "Dashboard", "Lieferungen", "Pflanze & Tier"]);
  });

  it("greift beim Sortieren auf das bereits umbenannte Label zu", () => {
    const out = wendeNavProfilAn(GRUPPEN, {
      gruppenLabels: { "Pflanze & Tier": "Tier & Futter" },
      reihenfolge: ["Tier & Futter"],
    });
    expect(out[0].label).toBe("Tier & Futter");
  });

  it("verändert die übergebenen Gruppen nicht (kein Mutieren des Moduls)", () => {
    const vorher = JSON.stringify(GRUPPEN);
    wendeNavProfilAn(GRUPPEN, {
      eigeneGruppen: [{ label: "Eierhandel", ausGruppe: "Lieferungen", section: "Eierhandel" }],
      gruppenLabels: { Finanzen: "Buchhaltung" },
    });
    expect(JSON.stringify(GRUPPEN)).toBe(vorher);
  });
});
