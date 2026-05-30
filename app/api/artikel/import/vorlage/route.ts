import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";
export const dynamic = "force-dynamic";

export async function GET() {
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

  const ws1 = XLSX.utils.json_to_sheet([beispielZeile], { header: vorlageHeaders });

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

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="artikel-import-vorlage.xlsx"',
    },
  });
}
