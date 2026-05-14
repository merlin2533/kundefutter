// Rationsberechnung — Rechenkern für Futterrationen aller Tierarten.
//
// Aufbau analog zu lib/duengebedarf.ts: reine Funktionen, keine I/O.
// Eine Ration ist eine Liste von Futterpositionen (Frischmasse-kg + Nähr-/
// Mineralstoffgehalte je kg Trockenmasse). Der Kern summiert die Aufnahme,
// vergleicht sie mit dem Bedarf (lib/tierbedarf.ts) und liefert die Bilanz
// inkl. Ca:P-Verhältnis, limitierender Aminosäuren, Magnesium und — bei
// Wiederkäuern — der ruminalen N-Bilanz (RNB).

import {
  berechneTierbedarf,
  type BedarfEingabe,
  type BedarfErgebnis,
  type BedarfWerte,
  type TierartKey,
} from "./tierbedarf";

// Nähr-/Mineralstoffwerte je kg Trockenmasse einer Futterposition.
export type NaehrstoffWerte = {
  me?: number;          // MJ ME / kg TM
  nel?: number;         // MJ NEL / kg TM
  rohprotein?: number;  // g XP / kg TM
  nxp?: number;         // g nXP / kg TM
  dp?: number;          // g verd. Rohprotein / kg TM (Pferd)
  rohfaser?: number;    // g XF / kg TM
  andfom?: number;      // g aNDFom / kg TM
  lysin?: number;       // g / kg TM
  methionin?: number;   // g / kg TM
  ca?: number;          // g / kg TM
  p?: number;           // g / kg TM
  mg?: number;          // g / kg TM
  na?: number;          // g / kg TM
};

export type Futterstufe = "GF" | "AF" | "LF"; // Grund-, Ausgleichs-, Leistungsfutter

export type RationsPosition = {
  futter: string;                 // Anzeigename
  quelle: "standard" | "artikel" | "manuell";
  futterId?: string;              // Referenz lib/futterwerte.ts
  artikelId?: number;             // Referenz Artikel
  fmKg: number;                   // Frischmasse kg / Tier / Tag
  tmGehalt: number;               // g TM / kg FM
  werte: NaehrstoffWerte;         // je kg TM (bereits aufgelöst)
  stufe?: Futterstufe;            // optional, für detaillierten Milchvieh-Modus
};

export type RationsEingabe = {
  tierart: TierartKey;
  nutzungsart: string;
  modus: "simple" | "detail";
  gewicht?: number | null;
  leistung?: number | null;
  fettProzent?: number | null;
  eiweissProzent?: number | null;
  positionen: RationsPosition[];
  manuellerBedarf?: Partial<BedarfWerte> | null;
};

export type PositionsErgebnis = {
  futter: string;
  stufe?: Futterstufe;
  fmKg: number;
  tmKg: number;
  anteil: number;                 // % an der TM-Aufnahme
  beitrag: NaehrstoffWerte;       // absolute Beiträge zur Ration
};

export type AminosaeureBewertung = {
  naehrstoff: "lysin" | "methionin";
  aufnahme: number | null;
  bedarf: number | null;
  deckung: number | null;         // %
  status: "ok" | "knapp" | "mangel" | "ohne_bedarf";
};

export type RationsErgebnis = {
  tierart: TierartKey;
  nutzungsart: string;
  modus: "simple" | "detail";
  tmAufnahme: number;             // kg TM / Tier / Tag
  summe: NaehrstoffWerte;         // aufsummierte Aufnahme
  bedarf: BedarfWerte;
  bilanz: NaehrstoffWerte;        // Aufnahme − Bedarf
  deckung: Partial<Record<keyof NaehrstoffWerte, number>>; // % je Nährstoff
  caPVerhaeltnis: number | null;  // Ca : P
  rohfaserAnteil: number | null;  // % der TM
  andfomAnteil: number | null;    // % der TM
  rnb: number | null;             // g — nur Wiederkäuer
  aminosaeuren: AminosaeureBewertung[];
  positionen: PositionsErgebnis[];
  rechenweg: { schritt: string; wert: number; einheit: string }[];
  hinweise: string[];
  // detaillierter Modus: Stufen-Zwischensummen (Milchvieh GF/AF/LF)
  stufen?: { stufe: Futterstufe; label: string; tmKg: number; summe: NaehrstoffWerte }[];
};

const NAEHRSTOFF_KEYS: (keyof NaehrstoffWerte)[] = [
  "me", "nel", "rohprotein", "nxp", "dp", "rohfaser",
  "andfom", "lysin", "methionin", "ca", "p", "mg", "na",
];

