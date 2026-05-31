import { NextResponse } from "next/server";
import type { CurrentUser } from "@/lib/auth";

// ─── PERMISSION-IDs ───────────────────────────────────────────────────────────
// Präfix-Konventionen:
//   s.*  = Seiten-Zugriff (Seitenaufruf erlaubt)
//   a.*  = Aktion (Schreiben, Löschen, Export)
//   f.*  = Feld-Sichtbarkeit (sensible Daten)

export const P = {
  // ── Seiten ──────────────────────────────────────────────────────────────────
  DASHBOARD:            "s.dashboard",
  KUNDEN:               "s.kunden",
  KUNDEN_BEWERTUNG:     "s.kunden.bewertung",
  KUNDEN_KARTE:         "s.kunden.karte",
  KUNDEN_IMPORT:        "s.kunden.import",
  MAILVERTEILER:        "s.mailverteiler",
  ARTIKEL:              "s.artikel",
  LIEFERANTEN:          "s.lieferanten",
  LAGER:                "s.lager",
  INVENTUR:             "s.inventur",
  LIEFERUNGEN:          "s.lieferungen",
  ANGEBOTE:             "s.angebote",
  AUFGABEN:             "s.aufgaben",
  BESUCHSTERMINE:       "s.besuchstermine",
  RECHNUNGEN:           "s.rechnungen",
  SAMMELRECHNUNGEN:     "s.sammelrechnungen",
  GUTSCHRIFTEN:         "s.gutschriften",
  AUSGABEN:             "s.ausgaben",
  BANKABGLEICH:         "s.bankabgleich",
  MAHNWESEN:            "s.mahnwesen",
  STATISTIK:            "s.statistik",
  MARKTPREISE:          "s.marktpreise",
  AGRARANTRAEGE:        "s.agrarantraege",
  BODENPROBEN:          "s.bodenproben",
  DUENGEBEDARF:         "s.duengebedarf",
  VORBESTELLUNGEN:      "s.vorbestellungen",
  BESTELLUNGEN:         "s.bestellungen",
  EINGANGSRECHNUNGEN:   "s.eingangsrechnungen",
  KONTRAKTE:            "s.kontrakte",
  REKLAMATIONEN:        "s.reklamationen",
  KAMPAGNEN:            "s.kampagnen",
  PSM:                  "s.psm",
  SORTENVERSUCHE:       "s.sortenversuche",
  RATIONSBERECHNUNG:    "s.rationsberechnung",
  FAHRER:               "s.fahrer",
  TOURENPLANUNG:        "s.tourenplanung",
  KI:                   "s.ki",
  EINSTELLUNGEN:        "s.einstellungen",
  AUDIT:                "s.audit",

  // ── Aktionen ────────────────────────────────────────────────────────────────
  KUNDEN_ERSTELLEN:         "a.kunden.erstellen",
  KUNDEN_BEARBEITEN:        "a.kunden.bearbeiten",
  KUNDEN_LOESCHEN:          "a.kunden.loeschen",
  ARTIKEL_ERSTELLEN:        "a.artikel.erstellen",
  ARTIKEL_BEARBEITEN:       "a.artikel.bearbeiten",
  ARTIKEL_LOESCHEN:         "a.artikel.loeschen",
  LIEFERUNGEN_ERSTELLEN:    "a.lieferungen.erstellen",
  LIEFERUNGEN_STORNIEREN:   "a.lieferungen.stornieren",
  ANGEBOTE_ERSTELLEN:       "a.angebote.erstellen",
  ANGEBOTE_BEARBEITEN:      "a.angebote.bearbeiten",
  LAGER_WARENEINGANG:       "a.lager.wareneingang",
  LAGER_KORREKTUR:          "a.lager.korrektur",
  EXPORT_LIEFERSCHEIN:      "a.export.lieferschein",
  EXPORT_RECHNUNG:          "a.export.rechnung",
  EXPORT_RECHNUNG_MAIL:     "a.export.rechnung_mail",
  EXPORT_DATEV:             "a.export.datev",
  EXPORT_BULK:              "a.export.bulk",
  EINSTELLUNGEN_BEARBEITEN: "a.einstellungen.bearbeiten",
  KI_NUTZEN:                "a.ki.nutzen",

  // ── Felder (sensible Daten) ──────────────────────────────────────────────
  FELD_ARTIKEL_EINKAUFSPREIS:     "f.artikel.einkaufspreis",
  FELD_ARTIKEL_MARGE:             "f.artikel.marge",
  FELD_LIEFERUNG_EINKAUFSWERT:    "f.lieferung.einkaufswert",
  FELD_KUNDE_UMSATZ:              "f.kunde.umsatz",
  FELD_KUNDE_OFFENER_BETRAG:      "f.kunde.offenerBetrag",
  FELD_STATISTIK_DECKUNGSBEITRAG: "f.statistik.deckungsbeitrag",
  FELD_STATISTIK_UMSATZ:          "f.statistik.umsatz",
  FELD_KALKULATION:               "f.kalkulation",
} as const;

