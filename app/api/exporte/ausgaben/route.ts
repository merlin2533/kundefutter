import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDatum, formatEuro } from "@/lib/utils";
import { ladeFirmaDaten } from "@/lib/firma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const von = searchParams.get("von");
  const bis = searchParams.get("bis");
  const kategorie = searchParams.get("kategorie");
  const buchungstyp = searchParams.get("buchungstyp");
  const zahlungsweg = searchParams.get("zahlungsweg");

  try {
    const where: Record<string, unknown> = {};
    if (von || bis) {
      where.datum = {};
      if (von) (where.datum as Record<string, unknown>).gte = new Date(von + "T00:00:00");
      if (bis) (where.datum as Record<string, unknown>).lte = new Date(bis + "T23:59:59");
    }
    if (kategorie) where.kategorie = kategorie;
    if (buchungstyp) where.buchungstyp = buchungstyp;
    if (zahlungsweg) where.zahlungsweg = zahlungsweg;

    const ausgaben = await prisma.ausgabe.findMany({
      where,
      select: {
        datum: true,
        belegNr: true,
        beschreibung: true,
        kategorie: true,
        buchungstyp: true,
        sachkonto: true,
        betragNetto: true,
        mwstSatz: true,
        bezahltAm: true,
      },
      orderBy: { datum: "asc" },
      take: 5000,
    });

    const firma = await ladeFirmaDaten();
    const doc = new jsPDF();
    const heute = formatDatum(new Date());

    // ── Kopf ──────────────────────────────────────────────────────────────────
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Ausgabenbericht", 14, 18);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    const zeitraum = von && bis
      ? `${formatDatum(new Date(von))} \u2013 ${formatDatum(new Date(bis))}`
      : von ? `ab ${formatDatum(new Date(von))}` : bis ? `bis ${formatDatum(new Date(bis))}` : "Gesamtzeitraum";
    doc.text(`${firma.name ?? ""}   \u00b7   Zeitraum: ${zeitraum}   \u00b7   Erstellt: ${heute}`, 14, 25);
    doc.setTextColor(0, 0, 0);

    // ── Summen je Buchungstyp ─────────────────────────────────────────────────
    const byTyp = new Map<string, { netto: number; mwst: number }>();
    let totalNetto = 0;
    let totalMwst = 0;

    for (const a of ausgaben) {
      const mwst = a.betragNetto * (a.mwstSatz / 100);
      totalNetto += a.betragNetto;
      totalMwst += mwst;
      const typ = a.buchungstyp ?? "Betriebsausgabe";
      const entry = byTyp.get(typ) ?? { netto: 0, mwst: 0 };
      entry.netto += a.betragNetto;
      entry.mwst += mwst;
      byTyp.set(typ, entry);
    }

    const totalBrutto = totalNetto + totalMwst;

    const summaryRows: string[][] = [];
    for (const [typ, v] of byTyp) {
      summaryRows.push([typ, formatEuro(v.netto), formatEuro(v.mwst), formatEuro(v.netto + v.mwst)]);
    }

    autoTable(doc, {
      startY: 32,
      head: [["Buchungstyp", "Netto", "MwSt", "Brutto"]],
      body: summaryRows,
      foot: [["Gesamt", formatEuro(totalNetto), formatEuro(totalMwst), formatEuro(totalBrutto)]],
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] as [number, number, number], textColor: 255 },
      footStyles: { fillColor: [240, 240, 240] as [number, number, number], fontStyle: "bold" },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
      margin: { left: 14, right: 14 },
    });

    // ── Haupttabelle ──────────────────────────────────────────────────────────
    const docWithTable = doc as jsPDF & { lastAutoTable: { finalY: number } };
    const startY = docWithTable.lastAutoTable.finalY + 8;

    const rows = ausgaben.map(a => {
      const mwst = a.betragNetto * (a.mwstSatz / 100);
      return [
        formatDatum(new Date(a.datum)),
        a.belegNr ?? "\u2013",
        a.beschreibung.length > 38 ? a.beschreibung.slice(0, 36) + "\u2026" : a.beschreibung,
        a.kategorie ?? "",
        a.buchungstyp ?? "",
        a.sachkonto ?? "",
        formatEuro(a.betragNetto),
        `${a.mwstSatz} %`,
        formatEuro(a.betragNetto + mwst),
        a.bezahltAm ? formatDatum(new Date(a.bezahltAm)) : "\u2013",
      ];
    });

    autoTable(doc, {
      startY,
      head: [["Datum", "Beleg-Nr.", "Beschreibung", "Kategorie", "Typ", "Konto", "Netto", "MwSt", "Brutto", "Bezahlt"]],
      body: rows,
      foot: [["", "", "", "", "", "Gesamt", formatEuro(totalNetto), "", formatEuro(totalBrutto), ""]],
      styles: { fontSize: 7, overflow: "linebreak" },
      headStyles: { fillColor: [59, 130, 246] as [number, number, number], textColor: 255, fontSize: 7 },
      footStyles: { fillColor: [240, 240, 240] as [number, number, number], fontStyle: "bold", fontSize: 7 },
      columnStyles: {
        6: { halign: "right" },
        7: { halign: "right" },
        8: { halign: "right", fontStyle: "bold" },
      },
      margin: { left: 14, right: 14 },
    });

    // ── Seitenzahlen ───────────────────────────────────────────────────────────
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Seite ${i} / ${pages}  \u00b7  ${heute}`,
        doc.internal.pageSize.getWidth() / 2,
        doc.internal.pageSize.getHeight() - 8,
        { align: "center" }
      );
    }

    const pdfBytes = doc.output("arraybuffer");
    const filename = `ausgabenbericht-${von ?? "gesamt"}-${bis ?? "heute"}.pdf`;

    return new NextResponse(pdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "PDF-Export fehlgeschlagen";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
