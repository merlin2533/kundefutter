// ZUGFeRD / Factur-X XML Parser für eingehende Lieferantenrechnungen
// Unterstützt: MINIMUM, BASIC-WL, EN 16931, EXTENDED Profile
// Keine externen Dependencies — reines Regex/String-Parsing

export interface ZugferdParsed {
  rechnungNummer: string | null;
  datum: string | null;       // ISO: YYYY-MM-DD
  faelligAm: string | null;  // ISO: YYYY-MM-DD
  lieferantName: string | null;
  iban: string | null;
  bic: string | null;
  betragNetto: number | null;
  mwstBetrag: number | null;
  mwstSatz: number | null;
  betragBrutto: number | null;
}

/** Liest den Inhalt eines XML-Tags (ohne Namespace-Präfix-Matching) */
function extractTag(xml: string, localName: string): string | null {
  // Matches <ram:ID>, <udt:ID>, <ID> etc. – ignoriert Namespace-Präfix
  const re = new RegExp(`<[^:>]*:?${localName}[^>]*>([^<]+)<`, "i");
  const m = xml.match(re);
  return m ? m[1].trim() : null;
}

/** Liest ein Tag mit bestimmtem Elterntag-Kontext.
 * Lookahead (?=[\s>]) stellt sicher, dass der Tagname nicht nur ein Präfix ist
 * (z.B. "ExchangedDocument" darf nicht "ExchangedDocumentContext" treffen). */
function extractInContext(xml: string, parentLocalName: string, childLocalName: string): string | null {
  const parentRe = new RegExp(
    `<[^:>]*:?${parentLocalName}(?=[\\s>])[^>]*>([\\s\\S]*?)<\\/[^:>]*:?${parentLocalName}(?=[\\s>/>])`,
    "i"
  );
  const parentMatch = xml.match(parentRe);
  if (!parentMatch) return null;
  return extractTag(parentMatch[1], childLocalName);
}

