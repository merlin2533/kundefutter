// Düngebedarfsermittlung nach DüV (Düngeverordnung) — vereinfachte Anlage 4 / Anlage 6
//
// Bezug: DüV vom 26.05.2017, geändert 28.04.2020.
// Hinweise:
//   - N-Bedarfswerte sind Standardwerte aus Anlage 4 Tab. 1
//   - Abzüge: Nmin (Anlage 4 Tab. 2), org. Düngung Vorjahr, Vorfruchtbonus
//   - Ergebnis ist Hinweiswert; finale Bedarfsplanung obliegt dem Landwirt
//
// Erweiterbar: Werte in lib/duengebedarf.ts -> NBEDARF_TABELLE pflegen.

export type Nbedarfseintrag = {
  fruchtart: string;
  ertragsBasisDtHa: number; // Basis-Ertragserwartung
  nBedarfBasis: number;     // kg N/ha bei Basis-Ertrag
  ertragsAnpassung?: number; // kg N pro dt/ha Mehrertrag
};

// Vereinfachte Auszüge DüV Anlage 4 Tabelle 1
export const NBEDARF_TABELLE: Nbedarfseintrag[] = [
  { fruchtart: "Winterweizen A/B", ertragsBasisDtHa: 80, nBedarfBasis: 230, ertragsAnpassung: 2.0 },
  { fruchtart: "Winterweizen E",   ertragsBasisDtHa: 80, nBedarfBasis: 260, ertragsAnpassung: 2.0 },
  { fruchtart: "Winterweizen C",   ertragsBasisDtHa: 80, nBedarfBasis: 210, ertragsAnpassung: 2.0 },
  { fruchtart: "Wintergerste",     ertragsBasisDtHa: 70, nBedarfBasis: 180, ertragsAnpassung: 1.5 },
  { fruchtart: "Winterroggen",     ertragsBasisDtHa: 70, nBedarfBasis: 170, ertragsAnpassung: 1.5 },
  { fruchtart: "Triticale",        ertragsBasisDtHa: 70, nBedarfBasis: 190, ertragsAnpassung: 1.5 },
  { fruchtart: "Hafer",            ertragsBasisDtHa: 55, nBedarfBasis: 130, ertragsAnpassung: 1.5 },
  { fruchtart: "Sommergerste",     ertragsBasisDtHa: 55, nBedarfBasis: 140, ertragsAnpassung: 1.5 },
  { fruchtart: "Sommerweizen",     ertragsBasisDtHa: 65, nBedarfBasis: 190, ertragsAnpassung: 2.0 },
  { fruchtart: "Winterraps",       ertragsBasisDtHa: 40, nBedarfBasis: 200, ertragsAnpassung: 1.5 },
  { fruchtart: "Sommerraps",       ertragsBasisDtHa: 30, nBedarfBasis: 150, ertragsAnpassung: 1.5 },
  { fruchtart: "Körnermais",       ertragsBasisDtHa: 90, nBedarfBasis: 200, ertragsAnpassung: 1.5 },
  { fruchtart: "Silomais",         ertragsBasisDtHa: 450, nBedarfBasis: 200, ertragsAnpassung: 0.2 },
  { fruchtart: "Zuckerrübe",       ertragsBasisDtHa: 650, nBedarfBasis: 170, ertragsAnpassung: 0.1 },
  { fruchtart: "Kartoffel",        ertragsBasisDtHa: 450, nBedarfBasis: 180, ertragsAnpassung: 0.2 },
  { fruchtart: "Grünland (3 Schnitte)", ertragsBasisDtHa: 80, nBedarfBasis: 200, ertragsAnpassung: 2.5 },
  { fruchtart: "Grünland (4 Schnitte)", ertragsBasisDtHa: 100, nBedarfBasis: 250, ertragsAnpassung: 2.5 },
  { fruchtart: "Ackergras",        ertragsBasisDtHa: 70, nBedarfBasis: 200, ertragsAnpassung: 2.5 },
  { fruchtart: "Sonnenblume",      ertragsBasisDtHa: 30, nBedarfBasis: 120, ertragsAnpassung: 1.5 },
  { fruchtart: "Erbse",            ertragsBasisDtHa: 40, nBedarfBasis: 0,   ertragsAnpassung: 0 },
  { fruchtart: "Ackerbohne",       ertragsBasisDtHa: 50, nBedarfBasis: 0,   ertragsAnpassung: 0 },
];

