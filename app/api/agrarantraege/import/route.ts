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
    "code der ma",
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
  egflMassnahme: ["betrag je vorhaben im rahmen des egfl"],
  elerMassnahme: ["betrag je vorhaben im rahmen des eler (eu-mittel)", "betrag je vorhaben im rahmen des eler"],
  nationalKofiMassnahme: ["betrag je vorhaben im rahmen der nationalen kofinanzierung", "nationale kofinanzierung je vorhaben"],
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
  const cleaned = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

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

function str(row: string[], col: number): string {
  if (col === -1) return "";
  return (row[col] ?? "").replace(/^"|"$/g, "").trim();
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
  massnahmen: Array<{ code: string; ziel: string; egfl: number; eler: number; nationalKofi: number; anfang: string; ende: string }>;
  mutter: string;
};

function entryToData(e: AggEntry) {
  return {
    haushaltsjahr: e.haushaltsjahr,
    name: e.name,
    steuerNr: e.steuerNr || null,
    plz: e.plz || null,
    gemeinde: e.gemeinde || null,
    land: e.land || null,
    egflGesamt: e.egflGesamt,
    elerGesamt: e.elerGesamt,
    nationalKofiGesamt: e.nationalKofiGesamt,
    elerUndKofiGesamt: e.elerUndKofiGesamt,
    gesamtBetrag: e.gesamtBetrag,
    massnahmen: e.massnahmen.length > 0 ? JSON.stringify(e.massnahmen) : null,
    mutterunternehmen: e.mutter || null,
  };
}

// Streaming: processes CSV line-by-line, inserts to DB in batches of BATCH_SIZE.
// Never holds more than BATCH_SIZE + 1 entries in memory at once.
const BATCH_SIZE = 200;

