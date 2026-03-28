import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ladeFirmaDaten } from "@/lib/firma";
import { formatDatum, formatEuro } from "@/lib/utils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// GET /api/exporte/kundenmappe?kundeId=X
// Erzeugt eine Kunden-Übersichtsmappe als PDF mit:
// - Stammdaten, Kontakte
// - Letzte 10 Lieferungen
// - Offene Rechnungen
// - Letzte CRM-Aktivitäten / Besuchshistorie
// - Bedarfe / Sonderpreise

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const kundeId = Number(searchParams.get("kundeId"));
  if (!kundeId) return NextResponse.json({ error: "kundeId fehlt" }, { status: 400 });

  const kunde = await prisma.kunde.findUnique({
    where: { id: kundeId },
    include: {
      kontakte: true,
      bedarfe: { include: { artikel: true } },
      artikelPreise: { include: { artikel: true }, take: 20 },
      lieferungen: {
        where: { status: { not: "storniert" } },
        include: { positionen: { include: { artikel: true } } },
        orderBy: { datum: "desc" },
        take: 10,
      },
      aktivitaeten: {
        orderBy: { datum: "desc" },
        take: 15,
      },
    },
  });

  if (!kunde) return NextResponse.json({ error: "Kunde nicht gefunden" }, { status: 404 });

  const firma = await ladeFirmaDaten();
  const doc = new jsPDF();
  const heute = formatDatum(new Date());

  // ── Deckblatt-Header ──────────────────────────────────────────────────────
  doc.setFillColor(22, 101, 52);
  doc.rect(0, 0, 210, 30, "F");
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255);
  doc.text(firma.name, 14, 13);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Kundenmappe · Stand: ${heute}`, 14, 21);

  // ── Kundenname ────────────────────────────────────────────────────────────
  doc.setTextColor(0);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(kunde.firma ?? kunde.name, 14, 48);
  if (kunde.firma) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80);
    doc.text(kunde.name, 14, 56);
  }

  // Kategorie-Badge
  doc.setFontSize(9);
  doc.setTextColor(22, 101, 52);
  doc.text(`Kategorie: ${kunde.kategorie}`, 14, 64);
  doc.setTextColor(100);
  if (!kunde.aktiv) doc.text("INAKTIV", 80, 64);

  // Adresse
  let adY = 72;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60);
  if (kunde.strasse) { doc.text(kunde.strasse, 14, adY); adY += 5; }
  if (kunde.plz || kunde.ort) { doc.text([kunde.plz, kunde.ort].filter(Boolean).join(" "), 14, adY); adY += 5; }
  if (kunde.notizen) { doc.text(`Notiz: ${kunde.notizen}`, 14, adY); adY += 5; }

  // Kontakte
  if (kunde.kontakte.length > 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text("Kontakte", 14, adY + 4);
    adY += 8;
    for (const k of kunde.kontakte) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60);
      doc.text(`${k.typ}${k.label ? ` (${k.label})` : ""}: ${k.wert}`, 18, adY);
      adY += 5;
    }
  }

  // ── Offene Rechnungen ─────────────────────────────────────────────────────
  const offeneRechnungen = kunde.lieferungen.filter((l) => l.rechnungNr && !l.bezahltAm);
  if (offeneRechnungen.length > 0) {
    adY += 4;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(180, 0, 0);
    doc.text(`Offene Rechnungen (${offeneRechnungen.length})`, 14, adY);
    adY += 2;
    autoTable(doc, {
      startY: adY,
      head: [["Rechnung-Nr.", "Lieferdatum", "Betrag (netto)", "Fällig"]],
      body: offeneRechnungen.map((l) => {
        const netto = l.positionen.reduce((s, p) => s + p.menge * p.verkaufspreis, 0);
        const fällig = new Date(new Date(l.rechnungDatum ?? l.datum).getTime() + (l.zahlungsziel ?? 30) * 86400000);
        return [l.rechnungNr ?? "—", formatDatum(l.datum), formatEuro(netto), formatDatum(fällig)];
      }),
      headStyles: { fillColor: [180, 0, 0], fontSize: 8 },
      styles: { fontSize: 8 },
      margin: { left: 14, right: 14 },
    });
    adY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  }

  // ── Letzte 10 Lieferungen ─────────────────────────────────────────────────
  if (kunde.lieferungen.length > 0) {
    if (adY > 220) { doc.addPage(); adY = 20; }
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(22, 101, 52);
    doc.text("Letzte Lieferungen", 14, adY + 4);
    adY += 2;
    autoTable(doc, {
      startY: adY,
      head: [["Datum", "Status", "Artikel", "Betrag"]],
      body: kunde.lieferungen.map((l) => {
        const artikel = l.positionen.map((p) => `${p.menge} × ${p.artikel.name}`).join(", ");
        const netto = l.positionen.reduce((s, p) => s + p.menge * p.verkaufspreis, 0);
        return [formatDatum(l.datum), l.status, artikel.slice(0, 60) + (artikel.length > 60 ? "…" : ""), formatEuro(netto)];
      }),
      headStyles: { fillColor: [22, 101, 52], fontSize: 8 },
      styles: { fontSize: 8 },
      columnStyles: { 2: { cellWidth: 70 } },
      margin: { left: 14, right: 14 },
    });
    adY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  }

  // ── Bedarfe ───────────────────────────────────────────────────────────────
  if (kunde.bedarfe.length > 0) {
    if (adY > 220) { doc.addPage(); adY = 20; }
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(22, 101, 52);
    doc.text("Wiederkehrende Bedarfe", 14, adY + 4);
    adY += 2;
    autoTable(doc, {
      startY: adY,
      head: [["Artikel", "Menge", "Intervall (Tage)"]],
      body: kunde.bedarfe.map((b) => [b.artikel.name, `${b.menge} ${b.artikel.einheit}`, String(b.intervallTage)]),
      headStyles: { fillColor: [22, 101, 52], fontSize: 8 },
      styles: { fontSize: 8 },
      margin: { left: 14, right: 14 },
    });
    adY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  }

  // ── Sonderpreise ──────────────────────────────────────────────────────────
  if (kunde.artikelPreise.length > 0) {
    if (adY > 220) { doc.addPage(); adY = 20; }
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(22, 101, 52);
    doc.text("Individuelle Preise / Rabatte", 14, adY + 4);
    adY += 2;
    autoTable(doc, {
      startY: adY,
      head: [["Artikel", "Listenpreis", "Sonderpreis", "Rabatt %"]],
      body: kunde.artikelPreise.map((p) => [
        p.artikel.name,
        formatEuro(p.artikel.standardpreis),
        formatEuro(p.preis),
        `${p.rabatt}%`,
      ]),
      headStyles: { fillColor: [22, 101, 52], fontSize: 8 },
      styles: { fontSize: 8 },
      margin: { left: 14, right: 14 },
    });
    adY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  }

  // ── Besuchshistorie / CRM ─────────────────────────────────────────────────
  if (kunde.aktivitaeten.length > 0) {
    if (adY > 200) { doc.addPage(); adY = 20; }
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(22, 101, 52);
    doc.text("Besuchs- und Kontakthistorie", 14, adY + 4);
    adY += 2;
    autoTable(doc, {
      startY: adY,
      head: [["Datum", "Typ", "Betreff", "Details"]],
      body: kunde.aktivitaeten.map((a) => [
        new Date(a.datum).toLocaleDateString("de-DE"),
        a.typ.charAt(0).toUpperCase() + a.typ.slice(1),
        a.betreff,
        (a.inhalt ?? "").slice(0, 80) + ((a.inhalt?.length ?? 0) > 80 ? "…" : ""),
      ]),
      headStyles: { fillColor: [22, 101, 52], fontSize: 8 },
      styles: { fontSize: 8 },
      columnStyles: { 3: { cellWidth: 60 } },
      margin: { left: 14, right: 14 },
    });
  }

  // ── Fußzeile ──────────────────────────────────────────────────────────────
  const pageCount = (doc as jsPDF & { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`${firma.name} · Kundenmappe · ${heute} · Seite ${i}/${pageCount}`, 105, 290, { align: "center" });
  }

  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
  const safeName = (kunde.firma ?? kunde.name).replace(/[^a-zA-Z0-9äöüÄÖÜ\-]/g, "_").slice(0, 40);
  const filename = `kundenmappe-${safeName}-${new Date().toISOString().slice(0, 10)}.pdf`;

  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
