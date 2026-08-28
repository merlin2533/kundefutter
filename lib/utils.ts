/**
 * Bevorzugten Lieferanten-Eintrag eines Artikels auflösen: der als "bevorzugt" markierte,
 * falls dort ein Preis hinterlegt ist; sonst irgendeiner MIT gepflegtem Preis (> 0); sonst
 * der bevorzugte auch ohne Preis; sonst der erste vorhandene. Nur bei komplett fehlenden
 * Lieferanten null.
 *
 * Ein reines `lieferanten[0]`- oder `find(bevorzugt) ?? lieferanten[0]`-Fallback zeigte bei
 * mehreren Lieferanten ohne eindeutige Präferenz je nach (nicht garantierter) DB-Rückgabe-
 * reihenfolge fälschlich 0,00 € statt des tatsächlich gepflegten EK eines anderen
 * Lieferanten — dieser Helper ist die einzige Quelle der Wahrheit dafür.
 */
export function resolveBevorzugtenLieferanten<T extends { einkaufspreis: number; bevorzugt?: boolean }>(
  lieferanten: T[] | null | undefined
): T | null {
  if (!lieferanten || lieferanten.length === 0) return null;
  const bev = lieferanten.find((l) => l.bevorzugt);
  if (bev && bev.einkaufspreis > 0) return bev;
  const mitPreis = lieferanten.find((l) => l.einkaufspreis > 0);
  if (mitPreis) return mitPreis;
  return bev ?? lieferanten[0];
}

/** Wie resolveBevorzugtenLieferanten(), liefert aber direkt den EK-Preis (0 wenn kein Lieferant). */
export function resolveBevorzugtenEK<T extends { einkaufspreis: number; bevorzugt?: boolean }>(
  lieferanten: T[] | null | undefined
): number {
  return resolveBevorzugtenLieferanten(lieferanten)?.einkaufspreis ?? 0;
}

export function berechneVerkaufspreis(
  artikel: { standardpreis: number },
  kundePreis?: { preis: number; rabatt: number } | null
): number {
  if (kundePreis) {
    const p = kundePreis.preis * (1 - kundePreis.rabatt / 100);
    return Math.round(p * 100) / 100;
  }
  return artikel.standardpreis;
}

export interface MengenrabattEintrag {
  kundeId: number | null;
  artikelId: number | null;
  kategorie: string | null;
  vonMenge: number;
  /** Absoluter Verkaufspreis ab `vonMenge` — primäre, neue Eingabeart. */
  preis: number | null;
  /** Legacy: Rabatt in % — wird nur genutzt, wenn `preis` null ist (alte, vor der
   *  Umstellung auf absolute Staffelpreise angelegte Einträge). */
  rabattProzent: number;
  aktiv: boolean;
}

/**
 * Ermittelt die geltende Mengenstaffel (höchste erreichte vonMenge-Schwelle) für einen
 * Artikel/eine Menge/einen Kunden. Einzige Quelle der Wahrheit für diese Auswahllogik —
 * von der Live-Vorschau im Lieferungs-Erfassungsformular (app/lieferungen/neu/page.tsx) UND
 * vom serverseitigen Preisberechnungs-Fallback (erstelleLieferungTransaktion() in
 * lib/lieferung.ts) genutzt, damit der dort vorausberechnete Preis garantiert dem entspricht,
 * der beim Speichern tatsächlich übernommen wird. Bei mehreren erreichten Schwellen gewinnt
 * die höchste (nicht der größte Rabatt — Staffeln sind absolute Preise, "größer" ist dabei
 * nicht gleich "besser"); bei gleicher Schwelle gewinnt ein kundenspezifischer Eintrag vor
 * einem allgemeingültigen.
 */
