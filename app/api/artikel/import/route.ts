import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

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
    return NextResponse.json({ error: "Datei konnte nicht gelesen werden (kein gültiges XLS/CSV)" }, { status: 400 });
  }

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  if (rows.length === 0) {
    return NextResponse.json({ error: "Keine Zeilen in der Datei gefunden" }, { status: 400 });
  }

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    const name = String(row["Name"] ?? "").trim();
    if (!name) {
      errors.push(`Zeile ${rowNum}: Name fehlt — übersprungen`);
      skipped++;
      continue;
    }

    const aktivRaw = String(row["Aktiv"] ?? "Ja").trim().toLowerCase();
    const aktiv = aktivRaw !== "nein" && aktivRaw !== "false" && aktivRaw !== "0";

    const standardpreis = parseFloat(String(row["Standardpreis"] ?? "0").replace(",", ".")) || 0;
    const aktuellerBestand = parseFloat(String(row["Lagerbestand"] ?? "0").replace(",", ".")) || 0;
    const mindestbestand = parseFloat(String(row["Mindestbestand"] ?? "0").replace(",", ".")) || 0;

    const artikelnummer = String(row["Artikelnummer"] ?? "").trim() || undefined;

    try {
      // Auto-Artikelnummer when not provided
      let finalNummer = artikelnummer;
      if (!finalNummer) {
        const nummernkreisRaw = await prisma.einstellung.findUnique({ where: { key: "artikel.nummernkreis" } });
        const nk = nummernkreisRaw?.value
          ? (() => { try { return JSON.parse(nummernkreisRaw.value); } catch { return null; } })()
          : null;
        const prefix = nk?.prefix ?? "ART-";
        const laenge = Number(nk?.laenge) || 5;
        const naechste = Number(nk?.naechste) || 1;
        finalNummer = `${prefix}${String(naechste).padStart(laenge, "0")}`;
        await prisma.einstellung.upsert({
          where: { key: "artikel.nummernkreis" },
          update: { value: JSON.stringify({ prefix, laenge, naechste: naechste + 1 }) },
          create: { key: "artikel.nummernkreis", value: JSON.stringify({ prefix, laenge, naechste: naechste + 1 }) },
        });
      }

      await prisma.artikel.create({
        data: {
          artikelnummer: finalNummer,
          name,
          kategorie: String(row["Kategorie"] ?? "Futter").trim() || "Futter",
          einheit: String(row["Einheit"] ?? "kg").trim() || "kg",
          standardpreis,
          aktuellerBestand,
          mindestbestand,
          aktiv,
        },
      });
      created++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Zeile ${rowNum} (${name}): ${msg}`);
      skipped++;
    }
  }

  return NextResponse.json({ created, skipped, errors: errors.slice(0, 20) });
}
