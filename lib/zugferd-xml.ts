// Factur-X / ZUGFeRD XML Generator (Rechnungen mit Positionen)
// Profil: urn:cen.eu:en16931:2017 (EN 16931 / "COMFORT") — BASIC-WL ("Without Lines")
// verbietet laut Spezifikation IncludedSupplyChainTradeLineItem-Elemente; da dieser
// Generator immer Positionen ausgibt, ist EN 16931 das kleinste zulässige Profil.
// Nur externe Abhängigkeit: rundeKaufmaennisch() aus lib/utils.ts (kein XML/PDF-Fremdpaket).
import { rundeKaufmaennisch } from "@/lib/utils";

/** GuidelineSpecifiedDocumentContextParameter-ID von generateZugferdXml() — einzige Quelle der
 *  Wahrheit, auch für die PDF/A-3-XMP-Metadaten in lib/zugferd-embed.ts, damit XML-Inhalt und
 *  die außen am PDF deklarierte Konformitätsstufe nie auseinanderlaufen können. */
export const ZUGFERD_PROFILE_ID = "urn:cen.eu:en16931:2017";
/** `fx:ConformanceLevel`-Wert laut Factur-X-Spezifikation für obiges Profil. */
export const ZUGFERD_CONFORMANCE_LEVEL = "EN 16931";

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

/** Geldbetrag: kaufmännisch auf Cent gerundet (nicht `toFixed`, das nur die Anzeige kürzt, ohne rundeKaufmaennisch()s Float-Restwert-Schutz — siehe lib/utils.ts). */
function money(n: number): string {
  return rundeKaufmaennisch(n, 2).toFixed(2);
}

/** Prozentsatz (MwSt-Satz) — keine Geldbetrag-Rundung nötig, die Sätze (0/7/19) sind bereits exakt. */
function fmtPercent(n: number): string {
  return n.toFixed(2);
}

