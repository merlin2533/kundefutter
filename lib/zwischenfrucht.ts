// Zwischenfrucht-Mischungsrechner – Rechenkern.
//
// Gängige Mischungsrechner (z.B. LWK NRW, LIZ) arbeiten von der Zielgröße her:
// Nutzer gibt gewünschte Samenanteile/Kornzahlen je Partner vor, der Rechner liefert
// die nötige Aussaatstärke in kg/ha. In der Praxis wird eine Zwischenfrucht-Mischung
// aber oft aus vorhandenen Säcken selbst gemischt ("2 Sack Ölrettich + 1 Sack Phacelia
// auf X ha") – hier ist die tatsächliche Aussaatstärke je Partner (kg/ha) der
// Ausgangspunkt, und Gewichts- sowie Samenanteil (Kornzahl je m²) sind das Ergebnis.
//
// TKG-Werte sind Ø-Richtwerte gängiger Herkünfte (Literatur/Herstellerangaben) und
// schwanken je nach Sorte/Partie teils erheblich – am zuverlässigsten ist das TKG auf
// dem Saatgutsack. Das Feld ist deshalb pro Zeile frei überschreibbar.

export type ZwischenfruchtFamilie =
  | "Kreuzblütler"
  | "Leguminosen"
  | "Raublattgewächse"
  | "Gräser"
  | "Sonstige";

export interface ZwischenfruchtArt {
  id: string;
  name: string;
  familie: ZwischenfruchtFamilie;
  tkg: number; // Tausendkorngewicht in Gramm, Ø-Richtwert
}

export const ZWISCHENFRUCHT_ARTEN: ZwischenfruchtArt[] = [
  { id: "oelrettich", name: "Ölrettich", familie: "Kreuzblütler", tkg: 12 },
  { id: "gelbsenf", name: "Gelbsenf (Weißer Senf)", familie: "Kreuzblütler", tkg: 7 },
  { id: "markstammkohl", name: "Markstammkohl", familie: "Kreuzblütler", tkg: 3 },
  { id: "winterrübsen", name: "Winterrübsen / Sommerraps (ZF)", familie: "Kreuzblütler", tkg: 4 },
  { id: "leindotter", name: "Leindotter", familie: "Kreuzblütler", tkg: 1.1 },
  { id: "phacelia", name: "Phacelia (Bienenfreund)", familie: "Raublattgewächse", tkg: 1.8 },
  { id: "buchweizen", name: "Buchweizen", familie: "Raublattgewächse", tkg: 22 },
  { id: "oellein", name: "Öllein (Faserlein)", familie: "Raublattgewächse", tkg: 6 },
  { id: "ramtill", name: "Ramtillkraut (Guizotia)", familie: "Raublattgewächse", tkg: 4.5 },
  { id: "sonnenblume", name: "Sonnenblume", familie: "Raublattgewächse", tkg: 60 },
  { id: "malve", name: "Malve", familie: "Raublattgewächse", tkg: 5 },
  { id: "perserklee", name: "Perserklee", familie: "Leguminosen", tkg: 2 },
  { id: "alexandrinerklee", name: "Alexandrinerklee", familie: "Leguminosen", tkg: 3 },
  { id: "inkarnatklee", name: "Inkarnatklee", familie: "Leguminosen", tkg: 3.5 },
  { id: "rotklee", name: "Rotklee", familie: "Leguminosen", tkg: 2 },
  { id: "esparsette", name: "Esparsette (unentspelzt)", familie: "Leguminosen", tkg: 18 },
  { id: "sommerwicke", name: "Sommerwicke", familie: "Leguminosen", tkg: 75 },
  { id: "winterwicke", name: "Winterwicke (Zottelwicke)", familie: "Leguminosen", tkg: 50 },
  { id: "ackerbohne", name: "Ackerbohne", familie: "Leguminosen", tkg: 450 },
  { id: "futtererbse", name: "Futtererbse", familie: "Leguminosen", tkg: 200 },
  { id: "blaue_lupine", name: "Blaue Lupine", familie: "Leguminosen", tkg: 170 },
  { id: "gelbe_lupine", name: "Gelbe Lupine", familie: "Leguminosen", tkg: 130 },
  { id: "platterbse", name: "Platterbse", familie: "Leguminosen", tkg: 120 },
  { id: "rauhafer", name: "Rauhafer (Saathafer)", familie: "Gräser", tkg: 32 },
  { id: "sudangras", name: "Sudangras / Sorghum-Hybride", familie: "Gräser", tkg: 10 },
  { id: "weidelgras", name: "Welsches Weidelgras", familie: "Gräser", tkg: 2.2 },
];

export function findZwischenfruchtArt(id: string): ZwischenfruchtArt | undefined {
  return ZWISCHENFRUCHT_ARTEN.find((a) => a.id === id);
}

export interface MischungKomponenteEingabe {
  name: string;
  tkg: number; // g
  kgProHa: number;
}

export interface MischungKomponenteErgebnis extends MischungKomponenteEingabe {
  koernerProM2: number;
  gewichtsanteilProzent: number;
  samenanteilProzent: number;
}

export interface MischungErgebnis {
  komponenten: MischungKomponenteErgebnis[];
  summeKgProHa: number;
  summeKoernerProM2: number;
  hinweise: string[];
}

export function berechneMischung(eingaben: MischungKomponenteEingabe[]): MischungErgebnis {
  const gueltige = eingaben.filter((e) => e.kgProHa > 0 && e.tkg > 0);

  const summeKgProHa = gueltige.reduce((s, e) => s + e.kgProHa, 0);
  const mitKoernern = gueltige.map((e) => ({
    ...e,
    // Körner/m² = Aussaatstärke (kg/ha) × 100 / TKG (g) – Standardformel der Saatgutbranche
    koernerProM2: (e.kgProHa * 100) / e.tkg,
  }));
  const summeKoernerProM2 = mitKoernern.reduce((s, e) => s + e.koernerProM2, 0);

  const komponenten: MischungKomponenteErgebnis[] = mitKoernern.map((e) => ({
    ...e,
    gewichtsanteilProzent: summeKgProHa > 0 ? (e.kgProHa / summeKgProHa) * 100 : 0,
    samenanteilProzent: summeKoernerProM2 > 0 ? (e.koernerProM2 / summeKoernerProM2) * 100 : 0,
  }));

  const hinweise: string[] = [
    "TKG-Werte sind Ø-Richtwerte – für ein genaues Ergebnis das TKG vom Saatgutsack (Etikett) verwenden.",
    "Die Berechnung berücksichtigt keine Keimfähigkeit/Feldaufgang – sie zeigt reine Saatgut-Anteile.",
  ];
  if (eingaben.length > 0 && gueltige.length < eingaben.length) {
    hinweise.push("Zeilen ohne Menge (kg/ha) oder TKG wurden bei der Berechnung nicht berücksichtigt.");
  }

  return { komponenten, summeKgProHa, summeKoernerProM2, hinweise };
}
