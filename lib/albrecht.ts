// lib/albrecht.ts
// Regelbasierte Albrecht-Bewertung nach Geobüro Christophel / ALBRECHT PLUS
// Richtwerte aus echten Christophel-Berichten.

export const ALBRECHT_DISCLAIMER =
  "Diese Analyse basiert auf der Albrecht-Methode und dient ausschließlich der " +
  "Beratung zur Bodenstruktur. Sie ist nicht nach DüV zugelassen und darf nicht " +
  "für die Düngebedarfsermittlung verwendet werden.";

export type Status = "ok" | "niedrig" | "hoch" | "kritisch";

export interface BewertungErgebnis {
  parameter: string;
  label: string;
  ist: number | null;
  sollMin: number | null;
  sollMax: number | null;
  einheit: string;
  status: Status;
  hinweis: string;
}

export interface BodenanalyseAlbrechtData {
  caSaettigung?: number | null;
  mgSaettigung?: number | null;
  kSaettigung?: number | null;
  naSaettigung?: number | null;
  hSaettigung?: number | null;
  variabelSaett?: number | null;
  bor?: number | null;
  eisen?: number | null;
  mangan?: number | null;
  kupfer?: number | null;
  zink?: number | null;
  chlorid?: number | null;
  silizium?: number | null;
  kobalt?: number | null;
  molybdaen?: number | null;
  selen?: number | null;
}

export const ALBRECHT_HINWEIS_LABEL: Record<string, string> = {
  caSaettigung: "Ca-Sättigung",
  mgSaettigung: "Mg-Sättigung",
  kSaettigung: "K-Sättigung",
  naSaettigung: "Na-Sättigung",
  hSaettigung: "H-Sättigung",
  caMgRatio: "Ca:Mg-Verhältnis",
  bor: "Bor (B)",
  eisen: "Eisen (Fe)",
  mangan: "Mangan (Mn)",
  kupfer: "Kupfer (Cu)",
  zink: "Zink (Zn)",
  chlorid: "Chlorid (Cl)",
  silizium: "Silizium (Si)",
  kobalt: "Kobalt (Co)",
  molybdaen: "Molybdän (Mo)",
  selen: "Selen (Se)",
};

function bewerte(
  parameter: string,
  ist: number | null | undefined,
  sollMin: number | null,
  sollMax: number | null,
  einheit: string,
  hinweise: Record<Status, string>
): BewertungErgebnis {
  const label = ALBRECHT_HINWEIS_LABEL[parameter] ?? parameter;
  const val = ist ?? null;

  if (val === null) {
    return { parameter, label, ist: null, sollMin, sollMax, einheit, status: "ok", hinweis: "Kein Messwert vorhanden." };
  }

  let status: Status = "ok";
  if (sollMax !== null && val > sollMax) {
    status = "hoch";
  } else if (sollMin !== null && val < sollMin) {
    status = "niedrig";
  }

  return { parameter, label, ist: val, sollMin, sollMax, einheit, status, hinweis: hinweise[status] };
}

