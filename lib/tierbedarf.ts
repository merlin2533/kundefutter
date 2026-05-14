// Tierbedarf — Ernährungs-Zielwerte (Bedarf) je Tierart und Nutzungsart.
//
// Orientierungswerte angelehnt an GfE-Versorgungsempfehlungen, LfL-Rationsrechner
// (Pferd, Milchvieh, wachsende Rinder) und DLG. Werte sind TAGESBEDARF je Tier.
//
// WICHTIG: Hinweiswerte für die Praxis — keine tierärztliche/fütterungs-
// beraterische Empfehlung. Für exakte Rationen Fachberatung hinzuziehen.

export type BedarfWerte = {
  tmBedarf: number;        // kg TM / Tier / Tag
  me?: number;             // MJ ME / Tag
  nel?: number;            // MJ NEL / Tag
  rohprotein?: number;     // g XP / Tag
  nxp?: number;            // g nutzbares Rohprotein / Tag
  dp?: number;             // g verdauliches Rohprotein / Tag (Pferd)
  rohfaser?: number;       // g XF / Tag (Mindestwert Struktur)
  andfom?: number;         // g aNDFom / Tag (Mindestwert Struktur)
  lysin?: number;          // g / Tag
  methionin?: number;      // g / Tag
  ca?: number;             // g / Tag
  p?: number;              // g / Tag
  mg?: number;             // g / Tag
  na?: number;             // g / Tag
};

export type TierartKey = "Rind" | "Schwein" | "Geflugel" | "Pferd" | "Schaf" | "Ziege";

export type BedarfEingabe = {
  tierart: TierartKey;
  nutzungsart: string;
  gewicht?: number | null;        // kg Lebendgewicht
  leistung?: number | null;       // Milch kg/Tag | tgl. Zunahme g | Eier/Tag …
  fettProzent?: number | null;    // Milchvieh
  eiweissProzent?: number | null; // Milchvieh
  manuellerBedarf?: Partial<BedarfWerte> | null; // Override einzelner Werte
};

export type BedarfErgebnis = {
  werte: BedarfWerte;
  rechenweg: { schritt: string; wert: number; einheit: string }[];
  hinweise: string[];
};

// ─── Nutzungsarten je Tierart ────────────────────────────────────────────────

export const NUTZUNGSARTEN: Record<TierartKey, string[]> = {
  Rind: [
    "Milchkuh laktierend",
    "Milchkuh trockenstehend",
    "Mastrind",
    "Jungvieh / Aufzucht",
    "Mutterkuh säugend",
  ],
  Schwein: [
    "Mastschwein Anfangsmast",
    "Mastschwein Endmast",
    "Zuchtsau tragend",
    "Zuchtsau laktierend",
    "Ferkel / Aufzucht",
  ],
  Geflugel: [
    "Legehenne",
    "Masthuhn / Broiler",
    "Junghenne / Aufzucht",
  ],
  Pferd: [
    "Warmblut Erhaltung",
    "Warmblut leichte Arbeit",
    "Warmblut mittlere Arbeit",
    "Warmblut schwere Arbeit",
    "Vollblut",
    "Pony",
    "Zuchtstute laktierend",
  ],
  Schaf: [
    "Mutterschaf säugend",
    "Mutterschaf tragend",
    "Mastlamm",
  ],
  Ziege: [
    "Milchziege laktierend",
    "Milchziege trockenstehend",
    "Mastziege",
  ],
};

export const TIERARTEN: { key: TierartKey; label: string; leistungLabel?: string }[] = [
  { key: "Rind", label: "Rind", leistungLabel: "Milch kg/Tag bzw. tgl. Zunahme g" },
  { key: "Schwein", label: "Schwein", leistungLabel: "tägliche Zunahme g / Ferkelzahl" },
  { key: "Geflugel", label: "Geflügel", leistungLabel: "Eier/Tag bzw. tgl. Zunahme g" },
  { key: "Pferd", label: "Pferd", leistungLabel: "—" },
  { key: "Schaf", label: "Schaf", leistungLabel: "Lämmerzahl / tgl. Zunahme g" },
  { key: "Ziege", label: "Ziege", leistungLabel: "Milch kg/Tag" },
];

