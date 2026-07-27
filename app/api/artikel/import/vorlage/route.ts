import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";
import { log } from "@/lib/logger";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const lieferanten = await prisma.lieferant.findMany({
      orderBy: { name: "asc" },
      take: 2000,
      select: { name: true },
    });

    const wb = XLSX.utils.book_new();

    // Sheet 1: Artikel-Importvorlage mit Beispielzeile
    const vorlageHeaders = [
      "Artikelnummer",
      "Name",
      "Kategorie",
      "Unterkategorie",
      "Einheit",
      "Standardpreis",
      "Einkaufspreis",
      "Mindestbestellmenge",
      "Lieferant",
      "Beschreibung",
      "Lagerbestand",
      "Mindestbestand",
      "MwSt %",
      "Aktiv",
    ];

    const beispielZeile: Record<string, unknown> = {
      Artikelnummer: "ART-00001",
      Name: "Beispielartikel Mais",
      Kategorie: "Futter",
      Unterkategorie: "Mais",
      Einheit: "kg",
      Standardpreis: 0.45,
      Einkaufspreis: 0.38,
      Mindestbestellmenge: 500,
      Lieferant: lieferanten[0]?.name ?? "Muster Agrar GmbH",
      Beschreibung: "Körnermais, trocken",
      Lagerbestand: 0,
      Mindestbestand: 1000,
      "MwSt %": 7,
      Aktiv: "Ja",
    };

    const ws1 = XLSX.utils.json_to_sheet([beispielZeile], {
      header: vorlageHeaders,
    });

    // Spaltenbreiten setzen
    ws1["!cols"] = vorlageHeaders.map((h) => ({
      wch: Math.max(h.length + 2, 16),
    }));

    XLSX.utils.book_append_sheet(wb, ws1, "Artikel");

    // Sheet 2: Vorhandene Lieferanten als Nachschlageliste
    const liefRows =
      lieferanten.length > 0
        ? lieferanten.map((l) => ({ Lieferantenname: l.name }))
        : [{ Lieferantenname: "(Noch keine Lieferanten angelegt)" }];

    const ws2 = XLSX.utils.json_to_sheet(liefRows);
    ws2["!cols"] = [{ wch: 40 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Lieferanten");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    // Buffer → Uint8Array: aktuelle @types/node machen Buffer nicht mehr
    // strukturell kompatibel zu BodyInit (bekannter Fallstrick, siehe AGENTS.md).
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          'attachment; filename="artikel-import-vorlage.xlsx"',
      },
    });
  } catch (err) {
    log.error("Artikel-Importvorlage konnte nicht erzeugt werden", err);
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
