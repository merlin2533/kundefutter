export interface SepaZahlung {
  empfaengerName: string;
  iban: string;
  bic?: string;
  betrag: number;        // EUR
  verwendungszweck: string;
  referenz: string;
}

function xmlEscape(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function ibanNormalisieren(iban: string): string {
  return iban.replace(/\s+/g, "").toUpperCase();
}

export function generiereSepaXml(
  absenderName: string,
  absenderIban: string,
  zahlungen: SepaZahlung[],
  datum: string // YYYY-MM-DD
): string {
  const msgId = `AGRAR-${datum.replace(/-/g, "")}-${Date.now()}`;
  const pmtInfId = `PMT-${Date.now()}`;
  const creDtTm = new Date().toISOString().replace(/\.\d{3}Z$/, "");
  const nbOfTxs = zahlungen.length;
  const ctrlSum = zahlungen.reduce((s, z) => s + z.betrag, 0).toFixed(2);
  const ibanAbs = ibanNormalisieren(absenderIban);

  const txLines = zahlungen
    .map((z) => {
      const betragStr = z.betrag.toFixed(2);
      const ibanEmpf = ibanNormalisieren(z.iban);
      const bicBlock = z.bic
        ? `<FinInstnId><BIC>${xmlEscape(z.bic.replace(/\s+/g, "").toUpperCase())}</BIC></FinInstnId>`
        : `<FinInstnId><Othr><Id>NOTPROVIDED</Id></Othr></FinInstnId>`;
      return `      <CdtTrfTxInf>
        <PmtId>
          <EndToEndId>${xmlEscape(z.referenz)}</EndToEndId>
        </PmtId>
        <Amt>
          <InstdAmt Ccy="EUR">${betragStr}</InstdAmt>
        </Amt>
        <CdtrAgt>${bicBlock}</CdtrAgt>
        <Cdtr>
          <Nm>${xmlEscape(z.empfaengerName)}</Nm>
        </Cdtr>
        <CdtrAcct>
          <Id><IBAN>${ibanEmpf}</IBAN></Id>
        </CdtrAcct>
        <RmtInf>
          <Ustrd>${xmlEscape(z.verwendungszweck)}</Ustrd>
        </RmtInf>
      </CdtTrfTxInf>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:schemaLocation="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03 pain.001.001.03.xsd">
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>${xmlEscape(msgId)}</MsgId>
      <CreDtTm>${creDtTm}</CreDtTm>
      <NbOfTxs>${nbOfTxs}</NbOfTxs>
      <CtrlSum>${ctrlSum}</CtrlSum>
      <InitgPty>
        <Nm>${xmlEscape(absenderName)}</Nm>
      </InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>${xmlEscape(pmtInfId)}</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <NbOfTxs>${nbOfTxs}</NbOfTxs>
      <CtrlSum>${ctrlSum}</CtrlSum>
      <PmtTpInf>
        <SvcLvl><Cd>SEPA</Cd></SvcLvl>
      </PmtTpInf>
      <ReqdExctnDt>${datum}</ReqdExctnDt>
      <Dbtr>
        <Nm>${xmlEscape(absenderName)}</Nm>
      </Dbtr>
      <DbtrAcct>
        <Id><IBAN>${ibanNormalisieren(ibanAbs)}</IBAN></Id>
      </DbtrAcct>
      <DbtrAgt>
        <FinInstnId><Othr><Id>NOTPROVIDED</Id></Othr></FinInstnId>
      </DbtrAgt>
${txLines}
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>`;
}