async function streamAndInsert(
  rl: ReturnType<typeof createInterface>
): Promise<{ count: number; error?: string }> {
  const deletedYears = new Set<number>();
  let batch: ReturnType<typeof entryToData>[] = [];
  let totalCount = 0;

  let sep = ";";
  let colYear = -1, colName = -1, colSteuerNr = -1, colPlz = -1, colGemeinde = -1;
  let colLand = -1, colMass = -1, colZiel = -1, colAnfang = -1, colEnde = -1;
  let colEgflM = -1, colElerM = -1, colNationalKofiM = -1;
  let colEgflG = -1, colElerG = -1, colNationalKofiG = -1, colElerUndKofiG = -1;
  let colGesamtBetrag = -1, colMutter = -1;
  let lineIndex = 0;

  let currentKey: string | null = null;
  let currentEntry: AggEntry | null = null;

  async function flushBatch() {
    if (batch.length === 0) return;
    await prisma.antragEmpfaenger.createMany({ data: batch });
    totalCount += batch.length;
    batch = [];
  }

  async function completeEntry() {
    if (!currentEntry) return;
    // Lazy-delete year on first encounter — safe because rows for each year
    // are grouped in AFIG CSV files, and we haven't inserted anything for
    // this year yet when we first see it.
    if (currentEntry.haushaltsjahr > 0 && !deletedYears.has(currentEntry.haushaltsjahr)) {
      await prisma.antragEmpfaenger.deleteMany({ where: { haushaltsjahr: currentEntry.haushaltsjahr } });
      deletedYears.add(currentEntry.haushaltsjahr);
    }
    batch.push(entryToData(currentEntry));
    currentEntry = null;
    if (batch.length >= BATCH_SIZE) await flushBatch();
  }

  for await (const rawLine of rl) {
    const line = rawLine.trim();
    if (!line) continue;

    if (lineIndex === 0) {
      sep = line.includes(";") ? ";" : ",";
      // Strip UTF-8 BOM from header if present
      const cleanLine = line.replace(/^\uFEFF/, "");
      const headers = cleanLine.split(sep).map((h) => h.replace(/^"|"$/g, "").trim());

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
        return { count: 0, error: `Spalte 'Name' nicht gefunden. Gefundene Spalten: ${headers.join(", ")}` };
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
    const egflG         = parseNum(row[colEgflG]);
    const elerG         = parseNum(row[colElerG]);
    const nationalKofiG = parseNum(row[colNationalKofiG]);
    const elerUndKofiG  = parseNum(row[colElerUndKofiG]);
    const gesamtBetrag  = parseNum(row[colGesamtBetrag]);
    const mutter        = str(row, colMutter);

    const key = `${year}|${name.toLowerCase()}|${plz}`;

    if (key !== currentKey) {
      await completeEntry();
      currentEntry = {
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
      };
      currentKey = key;
    } else if (currentEntry) {
      if (mass) {
        currentEntry.massnahmen.push({ code: mass, ziel, egfl: egflM, eler: elerM, nationalKofi: nationalKofiM, anfang, ende });
      }
      currentEntry.egflGesamt        = egflG || currentEntry.egflGesamt;
      currentEntry.elerGesamt        = elerG || currentEntry.elerGesamt;
      currentEntry.nationalKofiGesamt = nationalKofiG || currentEntry.nationalKofiGesamt;
      currentEntry.elerUndKofiGesamt = elerUndKofiG || currentEntry.elerUndKofiGesamt;
      currentEntry.gesamtBetrag      = gesamtBetrag || currentEntry.gesamtBetrag;
    }

    lineIndex++;
  }

  // Flush final entry
  await completeEntry();
  await flushBatch();

  if (totalCount === 0 && lineIndex <= 1) {
    return { count: 0, error: "Keine Datensätze aus CSV extrahiert" };
  }

  return { count: totalCount };
}

// POST /api/agrarantraege/import
// Modes:
//   1. multipart/form-data with field "csv"
//   2. JSON { action: "url", url: "https://..." }
//   3. JSON { action: "serverpath", path: "/absolute/path/to/file.csv" }
export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";

  // ── Mode 1: multipart/form-data upload ────────────────────────────────────
  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const file = formData.get("csv");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Keine CSV-Datei übergeben (Feld: csv)" }, { status: 400 });
    }

    const buffer = await (file as File).arrayBuffer();
    if (!buffer.byteLength) {
      return NextResponse.json({ error: "CSV-Inhalt ist leer" }, { status: 400 });
    }

    // Detect encoding from first 4KB only — avoids decoding the entire 250MB
    const bytes = new Uint8Array(buffer);
    const hasUtf8Bom = bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF;
    let encoding: BufferEncoding = "latin1";
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(buffer.slice(0, 4096));
      encoding = "utf8";
    } catch { /* latin1 */ }

    // Stream the raw bytes through readline — no full string allocation
    const nodeBuffer = Buffer.from(bytes);
    const nodeStream = Readable.from(nodeBuffer);
    nodeStream.setEncoding(encoding);
    // BOM stripping is handled in the header line parser (strips \uFEFF)
    void hasUtf8Bom; // handled in streamAndInsert header parsing

    const rl = createInterface({ input: nodeStream, crlfDelay: Infinity });
    const { count, error } = await streamAndInsert(rl);

    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json({ ok: true, importiert: count, modus: "upload" });
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
      fetchResponse = await fetch(url, { headers: { "Accept-Encoding": "gzip, deflate" } });
    } catch (e) {
      return NextResponse.json({ error: `Fetch-Fehler: ${String(e)}` }, { status: 502 });
    }

    if (!fetchResponse.ok) {
      return NextResponse.json({ error: `HTTP ${fetchResponse.status} beim Abrufen der URL` }, { status: 502 });
    }
    if (!fetchResponse.body) {
      return NextResponse.json({ error: "Keine Antwort-Body von der URL" }, { status: 502 });
    }

    const nodeStream = Readable.fromWeb(fetchResponse.body as import("stream/web").ReadableStream);
    const rl = createInterface({ input: nodeStream, crlfDelay: Infinity });
    const { count, error } = await streamAndInsert(rl);

    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json({ ok: true, importiert: count, modus: "url" });
  }

  // ── Mode 3: read from server filesystem path ───────────────────────────────
  if (body.action === "serverpath") {
    const filePath = body.path?.trim();
    if (!filePath) {
      return NextResponse.json({ error: "path fehlt im Request-Body" }, { status: 400 });
    }
    if (!filePath.startsWith("/")) {
      return NextResponse.json({ error: "path muss ein absoluter Pfad sein (beginnt mit /)" }, { status: 400 });
    }

    try {
      await stat(filePath);
    } catch {
      return NextResponse.json({ error: `Datei nicht gefunden: ${filePath}` }, { status: 400 });
    }

    const fileStream = createReadStream(filePath, { encoding: "latin1" });
    const rl = createInterface({ input: fileStream, crlfDelay: Infinity });
    const { count, error } = await streamAndInsert(rl);

    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json({ ok: true, importiert: count, modus: "serverpath" });
  }

  return NextResponse.json(
    { error: `Unbekannte action: "${body.action}". Erlaubt: url, serverpath` },
    { status: 400 }
  );
}