export type PermissionKey = (typeof P)[keyof typeof P];

// ─── METADATEN FÜR DIE MATRIX-UI ──────────────────────────────────────────────

export type PermissionMeta = {
  label: string;
  gruppe: string;
  typ: "seite" | "aktion" | "feld";
};

export const PERMISSION_META: Record<string, PermissionMeta> = {
  // Seiten
  "s.dashboard":           { label: "Dashboard",              gruppe: "Übersicht",     typ: "seite" },
  "s.kunden":              { label: "Kunden",                 gruppe: "Kunden",        typ: "seite" },
  "s.kunden.bewertung":    { label: "Kundenbewertung",        gruppe: "Kunden",        typ: "seite" },
  "s.kunden.karte":        { label: "Kundenkarte",            gruppe: "Kunden",        typ: "seite" },
  "s.kunden.import":       { label: "Kunden-Import",          gruppe: "Kunden",        typ: "seite" },
  "s.mailverteiler":       { label: "Mailverteiler",          gruppe: "Kunden",        typ: "seite" },
  "s.artikel":             { label: "Artikel",                gruppe: "Artikel",       typ: "seite" },
  "s.lieferanten":         { label: "Lieferanten",            gruppe: "Artikel",       typ: "seite" },
  "s.lager":               { label: "Lager",                  gruppe: "Lager",         typ: "seite" },
  "s.inventur":            { label: "Inventur",               gruppe: "Lager",         typ: "seite" },
  "s.lieferungen":         { label: "Lieferungen",            gruppe: "Lieferung",     typ: "seite" },
  "s.angebote":            { label: "Angebote",               gruppe: "Lieferung",     typ: "seite" },
  "s.aufgaben":            { label: "Aufgaben / TODO",        gruppe: "Lieferung",     typ: "seite" },
  "s.besuchstermine":      { label: "Besuchstermine",         gruppe: "Lieferung",     typ: "seite" },
  "s.rechnungen":          { label: "Rechnungen",             gruppe: "Finanzen",      typ: "seite" },
  "s.sammelrechnungen":    { label: "Sammelrechnungen",       gruppe: "Finanzen",      typ: "seite" },
  "s.gutschriften":        { label: "Gutschriften",           gruppe: "Finanzen",      typ: "seite" },
  "s.ausgaben":            { label: "Ausgabenbuch",           gruppe: "Finanzen",      typ: "seite" },
  "s.bankabgleich":        { label: "Bankabgleich",           gruppe: "Finanzen",      typ: "seite" },
  "s.mahnwesen":           { label: "Mahnwesen",              gruppe: "Finanzen",      typ: "seite" },
  "s.statistik":           { label: "Statistik / Analyse",   gruppe: "Analyse",       typ: "seite" },
  "s.marktpreise":         { label: "Marktpreise",            gruppe: "Analyse",       typ: "seite" },
  "s.agrarantraege":       { label: "Agraranträge (AFIG)",   gruppe: "Agrar",         typ: "seite" },
  "s.bodenproben":         { label: "Bodenproben",            gruppe: "Agrar",         typ: "seite" },
  "s.duengebedarf":        { label: "Düngebedarf",            gruppe: "Agrar",         typ: "seite" },
  "s.vorbestellungen":     { label: "Vorbestellungen",        gruppe: "Einkauf",       typ: "seite" },
  "s.bestellungen":        { label: "Lieferantenbestellungen",gruppe: "Einkauf",       typ: "seite" },
  "s.eingangsrechnungen":  { label: "Eingangsrechnungen",     gruppe: "Einkauf",       typ: "seite" },
  "s.kontrakte":           { label: "Kontrakte",              gruppe: "Vertrieb",      typ: "seite" },
  "s.reklamationen":       { label: "Reklamationen",          gruppe: "Vertrieb",      typ: "seite" },
  "s.kampagnen":           { label: "Kampagnen",              gruppe: "Vertrieb",      typ: "seite" },
  "s.psm":                 { label: "PSM-Ausbringung",        gruppe: "Agrar",         typ: "seite" },
  "s.sortenversuche":      { label: "Sortenversuche",         gruppe: "Agrar",         typ: "seite" },
  "s.rationsberechnung":   { label: "Rationsberechnung",      gruppe: "Agrar",         typ: "seite" },
  "s.fahrer":              { label: "Fahrer-Cockpit",         gruppe: "Lieferung",     typ: "seite" },
  "s.tourenplanung":       { label: "Tourenplanung",          gruppe: "Lieferung",     typ: "seite" },
  "s.ki":                  { label: "KI / AI",                gruppe: "System",        typ: "seite" },
  "s.einstellungen":       { label: "Einstellungen",          gruppe: "System",        typ: "seite" },
  "s.audit":               { label: "Änderungshistorie",      gruppe: "System",        typ: "seite" },

  // Aktionen
  "a.kunden.erstellen":         { label: "Kunden: Anlegen",               gruppe: "Kunden",    typ: "aktion" },
  "a.kunden.bearbeiten":        { label: "Kunden: Bearbeiten",            gruppe: "Kunden",    typ: "aktion" },
  "a.kunden.loeschen":          { label: "Kunden: Löschen",               gruppe: "Kunden",    typ: "aktion" },
  "a.artikel.erstellen":        { label: "Artikel: Anlegen",              gruppe: "Artikel",   typ: "aktion" },
  "a.artikel.bearbeiten":       { label: "Artikel: Bearbeiten",           gruppe: "Artikel",   typ: "aktion" },
  "a.artikel.loeschen":         { label: "Artikel: Löschen",              gruppe: "Artikel",   typ: "aktion" },
  "a.lieferungen.erstellen":    { label: "Lieferungen: Anlegen",          gruppe: "Lieferung", typ: "aktion" },
  "a.lieferungen.stornieren":   { label: "Lieferungen: Stornieren",       gruppe: "Lieferung", typ: "aktion" },
  "a.angebote.erstellen":       { label: "Angebote: Anlegen",             gruppe: "Lieferung", typ: "aktion" },
  "a.angebote.bearbeiten":      { label: "Angebote: Bearbeiten",          gruppe: "Lieferung", typ: "aktion" },
  "a.lager.wareneingang":       { label: "Lager: Wareneingang buchen",    gruppe: "Lager",     typ: "aktion" },
  "a.lager.korrektur":          { label: "Lager: Korrekturbuchung",       gruppe: "Lager",     typ: "aktion" },
  "a.export.lieferschein":      { label: "Export: Lieferschein drucken",  gruppe: "Export",    typ: "aktion" },
  "a.export.rechnung":          { label: "Export: Rechnung drucken",      gruppe: "Export",    typ: "aktion" },
  "a.export.rechnung_mail":     { label: "Export: Rechnung per Mail",     gruppe: "Export",    typ: "aktion" },
  "a.export.datev":             { label: "Export: DATEV CSV",             gruppe: "Export",    typ: "aktion" },
  "a.export.bulk":              { label: "Export: Massen-Export",         gruppe: "Export",    typ: "aktion" },
  "a.einstellungen.bearbeiten": { label: "Einstellungen: Bearbeiten",     gruppe: "System",    typ: "aktion" },
  "a.ki.nutzen":                { label: "KI: Analysefunktionen nutzen",  gruppe: "System",    typ: "aktion" },

  // Felder (sensible Daten)
  "f.artikel.einkaufspreis":     { label: "Feld: Artikel Einkaufspreis",          gruppe: "Felder", typ: "feld" },
  "f.artikel.marge":             { label: "Feld: Artikel Marge / Aufschlag",      gruppe: "Felder", typ: "feld" },
  "f.lieferung.einkaufswert":    { label: "Feld: Lieferung EK-Wert",              gruppe: "Felder", typ: "feld" },
  "f.kunde.umsatz":              { label: "Feld: Kunden-Umsatz",                  gruppe: "Felder", typ: "feld" },
  "f.kunde.offenerBetrag":       { label: "Feld: Offener Betrag am Kunden",       gruppe: "Felder", typ: "feld" },
  "f.statistik.deckungsbeitrag": { label: "Feld: Deckungsbeitrag in Statistik",   gruppe: "Felder", typ: "feld" },
  "f.statistik.umsatz":          { label: "Feld: Umsatzzahlen in Statistik",      gruppe: "Felder", typ: "feld" },
  "f.kalkulation":               { label: "Feld: Kalkulations-Seite + API",       gruppe: "Felder", typ: "feld" },
};

