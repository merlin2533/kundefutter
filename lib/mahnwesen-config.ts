// Client-safer Direkt-Import (kein next/server o.ä.) — diese Datei wird auch
// von "use client"-Seiten importiert (z.B. app/einstellungen/mahnwesen/page.tsx).
import * as Sentry from "@sentry/nextjs";

export interface MahnwesenConfig {
  /** Tage überfällig ab denen Mahnstufe 1 (Zahlungserinnerung) gilt */
  stufe1Tage: number;
  /** Tage überfällig ab denen Mahnstufe 2 (1. Mahnung) gilt */
  stufe2Tage: number;
  /** Tage überfällig ab denen Mahnstufe 3 (letzte Mahnung) gilt */
  stufe3Tage: number;
  /** Verzugszinssatz in % p.a. */
  verzugszinssatz: number;
  /** Mahngebühr (€) je Stufe */
  mahngebuehr1: number;
  mahngebuehr2: number;
  mahngebuehr3: number;
}

/**
 * Neutrale Standardwerte. Fristen entsprechen der bisherigen Logik (14/28/42),
 * Verzugszins 12,37 % = Basiszins 3,37 % + 9 Prozentpunkte (§ 288 Abs. 2 BGB).
 * Mahngebühren standardmäßig 0 € – jeder Betrieb legt eigene Werte fest.
 */
export const DEFAULT_MAHNWESEN_CONFIG: MahnwesenConfig = {
  stufe1Tage: 14,
  stufe2Tage: 28,
  stufe3Tage: 42,
  verzugszinssatz: 12.37,
  mahngebuehr1: 0,
  mahngebuehr2: 0,
  mahngebuehr3: 0,
};

function num(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Liest und validiert die Mahnwesen-Konfiguration aus dem rohen Einstellungswert. */
export function parseMahnwesenConfig(raw: string | null | undefined): MahnwesenConfig {
  if (!raw) return { ...DEFAULT_MAHNWESEN_CONFIG };
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    Sentry.captureException(e);
    return { ...DEFAULT_MAHNWESEN_CONFIG };
  }
  const d = DEFAULT_MAHNWESEN_CONFIG;
  return {
    stufe1Tage: num(parsed.stufe1Tage, d.stufe1Tage),
    stufe2Tage: num(parsed.stufe2Tage, d.stufe2Tage),
    stufe3Tage: num(parsed.stufe3Tage, d.stufe3Tage),
    verzugszinssatz: num(parsed.verzugszinssatz, d.verzugszinssatz),
    mahngebuehr1: num(parsed.mahngebuehr1, d.mahngebuehr1),
    mahngebuehr2: num(parsed.mahngebuehr2, d.mahngebuehr2),
    mahngebuehr3: num(parsed.mahngebuehr3, d.mahngebuehr3),
  };
}

/** Mahngebühr (€) für die angegebene Mahnstufe aus der Konfiguration. */
export function mahngebuehr(cfg: MahnwesenConfig, stufe: number): number {
  return stufe === 3 ? cfg.mahngebuehr3 : stufe === 2 ? cfg.mahngebuehr2 : cfg.mahngebuehr1;
}

/** Verzugszinsen (§ 288 BGB) für den überfälligen Betrag, taggenau. Auf Mahnstufe 1
 * (freundliche Zahlungserinnerung) werden bewusst keine Verzugszinsen berechnet/ausgewiesen —
 * der Kunde befindet sich erst ab Stufe 2 nachweislich in Verzug. */
export function berechneVerzugszinsen(betrag: number, tageUeberfaellig: number, satz: number, mahnstufe: number): number {
  if (mahnstufe <= 1 || tageUeberfaellig <= 0) return 0;
  return (betrag * (satz / 100) / 365) * tageUeberfaellig;
}

/** Betreffzeile je Mahnstufe — einzige Quelle der Wahrheit für PDF (generiereMahnungPdf) UND
 * E-Mail (mahnungEmail), damit beide Kanäle denselben Betreff zeigen. */
export const MAHNUNG_BETREFF: Record<1 | 2 | 3, string> = {
  1: "Freundliche Zahlungserinnerung",
  2: "1. Mahnung",
  3: "2. Mahnung / Letzte Mahnung",
};

export interface MahnungTextBausteine {
  anrede: string;
  absaetze: string[];
}

/** Einstellung-Keys für den je Mahnstufe überschreibbaren Brieftext (leer/nicht gesetzt →
 * DEFAULT_MAHNUNG_TEXTE), nach demselben Muster wie `ki.prompt.<feature>`. */
export const MAHNUNG_TEXT_EINSTELLUNG_KEY: Record<1 | 2 | 3, string> = {
  1: "system.mahnwesen.text.stufe1",
  2: "system.mahnwesen.text.stufe2",
  3: "system.mahnwesen.text.stufe3",
};

/**
 * Standard-Brieftext je Mahnstufe — Absätze getrennt durch eine Leerzeile, Platzhalter
 * `{rechnungNr}` `{rechnungDatum}` `{fristTage}`. Dies ist bewusst nur der DEFAULT: jeder Betrieb
 * kann den Text unter /einstellungen/mahnwesen auf die eigene Tonalität anpassen (siehe
 * MAHNUNG_TEXT_EINSTELLUNG_KEY) statt an einen einzelnen, hier hartcodierten Wortlaut gebunden
 * zu sein.
 */
