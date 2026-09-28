import { describe, it, expect } from "vitest";
import { berechneEierMhd, eierKennzeichnungZeile } from "@/lib/eier-mhd";

describe("eierKennzeichnungZeile", () => {
  it("liefert einen leeren String, wenn keine Güteklasse gesetzt ist (Position ist kein Ei)", () => {
    expect(eierKennzeichnungZeile({})).toBe("");
    expect(eierKennzeichnungZeile({ gewichtsklasse: "M" })).toBe("");
  });

  it("baut die Zeile aus den gesetzten Basisfeldern", () => {
    expect(
      eierKennzeichnungZeile({
        gueteklasse: "A",
        gewichtsklasse: "M",
        erzeugercode: "1-DE-0123451",
        legedatum: "2026-09-14",
      }),
    ).toBe(
      `Güteklasse A · Gewichtsklasse M · Erzeugercode 1-DE-0123451 · MHD ${berechneEierMhd(new Date("2026-09-14")).toLocaleDateString("de-DE")}`,
    );
  });

  it("hängt „lose Ware“ bzw. „verpackt“ an, je nach verpackungsart", () => {
    expect(eierKennzeichnungZeile({ gueteklasse: "A", verpackungsart: "lose" })).toBe("Güteklasse A · lose Ware");
    expect(eierKennzeichnungZeile({ gueteklasse: "A", verpackungsart: "verpackt" })).toBe("Güteklasse A · verpackt");
    // unbekannter/nicht gesetzter Wert erzeugt keinen Teil
    expect(eierKennzeichnungZeile({ gueteklasse: "A", verpackungsart: null })).toBe("Güteklasse A");
  });

  it("hängt die Packstellen-Zulassungsnummer IMMER an, wenn gesetzt — unabhängig von verpackungsart", () => {
    expect(eierKennzeichnungZeile({ gueteklasse: "A", verpackungsart: "verpackt" }, "DE-1234")).toBe(
      "Güteklasse A · verpackt · Packstellen-Zulassungsnr. DE-1234",
    );
    expect(eierKennzeichnungZeile({ gueteklasse: "A", verpackungsart: "lose" }, "DE-1234")).toBe(
      "Güteklasse A · lose Ware · Packstellen-Zulassungsnr. DE-1234",
    );
    expect(eierKennzeichnungZeile({ gueteklasse: "A" }, "DE-1234")).toBe("Güteklasse A · Packstellen-Zulassungsnr. DE-1234");
  });

  it("lässt die Zulassungsnummer bei leerem/nicht gesetztem Wert weg", () => {
    expect(eierKennzeichnungZeile({ gueteklasse: "A" }, "")).toBe("Güteklasse A");
    expect(eierKennzeichnungZeile({ gueteklasse: "A" }, null)).toBe("Güteklasse A");
    expect(eierKennzeichnungZeile({ gueteklasse: "A" })).toBe("Güteklasse A");
  });
});
