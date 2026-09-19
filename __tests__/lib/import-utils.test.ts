import { describe, it, expect } from "vitest";
import { normalizeArtikelnummer } from "@/lib/import-utils";

// Regressionstest für GlitchTip AGRI-14 ("Unique constraint failed on the fields:
// (`artikelnummer`)", 129 Vorkommen): der Artikel-Import erkannte Mengenstaffel-/
// Preisvariante-Zeilen einer Preisliste (gleiche Artikelnummer, abweichender Name, z.B.
// "… ab 500 kg"/"… ab 750 kg") nicht als Update, weil der Duplikat-Check nur nach normalisiertem
// NAMEN suchte — `artikel.create()` scheiterte dadurch an der @unique-Regel auf Artikelnummer.
// normalizeArtikelnummer() ist die Grundlage des zusätzlichen, in
// app/api/artikel/import/route.ts eingebauten Artikelnummer-Index.
describe("normalizeArtikelnummer", () => {
  it("entfernt Leerzeichen und Bindestriche und vereinheitlicht Groß-/Kleinschreibung", () => {
    expect(normalizeArtikelnummer(" ab-100 ")).toBe("AB100");
    expect(normalizeArtikelnummer("12 345")).toBe("12345");
    expect(normalizeArtikelnummer("A-1000")).toBe(normalizeArtikelnummer("a 1000"));
  });

  it("liefert für zwei unterschiedliche Nummern auch unterschiedliche Ergebnisse", () => {
    expect(normalizeArtikelnummer("A-100")).not.toBe(normalizeArtikelnummer("A-200"));
  });
});