export function bestMengenstaffel(
  artikelId: number,
  artikelKategorie: string,
  menge: number,
  kundeId: number | null,
  rabatte: MengenrabattEintrag[]
): MengenrabattEintrag | null {
  if (menge <= 0) return null;
  let best: MengenrabattEintrag | null = null;
  for (const r of rabatte) {
    if (!r.aktiv) continue;
    if (r.vonMenge > menge) continue;
    if (r.kundeId !== null && r.kundeId !== kundeId) continue;
    if (r.artikelId !== null) {
      if (r.artikelId !== artikelId) continue;
    } else if (r.kategorie !== null) {
      if (r.kategorie !== artikelKategorie) continue;
    } else {
      continue;
    }
    if (
      !best ||
      r.vonMenge > best.vonMenge ||
      (r.vonMenge === best.vonMenge && r.kundeId !== null && best.kundeId === null)
    ) {
      best = r;
    }
  }
  return best;
}

/** Wendet eine per bestMengenstaffel() ermittelte Staffel auf einen Basispreis an — absoluter
 *  Staffelpreis, falls gesetzt, sonst der Legacy-Rabattprozentsatz, sonst unverändert. */
export function wendeMengenstaffelAn(basisPreis: number, staffel: MengenrabattEintrag | null): number {
  if (!staffel) return basisPreis;
  if (staffel.preis !== null) return Math.round(staffel.preis * 100) / 100;
  return staffel.rabattProzent > 0
    ? Math.round(basisPreis * (1 - staffel.rabattProzent / 100) * 100) / 100
    : basisPreis;
}

/** Effektiver Rabatt-Prozentsatz einer Mengenstaffel gegenüber einem Basispreis — für die
 *  "Rabatt %"-Spalte auf Lieferschein/Rechnung, unabhängig davon ob die Staffel über einen
 *  absoluten Preis oder (Legacy) direkt über einen Prozentsatz definiert ist. Negative Werte
 *  (Staffelpreis liegt über dem Basispreis) werden auf 0 gekappt — die Spalte zeigt nur echte
 *  Rabatte, keine Aufschläge. */
export function effektiverMengenstaffelRabatt(basisPreis: number, staffel: MengenrabattEintrag | null): number {
  if (!staffel) return 0;
  if (staffel.preis === null) return staffel.rabattProzent;
  if (basisPreis <= 0) return 0;
  const pct = ((basisPreis - staffel.preis) / basisPreis) * 100;
  return pct > 0 ? Math.round(pct * 10) / 10 : 0;
}

export function berechneMarge(verkaufspreis: number, einkaufspreis: number) {
  const margeEuro = verkaufspreis - einkaufspreis;
  const margeProzent =
    verkaufspreis > 0 ? (margeEuro / verkaufspreis) * 100 : 0;
  return {
    margeEuro: Math.round(margeEuro * 100) / 100,
    margeProzent: Math.round(margeProzent * 10) / 10,
  };
}

export function lagerStatus(
  bestand: number,
  mindestbestand: number
): "rot" | "gelb" | "gruen" {
  if (bestand <= 0) return "rot";
  if (bestand <= mindestbestand) return "gelb";
  return "gruen";
}

// Kategorien, für die kein Lagerbestand geführt wird (Dienstleistungen)
// Wird durch Einstellung "system.lager_no_tracking_kategorien" ergänzt.
// "Sonstiges" u.a. für die synthetische "Alte Forderung"-Position (lib/lieferung.ts).
export const NICHT_LAGER_KATEGORIEN = ["Beratung", "Analysen", "Sonstiges"];

/**
 * Prüft ob ein Artikel lagerrelevant ist.
 * @param kategorie  Artikel-Kategorie
 * @param lagerTracking  Artikel-spezifisches Flag; false = immer deaktiviert
 * @param extraKategorien  Zusätzliche Kategorien aus Einstellungen
 */
export function istLagerrelevant(
  kategorie: string,
  lagerTracking?: boolean,
  extraKategorien?: string[]
): boolean {
  if (lagerTracking === false) return false;
  const alle = extraKategorien
    ? [...NICHT_LAGER_KATEGORIEN, ...extraKategorien]
    : NICHT_LAGER_KATEGORIEN;
  return !alle.includes(kategorie);
}

