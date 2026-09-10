import { describe, it, expect } from "vitest";
import { zahlungsuebersichtEmail, type ZahlungsuebersichtMailData } from "@/lib/email-templates";
import type { FirmaDaten } from "@/lib/firma";

const FIRMA: FirmaDaten = {
  name: "Musterhof GmbH",
  zusatz: "",
  strasse: "Hauptstraße 1",
  plzOrt: "12345 Musterstadt",
  telefon: "",
  email: "",
  steuernummer: "",
  iban: "DE12345678901234567890",
  bic: "TESTDEXX",
  bank: "Musterbank",
  emailFooterText: "",
  portalImpressumUrl: "",
  datenschutzUrl: "",
  primaryColor: "#2d6a4f",
  primaryLight: "#d1fae5",
};

function baseData(overrides: Partial<ZahlungsuebersichtMailData> = {}): ZahlungsuebersichtMailData {
  return {
    rechnungNr: "RE-2026-0755",
    rechnungDatum: new Date("2026-08-27"),
    bruttoBetrag: 610.47,
    teilzahlungen: [
      {
        datum: new Date("2026-09-10"),
        betrag: 362.7,
        notiz: "Überzahlung der Rechnungen, die am 2.9. überwiesen wurden. Anrechnung auf diese Rechnung.",
      },
    ],
    offenerBetrag: 247.77,
    firma: FIRMA,
    ...overrides,
  };
}

describe("zahlungsuebersichtEmail — reine Info-Mail, verändert NICHT die Rechnung selbst", () => {
  it("zeigt Rechnungsnummer, -datum, -betrag sowie jede Teilzahlung mit Datum/Betrag/Notiz", () => {
    const { text, html } = zahlungsuebersichtEmail(baseData());
    for (const s of ["RE-2026-0755", "27.08.2026", "610,47", "10.09.2026", "362,70", "Anrechnung auf diese Rechnung"]) {
      expect(text).toContain(s);
      expect(html).toContain(s.replace(",", ","));
    }
  });

  it("zeigt den noch offenen Restbetrag, wenn die Rechnung nicht vollständig beglichen ist", () => {
    const { text, html } = zahlungsuebersichtEmail(baseData());
    expect(text).toContain("Noch offener Betrag: 247,77");
    expect(html).toContain("Noch offener Betrag:");
    expect(html).toContain("247,77");
    expect(text).not.toContain("vollständig beglichen");
  });

  it("zeigt 'vollständig beglichen' statt eines Restbetrags, wenn offenerBetrag 0 ist", () => {
    const { text, html } = zahlungsuebersichtEmail(baseData({ offenerBetrag: 0 }));
    expect(text).toContain("Die Rechnung ist damit vollständig beglichen.");
    expect(html).toContain("vollständig beglichen");
    expect(text).not.toContain("Noch offener Betrag");
  });

  it("führt zusätzlich verrechnete Gutschriften/Forderungen als eigene Zeilen auf", () => {
    const { text, html } = zahlungsuebersichtEmail(
      baseData({
        weiterePositionen: [
          { label: "Gutschrift GS-2026-0012 verrechnet", betrag: 100 },
          { label: "Restforderung verrechnet", betrag: 50 },
        ],
      }),
    );
    expect(text).toContain("Gutschrift GS-2026-0012 verrechnet: 100,00");
    expect(text).toContain("Restforderung verrechnet: 50,00");
    expect(html).toContain("Gutschrift GS-2026-0012 verrechnet");
    expect(html).toContain("Restforderung verrechnet");
  });

  it("zeigt 'Keine Zahlungen erfasst', wenn (noch) keine Teilzahlung vorliegt", () => {
    const { html } = zahlungsuebersichtEmail(baseData({ teilzahlungen: [] }));
    expect(html).toContain("Keine Zahlungen erfasst");
  });

  it("escaped eine Notiz mit HTML-Sonderzeichen korrekt (kein Markup-Bruch/XSS)", () => {
    const { html } = zahlungsuebersichtEmail(
      baseData({
        teilzahlungen: [{ datum: new Date("2026-09-10"), betrag: 100, notiz: '<script>alert("x")</script>' }],
      }),
    );
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });
});