// ─── Helfer ──────────────────────────────────────────────────────────────────

/** Metabolisches Körpergewicht LW^0.75 */
function lw075(gewicht: number): number {
  return Math.pow(gewicht, 0.75);
}

/** Lineare Interpolation in einer nach `gewicht` sortierten Stützstellen-Tabelle. */
function interpoliere(
  tabelle: { gewicht: number; werte: BedarfWerte }[],
  gewicht: number,
): BedarfWerte {
  if (gewicht <= tabelle[0].gewicht) return { ...tabelle[0].werte };
  const last = tabelle[tabelle.length - 1];
  if (gewicht >= last.gewicht) return { ...last.werte };
  for (let i = 0; i < tabelle.length - 1; i++) {
    const a = tabelle[i], b = tabelle[i + 1];
    if (gewicht >= a.gewicht && gewicht <= b.gewicht) {
      const t = (gewicht - a.gewicht) / (b.gewicht - a.gewicht);
      const out: BedarfWerte = { tmBedarf: 0 };
      const keys = new Set([...Object.keys(a.werte), ...Object.keys(b.werte)]);
      for (const k of keys) {
        const av = (a.werte as Record<string, number>)[k] ?? 0;
        const bv = (b.werte as Record<string, number>)[k] ?? 0;
        (out as Record<string, number>)[k] = av + (bv - av) * t;
      }
      return out;
    }
  }
  return { ...last.werte };
}

function runde(w: BedarfWerte): BedarfWerte {
  const out: BedarfWerte = { tmBedarf: Math.round(w.tmBedarf * 100) / 100 };
  for (const [k, v] of Object.entries(w)) {
    if (k === "tmBedarf" || v == null) continue;
    (out as Record<string, number>)[k] = Math.round((v as number) * 10) / 10;
  }
  return out;
}

// ─── Rind ────────────────────────────────────────────────────────────────────

// Mastrind: Stützstellen bei ~1200–1400 g tgl. Zunahme (ME MJ, XP g, Mineralstoffe g)
const MASTRIND_TABELLE: { gewicht: number; werte: BedarfWerte }[] = [
  { gewicht: 150, werte: { tmBedarf: 4.2, me: 48, rohprotein: 700, nxp: 560, andfom: 1100, ca: 33, p: 16, mg: 6, na: 5 } },
  { gewicht: 250, werte: { tmBedarf: 5.8, me: 68, rohprotein: 805, nxp: 640, andfom: 1450, ca: 46, p: 22, mg: 8, na: 8 } },
  { gewicht: 350, werte: { tmBedarf: 7.5, me: 85, rohprotein: 850, nxp: 700, andfom: 1900, ca: 50, p: 26, mg: 11, na: 10 } },
  { gewicht: 450, werte: { tmBedarf: 9.0, me: 100, rohprotein: 900, nxp: 760, andfom: 2300, ca: 52, p: 30, mg: 14, na: 12 } },
  { gewicht: 550, werte: { tmBedarf: 10.0, me: 110, rohprotein: 950, nxp: 800, andfom: 2600, ca: 55, p: 33, mg: 16, na: 14 } },
  { gewicht: 700, werte: { tmBedarf: 11.5, me: 122, rohprotein: 1000, nxp: 850, andfom: 3000, ca: 58, p: 35, mg: 18, na: 16 } },
];

