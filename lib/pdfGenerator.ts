/**
 * Serverseitige PDF-Generierung mit jsPDF.
 * Wird für automatischen Google-Drive-Upload bei Rechnungs- und Lieferschein-Erstellung genutzt.
 */

import { prisma } from "@/lib/prisma";
import { formatDatum, formatEuro } from "@/lib/utils";
import { ladeFirmaDaten } from "@/lib/firma";
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

/**
 * Generiert eine Rechnung als PDF-Buffer für die angegebene Lieferung.
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
  const logo = await ladeLogo();
  const doc = new jsPDF();
  const k = lieferung.kunde;
  const zahlungsziel = lieferung.zahlungsziel ?? 30;
  // Rechnungsdatum: gespeichertes Datum oder Lieferdatum (nie "heute")
  const rechnungDatum = lieferung.rechnungDatum
    ? new Date(lieferung.rechnungDatum)
    : new Date(lieferung.datum);
  // Fälligkeitsdatum basiert auf Rechnungsdatum
  const faelligDatum = new Date(rechnungDatum.getTime() + zahlungsziel * 24 * 60 * 60 * 1000);

  // ── Briefkopf mit Logo links, Firma + Kontakt rechts ────────────────────────
  let logoBreiteMm = 0;
  if (logo) {
    try {
      const format = logo.format.toUpperCase() === "JPG" ? "JPEG" : logo.format.toUpperCase();
      doc.addImage(logo.dataUrl, format, 14, 12, 45, 22, undefined, "FAST");
      logoBreiteMm = 45;
    } catch {
      // Ungültiges Bildformat - ignorieren
    }
  }

  // Firmenzeile rechts neben dem Logo
  const firmaX = logoBreiteMm > 0 ? 65 : 14;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(22, 101, 52);
  doc.text(FIRMA.name, firmaX, 18);

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80);
  let kopfY = 24;
  if (FIRMA.zusatz) { doc.text(FIRMA.zusatz, firmaX, kopfY); kopfY += 4; }
  const adressTeile = [FIRMA.strasse, FIRMA.plzOrt].filter(Boolean);
  if (adressTeile.length) { doc.text(adressTeile.join(" · "), firmaX, kopfY); kopfY += 4; }
  const kontaktTeile = [FIRMA.telefon && `Tel: ${FIRMA.telefon}`, FIRMA.email].filter(Boolean) as string[];
  if (kontaktTeile.length) { doc.text(kontaktTeile.join(" · "), firmaX, kopfY); kopfY += 4; }
  if (FIRMA.steuernummer) {
    doc.text(`Steuernr.: ${FIRMA.steuernummer}`, firmaX, kopfY);
  }

  doc.setDrawColor(22, 101, 52);
  doc.setLineWidth(0.5);
  doc.line(14, 40, 196, 40);

  // ── Rechnungs-Meta-Block oben rechts ────────────────────────────────────────
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.text("RECHNUNG", 196, 18, { align: "right" });

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60);
  doc.text(`Nr.: ${lieferung.rechnungNr}`, 196, 26, { align: "right" });
  doc.text(`Datum: ${formatDatum(rechnungDatum)}`, 196, 31, { align: "right" });
  doc.text(`Zahlungsziel: ${zahlungsziel} Tage`, 196, 36, { align: "right" });
  doc.text(`Fällig: ${formatDatum(faelligDatum)}`, 196, 41, { align: "right" });

  // ── Absender-Kleingedrucktes über Empfänger-Adresse ────────────────────────
  doc.setFontSize(7);
  doc.setTextColor(120);
  const absenderZeile = [FIRMA.name, FIRMA.strasse, FIRMA.plzOrt].filter(Boolean).join(" · ");
  if (absenderZeile) doc.text(absenderZeile, 14, 50);

  // ── Empfänger-Adressfeld (links, Fensterumschlag-Position) ─────────────────
  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.setFont("helvetica", "bold");
  doc.text(k.firma ?? k.name, 14, 58);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  let ey = 63;
  if (k.firma) { doc.text(k.name, 14, ey); ey += 5; }
  if (k.strasse) { doc.text(k.strasse, 14, ey); ey += 5; }
  if (k.plz || k.ort) { doc.text([k.plz, k.ort].filter(Boolean).join(" "), 14, ey); ey += 5; }

  // Betreff
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.text(`Rechnung ${lieferung.rechnungNr}`, 14, ey + 6);

  // ── Positionen mit Rabatt ───────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (lieferung.positionen as any[]).map((p, i) => {
    const netto = p.menge * p.verkaufspreis * (1 - (p.rabattProzent ?? 0) / 100);
    return [
      String(i + 1),
      p.artikel.name,
      `${p.menge.toFixed(2)} ${p.artikel.einheit}`,
      formatEuro(p.verkaufspreis),
      (p.rabattProzent ?? 0) > 0 ? `${p.rabattProzent} %` : "—",
      formatEuro(netto),
      `${p.artikel.mwstSatz ?? 19} %`,
    ];
  });

  autoTable(doc, {
    startY: ey + 12,
    head: [["Pos.", "Bezeichnung", "Menge", "Einzel (€)", "Rabatt", "Gesamt (€)", "MwSt"]],
    body: rows,
    headStyles: { fillColor: [22, 101, 52] },
    styles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 10 },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right", cellWidth: 14 },
    },
  });

  const finalY = (doc as JsPDFWithAutoTable).lastAutoTable.finalY + 6;

  // ── Summen (nach MwSt-Satz gruppiert, mit Rabatt) ──────────────────────────
  const mwstGruppen = new Map<number, number>();
  let nettoGesamt = 0;
  for (const p of lieferung.positionen) {
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

  doc.setFontSize(9);
  doc.setTextColor(0);
  const sumX = 140;
  let sumY = finalY;
  doc.text("Nettobetrag:", sumX, sumY);
  doc.text(formatEuro(nettoGesamt), 196, sumY, { align: "right" });
  sumY += 6;

  const sortedSaetze = Array.from(mwstGruppen.entries()).sort(([a], [b]) => a - b);
  for (const [satz, basis] of sortedSaetze) {
    doc.text(`MwSt. ${satz} %:`, sumX, sumY);
    doc.text(formatEuro(basis * (satz / 100)), 196, sumY, { align: "right" });
    sumY += 6;
  }

  doc.setLineWidth(0.4);
  doc.line(sumX, sumY, 196, sumY);
  sumY += 7;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Bruttobetrag:", sumX, sumY);
  doc.text(formatEuro(brutto), 196, sumY, { align: "right" });

  // ── Zahlungsinformation ─────────────────────────────────────────────────────
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(60);
  doc.text(
    `Bitte überweisen Sie ${formatEuro(brutto)} bis ${formatDatum(faelligDatum)} unter Angabe der Rechnungsnummer ${lieferung.rechnungNr}.`,
    14, sumY + 14,
    { maxWidth: 120 },
  );
  if (FIRMA.iban) {
    const bankZeile = [
      FIRMA.bank && `Bank: ${FIRMA.bank}`,
      `IBAN: ${FIRMA.iban}`,
      FIRMA.bic && `BIC: ${FIRMA.bic}`,
    ].filter(Boolean).join("  ·  ");
    doc.text(bankZeile, 14, sumY + 24);
  }

  // ── GiroCode (EPC-QR-Code) für SEPA-Überweisung ────────────────────────────
  if (FIRMA.iban) {
    const giroCode = await erzeugeGiroCodeDataUrl({
      empfaenger: FIRMA.name,
      iban: FIRMA.iban,
      bic: FIRMA.bic,
      betrag: brutto,
      verwendungszweck: `Rechnung ${lieferung.rechnungNr ?? ""}`.trim(),
    });
    if (giroCode) {
      try {
        const qrX = 165;
        const qrY = sumY + 8;
        const qrSize = 28;
        doc.addImage(giroCode, "PNG", qrX, qrY, qrSize, qrSize, undefined, "FAST");
        doc.setFontSize(7);
        doc.setTextColor(120);
        doc.text("Scan & Pay", qrX + qrSize / 2, qrY + qrSize + 3, { align: "center" });
      } catch {
        // Bild-Einbettung fehlgeschlagen – QR einfach weglassen
      }
    }
  }

  // ── Fußzeile ─────────────────────────────────────────────────────────────────
  doc.setDrawColor(200);
  doc.setLineWidth(0.2);
  doc.line(14, 278, 196, 278);

  doc.setFontSize(7.5);
  doc.setTextColor(120);
  const footerFirma = [FIRMA.name, FIRMA.strasse, FIRMA.plzOrt].filter(Boolean).join(" · ");
  if (footerFirma) doc.text(footerFirma, 14, 283);
  const footerKontakt = [
    FIRMA.telefon && `Tel: ${FIRMA.telefon}`,
    FIRMA.email,
    FIRMA.steuernummer && `St.-Nr.: ${FIRMA.steuernummer}`,
  ].filter(Boolean).join(" · ");
  if (footerKontakt) doc.text(footerKontakt, 14, 287);
  const footerBank = [
    FIRMA.bank,
    FIRMA.iban && `IBAN: ${FIRMA.iban}`,
    FIRMA.bic && `BIC: ${FIRMA.bic}`,
  ].filter(Boolean).join(" · ");
  if (footerBank) doc.text(footerBank, 14, 291);

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
