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

/** Verzugszinsen (§ 288 BGB) für den überfälligen Betrag, taggenau. */
export function berechneVerzugszinsen(betrag: number, tageUeberfaellig: number, satz: number): number {
  if (tageUeberfaellig <= 0) return 0;
  return (betrag * (satz / 100) / 365) * tageUeberfaellig;
}