function naechsteNummer(prefix: string, letzte: string | null): string {
  const jahr = new Date().getFullYear();
  if (!letzte) return `${prefix}-${jahr}-0001`;

  const parts = letzte.split("-");
  // Erkennt das gültige Format "PRÄFIX-JJJJ-NNNN" (Teil[1] = 4-stellige Jahreszahl). Alles andere
  // ist ein Legacy-Zählerstand (nackter Integer wie "452", wie er z.B. vor Einführung dieses
  // Helpers für "letzte_bestellungsnummer" gespeichert wurde) — den fälschlich als "Jahr 0"
  // zu behandeln würde ihn sofort auf 0001 zurücksetzen und mit bereits vergebenen Nummern
  // desselben Jahres kollidieren.
  const istFormatiert = parts.length >= 3 && /^\d{4}$/.test(parts[1]);
  if (istFormatiert) {
    const letzteJahr = parseInt(parts[1], 10);
    if (letzteJahr !== jahr) return `${prefix}-${jahr}-0001`;
    const num = parseInt(parts[parts.length - 1] || "0", 10) + 1;
    return `${prefix}-${jahr}-${String(num).padStart(4, "0")}`;
  }

  // Legacy-Kompatibilität: die alte, jahrlose Zählung EINMALIG fortsetzen statt auf 0001
  // zurückzuspringen. Ab dem nächsten Aufruf liegt der Zähler bereits im neuen Format vor
  // und der reguläre Jahreswechsel-Reset oben greift wieder normal.
  const legacyNum = parseInt(letzte, 10);
  const next = Number.isFinite(legacyNum) && legacyNum > 0 ? legacyNum + 1 : 1;
  return `${prefix}-${jahr}-${String(next).padStart(4, "0")}`;
}

export const naechsteRechnungsnummer = (letzte: string | null, prefix = "RE") => naechsteNummer(prefix.trim() || "RE", letzte);
export const naechsteGutschriftsnummer = (letzte: string | null) => naechsteNummer("GS", letzte);
export const naechsteRetourennummer = (letzte: string | null) => naechsteNummer("RET", letzte);
export const naechsteBestellungsnummer = (letzte: string | null) => naechsteNummer("BES", letzte);
export const naechsteAngebotsnummer = (letzte: string | null, prefix = "AN") => naechsteNummer(prefix.trim() || "AN", letzte);

export function addTage(datum: Date, tage: number): Date {
  const d = new Date(datum);
  d.setDate(d.getDate() + tage);
  return d;
}

export function formatDatum(d: Date | string): string {
  return new Date(d).toLocaleDateString("de-DE");
}

/**
 * Kaufmännische Rundung (round half away from zero) auf die angegebene Stellenzahl.
 * Nutzt den Exponential-String-Umweg statt `Math.round(n * 100) / 100`, da Beträge wie
 * 1.005 als Double intern leicht unter dem exakten Wert liegen (1.00499999999999989…) und
 * eine direkte Multiplikation fälschlich abrunden würde. Rundet negative Beträge
 * (Gutschriften, Storno) symmetrisch weg von Null.
 */
export function rundeKaufmaennisch(n: number, stellen = 2): number {
  if (!Number.isFinite(n)) return n;
  const vorzeichen = n < 0 ? -1 : 1;
  const verschoben = Number(`${Math.abs(n)}e${stellen}`);
  const gerundet = Math.round(verschoben);
  return vorzeichen * Number(`${gerundet}e-${stellen}`);
}

