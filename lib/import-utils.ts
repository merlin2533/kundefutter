// Geteilte Helfer für Excel/CSV-Import-Routen.
// Spaltennamen werden case-insensitiv gematcht und Sonder-/Leerzeichen
// gestrippt — so kann der Nutzer "VK (Standardpreis)", "vk-standardpreis"
// oder "VK_STANDARDPREIS" gleich verwenden.
import * as XLSX from "xlsx";

export function pickCol(row: Record<string, unknown>, ...keys: string[]): string {
  const norm = (s: string) => s.toLowerCase().replace(/[\s_\-()]/g, "");
  const lookup: Record<string, unknown> = {};
  for (const k of Object.keys(row)) lookup[norm(k)] = row[k];
  for (const key of keys) {
    const v = lookup[norm(key)];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

// Wie pickCol(), aber liefert den ungestringifizierten Rohwert der Zelle — nötig für
// Datumsspalten, deren Wert (ohne `cellDates:true` beim XLSX.read()) ein numerischer
// Excel-Datums-Seriencode statt eines Textdatums sein kann; String(zahl) würde diese
// Information für parseImportDatum() unwiderruflich verlieren.
function pickRawCol(row: Record<string, unknown>, ...keys: string[]): unknown {
  const norm = (s: string) => s.toLowerCase().replace(/[\s_\-()]/g, "");
  const lookup: Record<string, unknown> = {};
  for (const k of Object.keys(row)) lookup[norm(k)] = row[k];
  for (const key of keys) {
    const v = lookup[norm(key)];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return undefined;
}

// Excel-Serial-Datumscodes liegen für diese Anwendung plausibel zwischen 36526 (2000-01-01)
// und 73050 (2099-12-31) — bewusst NICHT ab 1 (1900-01-01): ein Import-Datum vor 2000 ist für
// dieses System nicht real, ein Bereich ab 1 würde aber z.B. einen bloßen Jahres- oder
// Wochenwert ("2025") fälschlich als Datum (1905-07-17) statt als das erkennen, was er ist —
// ein anderer numerischer Wert (z.B. eine Belegnummer).
const EXCEL_SERIAL_MIN = 36526;
const EXCEL_SERIAL_MAX = 73050;

function datumAusSeriencode(n: number): Date | null {
  const parsed = XLSX.SSF.parse_date_code(n);
  if (!parsed) return null;
  const d = new Date(parsed.y, parsed.m - 1, parsed.d, parsed.H ?? 0, parsed.M ?? 0, parsed.S ?? 0);
  return isNaN(d.getTime()) ? null : d;
}

// new Date(jahr, monat0, tag) "rollt" einen ungültigen Tag/Monat stillschweigend in den
// Folgemonat (z.B. 31.02.2026 -> 03.03.2026) statt einen Fehler zu liefern — bei einem
// Legedatum-Import würde das unbemerkt ein falsches MHD erzeugen. Round-Trip-Prüfung: das
// tatsächlich konstruierte Datum muss exakt den angegebenen Komponenten entsprechen.
function gueltigesKalenderdatum(jahr: number, monatIndex: number, tag: number): Date | null {
  const d = new Date(jahr, monatIndex, tag);
  if (isNaN(d.getTime())) return null;
  if (d.getFullYear() !== jahr || d.getMonth() !== monatIndex || d.getDate() !== tag) return null;
  return d;
}

// Parst ein Datum aus einer Import-Zeile: erkennt sowohl Freitext-Formate (DD.MM.YYYY,
// YYYY-MM-DD) als auch numerische Excel-Datums-Seriencodes, wie sie XLSX.utils.sheet_to_json()
// OHNE `cellDates:true` für eine als Datum formatierte Excel-Zelle liefert (eine reine Zahl,
// z.B. 45912 statt "12.09.2025"). `new Date(String(zahl))` würde daraus fälschlich ein Datum
// im Jahr 45912 konstruieren, statt zu erkennen, dass es sich um einen Seriencode handelt —
// kritisch bei einem Legedatum-Import, da es das MHD bestimmt (lib/eier-mhd.ts
// berechneEierMhd()). Liefert `null` bei fehlendem ODER nicht erkennbarem Wert — der Aufrufer
// muss beide Fälle unterscheiden (Spalte fehlt vs. Wert ist ungültig).
export function parseImportDatum(row: Record<string, unknown>, ...keys: string[]): Date | null {
  const raw = pickRawCol(row, ...keys);
  if (raw === undefined) return null;
  if (raw instanceof Date) {
    return isNaN(raw.getTime()) ? null : raw;
  }
  if (typeof raw === "number") {
    return raw >= EXCEL_SERIAL_MIN && raw <= EXCEL_SERIAL_MAX ? datumAusSeriencode(raw) : null;
  }
  const s = String(raw).trim();
  if (!s) return null;
  // Jahr exakt 2- oder 4-stellig (nicht \d{2,4}) — sonst würde z.B. "12.09.202" (3-stellig,
  // eher ein Tippfehler) unbemerkt als Jahr 202 interpretiert.
  const dmy = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})$/);
  if (dmy) {
    const [, d, mo, y] = dmy;
    const yr = y.length === 2 ? 2000 + parseInt(y, 10) : parseInt(y, 10);
    return gueltigesKalenderdatum(yr, parseInt(mo, 10) - 1, parseInt(d, 10));
  }
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const [, y, mo, d] = iso;
    return gueltigesKalenderdatum(parseInt(y, 10), parseInt(mo, 10) - 1, parseInt(d, 10));
  }
  // Manche CSV-Exporte aus Excel verlieren die Zellformatierung und liefern den
  // Seriencode als reinen Zahlen-Text statt als Number — z.B. wenn die Quelldatei
  // erst nach CSV konvertiert und dann hier hochgeladen wird.
  if (/^\d{4,6}$/.test(s)) {
    const n = parseInt(s, 10);
    if (n >= EXCEL_SERIAL_MIN && n <= EXCEL_SERIAL_MAX) return datumAusSeriencode(n);
  }
  return null;
}