// Alle gültigen Permission-IDs (für Validierung)
export const ALL_PERMISSIONS = Object.keys(PERMISSION_META);

// ─── ROLLEN-PRESETS (für schnelles Anlegen) ───────────────────────────────────

export const ROLLE_PRESETS: Record<string, { bezeichnung: string; beschreibung: string; berechtigungen: string[] }> = {
  admin: {
    bezeichnung: "Administrator",
    beschreibung: "Vollzugriff auf alle Funktionen",
    berechtigungen: ["*"],
  },
  buero: {
    bezeichnung: "Büro / Innendienst",
    beschreibung: "Alle Funktionen außer Einstellungen und Benutzerverwaltung",
    berechtigungen: ALL_PERMISSIONS.filter(
      (p) => p !== P.EINSTELLUNGEN && p !== P.EINSTELLUNGEN_BEARBEITEN,
    ),
  },
  verkauf: {
    bezeichnung: "Außendienst / Verkauf",
    beschreibung: "CRM, Angebote, Lieferungen – ohne Einkaufspreise und Massen-Export",
    berechtigungen: [
      P.DASHBOARD, P.KUNDEN, P.KUNDEN_BEWERTUNG, P.KUNDEN_KARTE, P.ARTIKEL,
      P.LIEFERUNGEN, P.ANGEBOTE, P.AUFGABEN, P.BESUCHSTERMINE,
      P.BODENPROBEN, P.DUENGEBEDARF, P.VORBESTELLUNGEN, P.KONTRAKTE,
      P.REKLAMATIONEN, P.PSM, P.SORTENVERSUCHE, P.RATIONSBERECHNUNG,
      P.TOURENPLANUNG, P.MARKTPREISE,
      P.KUNDEN_ERSTELLEN, P.KUNDEN_BEARBEITEN,
      P.ANGEBOTE_ERSTELLEN, P.ANGEBOTE_BEARBEITEN,
      P.LIEFERUNGEN_ERSTELLEN,
      P.EXPORT_LIEFERSCHEIN, P.EXPORT_RECHNUNG, P.EXPORT_RECHNUNG_MAIL,
      P.FELD_KUNDE_UMSATZ, P.FELD_KUNDE_OFFENER_BETRAG,
    ],
  },
  lager: {
    bezeichnung: "Lagermitarbeiter",
    beschreibung: "Lager, Wareneingänge, Bestellliste – ohne Einkaufspreise",
    berechtigungen: [
      P.DASHBOARD, P.ARTIKEL, P.LAGER, P.INVENTUR, P.LIEFERUNGEN,
      P.BESTELLUNGEN,
      P.LAGER_WARENEINGANG, P.LAGER_KORREKTUR,
      P.EXPORT_LIEFERSCHEIN,
    ],
  },
  fahrer: {
    bezeichnung: "Fahrer",
    beschreibung: "Touren, Lieferscheine – nur Lese- und Druckzugriff",
    berechtigungen: [
      P.DASHBOARD, P.LIEFERUNGEN, P.FAHRER, P.TOURENPLANUNG,
      P.EXPORT_LIEFERSCHEIN,
    ],
  },
  buchhalter: {
    bezeichnung: "Buchhalter / Buchhaltung",
    beschreibung: "Finanzen, Rechnungen, DATEV-Export, Statistik",
    berechtigungen: [
      P.DASHBOARD, P.RECHNUNGEN, P.SAMMELRECHNUNGEN, P.GUTSCHRIFTEN,
      P.AUSGABEN, P.BANKABGLEICH, P.MAHNWESEN, P.STATISTIK,
      P.EINGANGSRECHNUNGEN,
      P.EXPORT_RECHNUNG, P.EXPORT_RECHNUNG_MAIL, P.EXPORT_DATEV, P.EXPORT_BULK,
      P.FELD_KUNDE_UMSATZ, P.FELD_KUNDE_OFFENER_BETRAG,
      P.FELD_STATISTIK_UMSATZ, P.FELD_STATISTIK_DECKUNGSBEITRAG, P.FELD_KALKULATION,
    ],
  },
  readonly: {
    bezeichnung: "Nur Lesen",
    beschreibung: "Lesezugriff auf alle Bereiche, keine Änderungen und keine Exporte",
    berechtigungen: ALL_PERMISSIONS.filter((p) => p.startsWith("s.")),
  },
};

