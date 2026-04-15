/**
 * Serverseitige PDF-Generierung mit jsPDF.
 * Wird für automatischen Google-Drive-Upload bei Rechnungs- und Lieferschein-Erstellung genutzt.
 */

import { prisma } from "@/lib/prisma";
import { formatDatum, formatEuro } from "@/lib/utils";
import { ladeFirmaDaten, type FirmaDaten } from "@/lib/firma";
import { erzeugeGiroCodeDataUrl } from "@/lib/girocode";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type JsPDFWithAutoTable = jsPDF & { lastAutoTable: { finalY: number } };

interface LogoDaten {
  dataUrl: string;
  format: string;
}

/**
 * Lädt das Firmenlogo aus den Einstellungen (Key: system.logo).
 * Erwartet eine Base64-DataURL im Format data:image/<format>;base64,...
 */
async function ladeLogo(): Promise<LogoDaten | null> {
  const eintrag = await prisma.einstellung.findUnique({
    where: { key: "system.logo" },
  });
  const value = eintrag?.value;
  if (!value || !value.startsWith("data:image")) return null;
  const match = /^data:image\/([a-zA-Z0-9+.-]+);base64,/.exec(value);
  if (!match) return null;
  let format = match[1].toLowerCase();
  if (format === "jpeg") format = "jpg";
  if (format === "svg+xml") return null; // jsPDF unterstützt kein SVG
  if (!["png", "jpg", "webp"].includes(format)) return null;
  return { dataUrl: value, format };
}

const EIGENTUMSVORBEHALT_DEFAULT =
  "Die Ware bleibt bis zur vollständigen Bezahlung Eigentum von Landhandel Röthemeier.";

/**
 * Lädt den rechtlichen Hinweis "Eigentumsvorbehalt" aus den Einstellungen.
 * Fällt auf den Standardtext zurück.
 */
async function ladeEigentumsvorbehalt(): Promise<string> {
  const row = await prisma.einstellung.findUnique({
    where: { key: "dokument.rechnung.eigentumsvorbehalt" },
  });
  const value = row?.value?.trim();
  return value && value.length > 0 ? value : EIGENTUMSVORBEHALT_DEFAULT;
}

/**
 * Lädt die dokument.footer.* Einstellungen oder fällt auf Firmendaten zurück.
 * Spiegelt die Logik von components/DokumentFooter.tsx – buildFooterColumns().
 */
async function ladeFooterSpalten(firma: FirmaDaten): Promise<{ links: string; mitte: string; rechts: string }> {
  const rows = await prisma.einstellung.findMany({
    where: { key: { startsWith: "dokument.footer." } },
  });
  const cfg: Record<string, string> = {};
  for (const r of rows) cfg[r.key] = r.value;

  const links = cfg["dokument.footer.links"] ||
    [firma.name, firma.zusatz, firma.strasse, firma.plzOrt].filter(Boolean).join("\n");

  const mitte = cfg["dokument.footer.mitte"] ||
    [
      firma.telefon ? `Tel: ${firma.telefon}` : "",
      firma.email,
      firma.steuernummer ? `Steuernr.: ${firma.steuernummer}` : "",
      firma.ustIdNr ? `USt-IdNr.: ${firma.ustIdNr}` : "",
      firma.oekoNummer ? `Öko-Nr.: ${firma.oekoNummer}` : "",
    ].filter(Boolean).join("\n");

  const rechts = cfg["dokument.footer.rechts"] ||
    [
      firma.bank,
      firma.iban ? `IBAN: ${firma.iban}` : "",
      firma.bic ? `BIC: ${firma.bic}` : "",
    ].filter(Boolean).join("\n");

  return { links, mitte, rechts };
}

/**
 * Zeichnet den 3-spaltigen Dokument-Footer am unteren Seitenrand.
 * Optional: direkt über dem Footer einen kleinen rechtlichen Hinweis (Eigentumsvorbehalt o.ä.).
 */
