import { NextRequest, NextResponse } from "next/server";
import { createInterface } from "readline";
import { Readable } from "stream";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Known column name variations in AFIG CSV files
// Includes exact 2024 column names from agrarzahlungen.de
const COL_ALIASES: Record<string, string[]> = {
  haushaltsjahr: ["haushaltsjahr", "budget year", "year"],
  name: [
    // 2024 format uses "Verdands" (typo) instead of "Verbands"
    "name des begünstigten/rechtsträgers/verdands",
    "name des begünstigten/rechtsträgers/verbands",
    "name des begünstigten",
    "begünstigter",
    "name",
    "recipient",
  ],
  steuerNr: ["steuerliches identifikationsmerkmal", "steuer", "identifikationsmerkmal"],
  plz: ["plz", "postcode", "postal code", "postleitzahl"],
  gemeinde: ["gemeinde", "ort", "municipality", "city"],
  land: ["betroffener staat", "land", "state", "country"],
  massnahme: [
    // 2024: "Code der Maßnahme/der Interventionskategorie/des Sektors gemäß Anhang IX"
    "code der ma", // short prefix matches all variants regardless of encoding
    "code der massnahme",
    "code der maßnahme",
    "maßnahme",
    "massnahme",
    "measure code",
    "intervention code",
  ],
  ziel: ["spezifisches ziel", "specific objective", "ziel"],
  anfang: ["anfangsdatum", "start date", "von", "begin"],
  ende: ["enddatum", "end date", "bis", "end"],
  // Per-measure amounts (columns 11, 13, 15) — stored per Maßnahme
  egflMassnahme: ["betrag je vorhaben im rahmen des egfl"],
  elerMassnahme: ["betrag je vorhaben im rahmen des eler (eu-mittel)", "betrag je vorhaben im rahmen des eler"],
  nationalKofiMassnahme: ["betrag je vorhaben im rahmen der nationalen kofinanzierung", "nationale kofinanzierung je vorhaben"],
  // Pre-calculated totals per beneficiary (use these for the stored Gesamt fields)
  egflGesamt: ["egfl- gesamtbetrag", "egfl-gesamtbetrag", "egfl gesamtbetrag"],
  elerGesamt: ["eler-gesamtbetrag für diesen begünstigten (eu-mittel)", "eler-gesamtbetrag", "eler gesamtbetrag"],
  nationalKofiGesamt: ["national kofinanzierter gesamtbetrag", "kofinanzierter gesamtbetrag"],
  elerUndKofiGesamt: ["summe des eler-betrags (eu-mittel) und des kofinanzierten betrags", "summe eler und kofi"],
  gesamtBetrag: ["eu-betrag (egfl und eler) und kofinanzierter betrag insgesamt", "gesamtbetrag", "gesamt"],
  mutter: ["name des mutterunternehmen", "mutterunternehmen", "parent company", "parent"],
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
  if (!s || !s.trim()) return 0;
  const t = s.trim().replace(/[€$£\s]/g, "");
  // German format: 1.234,56 → remove thousands dot, replace comma
  // CSV/English format: 1234.8 → dot is decimal, no thousands separator
  const cleaned = t.includes(",")
    ? t.replace(/\./g, "").replace(",", ".")
    : t;
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
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

type AggEntry = {
  haushaltsjahr: number;
  name: string;
  steuerNr: string;
  plz: string;
  gemeinde: string;
  land: string;
  egflGesamt: number;
  elerGesamt: number;
  nationalKofiGesamt: number;
  elerUndKofiGesamt: number;
  gesamtBetrag: number;
  massnahmen: Array<{
    code: string;
    ziel: string;
    egfl: number;
    eler: number;
    nationalKofi: number;
    anfang: string;
    ende: string;
  }>;
  mutter: string;
};

function str(row: string[], col: number): string {
  if (col === -1) return "";
  return (row[col] ?? "").replace(/^"|"$/g, "").trim();
}

async function processStream(
  rl: ReturnType<typeof createInterface>
): Promise<{ aggMap: Map<string, AggEntry>; error?: string }> {
  const aggMap = new Map<string, AggEntry>();

  let sep = ";";
  let colYear = -1;
  let colName = -1;
  let colSteuerNr = -1;
  let colPlz = -1;
  let colGemeinde = -1;
  let colLand = -1;
  let colMass = -1;
  let colZiel = -1;
  let colAnfang = -1;
  let colEnde = -1;
  let colEgflM = -1;
  let colElerM = -1;
  let colNationalKofiM = -1;
  let colEgflG = -1;
  let colElerG = -1;
  let colNationalKofiG = -1;
  let colElerUndKofiG = -1;
  let colGesamtBetrag = -1;
  let colMutter = -1;
  let lineIndex = 0;

  for await (const rawLine of rl) {
    const line = rawLine.trim();
    if (!line) continue;

    if (lineIndex === 0) {
      sep = line.includes(";") ? ";" : ",";
      const headers = line.split(sep).map((h) => h.replace(/^"|"$/g, "").trim());

      colYear           = findCol(headers, "haushaltsjahr");
      colName           = findCol(headers, "name");
      colSteuerNr       = findCol(headers, "steuerNr");
      colPlz            = findCol(headers, "plz");
      colGemeinde       = findCol(headers, "gemeinde");
      colLand           = findCol(headers, "land");
      colMass           = findCol(headers, "massnahme");
      colZiel           = findCol(headers, "ziel");
      colAnfang         = findCol(headers, "anfang");
      colEnde           = findCol(headers, "ende");
      colEgflM          = findCol(headers, "egflMassnahme");
      colElerM          = findCol(headers, "elerMassnahme");
      colNationalKofiM  = findCol(headers, "nationalKofiMassnahme");
      colEgflG          = findCol(headers, "egflGesamt");
      colElerG          = findCol(headers, "elerGesamt");
      colNationalKofiG  = findCol(headers, "nationalKofiGesamt");
      colElerUndKofiG   = findCol(headers, "elerUndKofiGesamt");
      colGesamtBetrag   = findCol(headers, "gesamtBetrag");
      colMutter         = findCol(headers, "mutter");

      if (colName === -1) {
        return {
          aggMap,
          error: `Spalte 'Name' nicht gefunden. Gefundene Spalten: ${headers.join(", ")}`,
        };
      }

      lineIndex++;
      continue;
    }

    const row = splitCsvLine(line, sep);

    const name = str(row, colName);
    if (!name || name.toLowerCase() === "kleinempfänger") {
      lineIndex++;
      continue;
    }

    const year          = colYear !== -1 ? parseInt(row[colYear] ?? "0") : 0;
    const steuerNr      = str(row, colSteuerNr);
    const plz           = str(row, colPlz);
    const gem           = str(row, colGemeinde);
    const land          = str(row, colLand);
    const mass          = str(row, colMass);
    const ziel          = str(row, colZiel);
    const anfang        = str(row, colAnfang);
    const ende          = str(row, colEnde);
    const egflM         = parseNum(row[colEgflM]);
    const elerM         = parseNum(row[colElerM]);
    const nationalKofiM = parseNum(row[colNationalKofiM]);
    // Use CSV's pre-calculated per-beneficiary totals (same value repeated on each row)
    const egflG         = parseNum(row[colEgflG]);
    const elerG         = parseNum(row[colElerG]);
    const nationalKofiG = parseNum(row[colNationalKofiG]);
    const elerUndKofiG  = parseNum(row[colElerUndKofiG]);
    const gesamtBetrag  = parseNum(row[colGesamtBetrag]);
    const mutter        = str(row, colMutter);

    const key = `${year}|${name.toLowerCase()}|${plz}`;

    const existing = aggMap.get(key);
    if (existing) {
      if (mass) {
        existing.massnahmen.push({ code: mass, ziel, egfl: egflM, eler: elerM, nationalKofi: nationalKofiM, anfang, ende });
      }
      // Update totals from CSV (they're the same on every row — just overwrite)
      existing.egflGesamt        = egflG || existing.egflGesamt;
      existing.elerGesamt        = elerG || existing.elerGesamt;
      existing.nationalKofiGesamt = nationalKofiG || existing.nationalKofiGesamt;
      existing.elerUndKofiGesamt = elerUndKofiG || existing.elerUndKofiGesamt;
      existing.gesamtBetrag      = gesamtBetrag || existing.gesamtBetrag;
    } else {
      aggMap.set(key, {
        haushaltsjahr: year,
        name,
        steuerNr,
        plz,
        gemeinde: gem,
        land,
        egflGesamt: egflG,
        elerGesamt: elerG,
        nationalKofiGesamt: nationalKofiG,
        elerUndKofiGesamt: elerUndKofiG,
        gesamtBetrag,
        massnahmen: mass ? [{ code: mass, ziel, egfl: egflM, eler: elerM, nationalKofi: nationalKofiM, anfang, ende }] : [],
        mutter,
      });
    }

    lineIndex++;
  }

  return { aggMap };
}

async function insertAggMap(aggMap: Map<string, AggEntry>): Promise<number> {
  const jahrgaenge = new Set(
    [...aggMap.values()].map((v) => v.haushaltsjahr).filter((y) => y > 0)
  );

  let importedCount = 0;

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
        steuerNr: r.steuerNr || null,
        plz: r.plz || null,
        gemeinde: r.gemeinde || null,
        land: r.land || null,
        egflGesamt: r.egflGesamt,
        elerGesamt: r.elerGesamt,
        nationalKofiGesamt: r.nationalKofiGesamt,
        elerUndKofiGesamt: r.elerUndKofiGesamt,
        gesamtBetrag: r.gesamtBetrag,
        massnahmen: r.massnahmen.length > 0 ? JSON.stringify(r.massnahmen) : null,
        mutterunternehmen: r.mutter || null,
      }));

      await tx.antragEmpfaenger.createMany({ data });
      importedCount += data.length;
    }
  });

  return importedCount;
}

