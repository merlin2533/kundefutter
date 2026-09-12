/**
 * lib/betriebsart.ts
 * Branchen-Profil des Betriebs — die eine Entscheidung "was für ein Betrieb bin ich?",
 * aus der sich Modulbündel, Artikelkategorien und der Zuschnitt der Navigation ableiten.
 *
 * Löst die früheren MODUL_PRESETS (lib/modul-presets.ts) ab: die waren ein reiner
 * Knopfdruck ohne Gedächtnis — nach dem Anwenden wusste die App nicht mehr, um was für
 * einen Betrieb es sich handelt, weshalb Menüstruktur und Beschriftungen für jeden
 * Betrieb identisch blieben. Die gewählte Betriebsart wird jetzt unter
 * `system.betriebsart` persistiert und steuert zusätzlich das Nav-Profil.
 *
 * Betriebsart und Einzel-Module bleiben orthogonal: die Betriebsart setzt die
 * modul.*-Werte beim Wechsel EINMALIG, danach sind die Toggles unter
 * /einstellungen/module frei überschreibbar. Kein Lock-in.
 *
 * Bewusst importfrei bis auf den reinen Typ-Import (siehe lib/modul-keys.ts) — die
 * Datei wird sowohl aus Client-Komponenten (Nav, Einstellungen, Onboarding) als auch
 * aus Server-Code genutzt.
 */
import type { ModulConfig, ModulKey } from "@/lib/modul-keys";
import type { NavProfilRegeln } from "@/lib/nav-profil";

export const BETRIEBSART_KEY = "system.betriebsart";

export type BetriebsartKey = "agrarhandel" | "eierbetrieb" | "saatguthandel" | "individuell";

// Die Umbau-Regeln selbst leben in lib/nav-profil.ts (dort steht auch die Funktion, die
// sie anwendet) — hier nur unter dem sprechenderen Namen NavProfil weiterverwendet, damit
// es keine zweite, auseinanderlaufende Definition gibt.
export type NavProfil = NavProfilRegeln & {
  /** Beschriftung der Tab-Gruppen auf der Kunden-Detailseite (TAB_GRUPPEN in
   *  app/kunden/[id]/_shared.tsx) — dieselbe Idee wie gruppenLabels, nur eine Ebene tiefer.
   *  Sonst hieße die Gruppe bei einem Eierbetrieb weiterhin "Agrar", obwohl darin nur noch
   *  der Tierbestand steht. */
  kundenTabGruppen?: Record<string, string>;
};

export interface Betriebsart {
  key: BetriebsartKey;
  label: string;
  icon: string;
  beschreibung: string;
  /** Nur die vom Standard abweichenden Werte — alle anderen Module bleiben unangetastet. */
  config: Partial<ModulConfig>;
  /** Optional: ersetzt system.artikelkategorien beim Anwenden. */
  artikelkategorien?: string[];
  navProfil?: NavProfil;
}

