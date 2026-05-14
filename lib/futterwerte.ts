// Futterwerttabelle — Nähr- und Mineralstoffgehalte von Futtermitteln.
//
// Werte sind Standard-/Orientierungswerte angelehnt an die LfL-Futterwerttabellen
// (Bayerische Landesanstalt für Landwirtschaft) sowie DLG-Futterwerttabellen.
// Alle Nähr-/Mineralstoffwerte beziehen sich auf 1 kg TROCKENMASSE (TM),
// `tmGehalt` ist der TM-Gehalt der Frischmasse in g/kg FM.
//
// Wichtig: Für exakte Rationen immer Laboranalysen verwenden — diese Tabelle
// dient als Ausgangsbasis und ist über /einstellungen/futterwerte ergänzbar
// (Custom-Einträge im Einstellung-Key `futterwerte.custom`).

export type Futtergruppe =
  | "Grobfutter"
  | "Saftfutter"
  | "Getreide"
  | "Eiweissfutter"
  | "Nebenprodukt"
  | "Mineralfutter"
  | "Sonstiges";

export type Futterwert = {
  name: string;
  gruppe: Futtergruppe;
  tmGehalt: number;          // g TM / kg FM
  // Energie (je nach Tierart relevant)
  me?: number;               // MJ ME / kg TM (Schwein, Geflügel, Pferd, Mastrind)
  nel?: number;              // MJ NEL / kg TM (Milchvieh / Wiederkäuer)
  // Protein
  rohprotein?: number;       // g XP / kg TM
  nxp?: number;              // g nutzbares Rohprotein / kg TM (Wiederkäuer)
  dp?: number;               // g verdauliches Rohprotein / kg TM (Pferd)
  // Struktur
  rohfaser?: number;         // g XF / kg TM
  andfom?: number;           // g aNDFom / kg TM
  // Limitierende Aminosäuren
  lysin?: number;            // g / kg TM
  methionin?: number;        // g / kg TM
  threonin?: number;         // g / kg TM
  tryptophan?: number;       // g / kg TM
  // Mengenelemente
  ca?: number;               // g / kg TM
  p?: number;                // g / kg TM
  mg?: number;               // g / kg TM
  na?: number;               // g / kg TM
};

// RNB (ruminale N-Bilanz) = (XP − nXP) / 6.25
export function rnbWert(f: { rohprotein?: number; nxp?: number }): number | undefined {
  if (f.rohprotein == null || f.nxp == null) return undefined;
  return (f.rohprotein - f.nxp) / 6.25;
}

