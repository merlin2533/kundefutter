import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rankCandidatesForBank, daysBetween, type ReconCandidate, type ReconCandidateKind } from "@/lib/bankabgleich-matching";
import { zuBankBuchung, ladeKandidatenFuerBetrag } from "@/lib/bankabgleich-kandidaten";
import { Sentry } from "@/lib/sentry";

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
const MAX_SUCHTREFFER = 20;

/** hoch = praktisch exakter Treffer; mittel = übliche Toleranz (Betrag ≤0,50€) ODER starker
 * Text-/Belegnummer-Match trotz größerer Abweichung; alles andere niedrig — wird bewusst nicht
 * mehr verworfen (siehe rankCandidatesForBank), damit echte Fehlbeträge/Überzahlungen einer
 * tatsächlichen Rechnung nicht spurlos aus den Vorschlägen verschwinden. */
function konfidenzFuer(amountDiff: number, dayDiff: number, textScore: number): "hoch" | "mittel" | "niedrig" {
  if (amountDiff < 0.01 && dayDiff <= 5) return "hoch";
  if (amountDiff <= 0.5 || textScore >= 0.5) return "mittel";
  return "niedrig";
}

function zuVorschlag(c: ReconCandidate, wirdBezahltAm: string, amountDiff: number, dayDiff: number, textScore: number): Vorschlag {
  return {
    typ: c.kind,
    id: c.id,
    bezeichnung: c.receiptNumber || c.description,
    gegenpartei: c.counterparty,
    betrag: Math.abs(c.amount),
    konfidenz: konfidenzFuer(amountDiff, dayDiff, textScore),
    amountDiff,
    dayDiff,
    textScore,
    wirdBezahltAm,
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const umsatzIdStr = searchParams.get("umsatzId");
  const umsatzId = parseInt(umsatzIdStr || "", 10);
  if (isNaN(umsatzId)) {
    return NextResponse.json({ error: "Ungültige umsatzId" }, { status: 400 });
  }
  const q = searchParams.get("q")?.trim().toLowerCase() ?? "";

  try {
    const umsatz = await prisma.kontoumsatz.findUnique({ where: { id: umsatzId } });
    if (!umsatz) return NextResponse.json({ error: "Umsatz nicht gefunden" }, { status: 404 });

    const bank = zuBankBuchung(umsatz);
    const kandidaten = await ladeKandidatenFuerBetrag(umsatz.betrag);

    // Manuelle Suche: alle offenen Kandidaten gleichen Vorzeichens (Verkauf/Einkauf, wie der
    // Bankbetrag) nach Rechnungsnr./Kunde/Text durchsuchen — unabhängig von Betrags-/
    // Datumsnähe, für den Fall, dass die passende Rechnung nicht unter den Top-Vorschlägen ist.
    if (q.length >= 2) {
      const treffer = kandidaten.filter(
        (c) =>
          c.receiptNumber?.toLowerCase().includes(q) ||
          c.counterparty.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q)
      );
      const vorschlaege = treffer
        .slice(0, MAX_SUCHTREFFER)
        .map((c) => zuVorschlag(c, bank.date, Math.abs(c.amount - bank.amount), daysBetween(bank.date, c.date), 0));
      return NextResponse.json(vorschlaege);
    }

    const ranked = rankCandidatesForBank(bank, kandidaten, MAX_VORSCHLAEGE);
    const vorschlaege = ranked.map((r) => zuVorschlag(r.candidate, bank.date, r.amountDiff, r.dayDiff, r.textScore));

    return NextResponse.json(vorschlaege);
  } catch (err) {
    Sentry.captureException(err);
    console.error(err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