const WIEDERKAEUER: TierartKey[] = ["Rind", "Schaf", "Ziege"];

function leeresProfil(): NaehrstoffWerte {
  const o: NaehrstoffWerte = {};
  for (const k of NAEHRSTOFF_KEYS) o[k] = 0;
  return o;
}

function runde2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Hauptfunktion: berechnet eine Ration für beliebige Tierart.
 * `modus: "detail"` liefert zusätzlich Stufen-Zwischensummen (GF/AF/LF).
 */
export function berechneRation(e: RationsEingabe): RationsErgebnis {
  const hinweise: string[] = [];
  const rechenweg: RationsErgebnis["rechenweg"] = [];

  // ── 1. Positionen aufsummieren ──────────────────────────────────────────
  const summe = leeresProfil();
  let tmAufnahme = 0;
  const posErgebnisse: PositionsErgebnis[] = [];

  for (const pos of e.positionen) {
    const fmKg = Number(pos.fmKg) || 0;
    const tmGehalt = Number(pos.tmGehalt) || 0;
    const tmKg = (fmKg * tmGehalt) / 1000;
    tmAufnahme += tmKg;

    const beitrag: NaehrstoffWerte = {};
    for (const k of NAEHRSTOFF_KEYS) {
      const proKgTm = Number(pos.werte[k]) || 0;
      const wert = tmKg * proKgTm;
      beitrag[k] = runde2(wert);
      summe[k] = (summe[k] ?? 0) + wert;
    }
    posErgebnisse.push({
      futter: pos.futter,
      stufe: pos.stufe,
      fmKg: runde2(fmKg),
      tmKg: runde2(tmKg),
      anteil: 0, // unten gesetzt
      beitrag,
    });
  }
  for (const p of posErgebnisse) {
    p.anteil = tmAufnahme > 0 ? Math.round((p.tmKg / tmAufnahme) * 1000) / 10 : 0;
  }
  for (const k of NAEHRSTOFF_KEYS) summe[k] = runde2(summe[k] ?? 0);
  rechenweg.push({ schritt: "TM-Aufnahme gesamt", wert: runde2(tmAufnahme), einheit: "kg TM" });

  // ── 2. Bedarf ermitteln ─────────────────────────────────────────────────
  const bedarfEingabe: BedarfEingabe = {
    tierart: e.tierart,
    nutzungsart: e.nutzungsart,
    gewicht: e.gewicht,
    leistung: e.leistung,
    fettProzent: e.fettProzent,
    eiweissProzent: e.eiweissProzent,
    manuellerBedarf: e.manuellerBedarf,
  };
  const bedarfErg: BedarfErgebnis = berechneTierbedarf(bedarfEingabe);
  const bedarf = bedarfErg.werte;
  hinweise.push(...bedarfErg.hinweise);
  for (const r of bedarfErg.rechenweg) rechenweg.push(r);

  // ── 3. Bilanz + Deckungsgrad ────────────────────────────────────────────
  const bilanz: NaehrstoffWerte = {};
  const deckung: RationsErgebnis["deckung"] = {};
  for (const k of NAEHRSTOFF_KEYS) {
    const auf = summe[k] ?? 0;
    const bed = (bedarf as Record<string, number>)[k];
    if (bed == null) continue;
    bilanz[k] = runde2(auf - bed);
    deckung[k] = bed > 0 ? Math.round((auf / bed) * 1000) / 10 : null as unknown as number;
  }

  // TM-Bilanz separat
  const tmBilanz = runde2(tmAufnahme - (bedarf.tmBedarf ?? 0));
  rechenweg.push({ schritt: "TM-Bedarf", wert: bedarf.tmBedarf ?? 0, einheit: "kg TM" });
  rechenweg.push({ schritt: "TM-Bilanz", wert: tmBilanz, einheit: "kg TM" });
  if (bedarf.tmBedarf && tmAufnahme < bedarf.tmBedarf * 0.9) {
    hinweise.push(`TM-Aufnahme (${runde2(tmAufnahme)} kg) liegt deutlich unter dem Bedarf (${bedarf.tmBedarf} kg) — Ration füllt das Tier nicht aus.`);
  } else if (bedarf.tmBedarf && tmAufnahme > bedarf.tmBedarf * 1.15) {
    hinweise.push(`TM-Aufnahme (${runde2(tmAufnahme)} kg) liegt über dem Bedarf — Aufnahmekapazität prüfen.`);
  }

  // ── 4. Qualitätsindikatoren ─────────────────────────────────────────────
  // Ca:P-Verhältnis
  const caPVerhaeltnis = summe.p && summe.p > 0 ? Math.round((summe.ca! / summe.p) * 100) / 100 : null;
  if (caPVerhaeltnis != null) {
    rechenweg.push({ schritt: "Ca:P-Verhältnis", wert: caPVerhaeltnis, einheit: ":1" });
    const [min, max] = caPSollbereich(e.tierart);
    if (caPVerhaeltnis < min) {
      hinweise.push(`Ca:P-Verhältnis ${caPVerhaeltnis}:1 zu eng — Soll ${min}:1 bis ${max}:1. Calciumquelle ergänzen.`);
    } else if (caPVerhaeltnis > max) {
      hinweise.push(`Ca:P-Verhältnis ${caPVerhaeltnis}:1 zu weit — Soll ${min}:1 bis ${max}:1. Phosphorzufuhr prüfen.`);
    }
  }

  // Rohfaser- / aNDFom-Anteil an der TM
  const rohfaserAnteil = tmAufnahme > 0 && summe.rohfaser != null
    ? Math.round((summe.rohfaser / (tmAufnahme * 1000)) * 1000) / 10 : null;
  const andfomAnteil = tmAufnahme > 0 && summe.andfom != null
    ? Math.round((summe.andfom / (tmAufnahme * 1000)) * 1000) / 10 : null;
  if (e.tierart === "Pferd" && rohfaserAnteil != null && rohfaserAnteil < 18) {
    hinweise.push(`Rohfaseranteil ${rohfaserAnteil} % der TM — beim Pferd mind. 18 % anstreben (Verdauungsgesundheit).`);
  }
  if (WIEDERKAEUER.includes(e.tierart) && andfomAnteil != null && andfomAnteil < 28) {
    hinweise.push(`aNDFom-Anteil ${andfomAnteil} % der TM — bei Wiederkäuern Strukturversorgung knapp (Pansengesundheit).`);
  }

  // RNB (ruminale N-Bilanz) — nur Wiederkäuer
  let rnb: number | null = null;
  if (WIEDERKAEUER.includes(e.tierart) && summe.rohprotein != null && summe.nxp != null) {
    rnb = Math.round(((summe.rohprotein - summe.nxp) / 6.25) * 10) / 10;
    rechenweg.push({ schritt: "RNB = (XP − nXP) / 6,25", wert: rnb, einheit: "g" });
    if (rnb < -10) {
      hinweise.push(`RNB ${rnb} g negativ — Pansen-Stickstoffmangel, Abbau der Grobfutterverdauung möglich.`);
    } else if (rnb > 50) {
      hinweise.push(`RNB ${rnb} g hoch — N-Überschuss, Harnstoffbelastung; Eiweißfutter reduzieren.`);
    }
  }

  // Magnesium-Hinweis (Anforderung: bei Pferd explizit)
  if (bilanz.mg != null && bilanz.mg < 0) {
    hinweise.push(`Magnesium unterversorgt (Bilanz ${bilanz.mg} g) — ${e.tierart === "Pferd" ? "beim Pferd v.a. bei nervösen/leistungsbeanspruchten Tieren kritisch" : "Mineralfutter anpassen"}.`);
  }

  // Limitierende Aminosäuren (v.a. Schwein, Geflügel)
  const aminosaeuren: AminosaeureBewertung[] = (["lysin", "methionin"] as const).map((as) => {
    const aufnahme = summe[as] ?? null;
    const bed = (bedarf as Record<string, number>)[as] ?? null;
    if (bed == null || bed === 0) {
      return { naehrstoff: as, aufnahme, bedarf: bed, deckung: null, status: "ohne_bedarf" as const };
    }
    const d = aufnahme != null ? Math.round((aufnahme / bed) * 1000) / 10 : null;
    let status: AminosaeureBewertung["status"] = "ok";
    if (d == null) status = "mangel";
    else if (d < 90) status = "mangel";
    else if (d < 100) status = "knapp";
    return { naehrstoff: as, aufnahme, bedarf: bed, deckung: d, status };
  });
  for (const as of aminosaeuren) {
    if (as.status === "mangel") {
      hinweise.push(`${as.naehrstoff === "lysin" ? "Lysin" : "Methionin"} unterversorgt (${as.deckung ?? 0} % Bedarfsdeckung) — limitierende Aminosäure, Leistung wird begrenzt.`);
    }
  }

  // Energie-/Protein-Hauptbilanz als Hinweis
  const energieKey: keyof NaehrstoffWerte = WIEDERKAEUER.includes(e.tierart) && bedarf.nel != null ? "nel" : "me";
  if (bilanz[energieKey] != null && bilanz[energieKey]! < 0) {
    hinweise.push(`Energie unterversorgt (Bilanz ${bilanz[energieKey]} ${energieKey === "nel" ? "MJ NEL" : "MJ ME"}) — Leistung nicht abgesichert.`);
  }
  const proteinKey: keyof NaehrstoffWerte = bedarf.nxp != null ? "nxp" : (bedarf.rohprotein != null ? "rohprotein" : "dp");
  if (bilanz[proteinKey] != null && bilanz[proteinKey]! < 0) {
    hinweise.push(`Protein unterversorgt (Bilanz ${bilanz[proteinKey]} g) — Eiweißfutter ergänzen.`);
  }

  // ── 5. Detaillierter Modus: Stufen-Zwischensummen ───────────────────────
  let stufen: RationsErgebnis["stufen"];
  if (e.modus === "detail") {
    const stufenDef: { stufe: Futterstufe; label: string }[] = [
      { stufe: "GF", label: "Grundfutter" },
      { stufe: "AF", label: "Ausgleichsfutter" },
      { stufe: "LF", label: "Leistungsfutter" },
    ];
    stufen = [];
    for (const sd of stufenDef) {
      const posDerStufe = e.positionen.filter((p) => (p.stufe ?? "GF") === sd.stufe);
      if (posDerStufe.length === 0) continue;
      const s = leeresProfil();
      let tm = 0;
      for (const pos of posDerStufe) {
        const tmKg = (Number(pos.fmKg) || 0) * (Number(pos.tmGehalt) || 0) / 1000;
        tm += tmKg;
        for (const k of NAEHRSTOFF_KEYS) {
          s[k] = (s[k] ?? 0) + tmKg * (Number(pos.werte[k]) || 0);
        }
      }
      for (const k of NAEHRSTOFF_KEYS) s[k] = runde2(s[k] ?? 0);
      stufen.push({ stufe: sd.stufe, label: sd.label, tmKg: runde2(tm), summe: s });
    }
    if (stufen.length > 1) {
      hinweise.push("Detaillierter Modus: Ration nach Grund-/Ausgleichs-/Leistungsfutter gestaffelt. Zwischensummen je Stufe ausgewiesen.");
    }
  }

  return {
    tierart: e.tierart,
    nutzungsart: e.nutzungsart,
    modus: e.modus,
    tmAufnahme: runde2(tmAufnahme),
    summe,
    bedarf,
    bilanz,
    deckung,
    caPVerhaeltnis,
    rohfaserAnteil,
    andfomAnteil,
    rnb,
    aminosaeuren,
    positionen: posErgebnisse,
    rechenweg,
    hinweise,
    stufen,
  };
}

