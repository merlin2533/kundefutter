// Deterministischer Bankabgleich-Matcher mit Näherungserkennung (Betrag-/Datumstoleranz +
// Textähnlichkeit). Portiert/adaptiert aus dem RESQIO-Schwesterprojekt
// (feuerwehr-gerate-meister-kartei-1: src/utils/bankReconciliation.ts) — dort bereits reine,
// framework-agnostische TypeScript-Logik. Reine Funktionen ohne DB-/Next.js-Abhängigkeit.

export interface BankBuchung {
  /** Kontoumsatz.id */
  id: number;
  /** ISO-Datum yyyy-MM-dd */
  date: string;
  /** vorzeichenbehaftet: positiv = Eingang, negativ = Ausgang */
  amount: number;
  purpose: string;
  name: string;
}

export type ReconCandidateKind = "lieferung" | "sammelrechnung" | "ausgabe" | "eingangsrechnung";

export interface ReconCandidate {
  kind: ReconCandidateKind;
  id: number;
  /** ISO-Datum yyyy-MM-dd */
  date: string;
  /** vorzeichenbehaftet wie BankBuchung.amount: Lieferung/Sammelrechnung positiv, Ausgabe/EingangsRechnung negativ */
  amount: number;
  description: string;
  counterparty: string;
  receiptNumber?: string;
  /** Nur bei kind lieferung/sammelrechnung mit hinterlegtem Skonto: Betrag nach Abzug des
   * Skonto-Prozentsatzes (Lieferung.skontoProzent/Sammelrechnung.skontoProzent). Ein Kunde, der
   * das Skonto nutzt, überweist absichtlich weniger als den vollen Rechnungsbetrag — ohne diesen
   * zweiten möglichen Betrag sähe eine korrekte Skonto-Zahlung wie ein Fehlbetrag aus. */
  skontoAmount?: number;
}

export interface MatchedPair {
  bank: BankBuchung;
  candidate: ReconCandidate;
  amountDiff: number;
  dayDiff: number;
  category: "matched" | "deviation";
  source: "auto" | "ai" | "manual";
  aiReason?: string;
  confidence?: number;
  textScore?: number;
  /** true = der Bankbetrag entspricht dem Skonto-reduzierten statt dem vollen Rechnungsbetrag. */
  skontoMatch?: boolean;
}

export interface AggregatedGroup {
  banks: BankBuchung[];
  candidate: ReconCandidate;
  sumAmountDiff: number;
}

export interface BankBuchungMitHinweis extends BankBuchung {
  nearestCandidate?: ReconCandidate;
  nearestDiff?: number;
  nearestScore?: number;
}

export interface ReconCandidateMitHinweis extends ReconCandidate {
  nearestBank?: BankBuchung;
  nearestDiff?: number;
  nearestScore?: number;
}

export interface ReconciliationSummary {
  bankCount: number;
  candidateCount: number;
  matchedCount: number;
  deviationCount: number;
  aggregatedCount: number;
  bankOnlyCount: number;
  candidateOnlyCount: number;
}

export interface ReconciliationResult {
  matched: MatchedPair[];
  deviations: MatchedPair[];
  aggregated: AggregatedGroup[];
  bankOnly: BankBuchungMitHinweis[];
  candidateOnly: ReconCandidateMitHinweis[];
  summary: ReconciliationSummary;
}

export interface MatchOptions {
  /** Maximale Datumsabweichung in Tagen für einen exakten Treffer. Default 5. */
  dateToleranceDays?: number;
  /** Maximale Betragsabweichung (€) für einen (abweichenden) Treffer. Default 0.50. */
  amountTolerance?: number;
  /** Maximale Anzahl Bankbuchungen, die zu einer Buchung kombiniert werden (N:1). Default 3. */
  aggregationMaxParts?: number;
}

const AMOUNT_EXACT = 0.005;
const AGGREGATION_PENDING_LIMIT = 60;

// ─── Textähnlichkeit (Name / Verwendungszweck / Belegnummer) ──────────────────

