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
  lieferant: ["Lieferant", "Lieferantenname", "Hersteller"],
} as const;