/** Ca:P-Sollbereich je Tierart (min, max). */
function caPSollbereich(tierart: TierartKey): [number, number] {
  switch (tierart) {
    case "Pferd":    return [1.2, 2.0];
    case "Schwein":  return [1.0, 1.5];
    case "Geflugel": return [1.5, 6.0]; // Legehennen sehr Ca-betont
    default:         return [1.5, 2.5]; // Wiederkäuer
  }
}

/** Label für die Energie-Einheit je Tierart (UI-Helfer). */
export function energieEinheit(tierart: TierartKey): "MJ NEL" | "MJ ME" {
  return WIEDERKAEUER.includes(tierart) ? "MJ NEL" : "MJ ME";
}

export const NAEHRSTOFF_LABELS: Record<keyof NaehrstoffWerte, string> = {
  me: "Energie (ME)",
  nel: "Energie (NEL)",
  rohprotein: "Rohprotein (XP)",
  nxp: "nutzbares Rohprotein (nXP)",
  dp: "verd. Rohprotein (DP)",
  rohfaser: "Rohfaser (XF)",
  andfom: "aNDFom",
  lysin: "Lysin",
  methionin: "Methionin",
  ca: "Calcium (Ca)",
  p: "Phosphor (P)",
  mg: "Magnesium (Mg)",
  na: "Natrium (Na)",
};

export const NAEHRSTOFF_EINHEITEN: Record<keyof NaehrstoffWerte, string> = {
  me: "MJ", nel: "MJ", rohprotein: "g", nxp: "g", dp: "g", rohfaser: "g",
  andfom: "g", lysin: "g", methionin: "g", ca: "g", p: "g", mg: "g", na: "g",
};
