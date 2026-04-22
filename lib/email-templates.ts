import type { FirmaDaten } from "@/lib/firma";

export type RechnungMailData = {
  rechnungNr: string;
  rechnungDatum: Date;
  faelligAm?: Date | null;
  bruttoBetrag: number;
  kundenAnrede?: string | null;
  firma: FirmaDaten;
  pdfFilename: string;
  xmlFilename: string;
};

function fmtDatum(d: Date): string {
  return d.toLocaleDateString("de-DE", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function fmtEuro(n: number): string {
  return n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function rechnungSubject(rechnungNr: string, firmenname: string, datum: Date): string {
  return `Rechnung Nr. ${rechnungNr} – ${firmenname} (${fmtDatum(datum)})`;
}

export function rechnungEmail(data: RechnungMailData): { subject: string; text: string; html: string } {
  const { rechnungNr, rechnungDatum, faelligAm, bruttoBetrag, kundenAnrede, firma, pdfFilename, xmlFilename } = data;
  const subject = rechnungSubject(rechnungNr, firma.name, rechnungDatum);
  const anrede = kundenAnrede?.trim()
    ? `Sehr geehrte/r ${kundenAnrede.trim()},`
    : "Sehr geehrte Damen und Herren,";

  const text = [
    anrede,
    "",
    "anbei erhalten Sie Ihre Rechnung als PDF sowie als strukturierte E-Rechnung (ZUGFeRD / Factur-X XML).",
    "",
    `Rechnungsnummer: ${rechnungNr}`,
    `Rechnungsdatum:  ${fmtDatum(rechnungDatum)}`,
    `Gesamtbetrag:    ${fmtEuro(bruttoBetrag)}`,
    faelligAm ? `Fällig am:       ${fmtDatum(faelligAm)}` : "",
    "",
    "Anhänge:",
    `• ${pdfFilename} – Rechnung (PDF)`,
    `• ${xmlFilename} – E-Rechnung (ZUGFeRD / Factur-X XML)`,
    ...(firma.iban
      ? [
          "",
          `Bankverbindung${firma.bank ? `: ${firma.bank}` : ""}`,
          `IBAN: ${firma.iban}${firma.bic ? `  ·  BIC: ${firma.bic}` : ""}`,
        ]
      : []),
    "",
    "Mit freundlichen Grüßen",
    firma.name,
    "",
    "─────────────────────────────────────────",
    firma.name + (firma.zusatz ? ` · ${firma.zusatz}` : ""),
    [firma.strasse, firma.plzOrt].filter(Boolean).join(", "),
    firma.telefon ? `Tel: ${firma.telefon}` : "",
    firma.email || "",
    firma.steuernummer ? `Steuernr.: ${firma.steuernummer}` : "",
    firma.ustIdNr ? `USt-IdNr.: ${firma.ustIdNr}` : "",
  ]
    .filter((l) => l !== "")
    .join("\n");

  const impressumParts = [
    escapeHtml(firma.name) + (firma.zusatz ? ` · ${escapeHtml(firma.zusatz)}` : ""),
    [firma.strasse, firma.plzOrt].filter(Boolean).map(escapeHtml).join(", "),
    firma.telefon ? `Tel: ${escapeHtml(firma.telefon)}` : "",
    firma.email
      ? `<a href="mailto:${escapeHtml(firma.email)}" style="color:#166534;text-decoration:none;">${escapeHtml(firma.email)}</a>`
      : "",
    firma.steuernummer ? `Steuernr.: ${escapeHtml(firma.steuernummer)}` : "",
    firma.ustIdNr ? `USt-IdNr.: ${escapeHtml(firma.ustIdNr)}` : "",
  ].filter(Boolean);

  const bankHtml = firma.iban
    ? `<p style="margin:20px 0 0 0;font-size:13px;color:#4b5563;line-height:1.6;">
         <b style="color:#1f2937;">Bankverbindung</b>${firma.bank ? `<br>${escapeHtml(firma.bank)}` : ""}<br>
         IBAN: <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;font-family:ui-monospace,SFMono-Regular,monospace;">${escapeHtml(firma.iban)}</code>${
           firma.bic
             ? ` &nbsp;·&nbsp; BIC: <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;font-family:ui-monospace,SFMono-Regular,monospace;">${escapeHtml(firma.bic)}</code>`
             : ""
         }
       </p>`
    : "";

  const zeile = (label: string, value: string, bold = false) => `
    <tr>
      <td style="padding:10px 14px;background:#f9fafb;border:1px solid #e5e7eb;font-weight:600;color:#374151;width:42%;">${escapeHtml(label)}</td>
      <td style="padding:10px 14px;border:1px solid #e5e7eb;color:#1f2937;font-variant-numeric:tabular-nums;">${bold ? `<b>${escapeHtml(value)}</b>` : escapeHtml(value)}</td>
    </tr>`;

  const html = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;padding:24px 0;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.08);overflow:hidden;">
      <tr><td style="padding:24px 32px;border-bottom:3px solid #166534;">
        <div style="font-size:20px;font-weight:700;color:#166534;letter-spacing:-0.01em;">${escapeHtml(firma.name)}</div>
        ${firma.zusatz ? `<div style="font-size:13px;color:#6b7280;margin-top:2px;">${escapeHtml(firma.zusatz)}</div>` : ""}
      </td></tr>
      <tr><td style="padding:28px 32px 8px 32px;">
        <p style="margin:0 0 16px 0;font-size:15px;">${escapeHtml(anrede)}</p>
        <p style="margin:0 0 20px 0;font-size:15px;line-height:1.6;color:#374151;">
          anbei erhalten Sie Ihre Rechnung als PDF sowie als strukturierte E-Rechnung (ZUGFeRD&nbsp;/&nbsp;Factur-X&nbsp;XML).
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 20px 0;border-collapse:collapse;font-size:14px;">
          ${zeile("Rechnungsnummer", rechnungNr)}
          ${zeile("Rechnungsdatum", fmtDatum(rechnungDatum))}
          ${zeile("Gesamtbetrag", fmtEuro(bruttoBetrag), true)}
          ${faelligAm ? zeile("Fällig am", fmtDatum(faelligAm)) : ""}
        </table>
        <div style="margin:0 0 8px 0;padding:12px 16px;background:#f0fdf4;border-left:3px solid #166534;border-radius:4px;font-size:13px;color:#14532d;line-height:1.6;">
          <b>Anhänge</b><br>
          ${escapeHtml(pdfFilename)} &mdash; Rechnung (PDF)<br>
          ${escapeHtml(xmlFilename)} &mdash; E-Rechnung (ZUGFeRD&nbsp;/&nbsp;Factur-X&nbsp;XML)
        </div>
        ${bankHtml}
        <p style="margin:28px 0 0 0;font-size:15px;">Mit freundlichen Grüßen<br><b>${escapeHtml(firma.name)}</b></p>
      </td></tr>
      <tr><td style="padding:16px 32px 20px 32px;border-top:1px solid #e5e7eb;background:#fafaf9;font-size:11px;color:#6b7280;line-height:1.7;">
        ${impressumParts.join(" &nbsp;·&nbsp; ")}
      </td></tr>
    </table>
    <div style="max-width:600px;padding:12px 32px;font-size:11px;color:#9ca3af;text-align:center;line-height:1.5;">
      Bei Rückfragen antworten Sie einfach auf diese Nachricht.
    </div>
  </td></tr>
</table>
</body>
</html>`;

  return { subject, text, html };
}
