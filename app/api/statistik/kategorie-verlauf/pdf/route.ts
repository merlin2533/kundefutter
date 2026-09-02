import { NextRequest, NextResponse } from "next/server";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDatum } from "@/lib/utils";
import { ladeKategorieVerlauf } from "@/lib/kategorie-verlauf";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";

// GET /api/statistik/kategorie-verlauf/pdf?kategorie=...&unterkategorie=...&von=...&bis=...&kundeSuche=...
// PDF-Export der gefilterten "Kategorie-Verlauf je Kunde"-Liste (Kunde × Jahr-Pivot).
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const { kunden, jahre, kategorie, unterkategorien, von, bis } = await ladeKategorieVerlauf({
      kategorie: searchParams.get("kategorie"),
      unterkategorien: searchParams.getAll("unterkategorie"),
      von: searchParams.get("von"),
      bis: searchParams.get("bis"),
      kundeSuche: searchParams.get("kundeSuche"),
    });

    const doc = new jsPDF({ orientation: "landscape" });
    const heute = formatDatum(new Date());

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Kategorie-Verlauf je Kunde", 14, 18);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    const kategorieLabel = `${kategorie}${unterkategorien.length > 0 ? ` / ${unterkategorien.join(", ")}` : ""}`;
    doc.text(
      `Kategorie: ${kategorieLabel}   ·   Zeitraum: ${formatDatum(von)}–${formatDatum(bis)}   ·   Erstellt: ${heute}`,
      14,
      25
    );
    doc.setTextColor(0, 0, 0);

    const rows = kunden.map((k) => {
      const jahresZellen = jahre.map((j) =>
        k.eintraege
          .filter((e) => e.jahr === j)
          .map((e) => {
            const teile: string[] = [];
            if (e.mengeGeliefert > 0) teile.push(`${e.artikelName} (${e.mengeGeliefert.toLocaleString("de-DE")} ${e.einheit ?? ""}) geliefert`.trim());
            if (e.mengeOffen > 0) teile.push(`${e.artikelName} (${e.mengeOffen.toLocaleString("de-DE")} ${e.einheit ?? ""}) offen`.trim());
            return teile.join("\n");
          })
          .join("\n")
      );
      return [k.kundeName, k.kundeOrt ?? "", ...jahresZellen];
    });

    autoTable(doc, {
      startY: 32,
      head: [["Kunde", "Ort", ...jahre.map((j) => String(j))]],
      body: rows,
      styles: { fontSize: 7, overflow: "linebreak", valign: "top" },
      headStyles: { fillColor: [59, 130, 246] as [number, number, number], textColor: 255, fontSize: 8 },
      margin: { left: 14, right: 14 },
    });

    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Seite ${i} / ${pages}  ·  ${heute}`,
        doc.internal.pageSize.getWidth() / 2,
        doc.internal.pageSize.getHeight() - 8,
        { align: "center" }
      );
    }

    const pdfBytes = doc.output("arraybuffer");
    return new NextResponse(pdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="kategorie-verlauf.pdf"`,
      },
    });
  } catch (err) {
    Sentry.captureException(err);
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "PDF-Export fehlgeschlagen";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
