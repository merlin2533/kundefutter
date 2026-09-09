// Geteilte Helfer für Excel/CSV-Import-Routen.
// Spaltennamen werden case-insensitiv gematcht und Sonder-/Leerzeichen
// gestrippt — so kann der Nutzer "VK (Standardpreis)", "vk-standardpreis"
// oder "VK_STANDARDPREIS" gleich verwenden.

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