export const BETRIEBSARTEN: Betriebsart[] = [
  {
    key: "agrarhandel",
    label: "Agrarhandel (Vollsortiment)",
    icon: "🌾",
    beschreibung:
      "Alle Module aktiv — klassischer Futter-/Dünger-/Saatguthändler mit Ackerbau-Beratung, Tierhaltung und Erzeugerabrechnung.",
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
    icon: "🥚",
    beschreibung:
      "Eierhandel und Rationsberechnung aktiv, Ackerbau-/Saatgut-Module aus. Erzeugerabrechnung bleibt an (Eierankauf von Erzeugern). Eierhandel bekommt eine eigene Menügruppe.",
    config: {
      sortenversuche: false,
      rationsberechnung: true,
      bodenproben: false,
      psm_ausbringung: false,
      erzeugerabrechnung: true,
      tourenplanung: true,
      kontrakte: false,
      kampagnen: true,
      fruehbezug: false,
      marktpreise: false,
      reklamationen: true,
      personal: true,
      agrarantraege: false,
      eierhandel: true,
    },
    artikelkategorien: ["Eier", "Futter", "Analysen", "Beratung"],
    navProfil: {
      // "Eier & Futter" fasst das Eierhandel-Kapitel und den nach dem Modulfilter allein
      // übrigen Tier-Eintrag (Rationsberechnung) zusammen — für einen Legehennenbetrieb
      // gehört beides ohnehin zusammen, und die Menüleiste bleibt so schmal wie bisher,
      // statt um eine elfte Gruppe zu wachsen.
      eigeneGruppen: [
        { label: "Eier & Futter", ausGruppe: "Lieferungen", section: "Eierhandel", auchAusGruppe: "Pflanze & Tier" },
      ],
      kundenTabGruppen: { Agrar: "Tier" },
      reihenfolge: [
        "Dashboard",
        "Kunden",
        "Vertrieb",
        "Lieferungen",
        "Eier & Futter",
        "Artikel & Lager",
        "Finanzen",
        "Personal",
        "Analyse",
      ],
    },
  },
  {
    key: "saatguthandel",
    label: "Saatguthandel",
    icon: "🌱",
    beschreibung:
      "Pflanzenbau, Sortenversuche und Frühbezug aktiv (Saison-Vorbestellungen), Tierhaltungs- und Eier-Module aus.",
    config: {
      sortenversuche: true,
      rationsberechnung: false,
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
    navProfil: {
      gruppenLabels: { "Pflanze & Tier": "Pflanzenbau" },
      kundenTabGruppen: { Agrar: "Pflanzenbau" },
    },
  },
  {
    key: "individuell",
    label: "Individuell",
    icon: "🧩",
    beschreibung:
      "Keine Vorgabe — die Module werden unten einzeln eingestellt. Die Menüstruktur bleibt die Standard-Struktur.",
    config: {},
  },
];

export function findeBetriebsart(key: BetriebsartKey): Betriebsart | undefined {
  return BETRIEBSARTEN.find((b) => b.key === key);
}

/** Fällt bei unbekanntem/fehlendem Wert auf "agrarhandel" zurück — eine Bestandsinstallation
 *  ohne gesetzten Key verhält sich damit exakt wie vor Einführung der Betriebsart. */
export function parseBetriebsart(value: string | null | undefined): BetriebsartKey {
  const treffer = BETRIEBSARTEN.find((b) => b.key === value);
  return treffer ? treffer.key : "agrarhandel";
}

export function navProfilFuer(key: BetriebsartKey): NavProfil | undefined {
  return findeBetriebsart(key)?.navProfil;
}

// ─── Modul-Oberbereiche ───────────────────────────────────────────────────────
// 16 Einzel-Toggles sind für die eigentliche Frage ("brauche ich Ackerbau?") zu
// kleinteilig. /einstellungen/module zeigt deshalb primär diese sechs Bereiche mit
// einem Master-Schalter; die Einzel-Module bleiben darunter aufklappbar für die
// Feinsteuerung. Die modul.*-Keys selbst bleiben unverändert das Speicher- und
// Enforcement-Format (requireModul, MODULE_HREFS, TAB_MODUL) — die Vereinfachung
// passiert in der Bedienung, nicht im Datenmodell.

export interface ModulBereich {
  key: string;
  label: string;
  icon: string;
  beschreibung: string;
  module: ModulKey[];
}

export const MODUL_BEREICHE: ModulBereich[] = [
  {
    key: "pflanzenbau",
    label: "Pflanzenbau & Feld",
    icon: "🌾",
    beschreibung:
      "Schlagkartei, Bodenproben, Düngebedarf (DüV), Anbauplanung, Pflanzenschutz, Sortenversuche und Agraranträge.",
    module: ["bodenproben", "psm_ausbringung", "sortenversuche", "agrarantraege"],
  },
  {
    key: "tier",
    label: "Tierhaltung & Futter",
    icon: "🐄",
    beschreibung: "Tierbestand je Kunde und Futterrationsberechnung inkl. eigener Futterwerte.",
    module: ["rationsberechnung"],
  },
  {
    key: "eier",
    label: "Eierhandel",
    icon: "🥚",
    beschreibung:
      "Ei-Sortierprotokoll, Güte-/Gewichtsklassen, Erzeugercode & Haltungsform, KAT-Meldung und Meldepflichten-Tracker.",
    module: ["eierhandel"],
  },
  {
    key: "vertrieb",
    label: "Vertrieb & Kundenbindung",
    icon: "📊",
    beschreibung: "Kampagnen, Kontrakte, Frühbezug/Vorbestellungen und Reklamationsmanagement.",
    module: ["kampagnen", "kontrakte", "fruehbezug", "reklamationen"],
  },
  {
    key: "logistik",
    label: "Logistik & Einkauf",
    icon: "🚛",
    beschreibung: "Tourenplanung, Fahrer-Cockpit und Erzeugerabrechnung (Anlieferungen).",
    module: ["tourenplanung", "erzeugerabrechnung"],
  },
  {
    key: "betrieb",
    label: "Betrieb & Schnittstellen",
    icon: "⚙️",
    beschreibung: "Personal & Lohn, Marktpreise (Eurostat/MATIF), Nextcloud-Ablage und MQTT-Automatisierung.",
    module: ["personal", "marktpreise", "nextcloud", "mqtt"],
  },
];

/** Beschriftung/Beschreibung je Einzel-Modul für die Detail-Ansicht unter einem Bereich. */
export const MODUL_LABELS: Record<ModulKey, { label: string; beschreibung: string }> = {
  sortenversuche: { label: "Sortenversuche", beschreibung: "Feldversuche und Sortenvergleiche (Ertrag, Feuchte, Protein)" },
  rationsberechnung: { label: "Rationsberechnung (Tier)", beschreibung: "Futterrationen für Rinder, Schweine, Geflügel, Pferde u.a." },
  bodenproben: { label: "Bodenproben & Düngung", beschreibung: "Schlagkartei, Bodenanalysen, Albrecht, Düngebedarf (DüV), Anbauplanung, Zertifizierungen, Sachkundenachweise" },
  psm_ausbringung: { label: "Pflanzenschutz", beschreibung: "PSM-Ausbringung und Spritzfenster-Prognose" },
  erzeugerabrechnung: { label: "Erzeugerabrechnung", beschreibung: "Erfassung und Abrechnung von Anlieferungen" },
  tourenplanung: { label: "Tourenplanung", beschreibung: "Routenoptimierung, Tour-Namen und Fahrer-Cockpit" },
  kontrakte: { label: "Kontrakte", beschreibung: "Rahmenverträge mit Mengenabrufen und Lieferverfolgung" },
  kampagnen: { label: "Kampagnen", beschreibung: "Marketing-Kampagnen mit Zielgruppen-Kriterien und Rabatten" },
  fruehbezug: { label: "Frühbezug / Vorbestellungen", beschreibung: "Saison-Vorbestellungen mit Frühbezugs-Rabattstaffeln" },
  mqtt: { label: "MQTT-Automatisierung", beschreibung: "IoT-Regeln für eingehende MQTT-Nachrichten" },
  nextcloud: { label: "Nextcloud", beschreibung: "Dokumentensynchronisation für Kunden, Artikel und Buchhaltung" },
  marktpreise: { label: "Marktpreise (Eurostat)", beschreibung: "Agrarpreisindizes und MATIF-Futures" },
  reklamationen: { label: "Reklamationen", beschreibung: "Beschwerdemanagement mit Prioritäten, Status und Lösungsdokumentation" },
  personal: { label: "Personal & Lohn", beschreibung: "Mitarbeiter, Arbeitsstunden, Urlaubsanträge und Lohnabrechnung" },
  agrarantraege: { label: "Agraranträge (AFIG)", beschreibung: "Agrarförderungs-Daten, Flächenanalyse und Gebietsanalyse" },
  eierhandel: { label: "Eierhandel", beschreibung: "Sortierprotokoll, Güte-/Gewichtsklassen, KAT-Meldung, Meldepflichten" },
};
