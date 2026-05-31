/**
 * lib/datev.ts
 * Zentrale Buchungskonto-Logik für den DATEV-Export (SKR03 / SKR04).
 * Sachkonten, Gegenkonten, Buchungstypen und Hilfsfunktionen.
 */

// ─── Whitelists ───────────────────────────────────────────────────────────────

export const BUCHUNGSTYPEN = [
  "Betriebsausgabe",
  "Privatentnahme",
  "Privateinlage",
  "Reisekosten",
  "Bewirtung",
] as const;
export type Buchungstyp = (typeof BUCHUNGSTYPEN)[number];

export const ZAHLUNGSWEGE = [
  "Bar",
  "Überweisung",
  "EC",
  "Kreditkarte",
  "Privat",
] as const;
export type Zahlungsweg = (typeof ZAHLUNGSWEGE)[number];

// ─── Kilometerpauschale / Bewirtung ───────────────────────────────────────────

/** § 9 Abs. 1 Nr. 4 EStG – 0,30 €/km */
export const KILOMETERPAUSCHALE_EUR = 0.3;

/** § 4 Abs. 5 Nr. 2 EStG – nur 70 % der Bewirtungskosten abzugsfähig */
export const BEWIRTUNG_ABZUGSFAEHIG = 0.7;

// ─── Sachkonten-Mapping ───────────────────────────────────────────────────────

/** Kategorie → SKR03 Aufwandskonto */
export const SACHKONTEN_SKR03: Record<string, string> = {
  Wareneinkauf: "3200",
  Betriebsbedarf: "4200",
  Fahrtkosten: "4530",
  Bürobedarf: "4930",
  "Telefon/Internet": "4920",
  Versicherung: "4360",
  Miete: "4210",
  Sonstige: "4900",
};

/** Kategorie → SKR04 Aufwandskonto */
export const SACHKONTEN_SKR04: Record<string, string> = {
  Wareneinkauf: "5200",
  Betriebsbedarf: "6300",
  Fahrtkosten: "6520",
  Bürobedarf: "6815",
  "Telefon/Internet": "6805",
  Versicherung: "6310",
  Miete: "6130",
  Sonstige: "6800",
};

/** Buchungstyp-Overrides – haben Vorrang vor der Kategorie */
export const BUCHUNGSTYP_KONTEN_SKR03: Partial<Record<Buchungstyp, string>> = {
  Privatentnahme: "1800",
  Privateinlage: "1890",
  Reisekosten: "4530",
  Bewirtung: "4654",
};

export const BUCHUNGSTYP_KONTEN_SKR04: Partial<Record<Buchungstyp, string>> = {
  Privatentnahme: "2100",
  Privateinlage: "2110",
  Reisekosten: "6520",
  Bewirtung: "6640",
};

// ─── Gegenkonten ──────────────────────────────────────────────────────────────

/** Zahlungsweg → SKR03 Gegenkonto */
export const GEGENKONTO_SKR03: Record<string, string> = {
  Bar: "1000",
  Überweisung: "1200",
  EC: "1200",
  Kreditkarte: "1200",
  Privat: "1890",
};

/** Zahlungsweg → SKR04 Gegenkonto */
export const GEGENKONTO_SKR04: Record<string, string> = {
  Bar: "1600",
  Überweisung: "1800",
  EC: "1800",
  Kreditkarte: "1800",
  Privat: "2110",
};

// ─── Erlöskonten (aus altem Route-Inline-Code extrahiert) ─────────────────────

/** Erlöskonto je MwSt-Satz */
export function erloeseKonto(
  mwstSatz: number,
  kontenrahmen: "SKR03" | "SKR04"
): string {
  if (kontenrahmen === "SKR04") {
    if (mwstSatz === 19) return "4400";
    if (mwstSatz === 7) return "4300";
    return "4200";
  }
  // SKR03
  if (mwstSatz === 19) return "8400";
  if (mwstSatz === 7) return "8300";
  return "8000";
}

/** Kreditorenkonto für Lieferanten (70000 + lieferantId) */
export function kreditorenKonto(lieferantId: number | null | undefined): string {
  return String(70000 + (lieferantId ?? 0));
}

// ─── Hauptfunktionen ──────────────────────────────────────────────────────────

/**
 * Bestimmt das DATEV-Sachkonto (Soll-Konto) für eine Ausgabe.
 * Priorität: explizit gesetztes Konto > Buchungstyp-Override > Kategorie-Mapping > Fallback
 */
export function getSachkonto(
  kategorie: string,
  buchungstyp: string,
  kontenrahmen: "SKR03" | "SKR04",
  explicitSachkonto?: string | null
): string {
  if (explicitSachkonto) return explicitSachkonto;

  const typeMap =
    kontenrahmen === "SKR04"
      ? BUCHUNGSTYP_KONTEN_SKR04
      : BUCHUNGSTYP_KONTEN_SKR03;
  if (buchungstyp in typeMap)
    return typeMap[buchungstyp as Buchungstyp]!;

  const katMap =
    kontenrahmen === "SKR04" ? SACHKONTEN_SKR04 : SACHKONTEN_SKR03;
  return katMap[kategorie] ?? (kontenrahmen === "SKR04" ? "6800" : "4900");
}

/**
 * Bestimmt das DATEV-Gegenkonto (Bank/Kasse/Kreditor) für eine Ausgabe.
 * Privatentnahmen/einlagen erhalten eigenständige Eigenkapital-Konten.
 */
export function getGegenkonto(
  zahlungsweg: string | null | undefined,
  lieferantId: number | null | undefined,
  kontenrahmen: "SKR03" | "SKR04",
  buchungstyp: string
): string {
  if (buchungstyp === "Privatentnahme")
    return kontenrahmen === "SKR04" ? "2100" : "1800";
  if (buchungstyp === "Privateinlage")
    return kontenrahmen === "SKR04" ? "2110" : "1890";

  if (zahlungsweg) {
    const map =
      kontenrahmen === "SKR04" ? GEGENKONTO_SKR04 : GEGENKONTO_SKR03;
    if (zahlungsweg in map) return map[zahlungsweg];
  }

  // Fallback: Kreditorenkonto
  return kreditorenKonto(lieferantId);
}

/**
 * Gibt den DATEV-BU-Schlüssel für eine Ausgabe zurück.
 * Bewirtungskosten → BU-Schlüssel 9 (nicht abzugsfähige Betriebsausgaben)
 */
export function getBuSchluessel(buchungstyp: string): string {
  return buchungstyp === "Bewirtung" ? "9" : "";
}

