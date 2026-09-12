"use client";

import { createContext, useContext } from "react";
import { DEFAULT_MODUL_CONFIG, type ModulConfig, type ModulKey } from "@/lib/modul-keys";
import type { BetriebsartKey } from "@/lib/betriebsart";

/**
 * Modul-/Betriebsart-Kontext für den Client.
 *
 * Vorher holte sich jede Stelle die Modulkonfiguration selbst per
 * `fetch("/api/einstellungen?prefix=modul.")` (Nav, /exporte, Kundendetail,
 * StammdatenTab) — mit Dashboard, Einstellungen und Hilfe wären daraus sieben
 * parallele Requests auf jeder Seite geworden, jeder mit einem kurzen Moment, in
 * dem die Oberfläche noch die falschen Einträge zeigt.
 *
 * Stattdessen lädt `app/layout.tsx` beides EINMAL server-seitig (dort liegen
 * ohnehin schon getAppName()/getCurrentUser()) und reicht es hier herein —
 * gleiches Muster wie UserProvider in lib/user-context.tsx, nur ohne Flackern.
 */

interface ModulKontext {
  module: ModulConfig;
  betriebsart: BetriebsartKey;
}

const Kontext = createContext<ModulKontext>({
  module: DEFAULT_MODUL_CONFIG,
  betriebsart: "agrarhandel",
});

export function ModulProvider({
  module,
  betriebsart,
  children,
}: {
  module: ModulConfig;
  betriebsart: BetriebsartKey;
  children: React.ReactNode;
}) {
  return <Kontext.Provider value={{ module, betriebsart }}>{children}</Kontext.Provider>;
}

/** Vollständige Modulkonfiguration (ohne Provider: die Standardwerte). */
export function useModule(): ModulConfig {
  return useContext(Kontext).module;
}

/** Einzelnes Modul aktiv? Kurzform für `useModule().eierhandel` & Co. */
export function useModulAktiv(key: ModulKey): boolean {
  return useContext(Kontext).module[key];
}

/** Eingestellte Betriebsart (Fallback "agrarhandel" = heutiges Standardverhalten). */
export function useBetriebsart(): BetriebsartKey {
  return useContext(Kontext).betriebsart;
}
