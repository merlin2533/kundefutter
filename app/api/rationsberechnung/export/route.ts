import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";
import {
  NAEHRSTOFF_LABELS,
  NAEHRSTOFF_EINHEITEN,
  type RationsErgebnis,
  type RationsEingabe,
  type NaehrstoffWerte,
} from "@/lib/rationsberechnung";

export const dynamic = "force-dynamic";

const NUTRIENT_ORDER: (keyof NaehrstoffWerte)[] = [
  "nel", "me", "rohprotein", "nxp", "dp", "rohfaser", "andfom",
  "lysin", "methionin", "ca", "p", "mg", "na",
];

function baueWorkbook(eingabe: RationsEingabe | null, ergebnis: RationsErgebnis, bezeichnung: string) {
  const wb = XLSX.utils.book_new();

  // ─── Sheet "Ration" ────────────────────────────────────────────────────────
  const kopf: (string | number)[][] = [
    ["Rationsberechnung", bezeichnung],
    ["Tierart", ergebnis.tierart],
    ["Nutzungsart", ergebnis.nutzungsart],
    ["Modus", ergebnis.modus === "detail" ? "detailliert" : "einfach"],
    ["Lebendgewicht (kg)", eingabe?.gewicht ?? ""],
    ["Leistung", eingabe?.leistung ?? ""],
    ["TM-Aufnahme (kg)", ergebnis.tmAufnahme],
    [],
  ];
  const posHeader = ["Futter", "Stufe", "FM kg", "TM kg", "Anteil %",
    ...NUTRIENT_ORDER.map((k) => `${NAEHRSTOFF_LABELS[k]} (${NAEHRSTOFF_EINHEITEN[k]})`)];
  const posRows = ergebnis.positionen.map((p) => [
    p.futter, p.stufe ?? "", p.fmKg, p.tmKg, p.anteil,
    ...NUTRIENT_ORDER.map((k) => p.beitrag[k] ?? ""),
  ]);
  const summeRow = ["Summe Aufnahme", "", "", ergebnis.tmAufnahme, 100,
    ...NUTRIENT_ORDER.map((k) => ergebnis.summe[k] ?? "")];
  const rationAoa = [...kopf, posHeader, ...posRows, summeRow];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rationAoa), "Ration");

  // ─── Sheet "Bilanz" ────────────────────────────────────────────────────────
  const bilanzHeader = ["Nährstoff", "Einheit", "Aufnahme", "Bedarf", "Bilanz", "Deckung %"];
  const bilanzRows = NUTRIENT_ORDER
    .filter((k) => ergebnis.bedarf[k] != null || ergebnis.summe[k] != null)
    .map((k) => [
      NAEHRSTOFF_LABELS[k],
      NAEHRSTOFF_EINHEITEN[k],
      ergebnis.summe[k] ?? "",
      ergebnis.bedarf[k] ?? "",
      ergebnis.bilanz[k] ?? "",
      ergebnis.deckung[k] ?? "",
    ]);
  const bilanzExtra: (string | number)[][] = [
    [],
    ["TM-Aufnahme (kg)", "kg", ergebnis.tmAufnahme, ergebnis.bedarf.tmBedarf ?? "", ""],
    ["Ca:P-Verhältnis", ":1", ergebnis.caPVerhaeltnis ?? "", "", ""],
    ["Rohfaser-Anteil", "% TM", ergebnis.rohfaserAnteil ?? "", "", ""],
    ["aNDFom-Anteil", "% TM", ergebnis.andfomAnteil ?? "", "", ""],
    ["RNB (ruminale N-Bilanz)", "g", ergebnis.rnb ?? "", "", ""],
  ];
  for (const as of ergebnis.aminosaeuren) {
    bilanzExtra.push([
      as.naehrstoff === "lysin" ? "Lysin-Deckung" : "Methionin-Deckung",
      "%", as.deckung ?? "", "", as.status,
    ]);
  }
  const bilanzAoa = [[`Bilanz — ${bezeichnung}`], [], bilanzHeader, ...bilanzRows, ...bilanzExtra];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(bilanzAoa), "Bilanz");

  // ─── Sheet "Rechenweg" ─────────────────────────────────────────────────────
  const rechenAoa: (string | number)[][] = [["Rechenweg"], [], ["Schritt", "Wert", "Einheit"]];
  for (const r of ergebnis.rechenweg) rechenAoa.push([r.schritt, r.wert, r.einheit]);
  if (ergebnis.stufen && ergebnis.stufen.length > 0) {
    rechenAoa.push([], ["Stufen-Zwischensummen"]);
    rechenAoa.push(["Stufe", "TM kg", ...NUTRIENT_ORDER.map((k) => NAEHRSTOFF_LABELS[k])]);
    for (const s of ergebnis.stufen) {
      rechenAoa.push([s.label, s.tmKg, ...NUTRIENT_ORDER.map((k) => s.summe[k] ?? "")]);
    }
  }
  rechenAoa.push([], ["Hinweise"]);
  for (const h of ergebnis.hinweise) rechenAoa.push([h]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rechenAoa), "Rechenweg");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

function dateiname(bezeichnung: string): string {
  const safe = bezeichnung.replace(/[^a-zA-Z0-9äöüÄÖÜ _-]/g, "").trim().replace(/\s+/g, "_");
  return `Ration_${safe || "Berechnung"}.xlsx`;
}

// GET /api/rationsberechnung/export?id=X — gespeicherte Berechnung exportieren
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = parseInt(searchParams.get("id") ?? "", 10);
  if (isNaN(id)) return NextResponse.json({ error: "id fehlt" }, { status: 400 });

  try {
    const ber = await prisma.rationsberechnung.findUnique({ where: { id } });
    if (!ber) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    let eingabe: RationsEingabe | null = null;
    let ergebnis: RationsErgebnis | null = null;
    try {
      const parsed = JSON.parse(ber.parameter);
      eingabe = parsed.eingabe ?? null;
      ergebnis = parsed.ergebnis ?? null;
    } catch {
      return NextResponse.json({ error: "Berechnungsdaten beschädigt" }, { status: 500 });
    }
    if (!ergebnis) return NextResponse.json({ error: "Kein Ergebnis gespeichert" }, { status: 500 });

    const buf = baueWorkbook(eingabe, ergebnis, ber.bezeichnung);
    return new NextResponse(buf as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${dateiname(ber.bezeichnung)}"`,
      },
    });
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Export fehlgeschlagen";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/rationsberechnung/export — Inline-Ergebnis exportieren (nicht gespeichert)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ergebnis: RationsErgebnis = body.ergebnis;
    const eingabe: RationsEingabe | null = body.eingabe ?? null;
    if (!ergebnis || !ergebnis.summe) {
      return NextResponse.json({ error: "Kein gültiges Ergebnis übergeben" }, { status: 400 });
    }
    const bezeichnung = body.bezeichnung?.trim()
      || `${ergebnis.tierart} ${ergebnis.nutzungsart} ${new Date().toLocaleDateString("de-DE")}`;
    const buf = baueWorkbook(eingabe, ergebnis, bezeichnung);
    return new NextResponse(buf as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${dateiname(bezeichnung)}"`,
      },
    });
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Export fehlgeschlagen";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
