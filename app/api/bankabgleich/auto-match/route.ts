import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runNormalMatch, type ReconCandidateKind } from "@/lib/bankabgleich-matching";
import { zuBankBuchung, ladeAlleOffenenKandidaten } from "@/lib/bankabgleich-kandidaten";
import { Sentry } from "@/lib/sentry";

export const dynamic = "force-dynamic";

const MAX_UMSAETZE = 500;

interface BankInfo {
  umsatzId: number;
  datum: string;
  betrag: number;
  verwendungszweck: string;
  gegenpartei: string;
}

interface KandidatInfo {
  typ: ReconCandidateKind;
  id: number;
  bezeichnung: string;
  gegenpartei: string;
  betrag: number;
}

interface AbgleichPaar {
  bank: BankInfo;
  kandidat: KandidatInfo;
  amountDiff: number;
  dayDiff: number;
  textScore: number;
  /** Datum (ISO), das bei Annahme als "bezahlt" auf dem Zielobjekt gesetzt würde. */
  wirdBezahltAm: string;
  /** true = amountDiff wurde gegen den Skonto-reduzierten statt den vollen Rechnungsbetrag berechnet. */
  skontoMatch: boolean;
}

export async function POST(req: NextRequest) {
  let body: { von?: string; bis?: string; kontoBezeichnung?: string; dateToleranceDays?: number; amountTolerance?: number };
  try {
    body = await req.json();
  } catch (err) {
    Sentry.captureException(err);
    body = {};
  }

  const where: Record<string, unknown> = { zugeordnet: false, ignoriert: false };
  if (body.von || body.bis) {
    where.buchungsdatum = {
      ...(body.von ? { gte: new Date(body.von) } : {}),
      ...(body.bis ? { lte: new Date(new Date(body.bis).setHours(23, 59, 59, 999)) } : {}),
    };
  }
  if (body.kontoBezeichnung) where.kontoBezeichnung = body.kontoBezeichnung;

  try {
    const umsaetze = await prisma.kontoumsatz.findMany({
      where,
      orderBy: { buchungsdatum: "desc" },
      take: MAX_UMSAETZE,
    });

    const bankBuchungen = umsaetze.map(zuBankBuchung);
    const kandidaten = await ladeAlleOffenenKandidaten();

    const result = runNormalMatch(bankBuchungen, kandidaten, {
      dateToleranceDays: body.dateToleranceDays,
      amountTolerance: body.amountTolerance,
    });

    const toKandidatInfo = (k: (typeof kandidaten)[number]): KandidatInfo => ({
      typ: k.kind,
      id: k.id,
      bezeichnung: k.receiptNumber || k.description,
      gegenpartei: k.counterparty,
      betrag: Math.abs(k.amount),
    });
    const toBankInfo = (b: (typeof bankBuchungen)[number]): BankInfo => ({
      umsatzId: b.id,
      datum: b.date,
      betrag: b.amount,
      verwendungszweck: b.purpose,
      gegenpartei: b.name,
    });
    const toPaar = (p: { bank: (typeof bankBuchungen)[number]; candidate: (typeof kandidaten)[number]; amountDiff: number; dayDiff: number; textScore?: number; skontoMatch?: boolean }): AbgleichPaar => ({
      bank: toBankInfo(p.bank),
      kandidat: toKandidatInfo(p.candidate),
      amountDiff: p.amountDiff,
      dayDiff: p.dayDiff,
      textScore: p.textScore ?? 0,
      wirdBezahltAm: p.bank.date,
      skontoMatch: p.skontoMatch ?? false,
    });

    return NextResponse.json({
      matched: result.matched.map(toPaar),
      deviations: result.deviations.map(toPaar),
      aggregated: result.aggregated.map((g) => ({
        banks: g.banks.map(toBankInfo),
        kandidat: toKandidatInfo(g.candidate),
        sumAmountDiff: g.sumAmountDiff,
      })),
      bankOnly: result.bankOnly.map((b) => ({
        ...toBankInfo(b),
        naechsterKandidat: b.nearestCandidate ? toKandidatInfo(b.nearestCandidate) : null,
        naechsteDiff: b.nearestDiff ?? null,
      })),
      candidateOnly: result.candidateOnly.map((c) => ({
        ...toKandidatInfo(c),
        naechsteBankbuchung: c.nearestBank ? toBankInfo(c.nearestBank) : null,
        naechsteDiff: c.nearestDiff ?? null,
      })),
      summary: result.summary,
    });
  } catch (err) {
    Sentry.captureException(err);
    console.error(err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