// ─── HELPER-FUNKTIONEN ────────────────────────────────────────────────────────

/**
 * Prüft ob ein User eine bestimmte Permission hat.
 * - "*" in Rollen- oder Benutzer-Berechtigungen = Vollzugriff
 * - Berechtigungen der Rolle + individuelle Overrides des Benutzers werden vereinigt
 */
export function hasPermission(user: CurrentUser, key: string): boolean {
  // Legacy: alter admin hat immer alles
  if (user.rolle === "admin" && !user.rolleId) return true;

  const perms = [...(user.rolleBerechtigungen ?? []), ...(user.berechtigungen ?? [])];
  return perms.includes("*") || perms.includes(key);
}

/**
 * API-Helper: gibt einen 403-NextResponse zurück wenn der User die Permission nicht hat,
 * sonst null. Verwendung:
 *   const deny = requirePermission(me, P.EXPORT_DATEV);
 *   if (deny) return deny;
 */
export function requirePermission(user: CurrentUser | null, key: string): NextResponse | null {
  if (!user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  if (!hasPermission(user, key)) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }
  return null;
}

/**
 * Entfernt sensible EK-Preis-Felder aus einem Artikel-Objekt wenn die Permission fehlt.
 */
export function filterArtikelFelder(
  obj: Record<string, unknown>,
  user: CurrentUser,
): Record<string, unknown> {
  if (hasPermission(user, P.FELD_ARTIKEL_EINKAUFSPREIS)) return obj;
  const result: Record<string, unknown> = { ...obj };
  delete result.einkaufsPreis;
  delete result.einkaufsPreisNetto;
  if (Array.isArray(result.lieferanten)) {
    result.lieferanten = (result.lieferanten as Record<string, unknown>[]).map((l) => {
      const lCopy: Record<string, unknown> = { ...l };
      delete lCopy.einkaufsPreis;
      return lCopy;
    });
  }
  if (Array.isArray(result.preisHistorie)) {
    delete result.preisHistorie;
  }
  return result;
}
