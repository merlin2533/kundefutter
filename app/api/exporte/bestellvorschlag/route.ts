import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDatum } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lieferantId = searchParams.get("lieferantId");
  const zeitraum = searchParams.get("zeitraum") ?? "90";
  const zielhorizont = searchParams.get("zielhorizont") ?? "30";
  const schwellwert = searchParams.get("schwellwert") ?? "21";
  const saisonal = searchParams.get("saisonal") ?? "false";

  // Bestellvorschlag von Prognose-API holen
  const baseUrl = req.nextUrl.origin;
  const progUrl = `${baseUrl}/api/prognose/bestellvorschlag?zeitraum=${zeitraum}&zielhorizont=${zielhorizont}&schwellwert=${schwellwert}&saisonal=${saisonal}`;
  const progRes = await fetch(progUrl);
  const alleGruppen: {
    lieferantId: number;
    lieferantName: string;
    positionen: {
      artikelName: string;
      artikelnummer: string;
      einheit: string;
      bestellmenge: number;
      bevorzugterLieferant: { einkaufspreis: number; mindestbestellmenge: number } | null;
    }[];
    gesamtEinkaufswert: number;
  }[] = await progRes.json();

  const gruppen = lieferantId
    ? alleGruppen.filter(g => g.lieferantId === Number(lieferantId))
    : alleGruppen;

  if (gruppen.length === 0) {
    return NextResponse.json({ error: "Keine Bestellvorschläge" }, { status: 404 });
  }

  // Lieferantendaten für Adresse
  const lieferantenIds = gruppen.map(g => g.lieferantId).filter(Boolean);
  const lieferantenDb = await prisma.lieferant.findMany({
    where: { id: { in: lieferantenIds } },
  });
  const lieferantenMap = Object.fromEntries(lieferantenDb.map(l => [l.id, l]));

  const doc = new jsPDF();
  const heute = formatDatum(new Date());

  gruppen.forEach((gruppe, idx) => {
    if (idx > 0) doc.addPage();

    const lieferant = lieferantenMap[gruppe.lieferantId];

    // Header
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Bestellvorschlag", 14, 20);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Datum: ${heute}`, 14, 28);
    doc.text(`Prognose-Zeitraum: ${zeitraum} Tage | Zielhorizont: ${zielhorizont} Tage`, 14, 33);

    // Lieferant-Box
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`Lieferant: ${gruppe.lieferantName}`, 14, 44);
    if (lieferant) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      if (lieferant.ansprechpartner) doc.text(`Ansprechpartner: ${lieferant.ansprechpartner}`, 14, 50);
      if (lieferant.email) doc.text(`E-Mail: ${lieferant.email}`, 14, 55);
      if (lieferant.telefon) doc.text(`Telefon: ${lieferant.telefon}`, 14, 60);
    }

    // Tabelle
    autoTable(doc, {
      startY: lieferant ? 68 : 52,
      head: [["Artikelnummer", "Bezeichnung", "Bestellmenge", "Einheit", "Einkaufspreis", "Gesamtwert"]],
      body: gruppe.positionen.map(p => [
        p.artikelnummer,
        p.artikelName,
        p.bestellmenge.toFixed(2),
        p.einheit,
        p.bevorzugterLieferant ? `${p.bevorzugterLieferant.einkaufspreis.toFixed(2)} €` : "-",
        p.bevorzugterLieferant
          ? `${(p.bestellmenge * p.bevorzugterLieferant.einkaufspreis).toFixed(2)} €`
          : "-",
      ]),
      foot: [["", "Gesamt", "", "", "", `${gruppe.gesamtEinkaufswert.toFixed(2)} €`]],
      headStyles: { fillColor: [22, 101, 52] },
      footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold" },
    });
  });

  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
  const filename = lieferantId
    ? `bestellvorschlag-lieferant-${lieferantId}-${new Date().toISOString().slice(0, 10)}.pdf`
    : `bestellvorschlag-alle-${new Date().toISOString().slice(0, 10)}.pdf`;

  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