/** Euro-Betrag, kaufmännisch auf `decimals` Nachkommastellen gerundet (Standard: 2 — für Endbeträge/Rechnungssummen). */
export function formatEuro(n: number, decimals = 2): string {
  return rundeKaufmaennisch(n, decimals).toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Einzel-/Bezugspreis mit 3 Nachkommastellen (z.B. 0,215 €/kg) — vermeidet Rundungsfehler bei Menge × Preis. */
export function formatPreis(n: number): string {
  return formatEuro(n, 3);
}

/**
 * Extrahiert das kg-Gewicht aus einer freitextigen Liefergröße (z.B. "25 kg Sack",
 * "Big Bag 600 kg" → 25 bzw. 600). Liefert null, wenn kein "<Zahl> kg"-Muster
 * gefunden wird — die Liefergröße ist ein Freitextfeld ohne festes Format.
 */
export function parseGebindegroesseKg(liefergroesse: string | null | undefined): number | null {
  if (!liefergroesse) return null;
  const match = liefergroesse.match(/(\d+(?:[.,]\d+)?)\s*kg/i);
  if (!match) return null;
  const n = parseFloat(match[1].replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Parst eine Dezimaleingabe tolerant für deutsche Eingaben.
 * Akzeptiert Komma als Dezimaltrennzeichen ("0,63" → 0.63) sowie Tausenderpunkte
 * bei gemischter Schreibweise. Leere/ungültige Eingaben → fallback (Standard 0).
 * Behebt das "springt auf 0 zurück"-Problem bei Komma-Eingabe auf mobilen Tastaturen.
 */
export function parseDezimal(v: string | number | null | undefined, fallback = 0): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : fallback;
  if (v == null) return fallback;
  let s = String(v).trim().replace(/\s/g, "");
  if (!s) return fallback;
  // Beide Trennzeichen vorhanden → Punkt ist Tausender, Komma Dezimal
  if (s.includes(",") && s.includes(".")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    s = s.replace(",", ".");
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : fallback;
}

export function formatPercent(n: number): string {
  return n.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "\u00a0%";
}

/** Mengenangabe mit bis zu 3 Nachkommastellen (z.B. 0,120 t). */
export function formatMenge(n: number): string {
  return n.toLocaleString("de-DE", { maximumFractionDigits: 3 });
}

/** Zahl mit fester Nachkommastellenzahl (de-DE), z.B. für Rechner-Ergebnistabellen. */
export function formatZahl(n: number, nachkommastellen = 1): string {
  if (!Number.isFinite(n)) return "–";
  return n.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: nachkommastellen });
}

/** Wiederverwendbare Farbfolge für Komponenten-Vergleichsbalken/-legenden (Tailwind bg-*-Klassen). */
export const KOMPONENTEN_FARBEN = [
  "bg-green-600",
  "bg-amber-500",
  "bg-blue-500",
  "bg-purple-500",
  "bg-rose-500",
  "bg-teal-500",
  "bg-indigo-500",
  "bg-orange-500",
  "bg-cyan-600",
  "bg-lime-600",
];

/** Stabile Farbzuordnung nach Name statt nach Array-Index – bleibt konsistent, auch wenn Zeilen
 * zwischenzeitlich (z.B. während der Eingabe) aus einer gefilterten Ergebnisliste herausfallen. */
export function farbeFuerName(name: string, palette: string[] = KOMPONENTEN_FARBEN): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return palette[hash % palette.length];
}

// \u2500\u2500\u2500 Datum / Zeitraum \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

/** Fr\u00fchestes Jahr, das in Auswertungs-Filtern angeboten wird. */
const BASE_YEAR = 2024;

/**
 * Dynamische Jahresliste von BASE_YEAR bis einschlie\u00dflich (aktuelles Jahr + 1)
 * als Strings \u2014 direkt f\u00fcr <option>-Elemente nutzbar.
 */
export function getJahreListe(): string[] {
  const current = new Date().getFullYear();
  const jahre: string[] = [];
  for (let y = BASE_YEAR; y <= current + 1; y++) jahre.push(String(y));
  return jahre;
}

/** Dieselbe Jahresliste als Zahlen (Saisonal-Vergleich, Budget). */
export function getJahreListeNum(): number[] {
  return getJahreListe().map(Number);
}

/** Jahresliste f\u00fcr die Budgetplanung \u2014 zus\u00e4tzliches Planjahr in der Zukunft. */
export function getBudgetJahre(): number[] {
  const liste = getJahreListeNum();
  return [...liste, liste[liste.length - 1] + 1];
}