/** Konvertiert ZUGFeRD-Datum (YYYYMMDD) nach ISO (YYYY-MM-DD) */
function parseDate102(s: string | null): string | null {
  if (!s) return null;
  const clean = s.replace(/\D/g, "");
  if (clean.length !== 8) return null;
  return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`;
}

/** Extrahiert ZUGFeRD-Dateiinhalt aus PDF-Binärdaten (heuristisch) */
export function extractXmlFromPdf(pdfBuffer: Buffer): string | null {
  // ZUGFeRD-XML ist im PDF als Datei-Anlage eingebettet.
  // Das XML beginnt immer mit <?xml und enthält factur-x oder zugferd Namespace-Marker.
  const pdfStr = pdfBuffer.toString("latin1");

  const xmlStart = pdfStr.indexOf("<?xml");
  if (xmlStart === -1) return null;

  // Suche nach dem letzten schließenden Tag der CrossIndustryInvoice
  const endings = [
    "CrossIndustryInvoice>",
    "CrossIndustryDocument>",
    "Invoice>",
  ];

  let xmlEnd = -1;
  for (const ending of endings) {
    const idx = pdfStr.lastIndexOf(`</${ending.split(">")[0]}`);
    if (idx > xmlStart) {
      xmlEnd = idx + ending.length + 2; // inkl. </ und >
      break;
    }
  }

  if (xmlEnd === -1) {
    // Fallback: nimm alles bis zum Ende (könnte beschnitten sein)
    const fallbackEnd = pdfStr.indexOf("endstream", xmlStart);
    if (fallbackEnd === -1) return null;
    xmlEnd = fallbackEnd;
  }

  const candidate = pdfStr.slice(xmlStart, xmlEnd);
  // Validierung: muss typische ZUGFeRD-Namespaces enthalten
  if (
    candidate.includes("factur-x") ||
    candidate.includes("urn:un:unece:uncefact") ||
    candidate.includes("zugferd") ||
    candidate.includes("CrossIndustryInvoice") ||
    candidate.includes("CrossIndustryDocument")
  ) {
    return candidate;
  }

  return null;
}

/** Parsed ZUGFeRD/Factur-X XML und gibt strukturierte Daten zurück */
export function parseZugferdXml(xml: string): ZugferdParsed {
  // Rechnungsnummer — ZUGFeRD 2.x: ExchangedDocument / ZUGFeRD 1.0: HeaderExchangedDocument
  const rechnungNummer =
    extractInContext(xml, "ExchangedDocument", "ID") ??
    extractInContext(xml, "HeaderExchangedDocument", "ID");

  // Rechnungsdatum
  const datumRaw =
    extractInContext(xml, "IssueDateTime", "DateTimeString") ??
    extractInContext(xml, "ExchangedDocument", "DateTimeString") ??
    extractInContext(xml, "HeaderExchangedDocument", "DateTimeString");
  const datum = parseDate102(datumRaw);

  // Fälligkeitsdatum aus Zahlungsbedingungen
  const faelligRaw =
    extractInContext(xml, "DueDateDateTime", "DateTimeString") ??
    extractInContext(xml, "SpecifiedTradePaymentTerms", "DateTimeString");
  const faelligAm = parseDate102(faelligRaw);

  // Verkäufer-Name (= unser Lieferant) — ZUGFeRD 1.0: SellerTradeParty inside SpecifiedSupplyChainTradeTransaction
  const lieferantName =
    extractInContext(xml, "SellerTradeParty", "Name") ??
    extractInContext(xml, "SellerTradeParty", "TradingBusinessName");

  // Geldbeträge aus Monetär-Zusammenfassung
  const summaryRe = new RegExp(
    `<[^:>]*:?SpecifiedTradeSettlementHeaderMonetarySummation[^>]*>([\\s\\S]*?)<\\/[^:>]*:?SpecifiedTradeSettlementHeaderMonetarySummation>`,
    "i"
  );
  const summaryMatch = xml.match(summaryRe);
  const summary = summaryMatch ? summaryMatch[1] : xml;

  const taxBasisRaw = extractTag(summary, "TaxBasisTotalAmount");
  const taxTotalRaw = extractTag(summary, "TaxTotalAmount");
  const grandTotalRaw =
    extractTag(summary, "GrandTotalAmount") ??
    extractTag(summary, "DuePayableAmount");

  const betragNetto = taxBasisRaw ? parseFloat(taxBasisRaw) : null;
  const mwstBetrag = taxTotalRaw ? parseFloat(taxTotalRaw) : null;
  const betragBrutto = grandTotalRaw ? parseFloat(grandTotalRaw) : null;

  // MwSt-Satz aus Tax-Block ermitteln (erster Eintrag)
  let mwstSatz: number | null = null;
  const taxRateRe = new RegExp(`<[^:>]*:?RateApplicablePercent[^>]*>([^<]+)<`, "i");
  const taxRateMatch = xml.match(taxRateRe);
  if (taxRateMatch) {
    const rate = parseFloat(taxRateMatch[1]);
    if (!isNaN(rate)) mwstSatz = rate;
  }
  // Fallback: aus Netto + MwSt berechnen
  if (mwstSatz === null && betragNetto && mwstBetrag && betragNetto > 0) {
    const calculated = Math.round((mwstBetrag / betragNetto) * 100);
    if (calculated === 7 || calculated === 19 || calculated === 0) {
      mwstSatz = calculated;
    }
  }

  // IBAN aus CreditorFinancialAccount (ZUGFeRD 2.x) oder PayeeFinancialAccount
  const ibanRaw =
    extractInContext(xml, "SpecifiedCreditorFinancialAccount", "IBANID") ??
    extractInContext(xml, "PayeeSpecifiedCreditorFinancialAccount", "IBANID") ??
    extractInContext(xml, "PayeeFinancialAccount", "IBANID") ??
    extractTag(xml, "IBANID");
  const iban = ibanRaw ? ibanRaw.replace(/\s/g, "").toUpperCase() : null;

  // BIC aus CreditorFinancialInstitution
  const bicRaw =
    extractInContext(xml, "SpecifiedCreditorFinancialInstitution", "BICID") ??
    extractInContext(xml, "PayeeSpecifiedCreditorFinancialInstitution", "BICID") ??
    extractTag(xml, "BICID");
  const bic = bicRaw ? bicRaw.replace(/\s/g, "").toUpperCase() : null;

  return {
    rechnungNummer,
    datum,
    faelligAm,
    lieferantName,
    iban,
    bic,
    betragNetto: betragNetto !== null && !isNaN(betragNetto) ? betragNetto : null,
    mwstBetrag: mwstBetrag !== null && !isNaN(mwstBetrag) ? mwstBetrag : null,
    mwstSatz,
    betragBrutto: betragBrutto !== null && !isNaN(betragBrutto) ? betragBrutto : null,
  };
}
