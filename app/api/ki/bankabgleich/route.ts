import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { analyzeText, PROMPTS } from "@/lib/ai";
import { zuBankBuchung, ladeAlleOffenenKandidaten } from "@/lib/bankabgleich-kandidaten";
import { pairTextScore, daysBetween, type AiMatch, type ReconCandidateKind } from "@/lib/bankabgleich-matching";

export const dynamic = "force-dynamic";

const MAX_BANK = 50;
const MAX_KANDIDATEN = 50;
const VALID_KINDS: ReconCandidateKind[] = ["lieferung", "sammelrechnung", "ausgabe", "eingangsrechnung"];

// KI-Abgleich für Restfälle, die der deterministische Abgleich nicht auflösen konnte
// (requestType/feature "bankabgleich" — siehe PROMPTS.bankabgleich in lib/ai.ts).
// Jeder Treffer landet ausschließlich in der Antwort, wird NIE automatisch übernommen —
// die Bestätigung erfolgt weiterhin explizit über PUT /api/bankabgleich/[id].
export async function POST(req: NextRequest) {
  let body: { umsatzIds?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const umsatzIds = Array.isArray(body.umsatzIds)
    ? body.umsatzIds.filter((x): x is number => Number.isInteger(x)).slice(0, MAX_BANK)
    : [];
  if (umsatzIds.length === 0) {
    return NextResponse.json({ error: "Keine umsatzIds übermittelt" }, { status: 400 });
  }

  try {
    const umsaetze = await prisma.kontoumsatz.findMany({
      where: { id: { in: umsatzIds }, zugeordnet: false },
    });
    if (umsaetze.length === 0) return NextResponse.json({ matches: [] });

    const bankBuchungen = umsaetze.map(zuBankBuchung);
    const alleKandidaten = await ladeAlleOffenenKandidaten();
    const kandidaten = alleKandidaten.slice(0, MAX_KANDIDATEN);

    const customPrompt = await prisma.einstellung.findUnique({ where: { key: "ki.prompt.bankabgleich" } });
    const systemPrompt = customPrompt?.value || PROMPTS.bankabgleich;

    const userText = JSON.stringify({
      bankbuchungen: bankBuchungen.map((b, i) => ({
        index: i,
        datum: b.date,
        betrag: b.amount,
        verwendungszweck: b.purpose,
        name: b.name,
      })),
      kandidaten: kandidaten.map((k) => ({
        kind: k.kind,
        id: k.id,
        datum: k.date,
        betrag: k.amount,
        beschreibung: k.description,
        gegenpartei: k.counterparty,
        belegnummer: k.receiptNumber ?? null,
      })),
    });

    const result = await analyzeText(userText, systemPrompt, "bankabgleich");
    const parsed = result.parsed as { matches?: unknown };
    const rawMatches = Array.isArray(parsed.matches) ? parsed.matches : [];

    // Anti-Halluzinations-Guard: nur gegen tatsächlich gesendete Indizes/IDs validieren,
    // Konfidenz-Schwelle serverseitig erneut prüfen, 1:1-Eindeutigkeit erzwingen.
    const seenBank = new Set<number>();
    const seenCandidate = new Set<string>();
    const matches: AiMatch[] = [];
    for (const m of rawMatches) {
      if (typeof m !== "object" || m === null) continue;
      const mm = m as Record<string, unknown>;
      const bankIndex = typeof mm.bankIndex === "number" ? mm.bankIndex : -1;
      const candidateKind = typeof mm.candidateKind === "string" ? mm.candidateKind : "";
      const candidateId = typeof mm.candidateId === "number" ? mm.candidateId : -1;
      const confidence = typeof mm.confidence === "number" ? mm.confidence : 0;

      if (bankIndex < 0 || bankIndex >= bankBuchungen.length) continue;
      if (!VALID_KINDS.includes(candidateKind as ReconCandidateKind)) continue;
      if (confidence < 0.5) continue;
      if (seenBank.has(bankIndex)) continue;

      const candKey = `${candidateKind}:${candidateId}`;
      if (seenCandidate.has(candKey)) continue;
      const kandidat = kandidaten.find((k) => k.kind === candidateKind && k.id === candidateId);
      if (!kandidat) continue;

      seenBank.add(bankIndex);
      seenCandidate.add(candKey);
      matches.push({
        bankIndex,
        candidateKind: candidateKind as ReconCandidateKind,
        candidateId,
        confidence,
        reason: typeof mm.reason === "string" ? mm.reason.slice(0, 300) : "",
      });
    }

    const antwort = matches.map((m) => {
      const bank = bankBuchungen[m.bankIndex];
      const kandidat = kandidaten.find((k) => k.kind === m.candidateKind && k.id === m.candidateId)!;
      return {
        bank: { umsatzId: bank.id, datum: bank.date, betrag: bank.amount, verwendungszweck: bank.purpose },
        kandidat: {
          typ: kandidat.kind,
          id: kandidat.id,
          bezeichnung: kandidat.receiptNumber || kandidat.description,
          gegenpartei: kandidat.counterparty,
          betrag: Math.abs(kandidat.amount),
        },
        amountDiff: Math.abs(kandidat.amount - bank.amount),
        dayDiff: daysBetween(bank.date, kandidat.date),
        textScore: pairTextScore(bank, kandidat),
        konfidenz: m.confidence,
        begruendung: m.reason,
        wirdBezahltAm: bank.date,
      };
    });

    return NextResponse.json({ matches: antwort, tokensIn: result.tokensIn, tokensOut: result.tokensOut });
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    const message = isDev && err instanceof Error ? err.message : "KI-Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