function zeichneDokumentFooter(
  doc: jsPDF,
  spalten: { links: string; mitte: string; rechts: string },
  hinweis?: string,
) {
  const pageHeight = doc.internal.pageSize.getHeight();
  const left = 14;
  const right = 196;
  const width = right - left;
  const colWidth = (width - 8) / 3;

  // Footer ist 6 Zeilen hoch (max), Zeilenhöhe 3.2 mm
  const zeilenHoehe = 3.2;
  const maxZeilen = Math.max(
    spalten.links.split("\n").length,
    spalten.mitte.split("\n").length,
    spalten.rechts.split("\n").length,
    1,
  );
  const footerHoehe = maxZeilen * zeilenHoehe + 4;
  const footerY = pageHeight - footerHoehe - 8;

  // Rechtlicher Hinweis über der Trennlinie (z.B. Eigentumsvorbehalt)
  if (hinweis && hinweis.trim().length > 0) {
    doc.setFontSize(7);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(102);
    const hinweisLines = doc.splitTextToSize(hinweis, width) as string[];
    const hinweisHoehe = hinweisLines.length * 3;
    const hinweisY = footerY - hinweisHoehe - 1;
    hinweisLines.forEach((line, i) => doc.text(line, left, hinweisY + i * 3));
  }

  // Trennlinie
  doc.setDrawColor(187);
  doc.setLineWidth(0.2);
  doc.line(left, footerY, right, footerY);

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(102);

  const startY = footerY + 4;
  const links = spalten.links.split("\n");
  const mitte = spalten.mitte.split("\n");
  const rechts = spalten.rechts.split("\n");

  links.forEach((line, i) => doc.text(line, left, startY + i * zeilenHoehe));
  mitte.forEach((line, i) =>
    doc.text(line, left + colWidth + 4 + colWidth / 2, startY + i * zeilenHoehe, { align: "center" }),
  );
  rechts.forEach((line, i) => doc.text(line, right, startY + i * zeilenHoehe, { align: "right" }));
}

/**
 * Generiert eine Rechnung als PDF-Buffer für die angegebene Lieferung.
 * Layout spiegelt die HTML-Vorschau unter /lieferungen/[id]/rechnung.
 * Die Lieferung muss bereits eine Rechnungsnummer besitzen.
 */