export const DEFAULT_MAHNUNG_TEXTE: Record<1 | 2 | 3, string> = {
  1: [
    "Bei der Durchsicht unserer offenen Posten ist uns aufgefallen, dass die Rechnung {rechnungNr} vom {rechnungDatum} noch nicht bei uns eingegangen ist. Vermutlich ist dies nur ein kleines Versehen – daher möchten wir Sie freundlich daran erinnern.",
    "Wir wären Ihnen dankbar, wenn Sie den offenen Betrag in den nächsten Tagen ausgleichen könnten. Sollten Sie die Zahlung bereits veranlasst haben, betrachten Sie diese Erinnerung bitte als gegenstandslos.",
    "Bei Fragen zur Rechnung oder falls es Unstimmigkeiten gibt, melden Sie sich jederzeit bei uns – wir klären das unkompliziert mit Ihnen.",
    "Vielen Dank und weiterhin viel Erfolg auf dem Hof!",
  ].join("\n\n"),
  2: [
    "Trotz unserer freundlichen Erinnerung haben wir für die Rechnung {rechnungNr} vom {rechnungDatum} bislang keinen Zahlungseingang feststellen können.",
    "Wir bitten Sie dringend, den offenen Betrag innerhalb von {fristTage} Tagen zu begleichen. Sollten Sie bereits gezahlt haben, betrachten Sie dieses Schreiben bitte als gegenstandslos.",
  ].join("\n\n"),
  3: [
    "Leider haben wir auch nach unserer 1. Mahnung für die Rechnung {rechnungNr} vom {rechnungDatum} keinen Zahlungseingang feststellen können.",
    "Wir bitten Sie letztmalig, den Betrag innerhalb von {fristTage} Tagen zu überweisen. Sollte die Zahlung weiterhin ausbleiben, müssen wir uns weitere Schritte vorbehalten.",
  ].join("\n\n"),
};

function renderMahnungPlatzhalter(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? vars[key] : match));
}

/**
 * Zentrale Quelle für den Brieftext einer Mahnung/Zahlungserinnerung — von PDF
 * (generiereMahnungPdf in lib/pdfGenerator.ts) UND E-Mail (mahnungEmail in
 * lib/email-templates.ts) genutzt, damit beide Kanäle exakt denselben Text zeigen statt
 * unabhängig voneinander zu driften. `kundeFirma` steuert nur die Anrede auf Stufe 1
 * ("Sehr geehrtes Team von X!"), `rechnungDatumFormatiert` wird bereits fertig formatiert
 * übergeben (z.B. via formatDatum), damit dieses client-sichere Modul kein Datums-Format-Modul
 * importieren muss.
 *
 * `opts.textUeberschreibung` (aus MAHNUNG_TEXT_EINSTELLUNG_KEY) ersetzt bei nicht-leerem Wert den
 * Standardtext dieser Stufe; die Frist-Angabe ("innerhalb von X Tagen") wird aus der tatsächlich
 * konfigurierten Mahnwesen-Konfiguration (`opts.cfg`) abgeleitet, statt eine fixe Zahl zu zeigen,
 * die sich unabhängig von den unter /einstellungen/mahnwesen eingestellten Fristen nie ändert —
 * gedeckelt auf die bisherigen Standardwerte (7 Tage Stufe 2, 5 Tage Stufe 3 — die letzte Mahnung
 * bleibt dadurch immer die dringlichste), damit ein großzügig konfigurierter Abstand zwischen
 * Stufe 2 und 3 nicht versehentlich die Zahlungsfrist der LETZTEN Mahnung verlängert.
 */
export function mahnungTextBausteine(
  mahnstufe: 1 | 2 | 3,
  rechnungNr: string,
  rechnungDatumFormatiert: string,
  kundeFirma?: string | null,
  opts?: { cfg?: MahnwesenConfig; textUeberschreibung?: string | null },
): MahnungTextBausteine {
  const anrede = mahnstufe === 1
    ? (kundeFirma ? `Sehr geehrtes Team von ${kundeFirma}!` : "Sehr geehrte Damen und Herren,")
    : "Sehr geehrte Damen und Herren,";

  const cfg = opts?.cfg ?? DEFAULT_MAHNWESEN_CONFIG;
  const konfiguriertesFenster = Math.max(1, cfg.stufe3Tage - cfg.stufe2Tage);
  const fristTage = mahnstufe === 3 ? Math.min(5, konfiguriertesFenster) : Math.min(7, konfiguriertesFenster);
  const vars: Record<string, string> = { rechnungNr, rechnungDatum: rechnungDatumFormatiert, fristTage: String(fristTage) };

  const template = opts?.textUeberschreibung?.trim() || DEFAULT_MAHNUNG_TEXTE[mahnstufe];
  const absaetze = template
    .split(/\n{2,}/)
    .map((absatz) => renderMahnungPlatzhalter(absatz.trim(), vars))
    .filter(Boolean);

  return { anrede, absaetze };
}
