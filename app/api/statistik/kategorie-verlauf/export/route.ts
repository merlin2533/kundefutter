import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { ladeKategorieVerlauf } from "@/lib/kategorie-verlauf";
import { prisma } from "@/lib/prisma";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";

// GET /api/statistik/kategorie-verlauf/export?kategorie=...&unterkategorie=...&von=...&bis=...&kundeSuche=...&lieferantId=...
// Excel-Export der gefilterten "Kategorie-Verlauf je Kunde"-Liste (Kunde × Jahr-Pivot).
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const lieferantIdParam = searchParams.get("lieferantId");
    const lieferantIdNum = lieferantIdParam ? parseInt(lieferantIdParam, 10) : null;
    const lieferantId = lieferantIdNum !== null && !isNaN(lieferantIdNum) ? lieferantIdNum : null;
    const { kunden, jahre, kategorie, unterkategorien, artikelUebersicht, gesamtProEinheit, lieferantUebersicht } = await ladeKategorieVerlauf({
      kategorie: searchParams.get("kategorie"),
      unterkategorien: searchParams.getAll("unterkategorie"),
      von: searchParams.get("von"),
      bis: searchParams.get("bis"),
      kundeSuche: searchParams.get("kundeSuche"),
      lieferantId,
    });

    const lieferantFilterName = lieferantId
      ? (await prisma.lieferant.findUnique({ where: { id: lieferantId }, select: { name: true } }))?.name ?? null
      : null;

    const kategorieLabel = `${kategorie}${unterkategorien.length > 0 ? ` / ${unterkategorien.join(", ")}` : ""}${lieferantFilterName ? ` · Lieferant: ${lieferantFilterName}` : ""}`;

    const wb = XLSX.utils.book_new();

    // Übersicht-Sheet: Gesamtmenge je Einheit + Menge je Artikel — dieselben Summen wie auf dem
    // Bildschirm (/statistik/kategorie-verlauf), aus denselben bereits gefilterten `kunden`
    // aufgebaut wie die Pivot-Tabelle.
    const uebersichtAoa: (string | number)[][] = [
      [`Kategorie-Verlauf – Übersicht: ${kategorieLabel}`],
      [],
      ["Gesamtmenge im Zeitraum"],
      ["Einheit", "Geliefert", "Offen"],
      ...gesamtProEinheit.map((g) => [g.einheit ?? "(ohne Einheit)", g.mengeGeliefert, g.mengeOffen]),
      [],
      ["Je Artikel"],
      ["Artikel", "Unterkategorie", "Einheit", "Geliefert", "Offen", "Kunden"],
      ...artikelUebersicht.map((a) => [
        a.artikelName,
        a.unterkategorie ?? "",
        a.einheit ?? "",
        a.mengeGeliefert,
        a.mengeOffen,
        a.anzahlKunden,
      ]),
      [],
      ["Je Lieferant"],
      ["Lieferant", "Einheit", "Geliefert", "Offen", "Artikel", "Kunden"],
      ...lieferantUebersicht.map((l) => [
        l.lieferantName,
        l.einheit ?? "",
        l.mengeGeliefert,
        l.mengeOffen,
        l.anzahlArtikel,
        l.anzahlKunden,
      ]),
    ];
    const wsUebersicht = XLSX.utils.aoa_to_sheet(uebersichtAoa);
    wsUebersicht["!cols"] = [{ wch: 32 }, { wch: 20 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, wsUebersicht, "Übersicht");

    const header = ["Kunde", "Ort", ...jahre.map((j) => String(j))];
    const rows = kunden.map((k) => {
      const jahresZellen = jahre.map((j) => {
        const eintraege = k.eintraege.filter((e) => e.jahr === j);
        return eintraege
          .map((e) => {
            const teile: string[] = [];
            if (e.mengeGeliefert > 0) teile.push(`${e.artikelName} (${e.mengeGeliefert.toLocaleString("de-DE")} ${e.einheit ?? ""}) geliefert`.trim());
            if (e.mengeOffen > 0) teile.push(`${e.artikelName} (${e.mengeOffen.toLocaleString("de-DE")} ${e.einheit ?? ""}) offen`.trim());
            return teile.join(" / ");
          })
          .join("; ");
      });
      return [k.kundeName, k.kundeOrt ?? "", ...jahresZellen];
    });

    const aoa = [
      [`Kategorie-Verlauf: ${kategorieLabel}`],
      [],
      header,
      ...rows,
    ];

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
