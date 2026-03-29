/**
 * Serverseitige PDF-Generierung mit jsPDF.
 * Wird für automatischen Google-Drive-Upload bei Rechnungs- und Lieferschein-Erstellung genutzt.
 */

import { prisma } from "@/lib/prisma";
import { formatDatum, formatEuro } from "@/lib/utils";
import { ladeFirmaDaten } from "@/lib/firma";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type JsPDFWithAutoTable = jsPDF & { lastAutoTable: { finalY: number } };

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
  const doc = new jsPDF();
  const k = lieferung.kunde;
  const zahlungsziel = lieferung.zahlungsziel ?? 30;
  const lieferDatum = new Date(lieferung.datum);
  const faelligDatum = new Date(lieferDatum.getTime() + zahlungsziel * 24 * 60 * 60 * 1000);
  const rechnungDatum = lieferung.rechnungDatum ? new Date(lieferung.rechnungDatum) : new Date();

  // ── Absender-Kopfzeile ──────────────────────────────────────────────────────
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(22, 101, 52);
  doc.text(FIRMA.name, 14, 18);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80);
  if (FIRMA.zusatz) doc.text(FIRMA.zusatz, 14, 24);
  const adressTeile = [FIRMA.strasse, FIRMA.plzOrt].filter(Boolean);
  if (adressTeile.length) doc.text(adressTeile.join(" · "), 14, 29);
  const kontaktTeile = [FIRMA.telefon && `Tel: ${FIRMA.telefon}`, FIRMA.email].filter(Boolean) as string[];
  if (kontaktTeile.length) doc.text(kontaktTeile.join(" · "), 14, 34);

  doc.setDrawColor(22, 101, 52);
  doc.setLineWidth(0.5);
  doc.line(14, 38, 196, 38);

  // ── Rechnungstitel ──────────────────────────────────────────────────────────
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.text("RECHNUNG", 14, 50);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60);
  doc.text(`Rechnungsnummer: ${lieferung.rechnungNr}`, 14, 57);
  doc.text(`Rechnungsdatum: ${formatDatum(rechnungDatum)}`, 14, 62);
  doc.text(`Lieferdatum: ${formatDatum(lieferung.datum)}`, 14, 67);

  // ── Empfänger-Box ───────────────────────────────────────────────────────────
  doc.setDrawColor(200);
  doc.setLineWidth(0.3);
  doc.rect(120, 44, 78, 36);
  doc.setFontSize(7);
  doc.setTextColor(130);
  doc.text("Rechnungsempfänger", 124, 50);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.text(k.firma ?? k.name, 124, 56);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  if (k.firma) { doc.text(k.name, 124, 61); }
  let ry = k.firma ? 66 : 62;
  if (k.strasse) { doc.text(k.strasse, 124, ry); ry += 5; }
  if (k.plz || k.ort) doc.text([k.plz, k.ort].filter(Boolean).join(" "), 124, ry);

  // ── Positionen ──────────────────────────────────────────────────────────────
  // Verwende den tatsächlichen MwSt-Satz des Artikels (Standard 7 % Agrargüter)
  const rows = lieferung.positionen.map((p, i) => {
    const netto = p.menge * p.verkaufspreis;
    return [
      String(i + 1),
      p.artikel.artikelnummer,
      p.artikel.name,
      `${p.menge.toFixed(2)} ${p.artikel.einheit}`,
      formatEuro(p.verkaufspreis),
      formatEuro(netto),
    ];
  });

  autoTable(doc, {
    startY: 82,
    head: [["Pos.", "Art.-Nr.", "Bezeichnung", "Menge", "Einzel (€)", "Gesamt (€)"]],
    body: rows,
    headStyles: { fillColor: [22, 101, 52] },
    styles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 25 },
      4: { halign: "right" },
      5: { halign: "right" },
    },
  });

  const finalY = (doc as JsPDFWithAutoTable).lastAutoTable.finalY + 6;

  // ── Summen (nach MwSt-Satz gruppiert) ──────────────────────────────────────
  const mwstGruppen = new Map<number, number>();
  let nettoGesamt = 0;
  for (const p of lieferung.positionen) {
    const netto = p.menge * p.verkaufspreis;
    nettoGesamt += netto;
    const satz = p.artikel.mwstSatz ?? 7;
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

  for (const [satz, basis] of mwstGruppen) {
    doc.text(`MwSt. ${satz}%:`, sumX, sumY);
    doc.text(formatEuro(basis * (satz / 100)), 196, sumY, { align: "right" });
    sumY += 6;
  }

  doc.setLineWidth(0.4);
  doc.line(sumX, sumY, 196, sumY);
  sumY += 7;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Gesamtbetrag:", sumX, sumY);
  doc.text(formatEuro(brutto), 196, sumY, { align: "right" });

  // ── Zahlungsbedingungen ─────────────────────────────────────────────────────
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(60);
  doc.text(`Zahlbar bis: ${formatDatum(faelligDatum)} (${zahlungsziel} Tage netto)`, 14, sumY + 14);

  if (FIRMA.iban) {
    doc.text(`Bankverbindung: ${FIRMA.bank}  ·  IBAN: ${FIRMA.iban}  ·  BIC: ${FIRMA.bic}`, 14, sumY + 20);
  }
  if (FIRMA.steuernummer) {
    doc.text(`Steuernummer: ${FIRMA.steuernummer}`, 14, sumY + 26);
  }
  if (lieferung.notiz) {
    doc.text(`Hinweis: ${lieferung.notiz}`, 14, sumY + 34);
  }

  // ── Fußzeile ────────────────────────────────────────────────────────────────
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(`${FIRMA.name} – Alle Preise gemäß aktueller Preisliste. Irrtümer vorbehalten.`, 105, 285, { align: "center" });

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
  const doc = new jsPDF();
  const k = lieferung.kunde;

  // ── Header ──────────────────────────────────────────────────────────────────
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(22, 101, 52);
  doc.text("Lieferschein", 14, 22);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(FIRMA.name, 14, 30);
  doc.text(`Druckdatum: ${formatDatum(new Date())}`, 14, 35);
  doc.text(`Lieferung Nr.: ${lieferung.id}`, 14, 40);
  doc.text(`Lieferdatum: ${formatDatum(lieferung.datum)}`, 14, 45);

  // ── Empfänger-Box ───────────────────────────────────────────────────────────
  doc.setDrawColor(200);
  doc.setLineWidth(0.3);
  doc.rect(120, 20, 78, 40);
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text("Empfänger", 124, 27);
  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.setFont("helvetica", "bold");
  doc.text(k.firma ?? k.name, 124, 34);
  if (k.firma) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(k.name, 124, 39);
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  let adressY = k.firma ? 44 : 40;
  if (k.strasse) { doc.text(k.strasse, 124, adressY); adressY += 5; }
  if (k.plz || k.ort) doc.text([k.plz, k.ort].filter(Boolean).join(" "), 124, adressY);

  // ── Positionen ──────────────────────────────────────────────────────────────
  autoTable(doc, {
    startY: 65,
    head: [["Pos.", "Artikelnummer", "Bezeichnung", "Menge", "Einheit"]],
    body: lieferung.positionen.map((p, i) => [
      String(i + 1),
      p.artikel.artikelnummer,
      p.artikel.name,
      p.menge.toFixed(2),
      p.artikel.einheit,
    ]),
    headStyles: { fillColor: [22, 101, 52] },
    styles: { fontSize: 9 },
  });

  // ── Unterschriftsfeld ───────────────────────────────────────────────────────
  const finalY = (doc as JsPDFWithAutoTable).lastAutoTable.finalY + 20;
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text("Empfangen von:", 14, finalY + 15);
  doc.text("Unterschrift Empfänger:", 110, finalY + 15);
  doc.setLineWidth(0.3);
  doc.line(14, finalY + 28, 90, finalY + 28);
  doc.line(110, finalY + 28, 196, finalY + 28);
  doc.text("Datum / Unterschrift", 14, finalY + 33);
  doc.text("Ort / Datum / Unterschrift", 110, finalY + 33);

  if (lieferung.notiz) {
    doc.setFontSize(8);
    doc.setTextColor(80);
    doc.text(`Hinweis: ${lieferung.notiz}`, 14, finalY + 45);
  }

  return Buffer.from(doc.output("arraybuffer"));
}
