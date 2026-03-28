import { NextRequest, NextResponse } from "next/server";
import { createInterface } from "readline";
import { Readable } from "stream";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

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
  plz: string;
  gemeinde: string;
  land: string;
  egfl: number;
  eler: number;
  massnahmen: Array<{ code: string; ziel: string; egfl: number; eler: number }>;
  mutter: string;
};

async function processStream(
  rl: ReturnType<typeof createInterface>
): Promise<{ aggMap: Map<string, AggEntry>; error?: string }> {
  const aggMap = new Map<string, AggEntry>();

  let headers: string[] = [];
  let sep = ";";
  let colYear = -1;
  let colName = -1;
  let colPlz = -1;
  let colGemeinde = -1;
  let colLand = -1;
  let colMass = -1;
  let colZiel = -1;
  let colEgfl = -1;
  let colEler = -1;
  let colMutter = -1;
  let lineIndex = 0;

  for await (const rawLine of rl) {
    const line = rawLine.trim();
    if (!line) continue;

    if (lineIndex === 0) {
      // Parse headers from first line
      sep = line.includes(";") ? ";" : ",";
      headers = line.split(sep).map((h) => h.replace(/^"|"$/g, "").trim());

      colYear     = findCol(headers, "haushaltsjahr");
      colName     = findCol(headers, "name");
      colPlz      = findCol(headers, "plz");
      colGemeinde = findCol(headers, "gemeinde");
      colLand     = findCol(headers, "land");
      colMass     = findCol(headers, "massnahme");
      colZiel     = findCol(headers, "ziel");
      colEgfl     = findCol(headers, "egfl");
      colEler     = findCol(headers, "eler");
      colMutter   = findCol(headers, "mutter");

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

    const name = (colName !== -1 ? row[colName] : "").replace(/^"|"$/g, "").trim();
    if (!name || name.toLowerCase() === "kleinempfänger") {
      lineIndex++;
      continue;
    }

    const year   = colYear !== -1 ? parseInt(row[colYear] ?? "0") : 0;
    const plz    = (colPlz !== -1 ? row[colPlz] : "").replace(/^"|"$/g, "").trim();
    const gem    = (colGemeinde !== -1 ? row[colGemeinde] : "").replace(/^"|"$/g, "").trim();
    const land   = (colLand !== -1 ? row[colLand] : "").replace(/^"|"$/g, "").trim();
    const mass   = (colMass !== -1 ? row[colMass] : "").replace(/^"|"$/g, "").trim();
    const ziel   = (colZiel !== -1 ? row[colZiel] : "").replace(/^"|"$/g, "").trim();
    const egfl   = parseNum(colEgfl !== -1 ? row[colEgfl] : undefined);
    const eler   = parseNum(colEler !== -1 ? row[colEler] : undefined);
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

    // NOTE: for files >100MB, use Auto-Download (url) or Serverpfad instead.
    const buffer = await (file as File).arrayBuffer();
    const text = new TextDecoder("latin1").decode(buffer);

    if (!text.trim()) {
      return NextResponse.json({ error: "CSV-Inhalt ist leer" }, { status: 400 });
    }

    const nodeStream = Readable.from(text.split("\n"));
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
