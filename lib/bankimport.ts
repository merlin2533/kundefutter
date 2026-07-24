export interface Buchung {
  buchungsdatum: Date;
  wertstellung?: Date;
  betrag: number; // + Eingang, - Ausgang
  waehrung: string;
  verwendungszweck: string;
  gegenkonto?: string; // IBAN
  gegenkontoName?: string;
  saldo?: number;
}

function parseDatum(s: string): Date | undefined {
  if (!s) return undefined;
  // DD.MM.YYYY
  const dmy = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dmy) return new Date(`${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`);
  // YYYY-MM-DD
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) return new Date(s);
  return undefined;
}

function parseBetrag(s: string): number {
  if (!s) return 0;
  let v = s.trim().replace(/['"]/g, "");
  // If comma is used as decimal separator (and dot as thousands): "1.234,56"
  // If dot is used as decimal separator: "1234.56"
  const hasComma = v.includes(",");
  const hasDot = v.includes(".");
  if (hasComma) {
    // German format: dot = thousands separator, comma = decimal
    if (hasDot) v = v.replace(/\./g, ""); // remove thousands dots
    v = v.replace(",", ".");
  }
  return parseFloat(v) || 0;
}

function unquote(s: string): string {
  return s.trim().replace(/^["']|["']$/g, "");
}

function splitCSVLine(line: string, sep: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuote = !inQuote;
    } else if (!inQuote && line.slice(i, i + sep.length) === sep) {
      result.push(current.trim());
      current = "";
      i += sep.length - 1;
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function detectSeparator(header: string): string {
  const semis = (header.match(/;/g) || []).length;
  const commas = (header.match(/,/g) || []).length;
  return semis >= commas ? ";" : ",";
}

function fixEncoding(text: string): string {
  // If the text contains replacement chars, it might be ISO-8859-1 misread.
  // Node.js strings are UTF-16, so we just return as-is in most cases.
  // Actual encoding conversion happens at the Buffer level if needed.
  return text;
}

type BankFormat = "sparkasse" | "volksbank" | "dkb" | "ing" | "generic";

function detectFormat(header: string): BankFormat {
  const h = header.toLowerCase();
  if (h.includes("buchungstag") && h.includes("wertstellung") && h.includes("buchungstext") && h.includes("verwendungszweck")) {
    return "sparkasse";
  }
  if (h.includes("auftraggeber/zahlungsempfänger") || h.includes("auftraggeber/zahlungsempf")) {
    if (h.includes("gläubiger-id") && !h.includes("betrag (eur)")) return "volksbank";
    if (h.includes("buchungstext") && !h.includes("gläubiger-id")) return "ing";
    return "volksbank";
  }
  if (h.includes("gläubiger-id") && h.includes("betrag (eur)")) return "dkb";
  if (h.includes("buchung") && h.includes("valuta") && (h.includes("empfänger") || h.includes("auftraggeber"))) {
    return "ing";
  }
  return "generic";
}

function parseSparkasse(lines: string[], sep: string): Buchung[] {
  // Header: Buchungstag;Wertstellung;Buchungstext;Verwendungszweck;Betrag;Währung
  const buchungen: Buchung[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = splitCSVLine(line, sep).map(unquote);
    if (cols.length < 5) continue;
    const datum = parseDatum(cols[0]);
    if (!datum) continue;
    buchungen.push({
      buchungsdatum: datum,
      wertstellung: parseDatum(cols[1]),
      verwendungszweck: (cols[3] || cols[2] || "").trim(),
      betrag: parseBetrag(cols[4]),
      waehrung: cols[5] || "EUR",
    });
  }
  return buchungen;
}

function parseVolksbank(lines: string[], sep: string): Buchung[] {
  // Header: Buchungstag;Valuta;Auftraggeber/Zahlungsempfänger;Konto;BLZ;Betrag;Gläubiger-ID;Mandatsreferenz;Buchungstext;Typ
  const buchungen: Buchung[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = splitCSVLine(line, sep).map(unquote);
    if (cols.length < 6) continue;
    const datum = parseDatum(cols[0]);
    if (!datum) continue;
    buchungen.push({
      buchungsdatum: datum,
      wertstellung: parseDatum(cols[1]),
      gegenkontoName: cols[2] || undefined,
      gegenkonto: cols[3] || undefined,
      betrag: parseBetrag(cols[5]),
      waehrung: "EUR",
      verwendungszweck: (cols[8] || cols[2] || "").trim(),
    });
  }
  return buchungen;
}

function parseDKB(lines: string[], sep: string): Buchung[] {
  // Header varies, look for columns: Buchungstag, Betrag (EUR), Gläubiger-ID
  // Typical: Buchungstag;Wertstellung;Buchungstext;Glaeubiger-ID;Mandatsreferenz;Betrag (EUR);Glaeubiger-ID;...
  const headerLine = lines[0];
  const headers = splitCSVLine(headerLine, sep).map(h => unquote(h).toLowerCase());
  const idxDatum = headers.findIndex(h => h.includes("buchungstag") || h.includes("buchung"));
  const idxValuta = headers.findIndex(h => h.includes("wertstellung") || h.includes("valuta"));
  const idxBetrag = headers.findIndex(h => h.includes("betrag"));
  const idxText = headers.findIndex(h => h.includes("buchungstext") || h.includes("verwendung"));
  const idxGegen = headers.findIndex(h => h.includes("auftraggeber") || h.includes("empfänger") || h.includes("empf"));
  const idxIban = headers.findIndex(h => h === "iban" || h === "konto" || h === "gegenkonto");

  const buchungen: Buchung[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = splitCSVLine(line, sep).map(unquote);
    if (idxDatum < 0 || idxBetrag < 0) continue;
    const datum = parseDatum(cols[idxDatum] || "");
    if (!datum) continue;
    buchungen.push({
      buchungsdatum: datum,
      wertstellung: idxValuta >= 0 ? parseDatum(cols[idxValuta] || "") : undefined,
      betrag: parseBetrag(cols[idxBetrag] || "0"),
      waehrung: "EUR",
      verwendungszweck: (idxText >= 0 ? cols[idxText] : "") || "",
      gegenkontoName: idxGegen >= 0 ? cols[idxGegen] || undefined : undefined,
      gegenkonto: idxIban >= 0 ? cols[idxIban] || undefined : undefined,
    });
  }
  return buchungen;
}

function parseING(lines: string[], sep: string): Buchung[] {
  // Header: Buchung;Valuta;Auftraggeber/Empfänger;Buchungstext;Betrag
  const buchungen: Buchung[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = splitCSVLine(line, sep).map(unquote);
    if (cols.length < 5) continue;
    const datum = parseDatum(cols[0]);
    if (!datum) continue;
    buchungen.push({
      buchungsdatum: datum,
      wertstellung: parseDatum(cols[1]),
      gegenkontoName: cols[2] || undefined,
      verwendungszweck: (cols[3] || "").trim(),
      betrag: parseBetrag(cols[4]),
      waehrung: "EUR",
    });
  }
  return buchungen;
}

// Manche Banken (u.a. Volksbank/Raiffeisenbank "VR-NetWorld"-Export) liefern sowohl Spalten für
// das EIGENE Konto ("Bankname Auftragskonto", "IBAN Auftragskonto") als auch für den tatsächlichen
// Überweiser/Empfänger ("Name Zahlungsbeteiligter", "IBAN Zahlungsbeteiligter"). Ein simples
// `.includes("name")` trifft zuerst auf "Bankname Auftragskonto" (eigene Bank, für jede Zeile
// identisch) statt auf die eigentliche Gegenpartei — daher hier eigene-Konto-Spalten explizit ausschließen.
function findColumnIndex(headers: string[], include: string[], exclude: string[] = []): number {
  return headers.findIndex(
    h => include.some(p => h.includes(p)) && !exclude.some(p => h.includes(p))
  );
}

function parseGeneric(lines: string[], sep: string): Buchung[] {
  if (lines.length < 2) return [];
  const headers = splitCSVLine(lines[0], sep).map(h => unquote(h).toLowerCase());
  const EIGENES_KONTO = ["auftragskonto", "eigenes konto", "eigenkonto"];

  const idxDatum = findColumnIndex(headers, ["datum", "buchung", "date"]);
  const idxBetrag = findColumnIndex(headers, ["betrag", "amount", "summe"]);
  // Verwendungszweck bevorzugen — "buchungstext" ist nur eine grobe Umsatzart (z.B. "Lastschrift")
  const idxText =
    findColumnIndex(headers, ["verwendung", "zweck"], EIGENES_KONTO) >= 0
      ? findColumnIndex(headers, ["verwendung", "zweck"], EIGENES_KONTO)
      : findColumnIndex(headers, ["buchungstext", "text", "description"]);
  const idxValuta = findColumnIndex(headers, ["valuta", "wertstellung"]);
  const idxGegen = findColumnIndex(
    headers,
    ["zahlungsbeteiligter", "auftraggeber", "empfänger", "gegenüber", "name"],
    [...EIGENES_KONTO, "bankname"]
  );
  const idxGegenIban = findColumnIndex(headers, ["iban"], EIGENES_KONTO);
  const idxWaehrung = findColumnIndex(headers, ["währung", "waehrung", "currency"]);
  const idxSaldo = findColumnIndex(headers, ["saldo", "kontostand", "balance"]);

  if (idxDatum < 0 || idxBetrag < 0) return [];

  const buchungen: Buchung[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = splitCSVLine(line, sep).map(unquote);
    const datum = parseDatum(cols[idxDatum] || "");
    if (!datum) continue;
    buchungen.push({
      buchungsdatum: datum,
      wertstellung: idxValuta >= 0 ? parseDatum(cols[idxValuta] || "") : undefined,
      betrag: parseBetrag(cols[idxBetrag] || "0"),
      waehrung: (idxWaehrung >= 0 ? cols[idxWaehrung] : "") || "EUR",
      verwendungszweck: (idxText >= 0 ? cols[idxText] : "") || "",
      gegenkontoName: idxGegen >= 0 ? cols[idxGegen] || undefined : undefined,
      gegenkonto: idxGegenIban >= 0 ? cols[idxGegenIban] || undefined : undefined,
      saldo: idxSaldo >= 0 ? parseBetrag(cols[idxSaldo] || "") || undefined : undefined,
    });
  }
  return buchungen;
}

export function parseKontoauszug(csvText: string, dateiname: string): Buchung[] {
  // Normalize line endings
  const text = fixEncoding(csvText).replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Skip leading non-data lines (metadata rows before header)
  const allLines = text.split("\n");
  let headerIndex = 0;

  // Find the header line (contains typical column names)
  for (let i = 0; i < Math.min(20, allLines.length); i++) {
    const l = allLines[i].toLowerCase();
    if (
      l.includes("buchungstag") ||
      l.includes("buchung") ||
      l.includes("datum") ||
      l.includes("date") ||
      l.includes("betrag") ||
      l.includes("amount")
    ) {
      headerIndex = i;
      break;
    }
  }

  const lines = allLines.slice(headerIndex);
  if (lines.length < 2) return [];

  const sep = detectSeparator(lines[0]);
  const format = detectFormat(lines[0]);

  void dateiname; // used for future logging if needed

  switch (format) {
    case "sparkasse":
      return parseSparkasse(lines, sep);
    case "volksbank":
      return parseVolksbank(lines, sep);
    case "dkb":
      return parseDKB(lines, sep);
    case "ing":
      return parseING(lines, sep);
    default:
      return parseGeneric(lines, sep);
  }
}