// Normalisiert einen Artikelnamen für den Duplikat-Abgleich beim Import:
// ®/™/©-Symbole entfernen, verschiedene Bindestrich-/Minus-Varianten auf "-"
// vereinheitlichen, Mehrfach-Leerzeichen zusammenfassen, groß-/kleinschreibungs-
// tolerant. Ohne diese Normalisierung matcht z.B. "Sulfomix® plus" (Import)
// nicht gegen "Sulfomix plus" (DB) — beide Import-Routen nutzen dieselbe
// Funktion, damit Vorschau und tatsächlicher Import konsistent entscheiden.
export function normalizeArtikelName(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/[®™©]/g, "")
    .replace(/[‐-―−]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// Normalisiert eine Artikelnummer für den Duplikat-Abgleich beim Import: Leerzeichen und
// Bindestriche entfernen, Groß-/Kleinschreibung vereinheitlichen — Preislisten mit
// Mengenstaffel-Zeilen (z.B. "… ab 500 kg" / "… ab 750 kg" desselben Produkts) teilen sich
// oft dieselbe Artikelnummer unter abweichendem Namen; ohne diesen Abgleich erkennt der reine
// Namens-Duplikat-Check (normalizeArtikelName) das nicht als Update und `artikel.create()`
// scheitert an der @unique-Regel auf Artikelnummer (siehe AGENTS.md "Bekannte Bugs").
export function normalizeArtikelnummer(s: string): string {
  return s.trim().replace(/[\s-]+/g, "").toUpperCase();
}

// Reduziert einen Artikelnamen zusätzlich um Verpackungs-/Mengenangaben
// (z.B. "- 25 kg Sack", "(600Kg)", "Big Bag") auf den reinen Produktnamen —
// dient NUR der Erkennung möglicher Duplikate mit abweichender Benennung
// (Anzeige als Hinweis in der Import-Vorschau), NICHT als automatischer
// Match/Merge: unterschiedliche Sorten/Varianten (z.B. "SU Horizon" vs.
// "SU Jonte") dürfen dadurch nicht fälschlich zusammengeführt werden.
export function artikelBaseName(s: string): string {
  return normalizeArtikelName(s)
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b\d+([.,]\d+)?\s*(kg|t|to|tonnen?|l|liter|ltr|stk|stück|stueck)\b/g, " ")
    .replace(/\b(big\s*bag|bigbag|sack|kanister|eimer|beutel|gebinde|flasche|palette|dose|karton|fass)\b/g, " ")
    .replace(/[-/,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Reduziert einen Firmennamen um gängige deutsche Rechtsformzusätze —
// dient wie artikelBaseName NUR der Erkennung möglicher Duplikate
// (Import-Vorschau-Hinweis), z.B. "BvG" (Import) vs. "BvG Agrar GmbH" (DB).
export function firmenBaseName(s: string): string {
  return normalizeArtikelName(s)
    .replace(/\./g, "") // Abkürzungspunkte entfernen (z.B. "B.v.G." → "bvg"), nicht durch Leerzeichen ersetzen
    .replace(/,/g, " ")
    .replace(/\b(gmbh\s*(&|und)\s*co\s*kg|gmbh|mbh|co\s*kg|kg|ohg|gbr|ag|eg|e\s*k)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Zwei bereits normalisierte/reduzierte Namen gelten als "ähnlich", wenn
// einer im anderen als zusammenhängender Text vorkommt (in beide Richtungen,
// da Import-Namen oft kürzer sind als die ausführlicheren DB-Namen — z.B.
// enthält "BvG-Bor 17,4 G – 17,4 % Bor, wasserlösliches Bor, Borsäure" den
// kürzeren Import-Namen "BvG-Bor 17,4 G" als Präfix). `minLaenge` verhindert
// Zufallstreffer durch sehr kurze/generische Reste.
export function istAehnlicherName(basisA: string, basisB: string, minLaenge = 4): boolean {
  if (basisA.length < minLaenge || basisB.length < minLaenge) return false;
  return basisA.includes(basisB) || basisB.includes(basisA);
}

// Firmennamen unterscheiden sich manchmal NICHT nur durch Rechtsform/
// Abkürzung, sondern durch einen abweichenden Unternehmensbereich-Zusatz —
// z.B. "BvG Agrar GmbH" (DB) vs. "BvG Bodenverbesserungs-GmbH" (Import),
// beides derselbe Lieferant. Da hier keiner der vollen Basisnamen im
// anderen enthalten ist, greift istAehnlicherName() nicht — als Fallback
// vergleichen wir nur das erste, markentypische Wort. Generische deutsche
// Branchenwörter werden ausgeschlossen, weil sie von vielen unabhängigen
// Firmen als erstes Wort genutzt werden (z.B. "Raiffeisen Nord" vs.
// "Raiffeisen Süd" sind KEIN gemeinsamer Treffer).
const GENERISCHE_FIRMEN_ERSTWORT = new Set([
  "raiffeisen", "landhandel", "landwirtschaftliche", "landwirtschafts",
  "handel", "handels", "grosshandel", "großhandel", "agrar", "agro",
  "genossenschaft", "vertrieb", "bau", "bayer", "syngenta", "basf",
]);

export function hatGemeinsamesErstwort(basisA: string, basisB: string, minLaenge = 3): boolean {
  const ersteA = basisA.split(/[\s-]+/).filter(Boolean)[0] ?? "";
  const ersteB = basisB.split(/[\s-]+/).filter(Boolean)[0] ?? "";
  if (ersteA.length < minLaenge || ersteA !== ersteB) return false;
  return !GENERISCHE_FIRMEN_ERSTWORT.has(ersteA);
}

// Deutsche Notation: "1.234,56" → 1234.56. Punkt nur als Tausender entfernen,
// wenn auch ein Komma vorhanden ist — sonst gehen "2634.8" → 26348 verloren.
export function parseNumber(s: string): number {
  if (!s) return 0;
  const cleaned = s.includes(",")
    ? s.replace(/\./g, "").replace(",", ".")
    : s.replace(/[^0-9.\-]/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

// ── Spalten-Aliasse für Artikel-Import-Vorlagen ─────────────────────────────
// Werden in beiden Routen (/api/artikel/import + /api/einstellungen/artikel-import)
// genutzt. Reihenfolge bestimmt Priorität — der erste Treffer gewinnt.

export const ARTIKEL_ALIAS = {
  name: ["Name", "Produktname", "Artikel", "Bezeichnung"],
  artikelnummer: ["Artikelnummer", "Nummer", "ArtNr", "Art-Nr", "SKU"],
  standardpreis: [
    "Standardpreis",
    "VK (Standardpreis)",
    "Verkaufspreis",
    "VK-Preis",
    "VKP",
    "VK",
    "Listenpreis",
    "Stückpreis",
    "Stueckpreis",
    "Nettopreis",
    "Netto-Preis",
    "Netto",
    "Preis netto",
    "Bruttopreis",
    "Preis",
  ],
  einkaufspreis: ["EK (Einkaufspreis)", "Einkaufspreis", "EK-Preis", "EK", "Einstandspreis"],
  mwst: ["MwSt %", "MwSt", "MwSt-Satz", "Mehrwertsteuer", "USt", "Steuer"],
  kategorie: ["Kategorie", "Artikelkategorie", "Produktkategorie", "Produktgruppe", "Warengruppe", "Gruppe"],
  unterkategorie: ["Unterkategorie", "Subkategorie", "Kultur", "Fruchtart"],
  einheit: ["Einheit", "Mengeneinheit", "ME", "Einh"],
  mindestbestand: ["Mindestbestand", "Meldebestand", "Min-Bestand"],
  bestand: ["Lagerbestand", "Bestand", "Aktueller Bestand"],
  liefergroesse: [
    "Verpackungsgröße",
    "Verpackungsgroesse",
    "Verpackung",
    "Liefergröße",
    "Liefergroesse",
    "Gebinde",
  ],
  beschreibung: ["Beschreibung", "Bemerkung", "Notiz"],
  lieferant: ["Bevorzugter Lieferant", "Lieferant", "Lieferantenname", "Hersteller"],
  mindestbestellmenge: ["Mindestbestellmenge", "Min. Bestellmenge", "Mindestmenge", "MOQ", "Min-Menge"],
} as const;

// ── Spalten-Aliasse für Kunden-Import-Vorlagen ──────────────────────────────
// Unterstützt u.a. Gevis/Navision-Exporte und einfache CSV-Listen.
// Reihenfolge bestimmt Priorität — der erste Treffer gewinnt.

export const KUNDEN_ALIAS = {
  name: ["Name", "Name 1", "Nachname", "Kundenname", "Suchbegriff"],
  vorname: ["Vorname", "Name 2", "Kontaktvorname"],
  firma: ["Firma", "Firmenname", "Unternehmensname", "Gesellschaft"],
  kundennummer: ["Kundennr.", "Kundennummer", "Kunden-Nr", "Nr.", "Nummer", "Debitorennummer", "Debitoren-Nr", "Kto.", "Kontonummer"],
  kategorie: ["Kategorie", "Kundengruppe", "Gruppe", "Kundenkategorie", "Preisgruppe", "Geschäftsgruppe", "Buchungsgruppe"],
  strasse: ["Straße", "Strasse", "Adresse", "Adresse 1", "Straße Nr.", "Str."],
  plz: ["PLZ", "PLZ-Code", "Postleitzahl", "Post. Leitzahl"],
  ort: ["Ort", "Stadt", "Wohnort", "Gemeinde"],
  land: ["Land", "Länder-/Regionscode", "Landcode", "Land/Region"],
  telefon: ["Telefon", "Tel.", "Telefonnr.", "Telefon 1", "Telefon Nr.", "Fon"],
  mobil: ["Mobil", "Handy", "Mobiltelefon", "Mobile", "Mobilnr."],
  fax: ["Fax", "Faxnr.", "Fax Nr.", "Fax-Nr."],
  email: ["E-Mail", "Email", "E-Mail-Adresse", "eMail", "Mail"],
  notizen: ["Notizen", "Bemerkungen", "Hinweise", "Kommentar", "Info"],
  ustIdNr: ["USt-IdNr.", "USt-ID", "USt Identifikationsnummer", "Umsatzsteuer-ID", "UID"],
  zahlungsziel: ["Zahlungsziel", "Zahlungsbedingungscode", "Zahlungsbedingung", "Nettotagezahl"],
  betriebsnummer: ["Betriebsnummer", "Betriebs-Nr.", "VVVO"],
} as const;

// ── Spalten-Aliasse für Anlieferungs-Import-Vorlagen (Erzeugerabrechnung) ───
// Kunde/Erzeuger und Artikel werden per Name/Artikelnummer aufgelöst (keine internen IDs
// in der Quelldatei erwartet). Reihenfolge bestimmt Priorität — der erste Treffer gewinnt.

export const ANLIEFERUNG_ALIAS = {
  kunde: ["Erzeuger", "Kunde", "Lieferant", "Name"],
  artikel: ["Artikel", "Artikelnummer", "Produkt", "Ware"],
  datum: ["Datum", "Anlieferungsdatum", "Lieferdatum"],
  menge: ["Menge", "Gewicht", "Liefermenge"],
  einheit: ["Einheit", "ME", "Mengeneinheit"],
  feuchte: ["Feuchte", "Restfeuchte", "Feuchtigkeit"],
  qualitaet: ["Qualität", "Qualitaet", "Güte", "Guete"],
  preisProEinheit: ["Preis", "Preis/Einheit", "Preis pro Einheit", "Preis je Einheit", "EK-Preis"],
  notiz: ["Notiz", "Bemerkung", "Hinweis"],
  externeNr: ["Belegnummer", "Beleg-Nr", "Externe Nr", "Externe-Nr", "Wiegescheinnummer", "Wiegeschein-Nr"],
} as const;

// ── Spalten-Aliasse für EierSortierung-Import-Vorlagen (Sortiermaschinen-Export) ──
// Ein Zeile = eine klassifizierte Ausgangscharge (analog der manuellen Erfassung unter
// /eiersortierung/neu) — Artikel/Güte-/Gewichtsklasse/Menge sind Pflicht, der Rest optional.

// Bewusst KEINE zu generischen Aliasse ("Gewicht" bei Gewichtsklasse, "Erzeuger" bei
// Erzeugercode, "Beleg"/"Belegnummer" bei Anlieferung) — ein Sortiermaschinen-Export hat
// oft eine eigene, unabhängige Belegnummer-Spalte, und ein reines "Gewicht"/"Erzeuger"
// kollidiert leicht mit einer echten Gramm-Gewichts- bzw. Erzeugernamen-Spalte. Ein
// falscher Treffer fällt dadurch als klare Zeilen-Fehlermeldung auf, statt still eine
// Spalte mit anderer Bedeutung zu übernehmen.
export const EIERSORTIERUNG_ALIAS = {
  artikel: ["Artikel", "Artikelnummer", "Produkt"],
  gueteklasse: ["Güteklasse", "Gueteklasse", "Güte", "Guete", "Klasse"],
  gewichtsklasse: ["Gewichtsklasse", "Größe", "Groesse"],
  menge: ["Menge", "Anzahl", "Stück", "Stueck"],
  datum: ["Datum", "Sortierdatum"],
  anlieferung: ["Anlieferung", "Anlieferungsnummer", "ANL-Nr", "Externe Nr", "Externe-Nr"],
  chargeNr: ["Charge", "Chargennummer", "Charge-Nr", "ChargeNr"],
  legedatum: ["Legedatum"],
  erzeugercode: ["Erzeugercode", "Erzeuger-Code"],
  notiz: ["Notiz", "Bemerkung", "Hinweis"],
} as const;