// Jungvieh / Aufzucht: ~700–900 g tgl. Zunahme
const JUNGVIEH_TABELLE: { gewicht: number; werte: BedarfWerte }[] = [
  { gewicht: 150, werte: { tmBedarf: 3.8, me: 40, rohprotein: 560, nxp: 470, rohfaser: 700, andfom: 1100, ca: 26, p: 14, mg: 5, na: 4 } },
  { gewicht: 250, werte: { tmBedarf: 5.5, me: 55, rohprotein: 640, nxp: 540, rohfaser: 950, andfom: 1550, ca: 33, p: 18, mg: 7, na: 6 } },
  { gewicht: 400, werte: { tmBedarf: 7.3, me: 68, rohprotein: 760, nxp: 640, rohfaser: 1250, andfom: 2050, ca: 38, p: 22, mg: 10, na: 8 } },
  { gewicht: 550, werte: { tmBedarf: 9.0, me: 80, rohprotein: 860, nxp: 720, rohfaser: 1500, andfom: 2450, ca: 42, p: 26, mg: 13, na: 10 } },
];

function bedarfRind(e: BedarfEingabe): BedarfErgebnis {
  const hinweise: string[] = [];
  const rechenweg: BedarfErgebnis["rechenweg"] = [];
  const lw = e.gewicht ?? 650;

  if (e.nutzungsart === "Milchkuh laktierend" || e.nutzungsart === "Mutterkuh säugend") {
    const milch = e.leistung ?? 25;
    const fett = e.fettProzent ?? 4.0;
    const eiweiss = e.eiweissProzent ?? 3.4;
    // Energiekorrigierte Milch (ECM)
    const ecm = milch * (0.38 * fett + 0.21 * eiweiss + 1.05) / 3.28;
    const m075 = lw075(lw);
    const nelMaint = 0.293 * m075;
    const nelMilch = 3.28 * ecm;
    const xpMaint = 3.45 * m075;
    const xpMilch = 85 * milch;
    rechenweg.push({ schritt: "ECM (energiekorrigierte Milch)", wert: Math.round(ecm * 10) / 10, einheit: "kg" });
    rechenweg.push({ schritt: "NEL Erhaltung (0,293 × LW^0,75)", wert: Math.round(nelMaint * 10) / 10, einheit: "MJ" });
    rechenweg.push({ schritt: "NEL Milch (3,28 × ECM)", wert: Math.round(nelMilch * 10) / 10, einheit: "MJ" });
    const werte: BedarfWerte = {
      tmBedarf: lw * 0.032 + milch * 0.1,
      nel: nelMaint + nelMilch,
      me: (nelMaint + nelMilch) / 0.62,
      rohprotein: xpMaint + xpMilch,
      nxp: xpMaint + xpMilch,
      rohfaser: (lw * 0.032 + milch * 0.1) * 170,        // ~17 % der TM
      andfom: (lw * 0.032 + milch * 0.1) * 320,
      ca: 0.052 * lw + 2.5 * milch,
      p: 0.0372 * lw + 1.43 * milch,
      mg: 0.0208 * lw + 0.8 * milch,
      na: 0.0156 * lw + 0.6 * milch,
    };
    hinweise.push("Milchvieh-Bedarf nach LfL-Rationsschema (Erhaltung + Leistung). TM-Aufnahme an tatsächliche Futteraufnahme anpassen.");
    return finalisiere(werte, e, rechenweg, hinweise);
  }

  if (e.nutzungsart === "Milchkuh trockenstehend") {
    const m075 = lw075(lw);
    const werte: BedarfWerte = {
      tmBedarf: lw * 0.02,
      nel: 0.293 * m075 + 13,           // + Konzeptus / Trächtigkeit
      me: (0.293 * m075 + 13) / 0.62,
      rohprotein: 3.45 * m075 + 280,
      nxp: 3.45 * m075 + 280,
      rohfaser: lw * 0.02 * 220,
      andfom: lw * 0.02 * 420,
      ca: 0.045 * lw,
      p: 0.03 * lw,
      mg: 0.025 * lw,
      na: 0.014 * lw,
    };
    hinweise.push("Trockensteher: energie-/calciumreduzierte Ration zur Vorbeugung von Milchfieber empfohlen.");
    return finalisiere(werte, e, rechenweg, hinweise);
  }

  const tabelle = e.nutzungsart === "Jungvieh / Aufzucht" ? JUNGVIEH_TABELLE : MASTRIND_TABELLE;
  const werte = interpoliere(tabelle, lw);
  rechenweg.push({ schritt: `Interpolation Tabellenwert bei ${lw} kg LW`, wert: lw, einheit: "kg" });
  hinweise.push("Bedarf aus LfL-Tabellenwerten interpoliert — bei abweichender Zunahme manuell anpassen.");
  return finalisiere(werte, e, rechenweg, hinweise);
}

