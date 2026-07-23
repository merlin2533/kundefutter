// Lädt offene Kandidaten (Verkaufs- und Einkaufsseite) für den Bankabgleich-Matcher
// (lib/bankabgleich-matching.ts) sowie die Umwandlung eines Kontoumsatz-Datensatzes in eine
// BankBuchung. Zentral an einer Stelle, damit Einzel-Vorschläge (vorschlaege/route.ts) und
// Massen-Abgleich (auto-match/route.ts) exakt dieselben Kandidaten sehen.

import { prisma } from "@/lib/prisma";
import { berechneLieferungBrutto, berechneSammelrechnungBrutto } from "@/lib/lieferung-brutto";
import type { BankBuchung, ReconCandidate } from "@/lib/bankabgleich-matching";

const MAX_KANDIDATEN = 300;

function toIso(d: Date | null | undefined): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

export interface KontoumsatzFuerMatching {
  id: number;
  buchungsdatum: Date;
  betrag: number;
  verwendungszweck: string;
  gegenkontoName: string | null;
  gegenkonto: string | null;
}

export function zuBankBuchung(u: KontoumsatzFuerMatching): BankBuchung {
  return {
    id: u.id,
    date: toIso(u.buchungsdatum),
    amount: u.betrag,
    purpose: u.verwendungszweck || "",
    name: u.gegenkontoName || u.gegenkonto || "",
  };
}

/** Offene Kandidaten auf der Verkaufsseite (Zahlungseingänge): Lieferungen + Sammelrechnungen. */
export async function ladeVerkaufsKandidaten(): Promise<ReconCandidate[]> {
  const [lieferungen, sammelrechnungen] = await Promise.all([
    prisma.lieferung.findMany({
      where: { bezahltAm: null, rechnungNr: { not: null } },
      include: {
        kunde: { select: { name: true } },
        positionen: { include: { artikel: { select: { mwstSatz: true } } } },
      },
      take: MAX_KANDIDATEN,
      orderBy: { rechnungDatum: "desc" },
    }),
    prisma.sammelrechnung.findMany({
      where: { bezahltAm: null, rechnungNr: { not: null } },
      include: {
        kunde: { select: { name: true } },
        lieferungen: { include: { positionen: { include: { artikel: { select: { mwstSatz: true } } } } } },
      },
      take: MAX_KANDIDATEN,
      orderBy: { rechnungDatum: "desc" },
    }),
  ]);

  const lieferungKandidaten: ReconCandidate[] = lieferungen.map((l) => ({
    kind: "lieferung",
    id: l.id,
    date: toIso(l.rechnungDatum ?? l.datum),
    amount: berechneLieferungBrutto(l),
    description: `Lieferung ${l.rechnungNr ?? ""}`.trim(),
    counterparty: l.kunde.name,
    receiptNumber: l.rechnungNr ?? undefined,
  }));

  const sammelKandidaten: ReconCandidate[] = sammelrechnungen.map((s) => ({
    kind: "sammelrechnung",
    id: s.id,
    date: toIso(s.rechnungDatum ?? s.createdAt),
    amount: berechneSammelrechnungBrutto(s),
    description: `Sammelrechnung ${s.rechnungNr ?? ""}`.trim(),
    counterparty: s.kunde.name,
    receiptNumber: s.rechnungNr ?? undefined,
  }));

  return [...lieferungKandidaten, ...sammelKandidaten];
}

/** Offene Kandidaten auf der Einkaufsseite (Zahlungsausgänge): Ausgaben + Lieferantenrechnungen. */
export async function ladeEinkaufsKandidaten(): Promise<ReconCandidate[]> {
  const [ausgaben, eingangsrechnungen] = await Promise.all([
    prisma.ausgabe.findMany({
      where: { bezahltAm: null },
      include: { lieferant: { select: { name: true } } },
      take: MAX_KANDIDATEN,
      orderBy: { datum: "desc" },
    }),
    prisma.eingangsRechnung.findMany({
      where: { status: "OFFEN" },
      include: { lieferant: { select: { name: true } } },
      take: MAX_KANDIDATEN,
      orderBy: { datum: "desc" },
    }),
  ]);

  const ausgabeKandidaten: ReconCandidate[] = ausgaben.map((a) => ({
    kind: "ausgabe",
    id: a.id,
    date: toIso(a.datum),
    amount: -(a.betragNetto * (1 + a.mwstSatz / 100)),
    description: a.beschreibung,
    counterparty: a.lieferant?.name ?? a.ausleger ?? "",
    receiptNumber: a.belegNr ?? undefined,
  }));

  const eingangKandidaten: ReconCandidate[] = eingangsrechnungen.map((r) => ({
    kind: "eingangsrechnung",
    id: r.id,
    // Betrag ist netto gepflegt (siehe app/eingangsrechnungen/neu), Brutto = betrag*(1+mwst/100)
    date: toIso(r.datum),
    amount: -(r.betrag * (1 + r.mwst / 100)),
    description: `Rechnung ${r.nummer ?? ""}`.trim(),
    counterparty: r.lieferant.name,
    receiptNumber: r.nummer ?? undefined,
  }));

  return [...ausgabeKandidaten, ...eingangKandidaten];
}

/** Passende Kandidaten je nach Vorzeichen des Bankbetrags (spart unnötige Kandidaten). */
export async function ladeKandidatenFuerBetrag(betrag: number): Promise<ReconCandidate[]> {
  return betrag >= 0 ? ladeVerkaufsKandidaten() : ladeEinkaufsKandidaten();
}

export async function ladeAlleOffenenKandidaten(): Promise<ReconCandidate[]> {
  const [verkauf, einkauf] = await Promise.all([ladeVerkaufsKandidaten(), ladeEinkaufsKandidaten()]);
  return [...verkauf, ...einkauf];
}