export async function generiereRechnungPdf(lieferungId: number): Promise<Buffer> {
  const lieferung = await prisma.lieferung.findUnique({
    where: { id: lieferungId },
    include: {
      kunde: { include: { kontakte: true } },
      positionen: { include: { artikel: true } },
    },
  });
  if (!lieferung) throw new Error(`Lieferung ${lieferungId} nicht gefunden`);

  const FIRMA = await ladeFirmaDaten();
  const footerSpalten = await ladeFooterSpalten(FIRMA);
  const eigentumsvorbehalt = await ladeEigentumsvorbehalt();
  const logo = await ladeLogo();
  const doc = new jsPDF();

  // ── Farben (matches HTML-Preview) ────────────────────────────────────────────
  const COL_TEXT: [number, number, number] = [0, 0, 0];
  const COL_MUTED: [number, number, number] = [85, 85, 85];
  const COL_LABEL: [number, number, number] = [136, 136, 136];
  const COL_BORDER_STRONG: [number, number, number] = [34, 34, 34];
  const COL_TABLE_HEAD_BG: [number, number, number] = [245, 245, 245];
  const COL_ROW_ALT_BG: [number, number, number] = [250, 250, 250];
  const COL_BOX_BG: [number, number, number] = [249, 249, 249];
  const COL_BOX_BORDER: [number, number, number] = [221, 221, 221];

  const k = lieferung.kunde;
  const zahlungsziel = lieferung.zahlungsziel ?? 30;
  const rechnungDatum = lieferung.rechnungDatum
    ? new Date(lieferung.rechnungDatum)
    : new Date(lieferung.datum);
  const lieferDatum = lieferung.lieferDatum
    ? new Date(lieferung.lieferDatum)
    : new Date(lieferung.datum);
  const faelligDatum = new Date(rechnungDatum.getTime() + zahlungsziel * 24 * 60 * 60 * 1000);

  // ── Kopfbereich: Logo + Firmenname links, Rechnungs-Meta rechts ─────────────
  let logoBreiteMm = 0;
  if (logo) {
    try {
      const format = logo.format.toUpperCase() === "JPG" ? "JPEG" : logo.format.toUpperCase();
      doc.addImage(logo.dataUrl, format, 14, 14, 40, 20, undefined, "FAST");
      logoBreiteMm = 40;
    } catch {
      // Ungültiges Bildformat - ignorieren
    }
  }

  // Firmenname unter Logo (fett, 13pt)
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COL_TEXT);
  if (FIRMA.name) doc.text(FIRMA.name, 14, logoBreiteMm > 0 ? 40 : 20);

  // "Rechnung" Titel oben rechts
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COL_TEXT);
  doc.text("Rechnung", 196, 20, { align: "right" });

  // Meta-Tabelle (Rechnungsnummer, Rechnungsdatum, Fällig am)
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  let metaY = 27;
  const metaLabelX = 155;
  const metaValueX = 196;
  const drawMetaZeile = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COL_MUTED);
    doc.text(label, metaLabelX, metaY, { align: "right" });
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setTextColor(...COL_TEXT);
    doc.text(value, metaValueX, metaY, { align: "right" });
    metaY += 5;
  };
  drawMetaZeile("Rechnungsnummer:", lieferung.rechnungNr ?? "—", true);
  drawMetaZeile("Rechnungsdatum:", formatDatum(rechnungDatum));
  drawMetaZeile("Lieferdatum:", formatDatum(lieferDatum));
  drawMetaZeile("Fällig am:", formatDatum(faelligDatum), true);

  // Dicke horizontale Trennlinie unter dem Kopf
  const sepY = Math.max(metaY + 2, 44);
  doc.setDrawColor(...COL_BORDER_STRONG);
  doc.setLineWidth(0.6);
  doc.line(14, sepY, 196, sepY);

  // ── Empfänger-Block ─────────────────────────────────────────────────────────
  let ey = sepY + 10;
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COL_LABEL);
  doc.text("RECHNUNGSEMPFÄNGER", 14, ey);
  ey += 5;

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COL_TEXT);
  doc.text(k.firma ?? k.name, 14, ey);
  ey += 5;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COL_TEXT);
  if (k.firma) { doc.text(k.name, 14, ey); ey += 5; }
  if (k.strasse) { doc.text(k.strasse, 14, ey); ey += 5; }
  if (k.plz || k.ort) {
    doc.text([k.plz, k.ort].filter(Boolean).join(" "), 14, ey);
    ey += 5;
  }

  // ── Betreff ─────────────────────────────────────────────────────────────────
  ey += 8;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COL_TEXT);
  doc.text(`Betreff: Rechnung ${lieferung.rechnungNr ?? ""}`.trim(), 14, ey);
  ey += 6;

  // ── Positionen-Tabelle ──────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const positionen = lieferung.positionen as any[];
  const hatRabatt = positionen.some((p) => (p.rabattProzent ?? 0) > 0);

  const head = hatRabatt
    ? [["Pos.", "Artikel", "Menge", "Einheit", "Einzelpreis", "Rabatt %", "Gesamt"]]
    : [["Pos.", "Artikel", "Menge", "Einheit", "Einzelpreis", "Gesamt"]];

  const body = positionen.map((p, i) => {
    const netto = p.menge * p.verkaufspreis * (1 - (p.rabattProzent ?? 0) / 100);
    const artikelZelle = `${p.artikel.name}\nMwSt ${p.artikel.mwstSatz ?? 19} %`;
    const mengeStr = p.menge.toLocaleString("de-DE", { maximumFractionDigits: 2 });
    const base = [
      String(i + 1),
      artikelZelle,
      mengeStr,
      p.artikel.einheit,
      formatEuro(p.verkaufspreis),
    ];
    if (hatRabatt) {
      base.push((p.rabattProzent ?? 0) > 0 ? `${p.rabattProzent} %` : "");
    }
    base.push(formatEuro(netto));
    return base;
  });

  autoTable(doc, {
    startY: ey + 2,
    head,
    body,
    theme: "plain",
    headStyles: {
      fillColor: COL_TABLE_HEAD_BG,
      textColor: [51, 51, 51],
      fontStyle: "bold",
      lineColor: [51, 51, 51],
      lineWidth: 0.3,
    },
    alternateRowStyles: { fillColor: COL_ROW_ALT_BG },
    styles: {
      fontSize: 9,
      cellPadding: { top: 2, right: 3, bottom: 2, left: 3 },
      lineColor: [221, 221, 221],
      lineWidth: 0.1,
      textColor: [0, 0, 0],
      valign: "top",
    },
    columnStyles: hatRabatt
      ? {
          0: { cellWidth: 12 },
          1: { cellWidth: "auto" },
          2: { halign: "right", cellWidth: 18 },
          3: { cellWidth: 16 },
          4: { halign: "right", cellWidth: 24 },
          5: { halign: "right", cellWidth: 18 },
          6: { halign: "right", cellWidth: 26 },
        }
      : {
          0: { cellWidth: 12 },
          1: { cellWidth: "auto" },
          2: { halign: "right", cellWidth: 20 },
          3: { cellWidth: 18 },
          4: { halign: "right", cellWidth: 28 },
          5: { halign: "right", cellWidth: 28 },
        },
  });

  const finalY = (doc as JsPDFWithAutoTable).lastAutoTable.finalY + 4;

  // ── Summenblock rechtsbündig ────────────────────────────────────────────────
  const mwstGruppen = new Map<number, number>();
  let nettoGesamt = 0;
  for (const p of positionen) {
    const netto = p.menge * p.verkaufspreis * (1 - (p.rabattProzent ?? 0) / 100);
    nettoGesamt += netto;
    const satz = p.artikel.mwstSatz ?? 19;
    mwstGruppen.set(satz, (mwstGruppen.get(satz) ?? 0) + netto);
  }
  let mwstGesamt = 0;
  for (const [satz, basis] of mwstGruppen) {
    mwstGesamt += basis * (satz / 100);
  }
  const brutto = nettoGesamt + mwstGesamt;

  const sumLabelX = 140;
  const sumValueX = 196;
  let sumY = finalY + 2;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(68);
  doc.text("Nettobetrag:", sumLabelX, sumY);
  doc.setTextColor(...COL_TEXT);
  doc.text(formatEuro(nettoGesamt), sumValueX, sumY, { align: "right" });
  sumY += 5.5;

  const sortedSaetze = Array.from(mwstGruppen.entries()).sort(([a], [b]) => a - b);
  for (const [satz, basis] of sortedSaetze) {
    doc.setTextColor(68);
    doc.text(`MwSt ${satz} %:`, sumLabelX, sumY);
    doc.setTextColor(...COL_TEXT);
    doc.text(formatEuro(basis * (satz / 100)), sumValueX, sumY, { align: "right" });
    sumY += 5.5;
  }

  doc.setDrawColor(...COL_BORDER_STRONG);
  doc.setLineWidth(0.5);
  doc.line(sumLabelX, sumY, sumValueX, sumY);
  sumY += 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...COL_TEXT);
  doc.text("Bruttobetrag:", sumLabelX, sumY);
  doc.text(formatEuro(brutto), sumValueX, sumY, { align: "right" });
  sumY += 8;

  // ── Zahlungsinformationen Box ───────────────────────────────────────────────
  const boxX = 14;
  const boxY = sumY + 4;
  const boxW = 182;
  const boxH = 32;

  // Hintergrund + Rahmen
  doc.setDrawColor(...COL_BOX_BORDER);
  doc.setFillColor(...COL_BOX_BG);
  doc.setLineWidth(0.2);
  doc.roundedRect(boxX, boxY, boxW, boxH, 1.5, 1.5, "FD");

  // GiroCode optional rechts in der Box
  let giroCodeRendered = false;
  if (FIRMA.iban && FIRMA.name) {
    const giroCode = await erzeugeGiroCodeDataUrl({
      empfaenger: FIRMA.name,
      iban: FIRMA.iban,
      bic: FIRMA.bic,
      betrag: brutto,
      verwendungszweck: `Rechnung ${lieferung.rechnungNr ?? ""}`.trim(),
    });
    if (giroCode) {
      try {
        const qrSize = 26;
        const qrX = boxX + boxW - qrSize - 4;
        const qrY = boxY + 3;
        doc.addImage(giroCode, "PNG", qrX, qrY, qrSize, qrSize, undefined, "FAST");
        doc.setFontSize(6.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(120);
        doc.text("Scan & Pay", qrX + qrSize / 2, qrY + qrSize + 3, { align: "center" });
        giroCodeRendered = true;
      } catch {
        // Bild-Einbettung fehlgeschlagen – ignorieren
      }
    }
  }

  // Text in der Box links
  const textMaxWidth = giroCodeRendered ? boxW - 40 : boxW - 8;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COL_TEXT);
  doc.text("Zahlungsinformationen", boxX + 4, boxY + 6);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(51);
  const zahlText =
    `Bitte überweisen Sie den Betrag von ${formatEuro(brutto)} bis zum ${formatDatum(faelligDatum)} ` +
    `unter Angabe der Rechnungsnummer ${lieferung.rechnungNr ?? ""}.`;
  const zahlLines = doc.splitTextToSize(zahlText, textMaxWidth) as string[];
  zahlLines.forEach((line, i) => doc.text(line, boxX + 4, boxY + 12 + i * 4));

  const bankZeile1 = FIRMA.bank ? `Bank: ${FIRMA.bank}` : "";
  const bankZeile2 = [
    FIRMA.iban ? `IBAN: ${FIRMA.iban}` : "",
    FIRMA.bic ? `BIC: ${FIRMA.bic}` : "",
  ].filter(Boolean).join("    ");
  const bankStartY = boxY + 12 + zahlLines.length * 4 + 2;
  if (bankZeile1) {
    doc.text(bankZeile1, boxX + 4, bankStartY);
  }
  if (bankZeile2) {
    doc.text(bankZeile2, boxX + 4, bankStartY + (bankZeile1 ? 4 : 0));
  }

  // ── Dokument-Footer (3-spaltig) mit Eigentumsvorbehalt-Hinweis ───────────────
  zeichneDokumentFooter(doc, footerSpalten, eigentumsvorbehalt);

  return Buffer.from(doc.output("arraybuffer"));
}