// ─── Schwein ─────────────────────────────────────────────────────────────────

const SCHWEIN_BEDARF: Record<string, BedarfWerte> = {
  "Mastschwein Anfangsmast": { tmBedarf: 1.7, me: 22, rohprotein: 330, lysin: 18, methionin: 5.5, ca: 14, p: 11, mg: 3, na: 2.5 },
  "Mastschwein Endmast":     { tmBedarf: 2.7, me: 33, rohprotein: 420, lysin: 21, methionin: 6.5, ca: 17, p: 13, mg: 4, na: 3 },
  "Zuchtsau tragend":        { tmBedarf: 2.8, me: 32, rohprotein: 330, lysin: 13, methionin: 4, ca: 22, p: 16, mg: 5, na: 4 },
  "Zuchtsau laktierend":     { tmBedarf: 6.2, me: 85, rohprotein: 900, lysin: 55, methionin: 15, ca: 42, p: 32, mg: 9, na: 7 },
  "Ferkel / Aufzucht":       { tmBedarf: 0.9, me: 13, rohprotein: 200, lysin: 13, methionin: 4, ca: 7, p: 5.5, mg: 2, na: 1.8 },
};

function bedarfSchwein(e: BedarfEingabe): BedarfErgebnis {
  const hinweise: string[] = [];
  const basis = SCHWEIN_BEDARF[e.nutzungsart] ?? SCHWEIN_BEDARF["Mastschwein Endmast"];
  const werte = { ...basis };
  // Skalierung über Gewicht innerhalb der Mastphase
  if (e.gewicht && (e.nutzungsart.startsWith("Mastschwein"))) {
    const ref = e.nutzungsart === "Mastschwein Anfangsmast" ? 45 : 90;
    const faktor = Math.max(0.6, Math.min(1.4, e.gewicht / ref));
    for (const k of Object.keys(werte)) {
      (werte as Record<string, number>)[k] = (werte as Record<string, number>)[k] * faktor;
    }
  }
  hinweise.push("Schweine-Bedarf als Tagesbedarf — limitierende Aminosäuren (Lysin, Methionin) beachten; Phosphor möglichst als verdaulicher P bewerten.");
  return finalisiere(werte, e, [], hinweise);
}

// ─── Geflügel ────────────────────────────────────────────────────────────────

const GEFLUGEL_BEDARF: Record<string, BedarfWerte> = {
  "Legehenne":           { tmBedarf: 0.115, me: 1.75, rohprotein: 17.5, lysin: 0.85, methionin: 0.42, ca: 3.8, p: 0.55, mg: 0.06, na: 0.17 },
  "Masthuhn / Broiler":  { tmBedarf: 0.10, me: 1.35, rohprotein: 21, lysin: 1.25, methionin: 0.55, ca: 0.95, p: 0.45, mg: 0.05, na: 0.15 },
  "Junghenne / Aufzucht":{ tmBedarf: 0.07, me: 1.0, rohprotein: 12, lysin: 0.6, methionin: 0.28, ca: 1.0, p: 0.4, mg: 0.04, na: 0.12 },
};

function bedarfGeflugel(e: BedarfEingabe): BedarfErgebnis {
  const hinweise: string[] = [];
  const werte = { ...(GEFLUGEL_BEDARF[e.nutzungsart] ?? GEFLUGEL_BEDARF["Legehenne"]) };
  hinweise.push("Geflügel-Bedarf je Tier und Tag. Aminosäuren (Lysin, Methionin) und — bei Legehennen — Calcium sind die kritischen Größen.");
  return finalisiere(werte, e, [], hinweise);
}