/** Mengenangabe mit 3 Nachkommastellen (BilledQuantity erlaubt Dezimalstellen). */
function fmtQty(n: number): string {
  return n.toFixed(3);
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

  // Positionen mit berechneten Beträgen. netPreis = Preis je Einheit NACH Rabatt (BT-146 —
  // "Item net price" ist per EN-16931-Definition bereits der rabattierte Einzelpreis), auf Cent
  // gerundet — sonst weicht NetPriceProductTradePrice × Menge vom gerundeten LineTotalAmount ab.
  const positionenBerechnet = positionen.map((p, idx) => {
    const rabatt = p.rabattProzent ?? 0;
    const netPreis = rundeKaufmaennisch(p.einzelpreis * (1 - rabatt / 100), 2);
    const netto = rundeKaufmaennisch(p.menge * netPreis, 2);
    return { ...p, idx: idx + 1, netPreis, netto };
  });

  // MwSt-Gruppen aggregieren: Steuerbasis je Satz = Summe der (bereits centgerundeten)
  // Positions-Nettobeträge; die MwSt selbst wird EINMAL aus dieser Summe berechnet (nicht aus
  // aufsummierten, je Position vorab gerundeten Einzelsteuerbeträgen) — sonst können bei vielen
  // Positionen Rundungsdifferenzen von mehreren Cent entstehen (BR-CO-17).
  const mwstGruppenMap = new Map<number, MwstGruppe>();
  for (const p of positionenBerechnet) {
    const existing = mwstGruppenMap.get(p.mwstSatz) ?? { satz: p.mwstSatz, basisBetrag: 0, mwstBetrag: 0 };
    existing.basisBetrag += p.netto;
    mwstGruppenMap.set(p.mwstSatz, existing);
  }
  for (const g of mwstGruppenMap.values()) {
    g.basisBetrag = rundeKaufmaennisch(g.basisBetrag, 2);
    g.mwstBetrag = rundeKaufmaennisch(g.basisBetrag * (g.satz / 100), 2);
  }
  const mwstGruppen = Array.from(mwstGruppenMap.values()).sort((a, b) => b.satz - a.satz);

  const lineTotalAmount = rundeKaufmaennisch(positionenBerechnet.reduce((s, p) => s + p.netto, 0), 2);
  const taxBasisTotalAmount = lineTotalAmount;
  const taxTotalAmount = rundeKaufmaennisch(mwstGruppen.reduce((s, g) => s + g.mwstBetrag, 0), 2);
  const grandTotalAmount = rundeKaufmaennisch(taxBasisTotalAmount + taxTotalAmount, 2);
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
          <ram:CalculatedAmount>${money(g.mwstBetrag)}</ram:CalculatedAmount>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:BasisAmount>${money(g.basisBetrag)}</ram:BasisAmount>
          <ram:CategoryCode>${mwstCategory(g.satz)}</ram:CategoryCode>
          <ram:RateApplicablePercent>${fmtPercent(g.satz)}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>`
    )
    .join("");

  // Line items. NetPriceProductTradePrice ist BT-146 (Einzelpreis NACH Rabatt) — dieselbe
  // Basis, aus der LineTotalAmount berechnet wurde (netPreis × Menge = netto), sonst driften
  // Einzelpreis und Positionssumme auseinander (siehe Kommentar bei positionenBerechnet oben).
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
            <ram:ChargeAmount>${money(p.netPreis)}</ram:ChargeAmount>
          </ram:NetPriceProductTradePrice>
        </ram:SpecifiedLineTradeAgreement>
        <ram:SpecifiedLineTradeDelivery>
          <ram:BilledQuantity unitCode="${unitCode(p.einheit)}">${fmtQty(p.menge)}</ram:BilledQuantity>
        </ram:SpecifiedLineTradeDelivery>
        <ram:SpecifiedLineTradeSettlement>
          <ram:ApplicableTradeTax>
            <ram:TypeCode>VAT</ram:TypeCode>
            <ram:CategoryCode>${mwstCategory(p.mwstSatz)}</ram:CategoryCode>
            <ram:RateApplicablePercent>${fmtPercent(p.mwstSatz)}</ram:RateApplicablePercent>
          </ram:ApplicableTradeTax>
          <ram:SpecifiedTradeSettlementLineMonetarySummation>
            <ram:LineTotalAmount>${money(p.netto)}</ram:LineTotalAmount>
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
      <ram:ID>${ZUGFERD_PROFILE_ID}</ram:ID>
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
${lineItems}
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
        <ram:LineTotalAmount>${money(lineTotalAmount)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${money(taxBasisTotalAmount)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">${money(taxTotalAmount)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${money(grandTotalAmount)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${money(duePayableAmount)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;

  return xml;
}

// ── Factur-X BASIC-WL (Without Lines) für Eingangsrechnungen ──────────────────
// Seller = Lieferant, Buyer = eigene Firma
// Keine IncludedSupplyChainTradeLineItem erforderlich

export interface ZugferdSimpleData {
  rechnungNr: string;
  datum: Date;
  faelligAm?: Date;
  seller: {
    name: string;
    strasse?: string;
    plz?: string;
    ort?: string;
    ustIdNr?: string;
  };
  buyer: {
    name: string;
    strasse?: string;
    plz?: string;
    ort?: string;
    ustIdNr?: string;
    steuernummer?: string;
    iban?: string;
    bic?: string;
  };
  betragNetto: number;
  mwstSatz: number; // 0 | 7 | 19
}

export function generateZugferdXmlSimple(d: ZugferdSimpleData): string {
  const mwstBetrag = d.betragNetto * (d.mwstSatz / 100);
  const brutto = d.betragNetto + mwstBetrag;
  const cat = mwstCategory(d.mwstSatz);

  const faellig = d.faelligAm ?? new Date(d.datum.getTime() + 30 * 86400000);

  function addrBlock(p: { strasse?: string; plz?: string; ort?: string }): string {
    if (!p.strasse && !p.plz && !p.ort) return "";
    return `
        <ram:PostalTradeAddress>${p.strasse ? `\n          <ram:LineOne>${esc(p.strasse)}</ram:LineOne>` : ""}${p.plz ? `\n          <ram:PostcodeCode>${esc(p.plz)}</ram:PostcodeCode>` : ""}${p.ort ? `\n          <ram:CityName>${esc(p.ort)}</ram:CityName>` : ""}
          <ram:CountryID>DE</ram:CountryID>
        </ram:PostalTradeAddress>`;
  }

  const sellerTaxReg = d.seller.ustIdNr
    ? `\n          <ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${esc(d.seller.ustIdNr)}</ram:ID></ram:SpecifiedTaxRegistration>`
    : "";

  let buyerTaxReg = "";
  if (d.buyer.ustIdNr) buyerTaxReg += `\n          <ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${esc(d.buyer.ustIdNr)}</ram:ID></ram:SpecifiedTaxRegistration>`;
  if (d.buyer.steuernummer) buyerTaxReg += `\n          <ram:SpecifiedTaxRegistration><ram:ID schemeID="FC">${esc(d.buyer.steuernummer)}</ram:ID></ram:SpecifiedTaxRegistration>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
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
    <ram:ID>${esc(d.rechnungNr)}</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${fmtDate102(d.datum)}</udt:DateTimeString>
    </ram:IssueDateTime>
  </rsm:ExchangedDocument>

  <rsm:SupplyChainTradeTransaction>

    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:Name>${esc(d.seller.name)}</ram:Name>${addrBlock(d.seller)}${sellerTaxReg}
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>${esc(d.buyer.name)}</ram:Name>${addrBlock(d.buyer)}${buyerTaxReg}
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>

    <ram:ApplicableHeaderTradeDelivery/>

    <ram:ApplicableHeaderTradeSettlement>
      <ram:PaymentReference>${esc(d.rechnungNr)}</ram:PaymentReference>
      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>${money(mwstBetrag)}</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:BasisAmount>${money(d.betragNetto)}</ram:BasisAmount>
        <ram:CategoryCode>${cat}</ram:CategoryCode>
        <ram:RateApplicablePercent>${fmtPercent(d.mwstSatz)}</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>
      <ram:SpecifiedTradePaymentTerms>
        <ram:DueDateDateTime>
          <udt:DateTimeString format="102">${fmtDate102(faellig)}</udt:DateTimeString>
        </ram:DueDateDateTime>
      </ram:SpecifiedTradePaymentTerms>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${money(d.betragNetto)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${money(d.betragNetto)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">${money(mwstBetrag)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${money(brutto)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${money(brutto)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>

  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;
}