// POST /api/agrarantraege/import
// Modes:
//   1. multipart/form-data with field "csv" (file upload — best for files <100MB)
//   2. JSON { action: "url", url: "https://..." } — server fetches the URL as a stream
//   3. JSON { action: "serverpath", path: "/absolute/path/to/file.csv" } — reads from filesystem
export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";

  // ── Mode 1: multipart/form-data upload ────────────────────────────────────
  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const file = formData.get("csv");
    if (!file || typeof file === "string") {
      return NextResponse.json(
        { error: "Keine CSV-Datei übergeben (Feld: csv)" },
        { status: 400 }
      );
    }

    const buffer = await (file as File).arrayBuffer();

    // Auto-detect encoding: try UTF-8 first (BOM or valid UTF-8), fall back to Latin-1
    let text: string;
    const bytes = new Uint8Array(buffer);
    const hasUtf8Bom = bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
      if (hasUtf8Bom) text = text.slice(1); // strip BOM
    } catch {
      text = new TextDecoder("latin1").decode(buffer);
    }

    if (!text.trim()) {
      return NextResponse.json({ error: "CSV-Inhalt ist leer" }, { status: 400 });
    }

    const nodeStream = Readable.from([text]);
    const rl = createInterface({ input: nodeStream, crlfDelay: Infinity });
    const { aggMap, error } = await processStream(rl);

    if (error) return NextResponse.json({ error }, { status: 400 });
    if (aggMap.size === 0) {
      return NextResponse.json({ error: "Keine Datensätze aus CSV extrahiert" }, { status: 400 });
    }

    const importiert = await insertAggMap(aggMap);
    const jahre = [...new Set([...aggMap.values()].map((v) => v.haushaltsjahr).filter((y) => y > 0))].sort();
    return NextResponse.json({ ok: true, importiert, jahre, modus: "upload" });
  }

  // ── Modes 2 & 3: JSON body ─────────────────────────────────────────────────
  let body: { action?: string; url?: string; path?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body" }, { status: 400 });
  }

  // ── Mode 2: fetch URL as stream ────────────────────────────────────────────
  if (body.action === "url") {
    const url = body.url?.trim();
    if (!url) {
      return NextResponse.json({ error: "url fehlt im Request-Body" }, { status: 400 });
    }

    let fetchResponse: Response;
    try {
      fetchResponse = await fetch(url, {
        headers: { "Accept-Encoding": "gzip, deflate" },
      });
    } catch (e) {
      return NextResponse.json({ error: `Fetch-Fehler: ${String(e)}` }, { status: 502 });
    }

    if (!fetchResponse.ok) {
      return NextResponse.json(
        { error: `HTTP ${fetchResponse.status} beim Abrufen der URL` },
        { status: 502 }
      );
    }

    if (!fetchResponse.body) {
      return NextResponse.json({ error: "Keine Antwort-Body von der URL" }, { status: 502 });
    }

    const nodeStream = Readable.fromWeb(fetchResponse.body as import("stream/web").ReadableStream);
    const rl = createInterface({ input: nodeStream, crlfDelay: Infinity });
    const { aggMap, error } = await processStream(rl);

    if (error) return NextResponse.json({ error }, { status: 400 });
    if (aggMap.size === 0) {
      return NextResponse.json({ error: "Keine Datensätze aus CSV extrahiert" }, { status: 400 });
    }

    const importiert = await insertAggMap(aggMap);
    const jahre = [...new Set([...aggMap.values()].map((v) => v.haushaltsjahr).filter((y) => y > 0))].sort();
    return NextResponse.json({ ok: true, importiert, jahre, modus: "url" });
  }

  // ── Mode 3: read from server filesystem path ───────────────────────────────
  if (body.action === "serverpath") {
    const filePath = body.path?.trim();
    if (!filePath) {
      return NextResponse.json({ error: "path fehlt im Request-Body" }, { status: 400 });
    }
    if (!filePath.startsWith("/")) {
      return NextResponse.json(
        { error: "path muss ein absoluter Pfad sein (beginnt mit /)" },
        { status: 400 }
      );
    }

    try {
      await stat(filePath);
    } catch {
      return NextResponse.json(
        { error: `Datei nicht gefunden: ${filePath}` },
        { status: 400 }
      );
    }

    const fileStream = createReadStream(filePath, { encoding: "latin1" });
    const rl = createInterface({ input: fileStream, crlfDelay: Infinity });
    const { aggMap, error } = await processStream(rl);

    if (error) return NextResponse.json({ error }, { status: 400 });
    if (aggMap.size === 0) {
      return NextResponse.json({ error: "Keine Datensätze aus CSV extrahiert" }, { status: 400 });
    }

    const importiert = await insertAggMap(aggMap);
    const jahre = [...new Set([...aggMap.values()].map((v) => v.haushaltsjahr).filter((y) => y > 0))].sort();
    return NextResponse.json({ ok: true, importiert, jahre, modus: "serverpath" });
  }

  return NextResponse.json(
    { error: `Unbekannte action: "${body.action}". Erlaubt: url, serverpath` },
    { status: 400 }
  );
}