/**
 * Generiert einen Lieferschein als PDF-Buffer (ohne Preise, mit Unterschriftsfeld).
 */
export async function generiereLieferscheinPdf(lieferungId: number): Promise<Buffer> {
  const lieferung = await prisma.lieferung.findUnique({
    where: { id: lieferungId },
    include: {
      kunde: { include: { kontakte: true } },
      positionen: { include: { artikel: true } },
    },
  });
  if (!lieferung) throw new Error(`Lieferung ${lieferungId} nicht gefunden`);

  const FIRMA = await ladeFirmaDaten();
  const logo = await ladeLogo();
  const doc = new jsPDF();
  const k = lieferung.kunde;

  // ── Logo oben links ─────────────────────────────────────────────────────────
  let logoBreiteMm = 0;
  if (logo) {
    try {
      const format = logo.format.toUpperCase() === "JPG" ? "JPEG" : logo.format.toUpperCase();
      doc.addImage(logo.dataUrl, format, 14, 12, 45, 22, undefined, "FAST");
      logoBreiteMm = 45;
    } catch {
      // ignore
    }
  }

  // ── Header: Firmenname links, Lieferschein-Titel rechts ─────────────────────
  const headerX = logoBreiteMm > 0 ? 65 : 14;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(22, 101, 52);
  doc.text(FIRMA.name, headerX, 18);

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80);
  let lsKopfY = 24;
  if (FIRMA.zusatz) { doc.text(FIRMA.zusatz, headerX, lsKopfY); lsKopfY += 4; }
  const lsAdress = [FIRMA.strasse, FIRMA.plzOrt].filter(Boolean);
  if (lsAdress.length) { doc.text(lsAdress.join(" · "), headerX, lsKopfY); lsKopfY += 4; }
  const lsKontakt = [FIRMA.telefon && `Tel: ${FIRMA.telefon}`, FIRMA.email].filter(Boolean) as string[];
  if (lsKontakt.length) doc.text(lsKontakt.join(" · "), headerX, lsKopfY);

  // Titel oben rechts
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.text("Lieferschein", 196, 18, { align: "right" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60);
  doc.text(`Nr.: ${lieferung.id}`, 196, 26, { align: "right" });
  doc.text(`Lieferdatum: ${formatDatum(lieferung.datum)}`, 196, 31, { align: "right" });

  doc.setDrawColor(22, 101, 52);
  doc.setLineWidth(0.5);
  doc.line(14, 40, 196, 40);

  // ── Empfänger ───────────────────────────────────────────────────────────────
  const telefon = k.kontakte?.find((c: { typ: string; wert: string }) => c.typ === "telefon" || c.typ === "mobil")?.wert;
  const email = k.kontakte?.find((c: { typ: string; wert: string }) => c.typ === "email")?.wert;

  doc.setFontSize(7);
  doc.setTextColor(120);
  doc.text("Empfänger", 14, 48);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.text(k.firma ?? k.name, 14, 55);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  let empfY = 60;
  if (k.firma) { doc.text(k.name, 14, empfY); empfY += 5; }
  if (k.strasse) { doc.text(k.strasse, 14, empfY); empfY += 5; }
  if (k.plz || k.ort) { doc.text([k.plz, k.ort].filter(Boolean).join(" "), 14, empfY); empfY += 5; }
  if (telefon) { doc.setTextColor(80); doc.text(`Tel.: ${telefon}`, 14, empfY); empfY += 5; }
  if (email) { doc.text(email, 14, empfY); }

  // ── Lieferadresse (falls abweichend) ────────────────────────────────────────
  let tabelleStart = 78;
  if ((lieferung as { lieferadresse?: string | null }).lieferadresse) {
    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.text("Lieferadresse", 120, 48);
    doc.setFontSize(9);
    doc.setTextColor(0);
    doc.setFont("helvetica", "normal");
    const lzLines = doc.splitTextToSize(
      (lieferung as { lieferadresse?: string | null }).lieferadresse as string,
      73,
    ) as string[];
    lzLines.forEach((line: string, i: number) => doc.text(line, 120, 55 + i * 5));
    tabelleStart = Math.max(tabelleStart, 55 + lzLines.length * 5 + 8);
  }

  // ── Positionen ──────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const positionen = lieferung.positionen as any[];
  const hasCharge = positionen.some((p) => p.chargeNr);
  const lsHead = hasCharge
    ? [["Pos.", "Bezeichnung", "Charge", "Menge", "Einheit"]]
    : [["Pos.", "Bezeichnung", "Menge", "Einheit"]];
  const lsBody = positionen.map((p, i) =>
    hasCharge
      ? [String(i + 1), p.artikel.name, p.chargeNr ?? "—", p.menge.toLocaleString("de-DE"), p.artikel.einheit]
      : [String(i + 1), p.artikel.name, p.menge.toLocaleString("de-DE"), p.artikel.einheit],
  );
  autoTable(doc, {
    startY: tabelleStart,
    head: lsHead,
    body: lsBody,
    headStyles: { fillColor: [22, 101, 52] },
    styles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 12 },
      [hasCharge ? 3 : 2]: { halign: "right" },
    },
  });

  // ── Unterschriftsfeld ───────────────────────────────────────────────────────
  const finalY = (doc as JsPDFWithAutoTable).lastAutoTable.finalY + 20;
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text("Erhalten am: _______________", 14, finalY + 15);
  doc.text("Unterschrift Empfänger:", 110, finalY + 15);
  doc.setLineWidth(0.3);
  doc.line(14, finalY + 28, 90, finalY + 28);
  doc.line(110, finalY + 28, 196, finalY + 28);
  doc.text("Datum", 14, finalY + 33);
  doc.text("Ort / Datum / Unterschrift", 110, finalY + 33);

  if (lieferung.notiz) {
    doc.setFontSize(8);
    doc.setTextColor(80);
    doc.text(`Hinweis: ${lieferung.notiz}`, 14, finalY + 45);
  }

  // ── Fußzeile ────────────────────────────────────────────────────────────────
  doc.setDrawColor(200);
  doc.setLineWidth(0.2);
  doc.line(14, 278, 196, 278);
  doc.setFontSize(7.5);
  doc.setTextColor(120);
  const lsFooter = [FIRMA.name, FIRMA.strasse, FIRMA.plzOrt].filter(Boolean).join(" · ");
  if (lsFooter) doc.text(lsFooter, 14, 283);
  const lsFooterKontakt = [
    FIRMA.telefon && `Tel: ${FIRMA.telefon}`,
    FIRMA.email,
  ].filter(Boolean).join(" · ");
  if (lsFooterKontakt) doc.text(lsFooterKontakt, 14, 287);

  return Buffer.from(doc.output("arraybuffer"));
}
