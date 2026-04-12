/**
 * Gemeinsamer 3-spaltiger Dokument-Footer für Rechnung, Lieferschein und Angebot.
 * Verwendet konfigurierbare Texte aus dokument.footer.* oder baut automatisch aus Firmadaten.
 */

export interface FooterColumns {
  links: string;
  mitte: string;
  rechts: string;
}

export function buildFooterColumns(
  firmaData: Record<string, string>,
  footerConfig: Record<string, string>
): FooterColumns {
  const name = firmaData["firma.name"] ?? firmaData["firma.firmenname"] ?? "";
  const zusatz = firmaData["firma.zusatz"] ?? "";
  const strasse = firmaData["firma.strasse"] ?? "";
  const plzOrt = [firmaData["firma.plz"], firmaData["firma.ort"]].filter(Boolean).join(" ");
  const tel = firmaData["firma.telefon"] ?? firmaData["firma.tel"] ?? "";
  const email = firmaData["firma.email"] ?? "";
  const steuernr = firmaData["firma.steuernummer"] ?? firmaData["firma.steuernr"] ?? "";
  const ustId = firmaData["firma.ustIdNr"] ?? "";
  const oeko = firmaData["firma.oekoNummer"] ?? "";
  const bank = firmaData["firma.bank"] ?? firmaData["firma.bankname"] ?? "";
  const iban = firmaData["firma.iban"] ?? "";
  const bic = firmaData["firma.bic"] ?? "";

  const links = footerConfig["dokument.footer.links"] ||
    [name, zusatz, strasse, plzOrt].filter(Boolean).join("\n");

  const mitte = footerConfig["dokument.footer.mitte"] ||
    [
      tel ? `Tel: ${tel}` : "",
      email,
      steuernr ? `Steuernr.: ${steuernr}` : "",
      ustId ? `USt-IdNr.: ${ustId}` : "",
      oeko ? `Öko-Nr.: ${oeko}` : "",
    ].filter(Boolean).join("\n");

  const rechts = footerConfig["dokument.footer.rechts"] ||
    [
      bank,
      iban ? `IBAN: ${iban}` : "",
      bic ? `BIC: ${bic}` : "",
    ].filter(Boolean).join("\n");

  return { links, mitte, rechts };
}

interface DokumentFooterProps {
  firmaData: Record<string, string>;
  footerConfig: Record<string, string>;
  marginTop?: string | number;
}

export default function DokumentFooter({ firmaData, footerConfig, marginTop = "auto" }: DokumentFooterProps) {
  const { links, mitte, rechts } = buildFooterColumns(firmaData, footerConfig);

  return (
    <>
      <hr style={{ borderTop: "1px solid #bbb", marginTop, marginBottom: "8px" }} />
      <div
        style={{
          fontSize: "7.5pt",
          color: "#666",
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "12px",
          lineHeight: "1.6",
        }}
      >
        <div style={{ whiteSpace: "pre-line" }}>{links}</div>
        <div style={{ whiteSpace: "pre-line", textAlign: "center" }}>{mitte}</div>
        <div style={{ whiteSpace: "pre-line", textAlign: "right" }}>{rechts}</div>
      </div>
    </>
  );
}
