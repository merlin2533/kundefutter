import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDatum } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const datum = searchParams.get("datum");

  if (!datum) {
    return NextResponse.json({ error: "datum fehlt (YYYY-MM-DD)" }, { status: 400 });
  }

  const von = new Date(datum);
  von.setHours(0, 0, 0, 0);
  const bis = new Date(datum);
  bis.setHours(23, 59, 59, 999);

  const lieferungen = await prisma.lieferung.findMany({
    where: {
      status: "geplant",
      datum: { gte: von, lte: bis },
    },
    include: {
      kunde: { include: { kontakte: true } },
      positionen: { include: { artikel: true } },
    },
    orderBy: { datum: "asc" },
  });

  // Sortierung nach PLZ des Kunden (aufsteigend)
  lieferungen.sort((a, b) => {
    const plzA = a.kunde.plz ?? "";
    const plzB = b.kunde.plz ?? "";
    return plzA.localeCompare(plzB);
  });

  const tourname = searchParams.get("tourname");
  const heute = formatDatum(new Date());
  const datumFormatiert = formatDatum(new Date(datum));

  const doc = new jsPDF({ orientation: "landscape" });

  // Header
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  const titel = tourname
    ? `${tourname} - ${datumFormatiert}`
    : `Tourenliste - ${datumFormatiert}`;
  doc.text(titel, 14, 20);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text("AgrarOffice Röthemeier", 14, 28);
  doc.text(`Gedruckt: ${heute}`, 14, 33);
  doc.setTextColor(0);

  // Tabelle
  const tableBody = lieferungen.map((l, i) => {
    const k = l.kunde;
    const telefon =
      k.kontakte.find(ko => ko.typ === "telefon")?.wert ??
      k.kontakte.find(ko => ko.typ === "mobil")?.wert ??
      "–";

    const positionenText = l.positionen
      .map(p => `${p.artikel.name}: ${p.menge} ${p.artikel.einheit}`)
      .join("\n");

    return [
      String(i + 1),
      k.plz ?? "–",
      k.ort ?? "–",
      k.firma ? `${k.firma}\n${k.name}` : k.name,
      telefon,
      positionenText || "–",
      "", // Unterschrift
    ];
  });

  autoTable(doc, {
    startY: 40,
    head: [["Nr.", "PLZ", "Ort", "Kunde", "Telefon", "Positionen", "Unterschrift"]],
    body: tableBody,
    headStyles: { fillColor: [22, 101, 52], fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 18 },
      2: { cellWidth: 30 },
      3: { cellWidth: 45 },
      4: { cellWidth: 30 },
      5: { cellWidth: 80 },
      6: { cellWidth: 45 },
    },
    bodyStyles: { minCellHeight: 18 },
  });

  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
  const filename = `tourenliste-${datum}.pdf`;

  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
