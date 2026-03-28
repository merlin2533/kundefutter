import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { naechsteRechnungsnummer, formatDatum, formatEuro } from "@/lib/utils";
import { ladeFirmaDaten } from "@/lib/firma";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const JSZip = require("jszip");

// ── Lieferschein PDF ──────────────────────────────────────────────────────────
function buildLieferscheinPdf(
  lieferung: {
    id: number;
    datum: Date | string;
    notiz?: string | null;
    kunde: { name: string; firma?: string | null; strasse?: string | null; plz?: string | null; ort?: string | null };
    positionen: { menge: number; chargeNr?: string | null; artikel: { artikelnummer: string; name: string; einheit: string } }[];
  },
  firma: Awaited<ReturnType<typeof ladeFirmaDaten>>
): Buffer {
  const doc = new jsPDF();
  const k = lieferung.kunde;

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(22, 101, 52);
  doc.text(firma.name, 14, 18);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80);
  if (firma.strasse || firma.plzOrt) doc.text([firma.strasse, firma.plzOrt].filter(Boolean).join(", "), 14, 24);

  doc.setDrawColor(22, 101, 52);
  doc.setLineWidth(0.5);
  doc.line(14, 28, 196, 28);

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.text("LIEFERSCHEIN", 14, 40);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60);
  doc.text(`Lieferschein-Nr: LS-${lieferung.id}`, 14, 47);
  doc.text(`Datum: ${formatDatum(lieferung.datum)}`, 14, 53);

  doc.setDrawColor(200);
  doc.setLineWidth(0.3);
  doc.rect(120, 34, 78, 30);
  doc.setFontSize(7);
  doc.setTextColor(130);
  doc.text("Empfänger", 124, 40);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.text(k.firma ?? k.name, 124, 46);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  if (k.firma) doc.text(k.name, 124, 51);
  let ry = k.firma ? 57 : 52;
  if (k.strasse) { doc.text(k.strasse, 124, ry); ry += 5; }
  if (k.plz || k.ort) doc.text([k.plz, k.ort].filter(Boolean).join(" "), 124, ry);

  autoTable(doc, {
    startY: 62,
    head: [["Pos.", "Art.-Nr.", "Bezeichnung", "Menge", "Charge"]],
    body: lieferung.positionen.map((p, i) => [
      String(i + 1),
      p.artikel.artikelnummer,
      p.artikel.name,
      `${p.menge.toFixed(2)} ${p.artikel.einheit}`,
      p.chargeNr ?? "",
    ]),
    headStyles: { fillColor: [22, 101, 52] },
    styles: { fontSize: 9 },
  });

  const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16;
  doc.setFontSize(9);
  doc.setTextColor(60);
  if (lieferung.notiz) doc.text(`Notiz: ${lieferung.notiz}`, 14, finalY);
  doc.text("Unterschrift Empfänger: ____________________________", 14, finalY + 14);

  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(`${firma.name}`, 105, 285, { align: "center" });

  return Buffer.from(doc.output("arraybuffer"));
}