// ─── Pferd ───────────────────────────────────────────────────────────────────

// Arbeitsfaktoren auf den Erhaltungsbedarf (Energie/Protein)
const PFERD_ARBEIT: Record<string, { energie: number; protein: number; tmFaktor: number; na: number }> = {
  "Warmblut Erhaltung":        { energie: 1.0, protein: 1.0, tmFaktor: 0.020, na: 1.0 },
  "Warmblut leichte Arbeit":   { energie: 1.25, protein: 1.2, tmFaktor: 0.020, na: 2.0 },
  "Warmblut mittlere Arbeit":  { energie: 1.5, protein: 1.4, tmFaktor: 0.0225, na: 3.0 },
  "Warmblut schwere Arbeit":   { energie: 1.9, protein: 1.7, tmFaktor: 0.025, na: 4.0 },
  "Vollblut":                  { energie: 1.6, protein: 1.45, tmFaktor: 0.022, na: 3.0 },
  "Pony":                      { energie: 1.0, protein: 1.0, tmFaktor: 0.018, na: 1.0 },
  "Zuchtstute laktierend":     { energie: 1.5, protein: 1.7, tmFaktor: 0.025, na: 2.0 },
};

function bedarfPferd(e: BedarfEingabe): BedarfErgebnis {
  const hinweise: string[] = [];
  const rechenweg: BedarfErgebnis["rechenweg"] = [];
  const lw = e.gewicht ?? 600;
  const m075 = lw075(lw);
  const f = PFERD_ARBEIT[e.nutzungsart] ?? PFERD_ARBEIT["Warmblut Erhaltung"];

  const meErhaltung = 0.52 * m075;          // MJ ME Erhaltung (GfE-orientiert)
  const dpErhaltung = 3.0 * m075;           // g verd. Rohprotein Erhaltung
  rechenweg.push({ schritt: "ME Erhaltung (0,52 × LW^0,75)", wert: Math.round(meErhaltung * 10) / 10, einheit: "MJ" });
  rechenweg.push({ schritt: `Arbeitsfaktor Energie (${e.nutzungsart})`, wert: f.energie, einheit: "×" });

  const tmBedarf = lw * f.tmFaktor;
  const werte: BedarfWerte = {
    tmBedarf,
    me: meErhaltung * f.energie,
    dp: dpErhaltung * f.protein,
    rohprotein: dpErhaltung * f.protein / 0.65,   // grobe Rückrechnung XP aus DP
    rohfaser: tmBedarf * 180,                      // mind. ~18 % Rohfaser der TM
    andfom: tmBedarf * 350,
    ca: 0.04 * lw,
    p: 0.028 * lw,
    mg: 0.015 * lw,                                // Magnesium explizit (Anforderung Pferd)
    na: 0.02 * lw * f.na,
  };
  hinweise.push("Pferde-Bedarf nach GfE-Orientierung. Strukturwirksame Rohfaser (mind. 18 % der TM) und Magnesium sind kritische Größen.");
  hinweise.push("Ca:P-Verhältnis im Auge behalten — beim Pferd 1,2:1 bis 2:1 anstreben.");
  return finalisiere(werte, e, rechenweg, hinweise);
}

// ─── Schaf / Ziege ───────────────────────────────────────────────────────────

const SCHAF_BEDARF: Record<string, BedarfWerte> = {
  "Mutterschaf säugend": { tmBedarf: 2.0, me: 18, nel: 11, rohprotein: 280, nxp: 230, andfom: 700, ca: 9, p: 5, mg: 2, na: 2.5 },
  "Mutterschaf tragend": { tmBedarf: 1.4, me: 11, nel: 7, rohprotein: 140, nxp: 120, andfom: 560, ca: 5, p: 3, mg: 1.5, na: 1.5 },
  "Mastlamm":            { tmBedarf: 1.2, me: 13, nel: 8, rohprotein: 170, nxp: 140, andfom: 420, ca: 6, p: 3, mg: 1, na: 1 },
};

