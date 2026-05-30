import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";
import { ARTIKEL_ALIAS, parseNumber, pickCol } from "@/lib/import-utils";
export const dynamic = "force-dynamic";

export interface VorschauZeile {
  zeile: number;
  name: string;
  aktion: "neu" | "aktualisieren" | "überspringen";
  details: string[];
}

export interface VorschauResult {
  plan: VorschauZeile[];
  summary: {
    neu: number;
    aktualisieren: number;
    ueberspringen: number;
    neueLieferanten: number;
  };
}

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Ungültige Formulardaten" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "Keine Datei übergeben" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer" });
  } catch {
    return NextResponse.json({ error: "Datei konnte nicht gelesen werden" }, { status: 400 });
  }

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  if (rows.length === 0) {
    return NextResponse.json({ error: "Keine Zeilen in der Datei gefunden" }, { status: 400 });
  }

  // Lade alle Artikelnamen und Lieferantennamen für schnellen Abgleich
  const [alleArtikel, alleLieferanten] = await Promise.all([
    prisma.artikel.findMany({ select: { name: true }, take: 20000 }),
    prisma.lieferant.findMany({ select: { name: true }, take: 2000 }),
  ]);

  const artikelNamenSet = new Set(alleArtikel.map((a) => a.name.toLowerCase()));
  const lieferantenNamenSet = new Set(alleLieferanten.map((l) => l.name.toLowerCase()));

  const plan: VorschauZeile[] = [];
  const neueLieferantenNamen = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const zeile = i + 2;
    const name = pickCol(row, ...ARTIKEL_ALIAS.name);

    if (!name) {
      plan.push({ zeile, name: "(leer)", aktion: "überspringen", details: ["Name fehlt — Zeile wird übersprungen"] });
      continue;
    }

    const details: string[] = [];

    const standardpreis = parseNumber(pickCol(row, ...ARTIKEL_ALIAS.standardpreis));
    const einkaufspreis = parseNumber(pickCol(row, ...ARTIKEL_ALIAS.einkaufspreis));
    const mindestbestellmenge = parseNumber(pickCol(row, ...ARTIKEL_ALIAS.mindestbestellmenge));
    const lieferantName = pickCol(row, ...ARTIKEL_ALIAS.lieferant);
    const kategorie = pickCol(row, ...ARTIKEL_ALIAS.kategorie);
    const einheit = pickCol(row, ...ARTIKEL_ALIAS.einheit);

    if (kategorie) details.push(`Kategorie: ${kategorie}`);
    if (einheit) details.push(`Einheit: ${einheit}`);
    if (standardpreis > 0) details.push(`VK: ${standardpreis.toFixed(2)} €`);
    if (einkaufspreis > 0) details.push(`EK: ${einkaufspreis.toFixed(2)} €`);
    if (mindestbestellmenge > 0) details.push(`Mindestbestellmenge: ${mindestbestellmenge}`);

    if (lieferantName) {
      const lKey = lieferantName.toLowerCase();
      if (lieferantenNamenSet.has(lKey)) {
        details.push(`Lieferant "${lieferantName}" — vorhanden, wird verknüpft`);
      } else if (neueLieferantenNamen.has(lKey)) {
        details.push(`Lieferant "${lieferantName}" — wird neu angelegt (mehrfach in Datei)`);
      } else {
        details.push(`Lieferant "${lieferantName}" — wird neu angelegt`);
        neueLieferantenNamen.add(lKey);
      }
    }

    const istVorhanden = artikelNamenSet.has(name.toLowerCase());
    plan.push({
      zeile,
      name,
      aktion: istVorhanden ? "aktualisieren" : "neu",
      details,
    });
  }

  const summary = {
    neu: plan.filter((p) => p.aktion === "neu").length,
    aktualisieren: plan.filter((p) => p.aktion === "aktualisieren").length,
    ueberspringen: plan.filter((p) => p.aktion === "überspringen").length,
    neueLieferanten: neueLieferantenNamen.size,
  };

  return NextResponse.json({ plan, summary } satisfies VorschauResult);
}