export const FUTTERWERTE: Futterwert[] = [
  // ─── Grobfutter ────────────────────────────────────────────────────────────
  { name: "Heu (1. Schnitt, Mitte Blüte)", gruppe: "Grobfutter", tmGehalt: 860, me: 7.2, nel: 5.27, rohprotein: 98, nxp: 118, dp: 55, rohfaser: 315, andfom: 605, ca: 4.0, p: 2.5, mg: 1.6, na: 0.4, lysin: 4.0, methionin: 1.3 },
  { name: "Heu (jung, blattreich)", gruppe: "Grobfutter", tmGehalt: 860, me: 8.4, nel: 5.9, rohprotein: 130, nxp: 128, dp: 82, rohfaser: 260, andfom: 540, ca: 5.5, p: 3.0, mg: 1.8, na: 0.5, lysin: 5.5, methionin: 1.8 },
  { name: "Luzerneheu", gruppe: "Grobfutter", tmGehalt: 860, me: 7.6, nel: 5.2, rohprotein: 170, nxp: 130, dp: 110, rohfaser: 300, andfom: 480, ca: 16.0, p: 2.6, mg: 2.2, na: 0.5, lysin: 7.5, methionin: 2.2 },
  { name: "Grassilage (1. Schnitt, Beg. Rispenschieben)", gruppe: "Grobfutter", tmGehalt: 350, me: 9.0, nel: 6.36, rohprotein: 180, nxp: 143, dp: 120, rohfaser: 224, andfom: 465, ca: 6.5, p: 4.0, mg: 2.4, na: 0.7, lysin: 8.0, methionin: 2.5 },
  { name: "Grassilage (2. Schnitt)", gruppe: "Grobfutter", tmGehalt: 350, me: 9.6, nel: 6.1, rohprotein: 160, nxp: 138, dp: 105, rohfaser: 258, andfom: 510, ca: 7.5, p: 3.6, mg: 2.7, na: 1.0, lysin: 7.2, methionin: 2.3 },
  { name: "Maissilage (wachsreif)", gruppe: "Grobfutter", tmGehalt: 350, me: 10.9, nel: 6.69, rohprotein: 82, nxp: 134, dp: 50, rohfaser: 195, andfom: 485, ca: 2.0, p: 2.2, mg: 1.3, na: 0.3, lysin: 2.3, methionin: 1.4 },
  { name: "Maissilage (teigreif)", gruppe: "Grobfutter", tmGehalt: 320, me: 10.85, nel: 6.5, rohprotein: 84, nxp: 132, dp: 48, rohfaser: 205, andfom: 465, ca: 2.1, p: 2.2, mg: 1.3, na: 0.3, lysin: 2.3, methionin: 1.4 },
  { name: "Weidegras (jung)", gruppe: "Grobfutter", tmGehalt: 180, me: 11.0, nel: 7.0, rohprotein: 200, nxp: 150, dp: 140, rohfaser: 200, andfom: 440, ca: 6.0, p: 4.0, mg: 2.0, na: 1.5, lysin: 9.5, methionin: 3.0 },
  { name: "Stroh (Getreide)", gruppe: "Grobfutter", tmGehalt: 860, me: 6.62, nel: 3.3, rohprotein: 45, nxp: 74, dp: 8, rohfaser: 420, andfom: 785, ca: 4.0, p: 0.8, mg: 0.9, na: 1.0, lysin: 1.5, methionin: 0.5 },
  { name: "Gerstenstroh", gruppe: "Grobfutter", tmGehalt: 860, me: 6.62, nel: 3.3, rohprotein: 45, nxp: 74, dp: 8, rohfaser: 435, andfom: 785, ca: 5.0, p: 0.8, mg: 0.9, na: 2.0, lysin: 1.5, methionin: 0.5 },

  // ─── Saftfutter ────────────────────────────────────────────────────────────
  { name: "Futterrüben", gruppe: "Saftfutter", tmGehalt: 130, me: 12.8, nel: 8.2, rohprotein: 70, nxp: 105, dp: 45, rohfaser: 70, andfom: 130, ca: 2.5, p: 2.0, mg: 1.5, na: 4.0 },
  { name: "Kartoffeln (gedämpft)", gruppe: "Saftfutter", tmGehalt: 230, me: 13.5, nel: 8.6, rohprotein: 95, nxp: 115, dp: 65, rohfaser: 30, andfom: 60, ca: 0.4, p: 2.3, mg: 1.1, na: 0.3, lysin: 5.0, methionin: 1.4 },
  { name: "Pressschnitzel (siliert)", gruppe: "Saftfutter", tmGehalt: 220, me: 11.5, nel: 7.3, rohprotein: 100, nxp: 145, dp: 55, rohfaser: 200, andfom: 430, ca: 9.0, p: 1.0, mg: 1.8, na: 0.4 },

  // ─── Getreide ──────────────────────────────────────────────────────────────
  { name: "Gerste", gruppe: "Getreide", tmGehalt: 880, me: 13.0, nel: 8.3, rohprotein: 120, nxp: 165, dp: 90, rohfaser: 55, andfom: 200, ca: 0.7, p: 4.0, mg: 1.3, na: 0.3, lysin: 4.3, methionin: 2.0, threonin: 4.0, tryptophan: 1.6 },
  { name: "Weizen", gruppe: "Getreide", tmGehalt: 880, me: 13.8, nel: 8.5, rohprotein: 138, nxp: 170, dp: 105, rohfaser: 28, andfom: 130, ca: 0.6, p: 3.7, mg: 1.3, na: 0.2, lysin: 3.5, methionin: 2.2, threonin: 3.7, tryptophan: 1.6 },
  { name: "Triticale", gruppe: "Getreide", tmGehalt: 880, me: 13.7, nel: 8.4, rohprotein: 128, nxp: 168, dp: 98, rohfaser: 30, andfom: 145, ca: 0.5, p: 3.6, mg: 1.2, na: 0.3, lysin: 4.4, methionin: 2.1 },
  { name: "Körnermais", gruppe: "Getreide", tmGehalt: 880, me: 13.9, nel: 8.6, rohprotein: 105, nxp: 165, dp: 75, rohfaser: 26, andfom: 110, ca: 0.4, p: 3.5, mg: 1.3, na: 0.2, lysin: 2.6, methionin: 1.9, threonin: 3.5, tryptophan: 0.7 },
  { name: "Hafer", gruppe: "Getreide", tmGehalt: 880, me: 11.5, nel: 7.0, rohprotein: 120, nxp: 155, dp: 88, rohfaser: 110, andfom: 320, ca: 1.2, p: 3.6, mg: 1.4, na: 0.4, lysin: 4.5, methionin: 1.9 },
  { name: "Roggen", gruppe: "Getreide", tmGehalt: 880, me: 13.3, nel: 8.2, rohprotein: 110, nxp: 162, dp: 82, rohfaser: 27, andfom: 140, ca: 0.7, p: 3.5, mg: 1.2, na: 0.3, lysin: 4.0, methionin: 1.7 },

  // ─── Eiweißfutter ──────────────────────────────────────────────────────────
  { name: "Sojaextraktionsschrot (44 % XP)", gruppe: "Eiweissfutter", tmGehalt: 880, me: 13.4, nel: 8.6, rohprotein: 500, nxp: 290, dp: 430, rohfaser: 70, andfom: 130, ca: 3.5, p: 7.0, mg: 3.0, na: 0.3, lysin: 30.5, methionin: 6.8, threonin: 19.0, tryptophan: 6.5 },
  { name: "Rapsextraktionsschrot", gruppe: "Eiweissfutter", tmGehalt: 890, me: 11.0, nel: 7.2, rohprotein: 398, nxp: 250, dp: 320, rohfaser: 130, andfom: 392, ca: 8.7, p: 13.6, mg: 5.8, na: 0.5, lysin: 21.5, methionin: 7.8, threonin: 17.0, tryptophan: 5.0 },
  { name: "Ackerbohnen", gruppe: "Eiweissfutter", tmGehalt: 880, me: 13.0, nel: 8.3, rohprotein: 298, nxp: 200, dp: 250, rohfaser: 90, andfom: 160, ca: 1.5, p: 5.5, mg: 1.3, na: 0.2, lysin: 19.0, methionin: 2.1, threonin: 10.5, tryptophan: 2.5 },
  { name: "Futtererbsen", gruppe: "Eiweissfutter", tmGehalt: 880, me: 13.4, nel: 8.5, rohprotein: 248, nxp: 195, dp: 210, rohfaser: 65, andfom: 140, ca: 1.0, p: 4.5, mg: 1.3, na: 0.2, lysin: 17.0, methionin: 2.3, threonin: 9.0, tryptophan: 2.2 },
  { name: "Sojakuchen (Pressextraktion)", gruppe: "Eiweissfutter", tmGehalt: 900, me: 14.5, nel: 9.0, rohprotein: 460, nxp: 280, dp: 400, rohfaser: 75, andfom: 145, ca: 3.3, p: 6.5, mg: 2.8, na: 0.3, lysin: 28.0, methionin: 6.2 },
  { name: "Lupinen (blau)", gruppe: "Eiweissfutter", tmGehalt: 880, me: 13.5, nel: 8.4, rohprotein: 360, nxp: 230, dp: 300, rohfaser: 150, andfom: 230, ca: 2.5, p: 4.5, mg: 1.8, na: 0.2, lysin: 16.5, methionin: 2.6 },

  // ─── Nebenprodukte ─────────────────────────────────────────────────────────
  { name: "Weizenkleie", gruppe: "Nebenprodukt", tmGehalt: 880, me: 9.5, nel: 6.6, rohprotein: 160, nxp: 155, dp: 115, rohfaser: 120, andfom: 420, ca: 1.5, p: 11.0, mg: 5.0, na: 0.3, lysin: 6.0, methionin: 2.4 },
  { name: "Biertreber (siliert)", gruppe: "Nebenprodukt", tmGehalt: 230, me: 11.0, nel: 7.0, rohprotein: 250, nxp: 200, dp: 180, rohfaser: 170, andfom: 480, ca: 3.5, p: 5.5, mg: 2.0, na: 0.3, lysin: 9.0, methionin: 4.0 },
  { name: "Trockenschnitzel (Zuckerrübe)", gruppe: "Nebenprodukt", tmGehalt: 910, me: 12.2, nel: 7.7, rohprotein: 95, nxp: 140, dp: 55, rohfaser: 200, andfom: 450, ca: 9.0, p: 1.0, mg: 1.8, na: 1.5 },
  { name: "Melasse", gruppe: "Nebenprodukt", tmGehalt: 750, me: 12.5, nel: 7.9, rohprotein: 130, nxp: 130, dp: 30, rohfaser: 0, andfom: 0, ca: 2.5, p: 0.3, mg: 0.5, na: 8.0 },
  { name: "Maiskleber (Corn Gluten Feed)", gruppe: "Nebenprodukt", tmGehalt: 880, me: 12.0, nel: 7.6, rohprotein: 230, nxp: 185, dp: 175, rohfaser: 90, andfom: 380, ca: 2.0, p: 9.5, mg: 4.5, na: 1.5, lysin: 6.5, methionin: 4.0 },

  // ─── Mineralfutter & Zusätze ───────────────────────────────────────────────
  { name: "Mineralfutter Rind (Ca/P 1:1)", gruppe: "Mineralfutter", tmGehalt: 950, ca: 160, p: 140, mg: 60, na: 80 },
  { name: "Mineralfutter Milchvieh (Ca-betont)", gruppe: "Mineralfutter", tmGehalt: 950, ca: 210, p: 40, mg: 70, na: 80 },
  { name: "Mineralfutter Schwein", gruppe: "Mineralfutter", tmGehalt: 950, ca: 200, p: 90, mg: 25, na: 70, lysin: 30, methionin: 12 },
  { name: "Mineralfutter Pferd", gruppe: "Mineralfutter", tmGehalt: 950, ca: 150, p: 80, mg: 50, na: 60 },
  { name: "Mineralfutter Geflügel (Legehennen)", gruppe: "Mineralfutter", tmGehalt: 950, ca: 350, p: 50, mg: 15, na: 60, methionin: 5 },
  { name: "Futterkalk", gruppe: "Mineralfutter", tmGehalt: 997, ca: 381, p: 0, mg: 5, na: 0 },
  { name: "Monocalciumphosphat", gruppe: "Mineralfutter", tmGehalt: 970, ca: 160, p: 220, mg: 5, na: 2 },
  { name: "Viehsalz", gruppe: "Mineralfutter", tmGehalt: 990, na: 390 },
  { name: "Kohlensaurer Magnesiumkalk", gruppe: "Mineralfutter", tmGehalt: 970, ca: 200, mg: 110 },

  // ─── Sonstiges ─────────────────────────────────────────────────────────────
  { name: "Milchaustauscher", gruppe: "Sonstiges", tmGehalt: 960, me: 16.5, nel: 10.5, rohprotein: 230, nxp: 230, dp: 215, rohfaser: 1, andfom: 0, ca: 9.0, p: 7.0, mg: 1.5, na: 5.0, lysin: 18.0, methionin: 5.0 },
  { name: "Pflanzenöl (Soja/Raps)", gruppe: "Sonstiges", tmGehalt: 999, me: 35.0, nel: 22.0, rohprotein: 0, rohfaser: 0, andfom: 0 },
  { name: "Bierhefe (getrocknet)", gruppe: "Sonstiges", tmGehalt: 920, me: 12.5, nel: 7.8, rohprotein: 480, nxp: 270, dp: 410, rohfaser: 5, andfom: 10, ca: 3.0, p: 14.0, mg: 2.5, na: 1.0, lysin: 34.0, methionin: 7.5 },
];

export const FUTTERGRUPPEN: Futtergruppe[] = [
  "Grobfutter", "Saftfutter", "Getreide", "Eiweissfutter",
  "Nebenprodukt", "Mineralfutter", "Sonstiges",
];

/** Sucht einen Futterwert per (case-insensitivem) Namen. */
export function findeFutterwert(name: string): Futterwert | undefined {
  const n = name.trim().toLowerCase();
  return FUTTERWERTE.find((f) => f.name.toLowerCase() === n);
}