const ZIEGE_BEDARF: Record<string, BedarfWerte> = {
  "Milchziege laktierend":     { tmBedarf: 2.2, me: 16, nel: 10, rohprotein: 280, nxp: 230, andfom: 650, ca: 9, p: 6, mg: 2, na: 2 },
  "Milchziege trockenstehend": { tmBedarf: 1.5, me: 9, nel: 5.5, rohprotein: 100, nxp: 90, andfom: 600, ca: 4, p: 3, mg: 1.5, na: 1.2 },
  "Mastziege":                 { tmBedarf: 1.2, me: 11, nel: 7, rohprotein: 140, nxp: 120, andfom: 420, ca: 5, p: 3, mg: 1, na: 1 },
};

function bedarfSchaf(e: BedarfEingabe): BedarfErgebnis {
  const hinweise: string[] = [];
  const werte = { ...(SCHAF_BEDARF[e.nutzungsart] ?? SCHAF_BEDARF["Mutterschaf tragend"]) };
  if (e.nutzungsart === "Mutterschaf säugend" && e.leistung && e.leistung >= 2) {
    werte.me = (werte.me ?? 0) * 1.25;
    werte.rohprotein = (werte.rohprotein ?? 0) * 1.25;
    hinweise.push("Mehrlingsgeburt: Energie- und Proteinbedarf um ca. 25 % erhöht.");
  }
  hinweise.push("Schaf-Bedarf als Orientierungswert (Wiederkäuer-Modell).");
  return finalisiere(werte, e, [], hinweise);
}

function bedarfZiege(e: BedarfEingabe): BedarfErgebnis {
  const hinweise: string[] = [];
  const werte = { ...(ZIEGE_BEDARF[e.nutzungsart] ?? ZIEGE_BEDARF["Milchziege trockenstehend"]) };
  if (e.nutzungsart === "Milchziege laktierend" && e.leistung) {
    // Basistabelle entspricht ~3 kg Milch; je weiterem kg + Bedarf
    const diff = e.leistung - 3;
    if (diff !== 0) {
      werte.nel = (werte.nel ?? 0) + diff * 3.1;
      werte.me = (werte.me ?? 0) + diff * 5.0;
      werte.rohprotein = (werte.rohprotein ?? 0) + diff * 65;
      werte.nxp = (werte.nxp ?? 0) + diff * 65;
      werte.ca = (werte.ca ?? 0) + diff * 2.5;
      werte.p = (werte.p ?? 0) + diff * 1.4;
    }
  }
  hinweise.push("Ziegen-Bedarf als Orientierungswert (Wiederkäuer-Modell, Basis ~3 kg Milch/Tag).");
  return finalisiere(werte, e, [], hinweise);
}

// ─── Finalisierung: Override + Rundung ───────────────────────────────────────

function finalisiere(
  werte: BedarfWerte,
  e: BedarfEingabe,
  rechenweg: BedarfErgebnis["rechenweg"],
  hinweise: string[],
): BedarfErgebnis {
  let final = { ...werte };
  if (e.manuellerBedarf) {
    for (const [k, v] of Object.entries(e.manuellerBedarf)) {
      if (v != null && !isNaN(Number(v))) {
        (final as Record<string, number>)[k] = Number(v);
      }
    }
    hinweise.push("Einzelne Bedarfswerte wurden manuell überschrieben.");
  }
  return { werte: runde(final), rechenweg, hinweise };
}

// ─── Dispatch ────────────────────────────────────────────────────────────────

export function berechneTierbedarf(e: BedarfEingabe): BedarfErgebnis {
  switch (e.tierart) {
    case "Rind":     return bedarfRind(e);
    case "Schwein":  return bedarfSchwein(e);
    case "Geflugel": return bedarfGeflugel(e);
    case "Pferd":    return bedarfPferd(e);
    case "Schaf":    return bedarfSchaf(e);
    case "Ziege":    return bedarfZiege(e);
    default:
      return { werte: { tmBedarf: 0 }, rechenweg: [], hinweise: ["Unbekannte Tierart."] };
  }
}