export function albrechtBewertung(analyse: BodenanalyseAlbrechtData): BewertungErgebnis[] {
  const ergebnisse: BewertungErgebnis[] = [];

  // Ca-Sättigung: SOLL 60–80%
  // Untergrenze Kritisch < 50%, Niedrig < 60%; Hoch > 80%
  (() => {
    const val = analyse.caSaettigung ?? null;
    const label = ALBRECHT_HINWEIS_LABEL.caSaettigung;
    if (val === null) {
      ergebnisse.push({ parameter: "caSaettigung", label, ist: null, sollMin: 60, sollMax: 80, einheit: "%", status: "ok", hinweis: "Kein Messwert." });
      return;
    }
    let status: Status = "ok";
    let hinweis = "Ca-Sättigung im optimalen Bereich (60–80 %). Gute Bodenstruktur.";
    if (val < 50) {
      status = "kritisch";
      hinweis = "Ca-Sättigung kritisch niedrig (< 50 %). Erheblicher Kalkungsbedarf. Bodenstruktur stark beeinträchtigt.";
    } else if (val < 60) {
      status = "niedrig";
      hinweis = "Ca-Sättigung zu niedrig (< 60 %). Kalkung empfohlen zur Verbesserung der Bodenstruktur.";
    } else if (val > 80) {
      status = "hoch";
      hinweis = "Ca-Sättigung zu hoch (> 80 %). Blockierung anderer Kationen (Mg, K) möglich.";
    }
    ergebnisse.push({ parameter: "caSaettigung", label, ist: val, sollMin: 60, sollMax: 80, einheit: "%", status, hinweis });
  })();

  // Mg-Sättigung: SOLL 10–20%
  // Kritisch < 5%, Niedrig < 10%; Hoch > 25%
  (() => {
    const val = analyse.mgSaettigung ?? null;
    const label = ALBRECHT_HINWEIS_LABEL.mgSaettigung;
    if (val === null) {
      ergebnisse.push({ parameter: "mgSaettigung", label, ist: null, sollMin: 10, sollMax: 20, einheit: "%", status: "ok", hinweis: "Kein Messwert." });
      return;
    }
    let status: Status = "ok";
    let hinweis = "Mg-Sättigung im Sollbereich (10–20 %). Ausreichende Mg-Versorgung.";
    if (val < 5) {
      status = "kritisch";
      hinweis = "Mg-Sättigung kritisch niedrig (< 5 %). Sofortige Mg-Düngung nötig. Tiergesundheit und Pflanzenertrag gefährdet.";
    } else if (val < 10) {
      status = "niedrig";
      hinweis = "Mg-Sättigung zu niedrig (< 10 %). Mg-Gabe empfohlen.";
    } else if (val > 25) {
      status = "hoch";
      hinweis = "Mg-Sättigung erhöht (> 25 %). Kann K-Aufnahme hemmen.";
    }
    ergebnisse.push({ parameter: "mgSaettigung", label, ist: val, sollMin: 10, sollMax: 20, einheit: "%", status, hinweis });
  })();

  // K-Sättigung: SOLL 2–7,5%
  // Kritisch < 1%, Niedrig < 2%; Hoch > 10%
  (() => {
    const val = analyse.kSaettigung ?? null;
    const label = ALBRECHT_HINWEIS_LABEL.kSaettigung;
    if (val === null) {
      ergebnisse.push({ parameter: "kSaettigung", label, ist: null, sollMin: 2, sollMax: 7.5, einheit: "%", status: "ok", hinweis: "Kein Messwert." });
      return;
    }
    let status: Status = "ok";
    let hinweis = "K-Sättigung im Sollbereich (2–7,5 %). Gute Kaliumversorgung.";
    if (val < 1) {
      status = "kritisch";
      hinweis = "K-Sättigung kritisch niedrig (< 1 %). Dringender K-Bedarf. Ertragsverluste und Qualitätsminderung möglich.";
    } else if (val < 2) {
      status = "niedrig";
      hinweis = "K-Sättigung niedrig (< 2 %). K-Düngung empfohlen.";
    } else if (val > 10) {
      status = "hoch";
      hinweis = "K-Sättigung erhöht (> 10 %). Mögliche Mg- und Ca-Antagonismen.";
    }
    ergebnisse.push({ parameter: "kSaettigung", label, ist: val, sollMin: 2, sollMax: 7.5, einheit: "%", status, hinweis });
  })();

  // Na-Sättigung: SOLL 0,5–3%
  // Niedrig < 0,5%; Hoch > 5%
  ergebnisse.push(bewerte("naSaettigung", analyse.naSaettigung, 0.5, 3, "%", {
    ok: "Na-Sättigung im Sollbereich (0,5–3 %). Ausreichend für Pflanzen- und Bodenbiologie.",
    niedrig: "Na-Sättigung niedrig (< 0,5 %). Natriumgabe bei Intensivkulturen prüfen.",
    hoch: "Na-Sättigung erhöht (> 3 %). Bei > 5 % Verdrängung anderer Kationen möglich.",
    kritisch: "Na-Sättigung sehr hoch. Salzschäden möglich.",
  }));

  // H-Sättigung: SOLL < 15%
  // Hoch > 15% (= zu sauer), Kritisch > 25%
  (() => {
    const val = analyse.hSaettigung ?? null;
    const label = ALBRECHT_HINWEIS_LABEL.hSaettigung;
    if (val === null) {
      ergebnisse.push({ parameter: "hSaettigung", label, ist: null, sollMin: null, sollMax: 15, einheit: "%", status: "ok", hinweis: "Kein Messwert." });
      return;
    }
    let status: Status = "ok";
    let hinweis = "H-Sättigung im Sollbereich (< 15 %). pH-Verhältnis gut.";
    if (val > 25) {
      status = "kritisch";
      hinweis = "H-Sättigung sehr hoch (> 25 %). Stark versauerter Boden. Dringender Kalkungsbedarf.";
    } else if (val > 15) {
      status = "hoch";
      hinweis = "H-Sättigung erhöht (> 15 %). Boden zu sauer. Kalkung empfohlen.";
    }
    ergebnisse.push({ parameter: "hSaettigung", label, ist: val, sollMin: null, sollMax: 15, einheit: "%", status, hinweis });
  })();

  // Ca:Mg-Verhältnis (berechnet aus Sättigungswerten)
  (() => {
    const ca = analyse.caSaettigung ?? null;
    const mg = analyse.mgSaettigung ?? null;
    if (ca === null || mg === null || mg === 0) return;
    const ratio = ca / mg;
    const label = ALBRECHT_HINWEIS_LABEL.caMgRatio;
    // SOLL 6:1 bis 9:1 → ratio 6–9
    let status: Status = "ok";
    let hinweis = `Ca:Mg-Verhältnis ${ratio.toFixed(1)}:1 im Sollbereich (6–9:1). Gute Balance.`;
    if (ratio < 4) {
      status = "kritisch";
      hinweis = `Ca:Mg-Verhältnis ${ratio.toFixed(1)}:1 — sehr eng. Ca deutlich zu niedrig oder Mg zu hoch.`;
    } else if (ratio < 6) {
      status = "niedrig";
      hinweis = `Ca:Mg-Verhältnis ${ratio.toFixed(1)}:1 — etwas eng. Kalkung oder Mg-Reduzierung prüfen.`;
    } else if (ratio > 12) {
      status = "kritisch";
      hinweis = `Ca:Mg-Verhältnis ${ratio.toFixed(1)}:1 — sehr weit. Mg-Versorgung kritisch niedrig.`;
    } else if (ratio > 9) {
      status = "hoch";
      hinweis = `Ca:Mg-Verhältnis ${ratio.toFixed(1)}:1 — etwas weit. Mg-Gabe prüfen.`;
    }
    ergebnisse.push({ parameter: "caMgRatio", label, ist: parseFloat(ratio.toFixed(2)), sollMin: 6, sollMax: 9, einheit: ":1", status, hinweis });
  })();

  // Spurenelemente
  ergebnisse.push(bewerte("bor", analyse.bor, 0.8, 2.0, "ppm", {
    ok: "Bor im Sollbereich (0,8–2,0 ppm). Gute Versorgung für Leguminosen und Raps.",
    niedrig: "Bor zu niedrig (< 0,8 ppm). Bormangel bei Raps, Rüben und Leguminosen möglich.",
    hoch: "Bor erhöht (> 2,0 ppm). Überdüngung mit Bor vermeiden.",
    kritisch: "Bor sehr niedrig. Dringender Mangel.",
  }));

  ergebnisse.push(bewerte("eisen", analyse.eisen, 200, null, "ppm", {
    ok: "Eisen ausreichend (≥ 200 ppm). Gute Grundversorgung.",
    niedrig: "Eisen niedrig (< 200 ppm). Auf leichten, kalkreichen Böden Chloroserisiko möglich.",
    hoch: "Eisengehalt erhöht.",
    kritisch: "Eisen sehr niedrig.",
  }));

  ergebnisse.push(bewerte("mangan", analyse.mangan, 50, 250, "ppm", {
    ok: "Mangan im Sollbereich (50–250 ppm). Ausreichend für Enzymaktivitäten.",
    niedrig: "Mangan niedrig (< 50 ppm). Manganmangel besonders auf alkalischen Böden möglich.",
    hoch: "Mangan erhöht (> 250 ppm). Auf stark sauren Böden Toxizität prüfen.",
    kritisch: "Mangan sehr niedrig.",
  }));

  ergebnisse.push(bewerte("kupfer", analyse.kupfer, 2, 10, "ppm", {
    ok: "Kupfer im Sollbereich (2–10 ppm). Gute Versorgung.",
    niedrig: "Kupfer niedrig (< 2 ppm). Kupfermangel bei Getreide und Gräsern möglich.",
    hoch: "Kupfer erhöht (> 10 ppm). Toxizität bei Dauerkulturen prüfen.",
    kritisch: "Kupfer sehr niedrig.",
  }));

  ergebnisse.push(bewerte("zink", analyse.zink, 6, 20, "ppm", {
    ok: "Zink im Sollbereich (6–20 ppm). Ausreichend für Enzymaktivitäten.",
    niedrig: "Zink niedrig (< 6 ppm). Zinkmangel bei Mais und Leguminosen möglich.",
    hoch: "Zink erhöht (> 20 ppm). Toleranzgrenze beachten.",
    kritisch: "Zink sehr niedrig.",
  }));

  ergebnisse.push(bewerte("chlorid", analyse.chlorid, 25, 250, "ppm", {
    ok: "Chlorid im Sollbereich (25–250 ppm). Normal.",
    niedrig: "Chlorid niedrig (< 25 ppm). Selten problematisch, aber beachten.",
    hoch: "Chlorid erhöht (> 250 ppm). Mögliche Salzbelastung prüfen.",
    kritisch: "Chlorid sehr niedrig.",
  }));

  ergebnisse.push(bewerte("silizium", analyse.silizium, 30, 60, "ppm", {
    ok: "Silizium im Sollbereich (30–60 ppm). Gut für Stressresistenz und Bodenstruktur.",
    niedrig: "Silizium niedrig (< 30 ppm). Si-Mangel kann Stresstoleranz und Bodenstruktur beeinträchtigen.",
    hoch: "Silizium erhöht (> 60 ppm). In der Regel unkritisch.",
    kritisch: "Silizium sehr niedrig.",
  }));

  ergebnisse.push(bewerte("kobalt", analyse.kobalt, 0.35, 2, "ppm", {
    ok: "Kobalt im Sollbereich (0,35–2 ppm). Wichtig für Symbiose-Bakterien.",
    niedrig: "Kobalt niedrig (< 0,35 ppm). Kann Knöllchenbakterienwachstum hemmen.",
    hoch: "Kobalt erhöht (> 2 ppm). Toxizität selten, aber prüfen.",
    kritisch: "Kobalt sehr niedrig.",
  }));

  ergebnisse.push(bewerte("molybdaen", analyse.molybdaen, 0.05, 0.1, "ppm", {
    ok: "Molybdän im Sollbereich (0,05–0,1 ppm). Ausreichend für N-Fixierung.",
    niedrig: "Molybdän niedrig (< 0,05 ppm). Wichtig für Hülsenfrüchte und N-Fixierung.",
    hoch: "Molybdän erhöht (> 0,1 ppm). Selten toxisch, aber hohe Werte beachten.",
    kritisch: "Molybdän sehr niedrig.",
  }));

  ergebnisse.push(bewerte("selen", analyse.selen, 0.03, 0.1, "ppm", {
    ok: "Selen im Sollbereich (0,03–0,1 ppm). Ausreichend für Tiergesundheit.",
    niedrig: "Selen niedrig (< 0,03 ppm). Selenmangel bei Weidetieren möglich. Selengabe prüfen.",
    hoch: "Selen erhöht (> 0,1 ppm). Toxizität für Tiere bei hohen Werten beachten.",
    kritisch: "Selen sehr niedrig.",
  }));

  // Filter: Nur Parameter mit tatsächlich vorhandenem Wert — außer Kationen-Sättigung (immer zeigen)
  return ergebnisse.filter((e) => {
    // Kationen immer zeigen (zentral für Albrecht-Bewertung)
    if (["caSaettigung", "mgSaettigung", "kSaettigung", "naSaettigung", "hSaettigung", "caMgRatio"].includes(e.parameter)) {
      return true;
    }
    return e.ist !== null;
  });
}

/** Zählt Status-Häufigkeiten für Ampel-Anzeige */
export function albrechtAmpel(analyse: BodenanalyseAlbrechtData): { ok: number; warn: number; kritisch: number } {
  const bew = albrechtBewertung(analyse);
  let ok = 0, warn = 0, krit = 0;
  for (const b of bew) {
    if (b.ist === null) continue;
    if (b.status === "ok") ok++;
    else if (b.status === "kritisch") krit++;
    else warn++;
  }
  return { ok, warn, kritisch: krit };
}
