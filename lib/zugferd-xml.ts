// Factur-X / ZUGFeRD BASIC-WL XML Generator
// Profil: urn:factur-x.eu:1p0:basicwl
// Keine externen Dependencies — reines TypeScript/String-Templating

export interface ZugferdData {
  rechnungNr: string;
  datum: Date;
  lieferDatum?: Date; // tatsächliches Lieferdatum (optional, sonst = datum)
  zahlungsziel: number; // Tage
  firma: {
    name: string;
    strasse: string;
    plz: string;
    ort: string;
    ustIdNr?: string;
    steuernummer?: string;
    iban?: string;
    bic?: string;
    bank?: string;
  };
  kunde: {
    name: string;
    firma?: string;
    strasse?: string;
    plz?: string;
    ort?: string;
    ustIdNr?: string;
  };
  positionen: Array<{
    bezeichnung: string;
    menge: number;
    einheit: string;
    einzelpreis: number; // netto
    mwstSatz: number; // 0 | 7 | 19
    rabattProzent?: number;
  }>;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function fmt2(n: number): string {
  return n.toFixed(2);
}

function fmtDate102(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

/** UN/ECE Recommendation 20 unit codes */
function unitCode(einheit: string): string {
  const e = einheit.toLowerCase();
  if (e === "kg" || e === "kilogramm") return "KGM";
  if (e === "t" || e === "tonne" || e === "to") return "TNE";
  if (e === "l" || e === "ltr" || e === "liter") return "LTR";
  if (e === "m" || e === "meter") return "MTR";
  if (e === "m²" || e === "m2" || e === "qm") return "MTK";
  if (e === "m³" || e === "m3" || e === "cbm") return "MTQ";
  // Default: piece / each
  return "C62";
}

/** MwSt-Kategorie nach EN 16931 */
function mwstCategory(satz: number): string {
  if (satz === 0) return "Z"; // zero rated
  return "S"; // standard
}

interface MwstGruppe {
  satz: number;
  basisBetrag: number;
  mwstBetrag: number;
}

export function generateZugferdXml(data: ZugferdData): string {
  const { rechnungNr, datum, zahlungsziel, firma, kunde, positionen } = data;

  const faelligAm = new Date(datum);
  faelligAm.setDate(faelligAm.getDate() + zahlungsziel);

  // Positionen mit berechneten Beträgen
  const positionenBerechnet = positionen.map((p, idx) => {
    const rabatt = p.rabattProzent ?? 0;
    const netto = p.menge * p.einzelpreis * (1 - rabatt / 100);
    return { ...p, idx: idx + 1, netto };
  });

  // MwSt-Gruppen aggregieren
  const mwstGruppenMap = new Map<number, MwstGruppe>();
  for (const p of positionenBerechnet) {
    const existing = mwstGruppenMap.get(p.mwstSatz) ?? { satz: p.mwstSatz, basisBetrag: 0, mwstBetrag: 0 };
    existing.basisBetrag += p.netto;
    existing.mwstBetrag += p.netto * (p.mwstSatz / 100);
    mwstGruppenMap.set(p.mwstSatz, existing);
  }
  const mwstGruppen = Array.from(mwstGruppenMap.values()).sort((a, b) => b.satz - a.satz);

  const lineTotalAmount = positionenBerechnet.reduce((s, p) => s + p.netto, 0);
  const taxBasisTotalAmount = lineTotalAmount;
  const taxTotalAmount = mwstGruppen.reduce((s, g) => s + g.mwstBetrag, 0);
  const grandTotalAmount = taxBasisTotalAmount + taxTotalAmount;
  const duePayableAmount = grandTotalAmount;

  const kundenName = esc(kunde.firma ? `${kunde.firma}` : kunde.name);

  // Seller Tax Registration
  let sellerTaxReg = "";
  if (firma.ustIdNr) {
    sellerTaxReg += `
          <ram:SpecifiedTaxRegistration>
            <ram:ID schemeID="VA">${esc(firma.ustIdNr)}</ram:ID>
          </ram:SpecifiedTaxRegistration>`;
  }
  if (firma.steuernummer) {
    sellerTaxReg += `
          <ram:SpecifiedTaxRegistration>
            <ram:ID schemeID="FC">${esc(firma.steuernummer)}</ram:ID>
          </ram:SpecifiedTaxRegistration>`;
  }

  // Buyer Tax Registration
  let buyerTaxReg = "";
  if (kunde.ustIdNr) {
    buyerTaxReg = `
          <ram:SpecifiedTaxRegistration>
            <ram:ID schemeID="VA">${esc(kunde.ustIdNr)}</ram:ID>
          </ram:SpecifiedTaxRegistration>`;
  }

  // Payment Means (IBAN/BIC)
  let paymentMeans = "";
  if (firma.iban) {
    paymentMeans = `
        <ram:SpecifiedTradeSettlementPaymentMeans>
          <ram:TypeCode>58</ram:TypeCode>
          <ram:PayeePartyCreditorFinancialAccount>
            <ram:IBANID>${esc(firma.iban.replace(/\s/g, ""))}</ram:IBANID>
          </ram:PayeePartyCreditorFinancialAccount>${
            firma.bic
              ? `
          <ram:PayeeSpecifiedCreditorFinancialInstitution>
            <ram:BICID>${esc(firma.bic)}</ram:BICID>
          </ram:PayeeSpecifiedCreditorFinancialInstitution>`
              : ""
          }
        </ram:SpecifiedTradeSettlementPaymentMeans>`;
  }

  // Trade Tax blocks
  const tradeTaxBlocks = mwstGruppen
    .map(
      (g) => `
        <ram:ApplicableTradeTax>
          <ram:CalculatedAmount>${fmt2(g.mwstBetrag)}</ram:CalculatedAmount>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:BasisAmount>${fmt2(g.basisBetrag)}</ram:BasisAmount>
          <ram:CategoryCode>${mwstCategory(g.satz)}</ram:CategoryCode>
          <ram:RateApplicablePercent>${fmt2(g.satz)}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>`
    )
    .join("");

  // Line items
  const lineItems = positionenBerechnet
    .map(
      (p) => `
      <ram:IncludedSupplyChainTradeLineItem>
        <ram:AssociatedDocumentLineDocument>
          <ram:LineID>${p.idx}</ram:LineID>
        </ram:AssociatedDocumentLineDocument>
        <ram:SpecifiedTradeProduct>
          <ram:Name>${esc(p.bezeichnung)}</ram:Name>
        </ram:SpecifiedTradeProduct>
        <ram:SpecifiedLineTradeAgreement>
          <ram:NetPriceProductTradePrice>
            <ram:ChargeAmount>${fmt2(p.einzelpreis)}</ram:ChargeAmount>
          </ram:NetPriceProductTradePrice>
        </ram:SpecifiedLineTradeAgreement>
        <ram:SpecifiedLineTradeDelivery>
          <ram:BilledQuantity unitCode="${unitCode(p.einheit)}">${fmt2(p.menge)}</ram:BilledQuantity>
        </ram:SpecifiedLineTradeDelivery>
        <ram:SpecifiedLineTradeSettlement>
          <ram:ApplicableTradeTax>
            <ram:TypeCode>VAT</ram:TypeCode>
            <ram:CategoryCode>${mwstCategory(p.mwstSatz)}</ram:CategoryCode>
            <ram:RateApplicablePercent>${fmt2(p.mwstSatz)}</ram:RateApplicablePercent>
          </ram:ApplicableTradeTax>
          <ram:SpecifiedTradeSettlementLineMonetarySummation>
            <ram:LineTotalAmount>${fmt2(p.netto)}</ram:LineTotalAmount>
          </ram:SpecifiedTradeSettlementLineMonetarySummation>
        </ram:SpecifiedLineTradeSettlement>
      </ram:IncludedSupplyChainTradeLineItem>`
    )
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice
  xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">

  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:factur-x.eu:1p0:basicwl</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>

  <rsm:ExchangedDocument>
    <ram:ID>${esc(rechnungNr)}</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${fmtDate102(datum)}</udt:DateTimeString>
    </ram:IssueDateTime>
  </rsm:ExchangedDocument>

  <rsm:SupplyChainTradeTransaction>

    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:Name>${esc(firma.name)}</ram:Name>
        <ram:PostalTradeAddress>
          <ram:LineOne>${esc(firma.strasse)}</ram:LineOne>
          <ram:PostcodeCode>${esc(firma.plz)}</ram:PostcodeCode>
          <ram:CityName>${esc(firma.ort)}</ram:CityName>
          <ram:CountryID>DE</ram:CountryID>
        </ram:PostalTradeAddress>${sellerTaxReg}
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>${kundenName}</ram:Name>${
    kunde.firma
      ? `
        <ram:SpecifiedLegalOrganization>
          <ram:TradingBusinessName>${esc(kunde.name)}</ram:TradingBusinessName>
        </ram:SpecifiedLegalOrganization>`
      : ""
  }${
    kunde.strasse || kunde.plz || kunde.ort
      ? `
        <ram:PostalTradeAddress>${kunde.strasse ? `\n          <ram:LineOne>${esc(kunde.strasse)}</ram:LineOne>` : ""}${kunde.plz ? `\n          <ram:PostcodeCode>${esc(kunde.plz)}</ram:PostcodeCode>` : ""}${kunde.ort ? `\n          <ram:CityName>${esc(kunde.ort)}</ram:CityName>` : ""}
          <ram:CountryID>DE</ram:CountryID>
        </ram:PostalTradeAddress>`
      : ""
  }${buyerTaxReg}
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>

    <ram:ApplicableHeaderTradeDelivery>
      <ram:ActualDeliverySupplyChainEvent>
        <ram:OccurrenceDateTime>
          <udt:DateTimeString format="102">${fmtDate102(data.lieferDatum ?? data.datum)}</udt:DateTimeString>
        </ram:OccurrenceDateTime>
      </ram:ActualDeliverySupplyChainEvent>
    </ram:ApplicableHeaderTradeDelivery>

    <ram:ApplicableHeaderTradeSettlement>
      <ram:PaymentReference>${esc(rechnungNr)}</ram:PaymentReference>
      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>${paymentMeans}${tradeTaxBlocks}
      <ram:SpecifiedTradePaymentTerms>
        <ram:DueDateDateTime>
          <udt:DateTimeString format="102">${fmtDate102(faelligAm)}</udt:DateTimeString>
        </ram:DueDateDateTime>
      </ram:SpecifiedTradePaymentTerms>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${fmt2(lineTotalAmount)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${fmt2(taxBasisTotalAmount)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">${fmt2(taxTotalAmount)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${fmt2(grandTotalAmount)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${fmt2(duePayableAmount)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
${lineItems}
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;

  return xml;
}