// Vorfrucht-Bonus (kg N/ha) — vereinfacht, DüV Anlage 4 Tab. 4
export const VORFRUCHT_ABZUG: Record<string, number> = {
  "Raps": 10,
  "Winterraps": 10,
  "Erbse": 20,
  "Ackerbohne": 30,
  "Lupine": 30,
  "Klee": 30,
  "Luzerne": 40,
  "Kleegras": 30,
  "Zwischenfrucht (abgefroren)": 10,
  "Zwischenfrucht (Leguminose)": 20,
  "Kartoffel": 10,
  "Zuckerrübe": 10,
};

// P/K-Bedarfswerte (kg/ha) je dt Ertrag — DüV Anlage 4 Tab. 7
export const PK_FAKTOREN: Record<string, { p: number; k: number; mg?: number }> = {
  "Winterweizen A/B": { p: 0.8, k: 0.55, mg: 0.13 },
  "Winterweizen E":   { p: 0.8, k: 0.55, mg: 0.13 },
  "Winterweizen C":   { p: 0.8, k: 0.55, mg: 0.13 },
  "Wintergerste":     { p: 0.8, k: 0.55, mg: 0.13 },
  "Winterroggen":     { p: 0.8, k: 0.6,  mg: 0.13 },
  "Triticale":        { p: 0.8, k: 0.6,  mg: 0.13 },
  "Hafer":            { p: 0.8, k: 0.6,  mg: 0.13 },
  "Sommergerste":     { p: 0.8, k: 0.55, mg: 0.13 },
  "Sommerweizen":     { p: 0.8, k: 0.55, mg: 0.13 },
  "Winterraps":       { p: 1.8, k: 1.0,  mg: 0.35 },
  "Sommerraps":       { p: 1.8, k: 1.0,  mg: 0.35 },
  "Körnermais":       { p: 0.8, k: 0.4,  mg: 0.15 },
  "Silomais":         { p: 0.18, k: 0.45, mg: 0.1 },
  "Zuckerrübe":       { p: 0.10, k: 0.20, mg: 0.1 },
  "Kartoffel":        { p: 0.14, k: 0.55, mg: 0.04 },
  "Grünland (3 Schnitte)": { p: 0.8, k: 2.5, mg: 0.3 },
  "Grünland (4 Schnitte)": { p: 0.8, k: 2.5, mg: 0.3 },
  "Ackergras":             { p: 0.8, k: 2.5, mg: 0.3 },
  "Sonnenblume":           { p: 1.6, k: 1.5, mg: 0.3 },
  "Erbse":                 { p: 1.1, k: 1.4, mg: 0.13 },
  "Ackerbohne":            { p: 1.1, k: 1.4, mg: 0.13 },
};

// Versorgungsklassen nach LWK Niedersachsen (A–F, IfB/LUFA-Format) bzw. VDLUFA (A–E).
// Korrekturfaktor: Klasse C = Entzugsdüngung; B/A = Aufdüngung; D/E/F = Düngung reduzieren/aussetzen.
export const VERSORGUNG_KORREKTUR: Record<string, number> = {
  A: 1.25,
  B: 1.10,
  C: 1.00,
  D: 0.75,
  E: 0.00,
  F: 0.00, // extrem hoch — keine Düngung
};

// Gültige Klassen-Buchstaben (IfB nutzt A–F, klassisch VDLUFA nur A–E)
export const GUELTIGE_KLASSEN = ["A", "B", "C", "D", "E", "F"] as const;

export type BedarfEingaben = {
  fruchtart: string;
  ertragsZiel?: number | null;       // dt/ha
  vorfrucht?: string | null;
  nMin?: number | null;              // kg N/ha
  organischeDuengungVorjahrN?: number | null; // kg N/ha
  versorgungsklasseP?: string | null; // A-E
  versorgungsklasseK?: string | null;
  versorgungsklasseMg?: string | null;
  zwischenfruchtAngebaut?: boolean;
};

