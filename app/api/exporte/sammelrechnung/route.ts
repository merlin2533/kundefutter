import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { naechsteRechnungsnummer, formatDatum, formatEuro } from "@/lib/utils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const FIRMA = {
  name: "Landhandel Röthemeier",
  zusatz: "AgrarOffice",
  strasse: "",
  plzOrt: "",
  telefon: "",
  email: "",
  steuernummer: "",
  iban: "",
  bic: "",
  bank: "",
};

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { kundeId, lieferungIds } = body as { kundeId: number; lieferungIds: number[] };

  if (!kundeId || !Array.isArray(lieferungIds) || lieferungIds.length < 2) {
    return NextResponse.json({ error: "kundeId und mindestens 2 lieferungIds erforderlich" }, { status: 400 });
  }

  // Create Sammelrechnung in a transaction
  let sammelrechnung;
  try {
  sammelrechnung = await prisma.$transaction(async (tx) => {
    // Pruefen ob Lieferungen bereits eine Rechnung oder Sammelrechnung haben
    const betroffene = await tx.lieferung.findMany({
      where: { id: { in: lieferungIds }, kundeId },
      select: { id: true, rechnungNr: true, sammelrechnungId: true, status: true },
    });
    if (betroffene.length !== lieferungIds.length) {
      throw new Error("Nicht alle Lieferungen wurden gefunden oder gehoeren nicht zum angegebenen Kunden");
    }
    const bereitsAbgerechnet = betroffene.filter((l) => l.rechnungNr || l.sammelrechnungId);
    if (bereitsAbgerechnet.length > 0) {
      throw new Error(`Lieferungen ${bereitsAbgerechnet.map((l) => l.id).join(", ")} haben bereits eine Rechnung`);
    }
    const nichtGeliefert = betroffene.filter((l) => l.status !== "geliefert");
    if (nichtGeliefert.length > 0) {
      throw new Error(`Lieferungen ${nichtGeliefert.map((l) => l.id).join(", ")} haben nicht den Status "geliefert"`);
    }

    // Get next invoice number
    const einstellung = await tx.einstellung.findUnique({ where: { key: "letzte_rechnungsnummer" } });
    const rechnungNr = naechsteRechnungsnummer(einstellung?.value ?? null);
    await tx.einstellung.upsert({
      where: { key: "letzte_rechnungsnummer" },
      update: { value: rechnungNr },
      create: { key: "letzte_rechnungsnummer", value: rechnungNr },
    });

    const sr = await tx.sammelrechnung.create({
      data: {
        kundeId,
        rechnungNr,
        rechnungDatum: new Date(),
        zahlungsziel: 30,
      },
    });

    // Link all deliveries to this Sammelrechnung
    await tx.lieferung.updateMany({
      where: { id: { in: lieferungIds }, kundeId },
      data: { sammelrechnungId: sr.id, rechnungNr },
    });

    return tx.sammelrechnung.findUnique({
      where: { id: sr.id },
      include: {
        kunde: { include: { kontakte: true } },
        lieferungen: {
          include: {
            positionen: { include: { artikel: true } },
          },
          orderBy: { datum: "asc" },
        },
      },
    });
  });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (!sammelrechnung) {
    return NextResponse.json({ error: "Fehler beim Erstellen der Sammelrechnung" }, { status: 500 });
  }

  const k = sammelrechnung.kunde;
  const doc = new jsPDF();
  const mwstSatz = 7;

  // ── Header ────────────────────────────────────────────────────────────────
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

  // ── Title ─────────────────────────────────────────────────────────────────
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.text("SAMMELRECHNUNG", 14, 50);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60);
  doc.text(`Rechnungsnummer: ${sammelrechnung.rechnungNr}`, 14, 57);
  doc.text(`Datum: ${formatDatum(sammelrechnung.rechnungDatum ?? new Date())}`, 14, 63);
  doc.text(`Zahlungsziel: ${sammelrechnung.zahlungsziel} Tage`, 14, 69);

  // ── Recipient box ─────────────────────────────────────────────────────────
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
  if (k.firma) doc.text(k.name, 124, 61);
  let ry = k.firma ? 66 : 62;
  if (k.strasse) { doc.text(k.strasse, 124, ry); ry += 5; }
  if (k.plz || k.ort) doc.text([k.plz, k.ort].filter(Boolean).join(" "), 124, ry);

  let currentY = 82;

  // ── Per-Lieferung sections ────────────────────────────────────────────────
  for (const lieferung of sammelrechnung.lieferungen) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(22, 101, 52);
    doc.text(`Lieferung vom ${formatDatum(lieferung.datum)} (Nr. ${lieferung.id})`, 14, currentY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0);

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
      startY: currentY + 3,
      head: [["Pos.", "Art.-Nr.", "Bezeichnung", "Menge", "Einzel (€)", "Gesamt (€)"]],
      body: rows,
      headStyles: { fillColor: [22, 101, 52], fontSize: 8 },
      styles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 22 },
        4: { halign: "right" },
        5: { halign: "right" },
      },
      margin: { left: 14, right: 14 },
    });

    currentY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

    // Check if we need a new page
    if (currentY > 240 && lieferung !== sammelrechnung.lieferungen[sammelrechnung.lieferungen.length - 1]) {
      doc.addPage();
      currentY = 20;
    }
  }

  // ── Gesamttabelle ─────────────────────────────────────────────────────────
  if (currentY > 220) {
    doc.addPage();
    currentY = 20;
  }

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(22, 101, 52);
  doc.text("Gesamtübersicht", 14, currentY);
  currentY += 4;

  const allPositionen = sammelrechnung.lieferungen.flatMap((l) =>
    l.positionen.map((p) => ({
      ...p,
      lieferDatum: l.datum,
    }))
  );

  const gesamtRows = allPositionen.map((p, i) => {
    const netto = p.menge * p.verkaufspreis;
    return [
      String(i + 1),
      formatDatum(p.lieferDatum),
      p.artikel.name,
      `${p.menge.toFixed(2)} ${p.artikel.einheit}`,
      formatEuro(p.verkaufspreis),
      formatEuro(netto),
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [["Pos.", "Lieferdatum", "Bezeichnung", "Menge", "Einzel (€)", "Gesamt (€)"]],
    body: gesamtRows,
    headStyles: { fillColor: [22, 101, 52] },
    styles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 24 },
      4: { halign: "right" },
      5: { halign: "right" },
    },
    margin: { left: 14, right: 14 },
  });

  const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // ── Summen ────────────────────────────────────────────────────────────────
  const nettoGesamt = allPositionen.reduce((s, p) => s + p.menge * p.verkaufspreis, 0);
  const mwst = nettoGesamt * (mwstSatz / 100);
  const brutto = nettoGesamt + mwst;

  const sumX = 130;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0);
  doc.text("Nettobetrag:", sumX, finalY);
  doc.text(formatEuro(nettoGesamt), 196, finalY, { align: "right" });
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
  doc.text(`Zahlbar innerhalb von ${sammelrechnung.zahlungsziel} Tagen nach Rechnungserhalt.`, 14, finalY + 28);
  if (FIRMA.iban) {
    doc.text(`Bankverbindung: ${FIRMA.bank}  ·  IBAN: ${FIRMA.iban}  ·  BIC: ${FIRMA.bic}`, 14, finalY + 34);
  }
  if (FIRMA.steuernummer) {
    doc.text(`Steuernummer: ${FIRMA.steuernummer}`, 14, finalY + 40);
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(`${FIRMA.name} – Alle Preise gemäß aktueller Preisliste. Irrtümer vorbehalten.`, 105, 285, { align: "center" });

  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
  const filename = `sammelrechnung-${sammelrechnung.rechnungNr?.replace(/\//g, "-")}-${new Date().toISOString().slice(0, 10)}.pdf`;

  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
