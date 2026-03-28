import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDatum } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lieferungId = searchParams.get("lieferungId");

  if (!lieferungId) {
    return NextResponse.json({ error: "lieferungId fehlt" }, { status: 400 });
  }

  const lieferung = await prisma.lieferung.findUnique({
    where: { id: Number(lieferungId) },
    include: {
      kunde: { include: { kontakte: true } },
      positionen: { include: { artikel: true } },
    },
  });

  if (!lieferung) {
    return NextResponse.json({ error: "Lieferung nicht gefunden" }, { status: 404 });
  }

  const doc = new jsPDF();
  const heute = formatDatum(new Date());
  const k = lieferung.kunde;

  // Header
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Lieferschein", 14, 22);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text("AgrarOffice Röthemeier", 14, 30);
  doc.text(`Druckdatum: ${heute}`, 14, 35);
  doc.text(`Lieferung Nr.: ${lieferung.id}`, 14, 40);
  doc.text(`Lieferdatum: ${formatDatum(lieferung.datum)}`, 14, 45);

  // Empfänger-Box
  doc.setDrawColor(200);
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

  // Tabelle
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

  // Unterschriften
  const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20;
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text("Empfangen von:", 14, finalY + 15);
  doc.text("Unterschrift Empfänger:", 110, finalY + 15);
  doc.line(14, finalY + 28, 90, finalY + 28);
  doc.line(110, finalY + 28, 196, finalY + 28);
  doc.text("Datum / Unterschrift", 14, finalY + 33);
  doc.text("Ort / Datum / Unterschrift", 110, finalY + 33);

  if (lieferung.notiz) {
    doc.setFontSize(8);
    doc.setTextColor(80);
    doc.text(`Hinweis: ${lieferung.notiz}`, 14, finalY + 45);
  }

  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
  const filename = `lieferschein-${lieferung.id}-${new Date().toISOString().slice(0, 10)}.pdf`;

  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