export type BedarfErgebnis = {
  fruchtart: string;
  ertragsZiel: number;
  nBedarf: number;
  pBedarf: number;
  kBedarf: number;
  mgBedarf: number;
  rechenweg: {
    nBasis: number;
    nErtragsKorrektur: number;
    nMinAbzug: number;
    nVorfruchtAbzug: number;
    nOrgDungAbzug: number;
    nZwischenfruchtAbzug: number;
    pBasis: number;
    pKorrektur: number;
    kBasis: number;
    kKorrektur: number;
    mgBasis: number;
    mgKorrektur: number;
  };
  hinweise: string[];
};

export function berechneDuengebedarf(e: BedarfEingaben): BedarfErgebnis {
  const hinweise: string[] = [];
  const eintrag = NBEDARF_TABELLE.find(f => f.fruchtart === e.fruchtart);
  if (!eintrag) {
    throw new Error(`Unbekannte Fruchtart: ${e.fruchtart}`);
  }

  const ertragsZiel = Number(e.ertragsZiel) || eintrag.ertragsBasisDtHa;
  const nBasis = eintrag.nBedarfBasis;
  const nErtragsKorrektur = (ertragsZiel - eintrag.ertragsBasisDtHa) * (eintrag.ertragsAnpassung ?? 0);

  const nMinAbzug = Math.max(0, Number(e.nMin) || 0);
  if (e.nMin == null) hinweise.push("Keine Nmin-Probe vorhanden — pauschale Werte können überschätzen.");

  const nVorfruchtAbzug = e.vorfrucht ? (VORFRUCHT_ABZUG[e.vorfrucht] ?? 0) : 0;
  const nOrgDungAbzug = Math.max(0, Number(e.organischeDuengungVorjahrN) || 0) * 0.1;
  const nZwischenfruchtAbzug = e.zwischenfruchtAngebaut ? 10 : 0;

  let nBedarf = nBasis + nErtragsKorrektur - nMinAbzug - nVorfruchtAbzug - nOrgDungAbzug - nZwischenfruchtAbzug;
  if (nBedarf < 0) {
    hinweise.push("Rechnerischer Bedarf negativ — keine N-Düngung erforderlich.");
    nBedarf = 0;
  }

  const pk = PK_FAKTOREN[e.fruchtart] ?? { p: 0, k: 0, mg: 0 };
  const pBasis = pk.p * ertragsZiel;
  const pKorrektur = VERSORGUNG_KORREKTUR[e.versorgungsklasseP ?? "C"] ?? 1.0;
  const pBedarf = pBasis * pKorrektur;

  const kBasis = pk.k * ertragsZiel;
  const kKorrektur = VERSORGUNG_KORREKTUR[e.versorgungsklasseK ?? "C"] ?? 1.0;
  const kBedarf = kBasis * kKorrektur;

  const mgBasis = (pk.mg ?? 0) * ertragsZiel;
  const mgKorrektur = VERSORGUNG_KORREKTUR[e.versorgungsklasseMg ?? "C"] ?? 1.0;
  const mgBedarf = mgBasis * mgKorrektur;

  if (e.versorgungsklasseP === "E") hinweise.push("P-Versorgungsklasse E → keine P-Düngung empfohlen.");
  if (e.versorgungsklasseK === "E") hinweise.push("K-Versorgungsklasse E → keine K-Düngung empfohlen.");

  return {
    fruchtart: e.fruchtart,
    ertragsZiel,
    nBedarf: Math.round(nBedarf),
    pBedarf: Math.round(pBedarf),
    kBedarf: Math.round(kBedarf),
    mgBedarf: Math.round(mgBedarf),
    rechenweg: {
      nBasis,
      nErtragsKorrektur: Math.round(nErtragsKorrektur),
      nMinAbzug,
      nVorfruchtAbzug,
      nOrgDungAbzug,
      nZwischenfruchtAbzug,
      pBasis: Math.round(pBasis),
      pKorrektur,
      kBasis: Math.round(kBasis),
      kKorrektur,
      mgBasis: Math.round(mgBasis),
      mgKorrektur,
    },
    hinweise,
  };
}

// Bodenprobe → automatische Versorgungsklassen-Ableitung nach VDLUFA / LWK Niedersachsen
// Grenzwerte für P2O5 / K2O in mg/100g (CAL) — leichter Boden
export function ableiteVersorgungsklasseP(phosphor: number | null | undefined): string | null {
  if (phosphor == null) return null;
  if (phosphor < 3) return "A";
  if (phosphor < 6) return "B";
  if (phosphor < 12) return "C";
  if (phosphor < 20) return "D";
  if (phosphor < 35) return "E";
  return "F";
}

