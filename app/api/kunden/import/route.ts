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
    const rowNum = i + 2; // 1-based + header

    const name = String(row["Name"] ?? "").trim();
    if (!name) {
      errors.push(`Zeile ${rowNum}: Name fehlt — übersprungen`);
      skipped++;
      continue;
    }

    const aktivRaw = String(row["Aktiv"] ?? "Ja").trim().toLowerCase();
    const aktiv = aktivRaw !== "nein" && aktivRaw !== "false" && aktivRaw !== "0";

    const kontakte: { typ: string; wert: string; label?: string }[] = [];
    const telefon = String(row["Telefon"] ?? "").trim();
    const mobil = String(row["Mobil"] ?? "").trim();
    const email = String(row["Email"] ?? "").trim();
    if (telefon) kontakte.push({ typ: "telefon", wert: telefon });
    if (mobil) kontakte.push({ typ: "mobil", wert: mobil });
    if (email) kontakte.push({ typ: "email", wert: email });

    try {
      await prisma.kunde.create({
        data: {
          name,
          firma: String(row["Firma"] ?? "").trim() || null,
          kategorie: String(row["Kategorie"] ?? "Sonstige").trim() || "Sonstige",
          strasse: String(row["Straße"] ?? row["Strasse"] ?? "").trim() || null,
          plz: String(row["PLZ"] ?? "").trim() || null,
          ort: String(row["Ort"] ?? "").trim() || null,
          land: String(row["Land"] ?? "Deutschland").trim() || "Deutschland",
          notizen: String(row["Notizen"] ?? "").trim() || null,
          aktiv,
          kontakte: kontakte.length ? { create: kontakte } : undefined,
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
