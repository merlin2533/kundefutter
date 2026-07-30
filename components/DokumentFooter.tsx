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

  // Bewusst eine <table> mit table-layout: auto + Breiten direkt auf den <td> (statt
  // CSS Grid/Flexbox oder table-layout: fixed + <colgroup>): dieser Footer sitzt in
  // allen Druckseiten (Rechnung/Angebot/Lieferschein/Auftragsbestätigung) selbst wieder
  // in einer Tabellenzelle. Grid-/Flex-Container innerhalb einer <td>, deren eigene
  // Breite erst während desselben Layout-Durchlaufs bestimmt wird, sowie
  // table-layout: fixed in Kombination mit <colgroup> werden von manchen
  // Druck-Renderern (u.a. WebKit/iOS) beim Paginieren nachweislich falsch berechnet —
  // bis hin zu kollabierenden Spalten. Eine simple auto-layout-Tabelle mit
  // Breiten-Attributen direkt an den Zellen ist die am längsten und verlässlichsten
  // browserübergreifend unterstützte Variante.
  return (
    <>
      <hr style={{ borderTop: "1px solid #bbb", marginTop, marginBottom: "8px" }} />
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          <tr>
            <td style={{ width: "34%", fontSize: "7.5pt", color: "#666", lineHeight: "1.6", whiteSpace: "pre-line", verticalAlign: "top", padding: 0 }}>
              {links}
            </td>
            <td style={{ width: "32%", fontSize: "7.5pt", color: "#666", lineHeight: "1.6", whiteSpace: "pre-line", textAlign: "center", verticalAlign: "top", padding: "0 6px" }}>
              {mitte}
            </td>
            <td style={{ width: "34%", fontSize: "7.5pt", color: "#666", lineHeight: "1.6", whiteSpace: "pre-line", textAlign: "right", verticalAlign: "top", padding: 0 }}>
              {rechts}
            </td>
          </tr>
        </tbody>
      </table>
    </>
  );
}