export function ableiteVersorgungsklasseK(kalium: number | null | undefined): string | null {
  if (kalium == null) return null;
  if (kalium < 5) return "A";
  if (kalium < 10) return "B";
  if (kalium < 20) return "C";
  if (kalium < 30) return "D";
  if (kalium < 45) return "E";
  return "F";
}

export function ableiteVersorgungsklasseMg(magnesium: number | null | undefined): string | null {
  if (magnesium == null) return null;
  if (magnesium < 3) return "A";
  if (magnesium < 5) return "B";
  if (magnesium < 8) return "C";
  if (magnesium < 12) return "D";
  if (magnesium < 18) return "E";
  return "F";
}

// Natrium (Na) in mg/kg (CAT) — Grünland/Acker, Richtwerte LWK
export function ableiteVersorgungsklasseNatrium(natrium: number | null | undefined): string | null {
  if (natrium == null) return null;
  if (natrium < 3) return "A";
  if (natrium < 6) return "B";
  if (natrium < 12) return "C";
  if (natrium < 20) return "D";
  if (natrium < 35) return "E";
  return "F";
}

// Bor in mg/kg (Heißwasser-extrahierbar) — VDLUFA-Richtwerte
export function ableiteVersorgungsklasseBor(bor: number | null | undefined): string | null {
  if (bor == null) return null;
  if (bor < 0.2) return "A";
  if (bor < 0.4) return "B";
  if (bor < 0.8) return "C";
  if (bor < 1.5) return "D";
  return "E";
}

// Schwefel als SO₃ in mg/100g (CAT) — VDLUFA-/LfL-Richtwerte
export function ableiteVersorgungsklasseSchwefel(schwefel: number | null | undefined): string | null {
  if (schwefel == null) return null;
  if (schwefel < 1) return "A";
  if (schwefel < 2) return "B";
  if (schwefel < 4) return "C";
  if (schwefel < 8) return "D";
  return "E";
}

// Zink in mg/kg (CAT) — VDLUFA
export function ableiteVersorgungsklasseZink(zink: number | null | undefined): string | null {
  if (zink == null) return null;
  if (zink < 1) return "A";
  if (zink < 2) return "B";
  if (zink < 4) return "C";
  if (zink < 8) return "D";
  return "E";
}

// Kupfer in mg/kg (CAT) — VDLUFA
export function ableiteVersorgungsklasseKupfer(kupfer: number | null | undefined): string | null {
  if (kupfer == null) return null;
  if (kupfer < 0.6) return "A";
  if (kupfer < 1.5) return "B";
  if (kupfer < 4) return "C";
  if (kupfer < 8) return "D";
  return "E";
}

// Mangan in mg/kg (CAT) — VDLUFA
export function ableiteVersorgungsklasseMangan(mangan: number | null | undefined): string | null {
  if (mangan == null) return null;
  if (mangan < 20) return "A";
  if (mangan < 40) return "B";
  if (mangan < 80) return "C";
  if (mangan < 150) return "D";
  return "E";
}

// Kalkbedarf t CaO/ha aus pH und Bodenart (vereinfachte LfL-Tabelle).
// Ergebnis: nicht-negative t CaO/ha (0 = kein Bedarf).
export function berechneKalkbedarf(pH: number | null | undefined, bodenart: string | null | undefined): number | null {
  if (pH == null) return null;
  // pH-Sollwerte je Bodenart (annähernd)
  const SOLL: Record<string, number> = {
    "S": 5.5, "lS": 5.8, "sL": 6.2, "L": 6.5, "T": 6.8, "Mo": 4.8,
  };
  const soll = bodenart && SOLL[bodenart] != null ? SOLL[bodenart] : 6.2;
  const delta = soll - pH;
  if (delta <= 0) return 0;
  // ~1 t CaO/ha hebt pH um 0,2–0,3 (Bodenart-abhängig); Faktor 5 t / pH-Stufe.
  const faktor = bodenart === "S" || bodenart === "lS" ? 3.5 : bodenart === "T" || bodenart === "Mo" ? 8 : 5;
  return Math.round(delta * faktor * 10) / 10;
}

export const FRUCHTARTEN_DUEV = NBEDARF_TABELLE.map(t => t.fruchtart);
