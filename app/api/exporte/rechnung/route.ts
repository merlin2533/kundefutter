import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { naechsteRechnungsnummer, formatDatum, formatEuro } from "@/lib/utils";
import { ladeFirmaDaten } from "@/lib/firma";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lieferungId = searchParams.get("lieferungId");

  if (!lieferungId) {
    return NextResponse.json({ error: "lieferungId fehlt" }, { status: 400 });
  }

  // Rechnungsnummer ggf. automatisch vergeben (transaktionssicher)
  const lieferung = await prisma.$transaction(async (tx) => {
    const l = await tx.lieferung.findUnique({
      where: { id: Number(lieferungId) },
      include: {
        kunde: { include: { kontakte: true } },
        positionen: { include: { artikel: true } },
      },
    });
    if (!l) return null;

    if (!l.rechnungNr) {
      const einstellung = await tx.einstellung.findUnique({ where: { key: "letzte_rechnungsnummer" } });
      const rechnungNr = naechsteRechnungsnummer(einstellung?.value ?? null);
      await tx.einstellung.upsert({
        where: { key: "letzte_rechnungsnummer" },
        update: { value: rechnungNr },
        create: { key: "letzte_rechnungsnummer", value: rechnungNr },
      });
      return tx.lieferung.update({
        where: { id: Number(lieferungId) },
        data: { rechnungNr, rechnungDatum: new Date() },
        include: {
          kunde: { include: { kontakte: true } },
          positionen: { include: { artikel: true } },
        },
      });
    }
    return l;
  });

  if (!lieferung) {
    return NextResponse.json({ error: "Lieferung nicht gefunden" }, { status: 404 });
  }

  const FIRMA = await ladeFirmaDaten();
  const doc = new jsPDF();
  const k = lieferung.kunde;
  const zahlungsziel = lieferung.zahlungsziel ?? 30;
  const lieferDatum = new Date(lieferung.datum);
  const faelligDatum = new Date(lieferDatum.getTime() + zahlungsziel * 24 * 60 * 60 * 1000);
  const rechnungDatum = lieferung.rechnungDatum ? new Date(lieferung.rechnungDatum) : new Date();

  // ── Absender-Kopfzeile ────────────────────────────────────────────────────
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(22, 101, 52); // green-800
  doc.text(FIRMA.name, 14, 18);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80);
  if (FIRMA.zusatz) doc.text(FIRMA.zusatz, 14, 24);
  const adressTeile = [FIRMA.strasse, FIRMA.plzOrt].filter(Boolean);
  if (adressTeile.length) doc.text(adressTeile.join(" · "), 14, 29);
  const kontaktTeile = [FIRMA.telefon && `Tel: ${FIRMA.telefon}`, FIRMA.email].filter(Boolean);
  if (kontaktTeile.length) doc.text(kontaktTeile.join(" · "), 14, 34);

  // Trennlinie
  doc.setDrawColor(22, 101, 52);
  doc.setLineWidth(0.5);
  doc.line(14, 38, 196, 38);

  // ── Rechnungstitel ────────────────────────────────────────────────────────
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

  // ── Empfänger-Box ─────────────────────────────────────────────────────────
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

  // ── Positionen ────────────────────────────────────────────────────────────
  const mwstSatz = 7; // % — Lebensmittel/Agrar: 7%
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

  const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  // ── Summen ────────────────────────────────────────────────────────────────
  const netto = lieferung.positionen.reduce((s, p) => s + p.menge * p.verkaufspreis, 0);
  const mwst = netto * (mwstSatz / 100);
  const brutto = netto + mwst;

  doc.setFontSize(9);
  doc.setTextColor(0);
  const sumX = 140;
  doc.text("Nettobetrag:", sumX, finalY);
  doc.text(formatEuro(netto), 196, finalY, { align: "right" });
  doc.text(`MwSt. ${mwstSatz}%:`, sumX, finalY + 6);
  doc.text(formatEuro(mwst), 196, finalY + 6, { align: "right" });

  doc.setLineWidth(0.4);
  doc.line(sumX, finalY + 9, 196, finalY + 9);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Gesamtbetrag:", sumX, finalY + 16);
  doc.text(formatEuro(brutto), 196, finalY + 16, { align: "right" });

  // ── Zahlungsbedingungen ───────────────────────────────────────────────────
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(60);
  doc.text(`Zahlbar bis: ${formatDatum(faelligDatum)} (${zahlungsziel} Tage netto)`, 14, finalY + 28);

  if (FIRMA.iban) {
    doc.text(`Bankverbindung: ${FIRMA.bank}  ·  IBAN: ${FIRMA.iban}  ·  BIC: ${FIRMA.bic}`, 14, finalY + 34);
  }
  if (FIRMA.steuernummer) {
    doc.text(`Steuernummer: ${FIRMA.steuernummer}`, 14, finalY + 40);
  }

  if (lieferung.notiz) {
    doc.text(`Hinweis: ${lieferung.notiz}`, 14, finalY + 48);
  }

  // ── Fußzeile ──────────────────────────────────────────────────────────────
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(`${FIRMA.name} – Alle Preise gemäß aktueller Preisliste. Irrtümer vorbehalten.`, 105, 285, { align: "center" });

  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
  const filename = `rechnung-${lieferung.rechnungNr?.replace(/\//g, "-")}-${new Date().toISOString().slice(0, 10)}.pdf`;

  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
