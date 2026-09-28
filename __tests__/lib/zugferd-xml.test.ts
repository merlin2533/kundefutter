import { describe, it, expect } from "vitest";
import { XMLParser } from "fast-xml-parser";
import { generateZugferdXml, generateZugferdXmlSimple, ZUGFERD_PROFILE_ID, ZUGFERD_CONFORMANCE_LEVEL, type ZugferdData } from "@/lib/zugferd-xml";

// parseTagValue:false, damit "18.00" als String erhalten bleibt (nicht zu 18 geparst wird) —
// die exakte Nachkommastellen-Formatierung ist genau das, was diese Tests verifizieren.
const parser = new XMLParser({ removeNSPrefix: true, ignoreAttributes: false, parseTagValue: false });

function baueBeispiel(): ZugferdData {
  return {
    rechnungNr: "RE-2026-0042",
    datum: new Date("2026-01-10"),
    zahlungsziel: 14,
    firma: {
      name: "Musterhof GmbH",
      strasse: "Feldweg 1",
      plz: "12345",
      ort: "Musterstadt",
      ustIdNr: "DE123456789",
      iban: "DE12345678901234567890",
      bic: "TESTDE",
      bank: "Musterbank",
    },
    kunde: { name: "Max Kunde" },
    positionen: [
      // Mengenstaffel-Fall: einzelpreis ist der LISTENPREIS, rabattProzent der echte Rabatt
      // (Staffelpreis 18 € = 20 € × (1-10%)) — genau das Szenario aus dem Doppelrabatt-Fix.
      { bezeichnung: "Dünger", menge: 3, einheit: "kg", einzelpreis: 20, mwstSatz: 19, rabattProzent: 10 },
      { bezeichnung: "Saatgut", menge: 2, einheit: "Stück", einzelpreis: 5, mwstSatz: 7, rabattProzent: 0 },
    ],
  };
}

describe("generateZugferdXml", () => {
  it("deklariert das EN-16931-Profil (nicht BASIC-WL, das keine Positionen erlaubt)", () => {
    const xml = generateZugferdXml(baueBeispiel());
    const parsed = parser.parse(xml);
    expect(parsed.CrossIndustryInvoice.ExchangedDocumentContext.GuidelineSpecifiedDocumentContextParameter.ID).toBe(ZUGFERD_PROFILE_ID);
    expect(ZUGFERD_PROFILE_ID).toBe("urn:cen.eu:en16931:2017");
    expect(ZUGFERD_CONFORMANCE_LEVEL).toBe("EN 16931");
  });

  it("Regression: Positionen stehen als erstes Kind von SupplyChainTradeTransaction, vor ApplicableHeaderTradeAgreement", () => {
    const xml = generateZugferdXml(baueBeispiel());
    const posIdx = xml.indexOf("<ram:IncludedSupplyChainTradeLineItem>");
    const agreementIdx = xml.indexOf("<ram:ApplicableHeaderTradeAgreement>");
    expect(posIdx).toBeGreaterThan(-1);
    expect(agreementIdx).toBeGreaterThan(-1);
    expect(posIdx).toBeLessThan(agreementIdx);
  });

  it("Regression: NetPriceProductTradePrice ist der Preis NACH Rabatt, sodass Einzelpreis × Menge exakt LineTotalAmount ergibt", () => {
    const xml = generateZugferdXml(baueBeispiel());
    const parsed = parser.parse(xml);
    const items = parsed.CrossIndustryInvoice.SupplyChainTradeTransaction.IncludedSupplyChainTradeLineItem;
    expect(items).toHaveLength(2);

    // Position 1: 20 € Liste, 10 % Rabatt -> 18 € netto/Einheit, 3 Stück -> 54,00 €
    expect(items[0].SpecifiedLineTradeAgreement.NetPriceProductTradePrice.ChargeAmount).toBe("18.00");
    expect(items[0].SpecifiedLineTradeSettlement.SpecifiedTradeSettlementLineMonetarySummation.LineTotalAmount).toBe("54.00");

    // Position 2: kein Rabatt -> 5,00 €/Einheit, 2 Stück -> 10,00 €
    expect(items[1].SpecifiedLineTradeAgreement.NetPriceProductTradePrice.ChargeAmount).toBe("5.00");
    expect(items[1].SpecifiedLineTradeSettlement.SpecifiedTradeSettlementLineMonetarySummation.LineTotalAmount).toBe("10.00");
  });

  it("Regression: Kopf-Summen sind korrekt gruppiert und kaufmännisch gerundet aggregiert", () => {
    const xml = generateZugferdXml(baueBeispiel());
    const parsed = parser.parse(xml);
    const settlement = parsed.CrossIndustryInvoice.SupplyChainTradeTransaction.ApplicableHeaderTradeSettlement;
    const summe = settlement.SpecifiedTradeSettlementHeaderMonetarySummation;

    // Netto: 54,00 + 10,00 = 64,00 €
    expect(summe.LineTotalAmount).toBe("64.00");
    expect(summe.TaxBasisTotalAmount).toBe("64.00");
    // MwSt: 54 × 19% = 10,26 €; 10 × 7% = 0,70 € -> 10,96 €
    expect(summe.TaxTotalAmount["#text"] ?? summe.TaxTotalAmount).toBe("10.96");
    // Brutto: 64,00 + 10,96 = 74,96 €
    expect(summe.GrandTotalAmount).toBe("74.96");
    expect(summe.DuePayableAmount).toBe("74.96");

    const taxBlocks = settlement.ApplicableTradeTax;
    expect(taxBlocks).toHaveLength(2);
    const satz19 = taxBlocks.find((t: { RateApplicablePercent: string }) => t.RateApplicablePercent === "19.00");
    const satz7 = taxBlocks.find((t: { RateApplicablePercent: string }) => t.RateApplicablePercent === "7.00");
    expect(satz19.BasisAmount).toBe("54.00");
    expect(satz19.CalculatedAmount).toBe("10.26");
    expect(satz7.BasisAmount).toBe("10.00");
    expect(satz7.CalculatedAmount).toBe("0.70");
  });

  it("liefert Verkäuferdaten (Name/Adresse/USt-IdNr) korrekt in die SellerTradeParty", () => {
    const xml = generateZugferdXml(baueBeispiel());
    const parsed = parser.parse(xml);
    const seller = parsed.CrossIndustryInvoice.SupplyChainTradeTransaction.ApplicableHeaderTradeAgreement.SellerTradeParty;
    expect(seller.Name).toBe("Musterhof GmbH");
    expect(seller.SpecifiedTaxRegistration.ID["#text"] ?? seller.SpecifiedTaxRegistration.ID).toBe("DE123456789");
  });
});

describe("generateZugferdXmlSimple (BASIC-WL für Eingangsrechnungen ohne Positionen)", () => {
  it("bleibt beim BASIC-WL-Profil, da hier bewusst keine Positionen ausgegeben werden", () => {
    const xml = generateZugferdXmlSimple({
      rechnungNr: "ER-2026-0001",
      datum: new Date("2026-01-10"),
      seller: { name: "Lieferant GmbH" },
      buyer: { name: "Musterhof GmbH" },
      betragNetto: 100,
      mwstSatz: 19,
    });
    expect(xml).toContain("urn:factur-x.eu:1p0:basicwl");
    expect(xml).not.toContain("IncludedSupplyChainTradeLineItem");
  });
});