// ── Rechnung PDF ──────────────────────────────────────────────────────────────
function buildRechnungPdf(
  lieferung: {
    id: number;
    datum: Date | string;
    rechnungNr?: string | null;
    rechnungDatum?: Date | string | null;
    zahlungsziel?: number | null;
    notiz?: string | null;
    kunde: { name: string; firma?: string | null; strasse?: string | null; plz?: string | null; ort?: string | null };
    positionen: { menge: number; verkaufspreis: number; artikel: { artikelnummer: string; name: string; einheit: string } }[];
  },
  firma: Awaited<ReturnType<typeof ladeFirmaDaten>>
): Buffer {
  const doc = new jsPDF();
  const k = lieferung.kunde;
  const mwstSatz = 7;
  const zahlungsziel = lieferung.zahlungsziel ?? 30;
  const rechnungDatum = lieferung.rechnungDatum ? new Date(lieferung.rechnungDatum) : new Date();
  const faelligDatum = new Date(rechnungDatum.getTime() + zahlungsziel * 24 * 60 * 60 * 1000);

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(22, 101, 52);
  doc.text(firma.name, 14, 18);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80);
  if (firma.zusatz) doc.text(firma.zusatz, 14, 24);
  const adrTeile = [firma.strasse, firma.plzOrt].filter(Boolean);
  if (adrTeile.length) doc.text(adrTeile.join(" · "), 14, 29);
  const ktTeile = [firma.telefon && `Tel: ${firma.telefon}`, firma.email].filter(Boolean);
  if (ktTeile.length) doc.text(ktTeile.join(" · "), 14, 34);
  doc.setDrawColor(22, 101, 52);
  doc.setLineWidth(0.5);
  doc.line(14, 38, 196, 38);

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

  const rows = lieferung.positionen.map((p, i) => {
    const netto = p.menge * p.verkaufspreis;
    return [String(i + 1), p.artikel.artikelnummer, p.artikel.name, `${p.menge.toFixed(2)} ${p.artikel.einheit}`, formatEuro(p.verkaufspreis), formatEuro(netto)];
  });
  autoTable(doc, {
    startY: 82,
    head: [["Pos.", "Art.-Nr.", "Bezeichnung", "Menge", "Einzel (€)", "Gesamt (€)"]],
    body: rows,
    headStyles: { fillColor: [22, 101, 52] },
    styles: { fontSize: 9 },
    columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 25 }, 4: { halign: "right" }, 5: { halign: "right" } },
  });

  const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  const netto = lieferung.positionen.reduce((s, p) => s + p.menge * p.verkaufspreis, 0);
  const mwst = netto * (mwstSatz / 100);
  const brutto = netto + mwst;
  const sumX = 140;
  doc.setFontSize(9);
  doc.setTextColor(0);
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

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(60);
  doc.text(`Zahlbar bis: ${formatDatum(faelligDatum)} (${zahlungsziel} Tage netto)`, 14, finalY + 28);
  if (firma.iban) doc.text(`Bankverbindung: ${firma.bank}  ·  IBAN: ${firma.iban}  ·  BIC: ${firma.bic}`, 14, finalY + 34);
  if (firma.steuernummer) doc.text(`Steuernummer: ${firma.steuernummer}`, 14, finalY + 40);
  if (lieferung.notiz) doc.text(`Hinweis: ${lieferung.notiz}`, 14, finalY + 48);

  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(`${firma.name} – Alle Preise gemäß aktueller Preisliste. Irrtümer vorbehalten.`, 105, 285, { align: "center" });

  return Buffer.from(doc.output("arraybuffer"));
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const typ = searchParams.get("typ"); // "rechnung" | "lieferschein"
  const kundeId = searchParams.get("kundeId");
  const von = searchParams.get("von");
  const bis = searchParams.get("bis");
  const rnrVon = searchParams.get("rnrVon"); // Rechnungsnummer von (string prefix)
  const rnrBis = searchParams.get("rnrBis"); // Rechnungsnummer bis (string prefix)

  if (typ !== "rechnung" && typ !== "lieferschein") {
    return NextResponse.json({ error: "typ muss 'rechnung' oder 'lieferschein' sein" }, { status: 400 });
  }

  const where: Record<string, unknown> = { status: "geliefert" };
  if (kundeId) where.kundeId = Number(kundeId);
  if (von || bis) {
    where.datum = {};
    if (von) (where.datum as Record<string, unknown>).gte = new Date(von);
    if (bis) {
      const bisDate = new Date(bis);
      bisDate.setHours(23, 59, 59, 999);
      (where.datum as Record<string, unknown>).lte = bisDate;
    }
  }
  if (typ === "rechnung") {
    where.rechnungNr = { not: null };
  }

  const lieferungen = await prisma.lieferung.findMany({
    where,
    include: {
      kunde: true,
      positionen: { include: { artikel: true } },
    },
    orderBy: typ === "rechnung" ? { rechnungNr: "asc" } : { datum: "asc" },
  });

  // Apply rechnungNr filter client-side (string comparison)
  const filtered = typ === "rechnung" && (rnrVon || rnrBis)
    ? lieferungen.filter((l) => {
        const nr = l.rechnungNr ?? "";
        if (rnrVon && nr < rnrVon) return false;
        if (rnrBis && nr > rnrBis) return false;
        return true;
      })
    : lieferungen;

  if (filtered.length === 0) {
    return NextResponse.json({ error: "Keine Lieferungen für diese Filter gefunden" }, { status: 404 });
  }

  const firma = await ladeFirmaDaten();
  const zip = new JSZip();
  const folder = zip.folder(typ === "rechnung" ? "rechnungen" : "lieferscheine");

  for (const lieferung of filtered) {
    let pdfBuf: Buffer;
    let filename: string;
    if (typ === "rechnung") {
      pdfBuf = buildRechnungPdf(lieferung, firma);
      filename = `rechnung-${lieferung.rechnungNr?.replace(/\//g, "-") ?? lieferung.id}-${formatDatum(lieferung.datum).replace(/\./g, "-")}.pdf`;
    } else {
      pdfBuf = buildLieferscheinPdf(lieferung, firma);
      filename = `lieferschein-LS-${lieferung.id}-${formatDatum(lieferung.datum).replace(/\./g, "-")}.pdf`;
    }
    folder!.file(filename, pdfBuf);
  }

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" }) as Buffer;
  const date = new Date().toISOString().slice(0, 10);
  const zipFilename = `${typ === "rechnung" ? "rechnungen" : "lieferscheine"}-massenexport-${date}.zip`;

  return new NextResponse(zipBuffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${zipFilename}"`,
      "X-Export-Count": String(filtered.length),
    },
  });
}
