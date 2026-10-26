import { describe, it, expect } from "vitest";
import { generiereSepaXml } from "@/lib/sepa";

describe("generiereSepaXml", () => {
  it("bildet CtrlSum aus auf Cent gerundeten Einzelbeträgen (kein Float-Drift)", () => {
    const zahlungen = Array.from({ length: 10 }, (_, i) => ({
      empfaengerName: `Kunde ${i}`,
      iban: "DE89370400440532013000",
      betrag: 0.1,
      verwendungszweck: "Test",
      referenz: `R${i}`,
    }));
    const xml = generiereSepaXml("Firma", "DE89370400440532013000", zahlungen, "2026-10-16");
    expect(xml).toContain("<CtrlSum>1.00</CtrlSum>");
    expect(xml).toContain("<NbOfTxs>10</NbOfTxs>");
  });
});
