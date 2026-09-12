/**
 * lib/modul-keys.ts
 * Reine Daten-/Parselogik des Modul-Systems — bewusst OHNE jeden Import.
 *
 * `lib/modul-config.ts` (der server-seitige Einstieg) importiert `prisma` und
 * `next/server`; sobald eine "use client"-Datei darauf zugreift, bricht der
 * Webpack-Build ("You're importing a module that depends on next/server…").
 * Typ, Defaults und die Auswertung einer rohen Einstellungs-Map leben deshalb
 * hier und werden von Server (getModulConfig) UND Client (ModulProvider)
 * gemeinsam genutzt, statt die `val !== "false" && val !== "0"`-Logik an jeder
 * Stelle erneut zu schreiben.
 */

export interface ModulConfig {
  sortenversuche: boolean;
  rationsberechnung: boolean;
  bodenproben: boolean;
  psm_ausbringung: boolean;
  erzeugerabrechnung: boolean;
  tourenplanung: boolean;
  kontrakte: boolean;
  kampagnen: boolean;
  fruehbezug: boolean;
  mqtt: boolean;
  nextcloud: boolean;
  marktpreise: boolean;
  reklamationen: boolean;
  personal: boolean;
  agrarantraege: boolean;
  eierhandel: boolean;
}

export type ModulKey = keyof ModulConfig;

export const DEFAULT_MODUL_CONFIG: ModulConfig = {
  sortenversuche: true,
  rationsberechnung: true,
  bodenproben: true,
  psm_ausbringung: true,
  erzeugerabrechnung: true,
  tourenplanung: true,
  kontrakte: true,
  kampagnen: true,
  fruehbezug: true,
  mqtt: false,
  nextcloud: false,
  marktpreise: true,
  reklamationen: true,
  personal: true,
  agrarantraege: true,
  eierhandel: false,
};

/** Alle Modul-Keys in stabiler Reihenfolge (aus den Defaults abgeleitet, damit ein
 *  neuer Key nur an genau einer Stelle ergänzt werden muss). */
export const MODUL_KEYS = Object.keys(DEFAULT_MODUL_CONFIG) as ModulKey[];

/** Einstellung-Key (`modul.<key>`) zu einem Modul. */
export function modulSettingKey(key: ModulKey): string {
  return `modul.${key}`;
}

/**
 * Wertet eine rohe Einstellungs-Map zu einer vollständigen ModulConfig aus.
 * Akzeptiert beide Schreibweisen der Keys — mit Präfix (`modul.eierhandel`, so
 * liefert es `GET /api/einstellungen?prefix=modul.`) und ohne (`eierhandel`).
 * Fehlt ein Key, gilt der Standardwert; `"false"`/`"0"` bedeuten aus.
 */
export function modulConfigAusMap(map: Record<string, string> | null | undefined): ModulConfig {
  const roh = map ?? {};
  const config = { ...DEFAULT_MODUL_CONFIG };
  for (const key of MODUL_KEYS) {
    const val = roh[modulSettingKey(key)] ?? roh[key];
    if (val === undefined) continue;
    config[key] = val !== "false" && val !== "0";
  }
  return config;
}
