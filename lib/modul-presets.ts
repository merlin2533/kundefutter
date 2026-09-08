import type { ModulConfig } from "@/lib/modul-config";

export interface ModulPreset {
  key: string;
  label: string;
  beschreibung: string;
  /** Nur die vom Standard abweichenden Werte — alle anderen Module bleiben unangetastet. */
  config: Partial<ModulConfig>;
  /** Optional: ersetzt system.artikelkategorien beim Anwenden des Presets. */
  artikelkategorien?: string[];
}

/** Vordefinierte Branchen-Bundles für /einstellungen/module — setzen mehrere modul.*-Werte
 *  (und optional Artikelkategorien) auf einen Schlag. Einzel-Toggles bleiben danach weiterhin
 *  frei editierbar, ein Preset ist nur ein Ausgangspunkt, kein Lock-in. */
export const MODUL_PRESETS: ModulPreset[] = [
  {
    key: "vollsortiment",
    label: "Vollsortiment (Agrarhandel)",
    beschreibung: "Alle Module aktiv — Standardeinstellung für einen klassischen Futter-/Dünger-/Saatguthändler.",
    config: {
      sortenversuche: true,
      rationsberechnung: true,
      bodenproben: true,
      psm_ausbringung: true,
      erzeugerabrechnung: true,
      tourenplanung: true,
      kontrakte: true,
      kampagnen: true,
      fruehbezug: true,
      marktpreise: true,
      reklamationen: true,
      personal: true,
      agrarantraege: true,
      eierhandel: false,
    },
  },
  {
    key: "eierbetrieb",
    label: "Eierbetrieb / Legehennenbetrieb",
    beschreibung: "Rationsberechnung + Eierhandel-Modul aktiv, Ackerbau-/Saatgut-spezifische Module aus. Anlieferung/Erzeugerabrechnung bleibt an (Eierankauf von Erzeugern).",
    config: {
      sortenversuche: false,
      rationsberechnung: true,
      bodenproben: false,
      psm_ausbringung: false,
      erzeugerabrechnung: true,
      fruehbezug: false,
      kontrakte: false,
      kampagnen: true,
      agrarantraege: false,
      eierhandel: true,
    },
    artikelkategorien: ["Eier", "Futter", "Analysen", "Beratung"],
  },
  {
    key: "saatguthandel",
    label: "Saatguthandel",
    beschreibung: "Sortenversuche + Frühbezug aktiv (Saison-Vorbestellungen), Tierhaltungs-Module aus.",
    config: {
      sortenversuche: true,
      rationsberechnung: false,
      fruehbezug: true,
      bodenproben: true,
      psm_ausbringung: true,
      eierhandel: false,
    },
  },
];
