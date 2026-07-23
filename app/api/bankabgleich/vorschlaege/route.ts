import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runNormalMatch, type ReconCandidateKind } from "@/lib/bankabgleich-matching";
import { zuBankBuchung, ladeKandidatenFuerBetrag } from "@/lib/bankabgleich-kandidaten";

export const dynamic = "force-dynamic";

export interface Vorschlag {
  typ: ReconCandidateKind;
  id: number;
  bezeichnung: string;
  gegenpartei: string;
  betrag: number;
  konfidenz: "hoch" | "mittel" | "niedrig";
  amountDiff: number;
  dayDiff: number;
  textScore: number;
  /** Datum (ISO), das bei Annahme als "bezahlt" auf dem Zielobjekt gesetzt würde. */
  wirdBezahltAm: string;
}

const MAX_VORSCHLAEGE = 8;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const umsatzIdStr = searchParams.get("umsatzId");
  const umsatzId = parseInt(umsatzIdStr || "", 10);
  if (isNaN(umsatzId)) {
    return NextResponse.json({ error: "Ungültige umsatzId" }, { status: 400 });
  }

  try {
    const umsatz = await prisma.kontoumsatz.findUnique({ where: { id: umsatzId } });
    if (!umsatz) return NextResponse.json({ error: "Umsatz nicht gefunden" }, { status: 404 });

    const bank = zuBankBuchung(umsatz);
    const kandidaten = await ladeKandidatenFuerBetrag(umsatz.betrag);
    const result = runNormalMatch([bank], kandidaten);

    const vorschlaege: Vorschlag[] = [
      ...result.matched.map((p) => ({
        typ: p.candidate.kind,
        id: p.candidate.id,
        bezeichnung: p.candidate.receiptNumber || p.candidate.description,
        gegenpartei: p.candidate.counterparty,
        betrag: Math.abs(p.candidate.amount),
        konfidenz: "hoch" as const,
        amountDiff: p.amountDiff,
        dayDiff: p.dayDiff,
        textScore: p.textScore ?? 0,
        wirdBezahltAm: bank.date,
      })),
      ...result.deviations.map((p) => ({
        typ: p.candidate.kind,
        id: p.candidate.id,
        bezeichnung: p.candidate.receiptNumber || p.candidate.description,
        gegenpartei: p.candidate.counterparty,
        betrag: Math.abs(p.candidate.amount),
        konfidenz: ((p.textScore ?? 0) >= 0.5 ? "mittel" : "niedrig") as "mittel" | "niedrig",
        amountDiff: p.amountDiff,
        dayDiff: p.dayDiff,
        textScore: p.textScore ?? 0,
        wirdBezahltAm: bank.date,
      })),
    ];

    // Beste zuerst: hoch > mittel > niedrig, innerhalb dessen geringste Betragsabweichung
    const rang = { hoch: 0, mittel: 1, niedrig: 2 };
    vorschlaege.sort((a, b) => rang[a.konfidenz] - rang[b.konfidenz] || a.amountDiff - b.amountDiff);

    return NextResponse.json(vorschlaege.slice(0, MAX_VORSCHLAEGE));
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