export function normalizeText(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function tokenize(normalized: string): string[] {
  return normalized.split(" ").filter((t) => t.length >= 2);
}

/** Overlap-Koeffizient (0..1): |A∩B| / min(|A|,|B|) — kurzer Buchungstext, der vollständig im
 * langen Verwendungszweck steckt, erhält so trotzdem einen hohen Score (anders als bei Jaccard). */
export function tokenSimilarity(a: string, b: string): number {
  const ta = new Set(tokenize(normalizeText(a)));
  const tb = new Set(tokenize(normalizeText(b)));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / Math.min(ta.size, tb.size);
}

/** Starkes Signal: die Rechnungs-/Belegnummer der Buchung taucht im Verwendungszweck/Namen auf.
 *
 * Prüft zuerst die vollständige, normalisierte Rechnungsnummer als Teilzeichenkette (z.B.
 * "RE-2026-0361" → "re20260361"). Kunden geben im Verwendungszweck einer Überweisung aber sehr
 * oft nur die laufende Nummer am Ende an ("Rechnung 361", "RG 0361") statt des vollen internen
 * Formats mit Präfix/Jahr — das ließ den Abgleich bisher komplett ins Leere laufen, obwohl der
 * Zahlende die Rechnungsnummer korrekt referenziert hatte. Fallback: die letzte Ziffernfolge der
 * Rechnungsnummer (mit UND ohne führende Nullen) als eigenständiges Zahlen-Token im
 * Verwendungszweck suchen — Token-Grenze statt roher Teilzeichenkette, damit z.B. "361" nicht
 * zufällig in einer IBAN oder Telefonnummer "trifft". Etwas geringere Konfidenz als der
 * Volltreffer, da die kurze Zahl allein prinzipiell mehrdeutiger ist. */
export function receiptNumberHit(bankText: string, receiptNumber?: string): number {
  if (!receiptNumber) return 0;
  const needle = normalizeText(receiptNumber).replace(/\s+/g, "");
  if (needle.length < 3) return 0;
  const haystack = normalizeText(bankText).replace(/\s+/g, "");
  if (haystack.includes(needle)) return 1;

  const trailingMatch = receiptNumber.match(/(\d+)\D*$/);
  if (!trailingMatch) return 0;
  const trailing = trailingMatch[1];
  const trailingOhneNull = trailing.replace(/^0+/, "");
  if (trailingOhneNull.length < 2) return 0;
  const tokens = tokenize(normalizeText(bankText));
  const hit = tokens.some((t) => t === trailing || t === trailingOhneNull);
  return hit ? 0.85 : 0;
}

/** Umkehrung von receiptNumberHit(): extrahiert aus einem Verwendungszweck alle Zahlen-Tokens,
 * die wie eine referenzierte Rechnungsnummer aussehen (z.B. "Rechnungen 0497+0583+0584+0553" →
 * ["0497","0583","0584","0553"]) — für die gezielte, uncapped DB-Suche nach diesen Nummern, damit
 * eine ältere referenzierte Rechnung nicht durch den 300er-Deckel des Kandidaten-Pools aus den
 * automatischen Vorschlägen fällt (siehe Kommentar in app/api/bankabgleich/vorschlaege/route.ts).
 * Bare Jahreszahlen (20xx) werden ausgeschlossen — zu unspezifisch, würde zu viele Treffer liefern. */
export function extractRechnungsnummerKandidaten(text: string): string[] {
  const tokens = tokenize(normalizeText(text));
  const kandidaten = new Set<string>();
  for (const t of tokens) {
    if (!/^\d+$/.test(t)) continue;
    if (t.length < 3 || t.length > 8) continue;
    if (/^20\d{2}$/.test(t)) continue;
    kandidaten.add(t);
  }
  return [...kandidaten];
}

/** Kombinierte Textähnlichkeit (0..1): Belegnummer-Treffer ist nahezu sicher, sonst Token-Overlap. */
export function pairTextScore(bank: BankBuchung, candidate: ReconCandidate): number {
  const bankText = `${bank.purpose} ${bank.name}`;
  const candText = `${candidate.description} ${candidate.counterparty}`;
  const receipt = receiptNumberHit(bankText, candidate.receiptNumber);
  const tokens = tokenSimilarity(bankText, candText);
  return Math.max(receipt, tokens);
}

/** Toleranz (€), ab der eine Näherung an den Skonto-Betrag tatsächlich als "das ist Skonto"
 * gilt statt bloß "zufällig ein bisschen näher als der volle Betrag" — sonst würde z.B. eine
 * winzige Teilzahlung, die weit von beiden Beträgen entfernt liegt, aber marginal näher am
 * Skonto-Betrag als am vollen Betrag ist, fälschlich als erkannte Skonto-Zahlung markiert. */
const SKONTO_ERKENNUNGS_TOLERANZ = 1;

/** Betragsabweichung eines Kandidaten zu einer Bankbuchung — berücksichtigt bei Kandidaten mit
 * hinterlegtem Skonto (skontoAmount) automatisch auch den Skonto-reduzierten Betrag, damit eine
 * legitime Skonto-Zahlung (Kunde überweist absichtlich weniger) nicht wie ein Fehlbetrag aussieht.
 * Liefert den jeweils näher liegenden Betrag (für Ranking/Toleranz-Checks) + ob dieser Betrag
 * PLAUSIBEL dem Skonto-Betrag entspricht (innerhalb SKONTO_ERKENNUNGS_TOLERANZ) — nicht schon,
 * weil er nur geringfügig näher liegt als der volle Betrag. */
export function bestimmeBetragsabweichung(candidate: ReconCandidate, bankAmount: number): { amountDiff: number; skontoMatch: boolean } {
  const diffVoll = Math.abs(candidate.amount - bankAmount);
  if (candidate.skontoAmount == null) return { amountDiff: diffVoll, skontoMatch: false };
  const diffSkonto = Math.abs(candidate.skontoAmount - bankAmount);
  if (diffSkonto < diffVoll) {
    return { amountDiff: diffSkonto, skontoMatch: diffSkonto <= SKONTO_ERKENNUNGS_TOLERANZ };
  }
  return { amountDiff: diffVoll, skontoMatch: false };
}

export interface RankedCandidate {
  candidate: ReconCandidate;
  amountDiff: number;
  dayDiff: number;
  textScore: number;
  /** true = amountDiff wurde gegen den Skonto-reduzierten Betrag berechnet (näher als der volle Betrag). */
  skontoMatch: boolean;
}

/**
 * Rankt ALLE gleichvorzeichigen Kandidaten für eine einzelne Bankbuchung — anders als
 * runNormalMatch() (Bulk-Auto-Abgleich, hart nach amountTolerance gefiltert) wird hier keine
 * Betragsabweichung verworfen, sondern nur niedriger gewichtet: ein Text-/Belegnummer-Treffer
 * schlägt Betragsnähe, weil eine erkennbare Rechnungsnummer im Verwendungszweck ein stärkeres
 * Signal ist als ein knapp passender Betrag. Für die manuelle Zuordnung im UI gedacht, bei der
 * der Bankbetrag bewusst von der Rechnung abweichen kann (Fehlbetrag/Überzahlung) — nicht für
 * den automatischen Massenabgleich.
 */
export function rankCandidatesForBank(bank: BankBuchung, candidates: ReconCandidate[], limit = 8): RankedCandidate[] {
  const scored = candidates.map((candidate) => {
    const { amountDiff, skontoMatch } = bestimmeBetragsabweichung(candidate, bank.amount);
    const dayDiff = daysBetween(bank.date, candidate.date);
    const textScore = pairTextScore(bank, candidate);
    const score = textScore * 100 - Math.min(amountDiff, 10000) / 50 - Math.min(dayDiff, 60) / 6;
    return { candidate, amountDiff, dayDiff, textScore, skontoMatch, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(({ candidate, amountDiff, dayDiff, textScore, skontoMatch }) => ({ candidate, amountDiff, dayDiff, textScore, skontoMatch }));
}

function hintScore(bank: BankBuchung, candidate: ReconCandidate): number {
  const { amountDiff } = bestimmeBetragsabweichung(candidate, bank.amount);
  const dayDiff = daysBetween(bank.date, candidate.date);
  const text = pairTextScore(bank, candidate);
  return text * 2 - amountDiff - Math.min(dayDiff, 30) / 60;
}

export function daysBetween(a: string, b: string): number {
  if (!a || !b) return 9999;
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  if (isNaN(da) || isNaN(db)) return 9999;
  return Math.abs(Math.round((da - db) / 86400000));
}

// ─── Abgleich ──────────────────────────────────────────────────────────────────

/**
 * 1:1-Abgleich von Bankbuchungen gegen Kandidaten (Lieferung/Sammelrechnung/Ausgabe/
 * EingangsRechnung) nach vorzeichenbehaftetem Betrag + Datumsnähe. Zwei Pässe, damit exakte
 * Treffer nicht durch eine früher verarbeitete Bankbuchung "gestohlen" werden, die nur ungefähr
 * passt:
 *   1. Exakter Pass — Betrag gleich (Rundungstoleranz) UND Datum innerhalb Toleranz, bei
 *      Gleichstand bester Textscore, dann nächstliegendes Datum.
 *   2. Abweichungs-Pass — verbleibende Zeilen innerhalb der Betragstoleranz, Scoring bevorzugt
 *      geringe Betragsabweichung vor Datumsnähe, Textscore bricht Gleichstände.
 *   3. N:1-Aggregation — mehrere übrige Bankbuchungen, die sich zu einer Buchung aufsummieren
 *      (Splitzahlungen), kombinatorisch begrenzt.
 */
export function runNormalMatch(
  bank: BankBuchung[],
  candidates: ReconCandidate[],
  opts: MatchOptions = {}
): ReconciliationResult {
  const dateTol = opts.dateToleranceDays ?? 5;
  const amountTol = opts.amountTolerance ?? 0.5;
  const maxParts = Math.max(2, Math.min(opts.aggregationMaxParts ?? 3, 6));

  const matched: MatchedPair[] = [];
  const deviations: MatchedPair[] = [];
  const usedCandidate = new Set<number>();
  const matchedBank = new Set<number>();

  // Pass 1: exakte Treffer — inkl. Skonto-reduziertem Betrag (bestimmeBetragsabweichung), sonst
  // sähe eine bewusst geringer überwiesene, korrekte Skonto-Zahlung wie ein Fehlbetrag aus.
  for (let bi = 0; bi < bank.length; bi++) {
    const mv = bank[bi];
    let best = -1;
    let bestDayDiff = Infinity;
    let bestTextScore = -1;
    let bestSkontoMatch = false;
    for (let ci = 0; ci < candidates.length; ci++) {
      if (usedCandidate.has(ci)) continue;
      const { amountDiff, skontoMatch } = bestimmeBetragsabweichung(candidates[ci], mv.amount);
      if (amountDiff > AMOUNT_EXACT) continue;
      const dayDiff = daysBetween(mv.date, candidates[ci].date);
      if (dayDiff > dateTol) continue;
      const textScore = pairTextScore(mv, candidates[ci]);
      if (textScore > bestTextScore + 1e-9 || (Math.abs(textScore - bestTextScore) <= 1e-9 && dayDiff < bestDayDiff)) {
        bestTextScore = textScore;
        bestDayDiff = dayDiff;
        best = ci;
        bestSkontoMatch = skontoMatch;
      }
    }
    if (best >= 0) {
      usedCandidate.add(best);
      matchedBank.add(bi);
      matched.push({
        bank: mv,
        candidate: candidates[best],
        amountDiff: bestimmeBetragsabweichung(candidates[best], mv.amount).amountDiff,
        dayDiff: bestDayDiff,
        category: "matched",
        source: "auto",
        textScore: bestTextScore,
        skontoMatch: bestSkontoMatch,
      });
    }
  }

  // Pass 2: Abweichungs-Treffer innerhalb der Betragstoleranz
  const pending: BankBuchung[] = [];
  for (let bi = 0; bi < bank.length; bi++) {
    if (matchedBank.has(bi)) continue;
    const mv = bank[bi];
    let best = -1;
    let bestScore = Infinity;
    let bestAmountDiff = 0;
    let bestDayDiff = 0;
    let bestTextScore = 0;
    let bestSkontoMatch = false;

    for (let ci = 0; ci < candidates.length; ci++) {
      if (usedCandidate.has(ci)) continue;
      const c = candidates[ci];
      const { amountDiff, skontoMatch } = bestimmeBetragsabweichung(c, mv.amount);
      if (amountDiff > amountTol) continue;
      const dayDiff = daysBetween(mv.date, c.date);
      const textScore = pairTextScore(mv, c);
      // textScore*10 ließ einen Rechnungsnummer-Treffer (0.85–1, "nahezu sicher" laut
      // pairTextScore-Doku) faktisch wirkungslos verpuffen: ein Zahlungsziel von wenigen
      // Wochen erzeugt leicht 20–40 Tage dayDiff, was den Text-Bonus von max. 10 Punkten
      // deutlich übersteigt — bei zwei offenen Rechnungen mit identischem Betrag gewann so
      // zuverlässig die zeitlich nähere statt der per Rechnungsnummer referenzierten. *500
      // bringt den Text-/Belegnummer-Treffer in dieselbe Größenordnung wie amountDiff*1000
      // innerhalb der (bereits per amountTol gedeckelten) Betragstoleranz.
      const score = amountDiff * 1000 + dayDiff - textScore * 500;
      if (score < bestScore) {
        bestScore = score;
        best = ci;
        bestAmountDiff = amountDiff;
        bestDayDiff = dayDiff;
        bestTextScore = textScore;
        bestSkontoMatch = skontoMatch;
      }
    }

    if (best >= 0) {
      usedCandidate.add(best);
      deviations.push({
        bank: mv,
        candidate: candidates[best],
        amountDiff: bestAmountDiff,
        dayDiff: bestDayDiff,
        category: "deviation",
        source: "auto",
        textScore: bestTextScore,
        skontoMatch: bestSkontoMatch,
      });
    } else {
      pending.push(mv);
    }
  }

  // Pass 3: N:1-Aggregation (Splitzahlungen)
  const aggregated: AggregatedGroup[] = [];
  const aggregatedBankIndexes = new Set<number>();
  const aggregatedCandidateIds = new Set<string>();

  if (pending.length >= 2 && pending.length <= AGGREGATION_PENDING_LIMIT) {
    const candidatesRemaining = candidates.filter((_, ci) => !usedCandidate.has(ci));
    for (const cand of candidatesRemaining) {
      const key = `${cand.kind}:${cand.id}`;
      if (aggregatedCandidateIds.has(key)) continue;
      const avail = pending
        .map((b, i) => ({ b, i }))
        .filter(({ i }) => !aggregatedBankIndexes.has(i))
        .filter(({ b }) => (cand.amount < 0 ? b.amount < 0 : b.amount > 0));

      const pickExactly = (need: number, start: number, sumSoFar: number, picked: number[]): number[] | null => {
        if (picked.length === need) {
          return Math.abs(sumSoFar - cand.amount) <= amountTol ? picked.slice() : null;
        }
        for (let k = start; k < avail.length; k++) {
          const hit = pickExactly(need, k + 1, sumSoFar + avail[k].b.amount, [...picked, k]);
          if (hit) return hit;
        }
        return null;
      };

      let found: number[] | null = null;
      for (let depth = 2; depth <= maxParts && !found; depth++) {
        if (depth >= 3 && avail.length > 20) break;
        if (depth >= 4 && avail.length > 14) break;
        found = pickExactly(depth, 0, 0, []);
      }
      if (found) found = found.map((k) => avail[k].i);

      if (found) {
        found.forEach((i) => aggregatedBankIndexes.add(i));
        aggregatedCandidateIds.add(key);
        const banks = found.map((i) => pending[i]);
        aggregated.push({
          banks,
          candidate: cand,
          sumAmountDiff: Math.abs(banks.reduce((s, b) => s + b.amount, 0) - cand.amount),
        });
      }
    }
  }

  const bankOnly = pending.filter((_, i) => !aggregatedBankIndexes.has(i));
  const candidateOnly = candidates.filter((c, ci) => !usedCandidate.has(ci) && !aggregatedCandidateIds.has(`${c.kind}:${c.id}`));

  const bankOnlyWithHint = computeBankHints(bankOnly, candidateOnly);
  const candidateOnlyWithHint = computeCandidateHints(candidateOnly, bankOnly);

  return {
    matched,
    deviations,
    aggregated,
    bankOnly: bankOnlyWithHint,
    candidateOnly: candidateOnlyWithHint,
    summary: buildSummary(bank, candidates, matched, deviations, aggregated, bankOnly, candidateOnly),
  };
}

function computeBankHints(bankOnly: BankBuchung[], candidateOnly: ReconCandidate[]): BankBuchungMitHinweis[] {
  return bankOnly.map((mv) => {
    let bestScore = -Infinity;
    let nearest: ReconCandidate | undefined;
    for (const c of candidateOnly) {
      const score = hintScore(mv, c);
      if (score > bestScore) { bestScore = score; nearest = c; }
    }
    return nearest
      ? { ...mv, nearestCandidate: nearest, nearestDiff: bestimmeBetragsabweichung(nearest, mv.amount).amountDiff, nearestScore: bestScore }
      : { ...mv };
  });
}

function computeCandidateHints(candidateOnly: ReconCandidate[], bankOnly: BankBuchung[]): ReconCandidateMitHinweis[] {
  return candidateOnly.map((c) => {
    let bestScore = -Infinity;
    let nearest: BankBuchung | undefined;
    for (const mv of bankOnly) {
      const score = hintScore(mv, c);
      if (score > bestScore) { bestScore = score; nearest = mv; }
    }
    return nearest
      ? { ...c, nearestBank: nearest, nearestDiff: bestimmeBetragsabweichung(c, nearest.amount).amountDiff, nearestScore: bestScore }
      : { ...c };
  });
}

/** KI-Vorschlag (vom Backend zurückgeliefert). */
export interface AiMatch {
  /** Index in das an die KI gesendete bankOnly-Array */
  bankIndex: number;
  candidateKind: ReconCandidateKind;
  candidateId: number;
  confidence: number;
  reason: string;
}

/**
 * Fügt KI-Vorschläge in ein Abgleichsergebnis ein. KI-Treffer landen immer in "deviations"
 * (brauchen menschliche Bestätigung), nie direkt in "matched".
 */
export function mergeAiMatches(base: ReconciliationResult, aiMatches: AiMatch[]): ReconciliationResult {
  const bankOnly = [...base.bankOnly];
  const candidateOnly = [...base.candidateOnly];
  const deviations = [...base.deviations];

  const consumedBank = new Set<number>();
  const consumedCandidate = new Set<string>();

  for (const m of aiMatches) {
    if (m.bankIndex < 0 || m.bankIndex >= bankOnly.length) continue;
    if (consumedBank.has(m.bankIndex)) continue;
    const mv = bankOnly[m.bankIndex];
    const key = `${m.candidateKind}:${m.candidateId}`;
    const c = candidateOnly.find((x) => x.kind === m.candidateKind && x.id === m.candidateId);
    if (!c || consumedCandidate.has(key)) continue;

    consumedBank.add(m.bankIndex);
    consumedCandidate.add(key);
    const { amountDiff, skontoMatch } = bestimmeBetragsabweichung(c, mv.amount);
    deviations.push({
      bank: mv,
      candidate: c,
      amountDiff,
      dayDiff: daysBetween(mv.date, c.date),
      category: "deviation",
      source: "ai",
      skontoMatch,
      aiReason: m.reason,
      confidence: m.confidence,
      textScore: pairTextScore(mv, c),
    });
  }

  const newBankOnly = bankOnly.filter((_, i) => !consumedBank.has(i));
  const newCandidateOnly = candidateOnly.filter((c) => !consumedCandidate.has(`${c.kind}:${c.id}`));
  const newBankOnlyWithHint = computeBankHints(newBankOnly, newCandidateOnly);
  const newCandidateOnlyWithHint = computeCandidateHints(newCandidateOnly, newBankOnly);

  return {
    matched: base.matched,
    deviations,
    aggregated: base.aggregated,
    bankOnly: newBankOnlyWithHint,
    candidateOnly: newCandidateOnlyWithHint,
    summary: buildSummary(
      [...base.matched.map((p) => p.bank), ...base.deviations.map((p) => p.bank), ...base.bankOnly],
      [...base.matched.map((p) => p.candidate), ...base.deviations.map((p) => p.candidate), ...base.candidateOnly],
      base.matched,
      deviations,
      base.aggregated,
      newBankOnly,
      newCandidateOnly
    ),
  };
}

function buildSummary(
  bank: BankBuchung[],
  candidates: ReconCandidate[],
  matched: MatchedPair[],
  deviations: MatchedPair[],
  aggregated: AggregatedGroup[],
  bankOnly: BankBuchung[],
  candidateOnly: ReconCandidate[]
): ReconciliationSummary {
  return {
    bankCount: bank.length,
    candidateCount: candidates.length,
    matchedCount: matched.length,
    deviationCount: deviations.length,
    aggregatedCount: aggregated.length,
    bankOnlyCount: bankOnly.length,
    candidateOnlyCount: candidateOnly.length,
  };
}