/** Monate mit Wert ("01"\u2013"12") und langem Label \u2014 einzige Quelle f\u00fcr Monats-Selects. */
export const MONATE_LANG = [
  { value: "01", label: "Januar" },
  { value: "02", label: "Februar" },
  { value: "03", label: "M\u00e4rz" },
  { value: "04", label: "April" },
  { value: "05", label: "Mai" },
  { value: "06", label: "Juni" },
  { value: "07", label: "Juli" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "Oktober" },
  { value: "11", label: "November" },
  { value: "12", label: "Dezember" },
] as const;

/** Kurz-Labels der Monate (Index 0 = Jan) \u2014 f\u00fcr Diagramme. */
export const MONATE_KURZ = [
  "Jan", "Feb", "M\u00e4r", "Apr", "Mai", "Jun",
  "Jul", "Aug", "Sep", "Okt", "Nov", "Dez",
] as const;

/**
 * Parst "YYYY-MM" zum UTC-Monatsanfang. Ung\u00fcltige/leere Eingabe \u2192 fallback
 * (Standard: 2024-01-01T00:00:00Z).
 */
export function parseYearMonth(ym: string | null | undefined, fallback?: Date): Date {
  if (ym) {
    const d = new Date(`${ym}-01T00:00:00.000Z`);
    if (!isNaN(d.getTime())) return d;
  }
  return fallback ?? new Date("2024-01-01T00:00:00.000Z");
}

/**
 * Exklusive Obergrenze f\u00fcr einen "bis=YYYY-MM"-Parameter:
 * "2025-03" \u2192 2025-04-01 (Monatsanfang des Folgemonats).
 * Ung\u00fcltige/leere Eingabe \u2192 fallback (Standard: jetzt).
 */
export function parseBisYearMonth(ym: string | null | undefined, fallback?: Date): Date {
  if (ym) {
    const parts = ym.split("-").map(Number);
    if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return new Date(parts[0], parts[1], 1);
    }
  }
  return fallback ?? new Date();
}

const UMLAUT_PAARE: [string, string][] = [
  ["ä", "Ä"],
  ["ö", "Ö"],
  ["ü", "Ü"],
];

/**
 * SQLites LIKE-Operator (Basis von Prisma `contains` auf SQLite) faltet Groß-/Kleinschreibung
 * nur für ASCII-Buchstaben — deutsche Umlaute (ä/ö/ü) bleiben case-sensitiv. Eine Suche nach
 * "ölrettich" findet den gespeicherten Artikel "Ölrettich" dadurch NICHT, obwohl der Rest des
 * Wortes (ASCII) bereits case-insensitiv gefunden würde.
 *
 * Erzeugt alle Groß-/Klein-Kombinationen der im Suchbegriff enthaltenen Umlaute, damit sie als
 * `contains`-OR-Filter alle Schreibweisen abdecken (Aufrufer: `where.OR = umlautSchreibweisen(q)
 * .flatMap(v => [...])`). Ohne Umlaute im Suchbegriff liefert die Funktion einfach `[suchbegriff]`
 * zurück (kein zusätzlicher Overhead). Bei mehr als 6 Umlauten im Suchbegriff wird begrenzt, um
 * eine kombinatorische Explosion zu vermeiden — in der Praxis unrealistisch lang.
 */
export function umlautSchreibweisen(suchbegriff: string): string[] {
  const positionen: number[] = [];
  for (let i = 0; i < suchbegriff.length; i++) {
    if (UMLAUT_PAARE.some(([klein, gross]) => suchbegriff[i] === klein || suchbegriff[i] === gross)) {
      positionen.push(i);
    }
  }
  if (positionen.length === 0) return [suchbegriff];

  const begrenzt = positionen.slice(0, 6);
  const chars = suchbegriff.split("");
  const varianten = new Set<string>();
  for (let mask = 0; mask < 1 << begrenzt.length; mask++) {
    const kopie = [...chars];
    begrenzt.forEach((pos, idx) => {
      const paar = UMLAUT_PAARE.find(([klein, gross]) => kopie[pos] === klein || kopie[pos] === gross);
      if (!paar) return;
      kopie[pos] = mask & (1 << idx) ? paar[1] : paar[0];
    });
    varianten.add(kopie.join(""));
  }
  return [...varianten];
}
