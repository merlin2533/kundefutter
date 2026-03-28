import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// GET /api/agrarantraege/pdf?kundeId=X  — Antragsdaten-PDF für einen Kunden
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const kundeId = Number(searchParams.get("kundeId"));
  if (!kundeId) return NextResponse.json({ error: "kundeId fehlt" }, { status: 400 });

  const kunde = await prisma.kunde.findUnique({
    where: { id: kundeId },
    include: { antragDaten: { orderBy: { haushaltsjahr: "desc" } } },
  });
  if (!kunde) return NextResponse.json({ error: "Kunde nicht gefunden" }, { status: 404 });

  const doc = new jsPDF();

  // Header
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Agrarantrag-Daten", 14, 20);

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(kunde.firma ? `${kunde.firma} / ${kunde.name}` : kunde.name, 14, 30);
  if (kunde.plz || kunde.ort) {
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text([kunde.plz, kunde.ort].filter(Boolean).join(" "), 14, 36);
  }
  if (kunde.betriebsnummer) {
    doc.setFontSize(9);
    doc.setTextColor(80);
    doc.text(`Betriebsnummer: ${kunde.betriebsnummer}`, 14, 42);
  }
  if (kunde.flaeche) {
    doc.text(`Fläche: ${kunde.flaeche} ha`, 14, kunde.betriebsnummer ? 48 : 42);
  }

  doc.setTextColor(0);

  let y = kunde.betriebsnummer || kunde.flaeche ? 60 : 48;

  if (kunde.antragDaten.length === 0) {
    doc.setFontSize(10);
    doc.text("Keine Antragsdaten verknüpft.", 14, y);
  } else {
    for (const antrag of kunde.antragDaten) {
      // Jahr-Header
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(`Haushaltsjahr ${antrag.haushaltsjahr}`, 14, y);
      y += 6;

      // Übersicht
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80);
      doc.text(`EGFL: ${antrag.egflGesamt.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}   ELER: ${antrag.elerGesamt.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}   Gesamt: ${antrag.gesamtBetrag.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}`, 14, y);
      y += 5;
      if (antrag.gemeinde || antrag.land) {
        doc.text(`Gemeinde: ${[antrag.gemeinde, antrag.land].filter(Boolean).join(", ")}`, 14, y);
        y += 5;
      }
      doc.setTextColor(0);

      // Maßnahmen-Tabelle
      if (antrag.massnahmen) {
        let massnahmen: Array<{ code: string; ziel: string; egfl: number; eler: number }> = [];
        try { massnahmen = JSON.parse(antrag.massnahmen); } catch { /* ignore */ }

        if (massnahmen.length > 0) {
          autoTable(doc, {
            startY: y,
            head: [["Maßnahme-Code", "Spezifisches Ziel", "EGFL (EUR)", "ELER (EUR)"]],
            body: massnahmen.map((m) => [
              m.code,
              m.ziel ?? "—",
              m.egfl > 0 ? m.egfl.toLocaleString("de-DE", { minimumFractionDigits: 2 }) : "—",
              m.eler > 0 ? m.eler.toLocaleString("de-DE", { minimumFractionDigits: 2 }) : "—",
            ]),
            headStyles: { fillColor: [22, 101, 52], fontSize: 8 },
            styles: { fontSize: 8, cellPadding: 2 },
            columnStyles: { 1: { cellWidth: 70 } },
          });
          y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
        }
      }

      y += 4;
      if (y > 260) { doc.addPage(); y = 20; }
    }
  }

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(`Quelle: AFIG agrarzahlungen.de — Gedruckt: ${new Date().toLocaleDateString("de-DE")}`, 14, 285);

  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="agrarantrag-kunde-${kundeId}.pdf"`,
    },
  });
}
