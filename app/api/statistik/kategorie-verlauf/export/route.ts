import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { ladeKategorieVerlauf } from "@/lib/kategorie-verlauf";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";

// GET /api/statistik/kategorie-verlauf/export?kategorie=...&unterkategorie=...&jahrVon=...&jahrBis=...&kundeSuche=...
// Excel-Export der gefilterten "Kategorie-Verlauf je Kunde"-Liste (Kunde × Jahr-Pivot).
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const { kunden, jahre, kategorie, unterkategorie } = await ladeKategorieVerlauf({
      kategorie: searchParams.get("kategorie"),
      unterkategorie: searchParams.get("unterkategorie"),
      jahrVon: parseInt(searchParams.get("jahrVon") ?? "", 10),
      jahrBis: parseInt(searchParams.get("jahrBis") ?? "", 10),
      kundeSuche: searchParams.get("kundeSuche"),
    });

    const header = ["Kunde", "Ort", ...jahre.map((j) => String(j))];
    const rows = kunden.map((k) => {
      const jahresZellen = jahre.map((j) => {
        const eintraege = k.eintraege.filter((e) => e.jahr === j);
        return eintraege
          .map((e) => `${e.artikelName} (${e.menge.toLocaleString("de-DE")} ${e.einheit ?? ""})`.trim())
          .join("; ");
      });
      return [k.kundeName, k.kundeOrt ?? "", ...jahresZellen];
    });

    const aoa = [
      [`Kategorie-Verlauf: ${kategorie}${unterkategorie !== "alle" ? ` / ${unterkategorie}` : ""}`],
      [],
      header,
      ...rows,
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 28 }, { wch: 16 }, ...jahre.map(() => ({ wch: 32 }))];
    XLSX.utils.book_append_sheet(wb, ws, "Kategorie-Verlauf");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="kategorie-verlauf.xlsx"`,
      },
    });
  } catch (err) {
    Sentry.captureException(err);
    console.error("Statistik/Kategorie-Verlauf Excel-Export Fehler:", err);
    return NextResponse.json({ error: "Export fehlgeschlagen" }, { status: 500 });
  }
}
