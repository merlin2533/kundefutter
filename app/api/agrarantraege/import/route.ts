import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Known column name variations in AFIG CSV files
const COL_ALIASES: Record<string, string[]> = {
  haushaltsjahr: ["haushaltsjahr", "budget year", "year"],
  name: [
    "name des begünstigten/rechtsträgers/verbands",
    "name des begünstigten",
    "begünstigter",
    "name",
    "recipient",
  ],
  plz: ["plz", "postcode", "postal code", "postleitzahl"],
  gemeinde: ["gemeinde", "ort", "municipality", "city"],
  land: ["betroffener staat", "land", "state", "country"],
  massnahme: [
    "code der maßnahme/der interventionskategorie/des sektors",
    "code der maßnahme",
    "maßnahme",
    "measure code",
    "intervention code",
  ],
  ziel: ["spezifisches ziel", "specific objective", "ziel"],
  egfl: ["egfl-betrag", "egfl betrag", "egfl (eur)", "egfl", "total egfl", "betrag egfl"],
  eler: ["eler-betrag", "eler betrag", "eler (eur)", "eler", "total eler", "betrag eler"],
  mutter: ["mutterunternehmen", "parent company", "parent"],
};

function findCol(headers: string[], key: string): number {
  const aliases = COL_ALIASES[key] ?? [key];
  for (const alias of aliases) {
    const idx = headers.findIndex((h) => h.toLowerCase().trim().includes(alias.toLowerCase()));
    if (idx !== -1) return idx;
  }
  return -1;
}

function parseNum(s: string | undefined): number {
  if (!s) return 0;
  // Remove currency symbols, spaces, replace , with .
  const cleaned = s.replace(/[€$£\s]/g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

interface RawRow {
  haushaltsjahr: number;
  name: string;
  plz: string;
  gemeinde: string;
  land: string;
  massnahme: string;
  ziel: string;
  egfl: number;
  eler: number;
  mutter: string;
}

// POST /api/agrarantraege/import
// Body: multipart/form-data with field "csv" (file) or "text" (raw CSV string)
export async function POST(req: NextRequest) {
  let csvText = "";

  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const file = formData.get("csv");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Keine CSV-Datei übergeben (Feld: csv)" }, { status: 400 });
    }
    csvText = await (file as File).text();
  } else {
    // plain text body
    csvText = await req.text();
  }

  if (!csvText.trim()) {
    return NextResponse.json({ error: "CSV-Inhalt ist leer" }, { status: 400 });
  }

  // Detect separator
  const firstLine = csvText.split("\n")[0];
  const sep = firstLine.includes(";") ? ";" : ",";

  const lines = csvText.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) {
    return NextResponse.json({ error: "CSV hat zu wenig Zeilen" }, { status: 400 });
  }

  // Parse headers
  const headers = lines[0].split(sep).map((h) => h.replace(/^"|"$/g, "").trim());

  const colYear    = findCol(headers, "haushaltsjahr");
  const colName    = findCol(headers, "name");
  const colPlz     = findCol(headers, "plz");
  const colGemeinde = findCol(headers, "gemeinde");
  const colLand    = findCol(headers, "land");
  const colMass    = findCol(headers, "massnahme");
  const colZiel    = findCol(headers, "ziel");
  const colEgfl    = findCol(headers, "egfl");
  const colEler    = findCol(headers, "eler");
  const colMutter  = findCol(headers, "mutter");

  if (colName === -1) {
    return NextResponse.json({
      error: `Spalte 'Name' nicht gefunden. Gefundene Spalten: ${headers.join(", ")}`,
    }, { status: 400 });
  }

  // Parse data rows and aggregate per (haushaltsjahr, name, plz)
  const aggMap = new Map<string, {
    haushaltsjahr: number;
    name: string;
    plz: string;
    gemeinde: string;
    land: string;
    egfl: number;
    eler: number;
    massnahmen: Array<{ code: string; ziel: string; egfl: number; eler: number }>;
    mutter: string;
  }>();

  for (let i = 1; i < lines.length; i++) {
    // Handle quoted fields with commas
    const row = splitCsvLine(lines[i], sep);

    const name = (colName !== -1 ? row[colName] : "").replace(/^"|"$/g, "").trim();
    if (!name || name.toLowerCase() === "kleinempfänger") continue;

    const year  = colYear !== -1 ? parseInt(row[colYear] ?? "0") : 0;
    const plz   = (colPlz !== -1 ? row[colPlz] : "").replace(/^"|"$/g, "").trim();
    const gem   = (colGemeinde !== -1 ? row[colGemeinde] : "").replace(/^"|"$/g, "").trim();
    const land  = (colLand !== -1 ? row[colLand] : "").replace(/^"|"$/g, "").trim();
    const mass  = (colMass !== -1 ? row[colMass] : "").replace(/^"|"$/g, "").trim();
    const ziel  = (colZiel !== -1 ? row[colZiel] : "").replace(/^"|"$/g, "").trim();
    const egfl  = parseNum(colEgfl !== -1 ? row[colEgfl] : undefined);
    const eler  = parseNum(colEler !== -1 ? row[colEler] : undefined);
    const mutter = (colMutter !== -1 ? row[colMutter] : "").replace(/^"|"$/g, "").trim();

    const key = `${year}|${name.toLowerCase()}|${plz}`;

    const existing = aggMap.get(key);
    if (existing) {
      existing.egfl += egfl;
      existing.eler += eler;
      if (mass) {
        existing.massnahmen.push({ code: mass, ziel, egfl, eler });
      }
    } else {
      aggMap.set(key, {
        haushaltsjahr: year,
        name,
        plz,
        gemeinde: gem,
        land,
        egfl,
        eler,
        massnahmen: mass ? [{ code: mass, ziel, egfl, eler }] : [],
        mutter,
      });
    }
  }

  if (aggMap.size === 0) {
    return NextResponse.json({ error: "Keine Datensätze aus CSV extrahiert" }, { status: 400 });
  }

  // Batch upsert — delete old data for the same haushaltsjahr first, then insert
  const jahrgaenge = new Set([...aggMap.values()].map((v) => v.haushaltsjahr).filter((y) => y > 0));

  let importedCount = 0;
  let skippedCount = 0;

  await prisma.$transaction(async (tx) => {
    // Delete existing entries for the years being imported (preserving kundeId links)
    for (const jahr of jahrgaenge) {
      await tx.antragEmpfaenger.deleteMany({ where: { haushaltsjahr: jahr } });
    }

    // Insert new records in batches of 500
    const records = [...aggMap.values()];
    const batchSize = 500;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const data = batch.map((r) => ({
        haushaltsjahr: r.haushaltsjahr,
        name: r.name,
        plz: r.plz || null,
        gemeinde: r.gemeinde || null,
        land: r.land || null,
        egflGesamt: r.egfl,
        elerGesamt: r.eler,
        gesamtBetrag: r.egfl + r.eler,
        massnahmen: r.massnahmen.length > 0 ? JSON.stringify(r.massnahmen) : null,
        mutterunternehmen: r.mutter || null,
      }));

      await tx.antragEmpfaenger.createMany({ data });
      importedCount += data.length;
    }
  });

  return NextResponse.json({
    ok: true,
    importiert: importedCount,
    uebersprungen: skippedCount,
    jahre: [...jahrgaenge].sort(),
  });
}

// Simple CSV line splitter that respects quoted fields
function splitCsvLine(line: string, sep: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === sep && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}
