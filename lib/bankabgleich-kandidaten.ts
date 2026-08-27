// Lädt offene Kandidaten (Verkaufs- und Einkaufsseite) für den Bankabgleich-Matcher
// (lib/bankabgleich-matching.ts) sowie die Umwandlung eines Kontoumsatz-Datensatzes in eine
// BankBuchung. Zentral an einer Stelle, damit Einzel-Vorschläge (vorschlaege/route.ts) und
// Massen-Abgleich (auto-match/route.ts) exakt dieselben Kandidaten sehen.

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { berechneLieferungBrutto, berechneSammelrechnungBrutto } from "@/lib/lieferung-brutto";
import type { BankBuchung, ReconCandidate } from "@/lib/bankabgleich-matching";

const MAX_KANDIDATEN = 300;
/** Treffer-Limit je Beleg-Typ für die gezielte Text-/Rechnungsnummer-Suche (sucheKandidatenFuerBetrag). */
const SEARCH_LIMIT = 20;

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

const LIEFERUNG_INCLUDE = {
  kunde: { select: { name: true } },
  positionen: { include: { artikel: { select: { mwstSatz: true } } } },
} satisfies Prisma.LieferungInclude;

const SAMMELRECHNUNG_INCLUDE = {
  kunde: { select: { name: true } },
  lieferungen: { include: { positionen: { include: { artikel: { select: { mwstSatz: true } } } } } },
} satisfies Prisma.SammelrechnungInclude;

/** Betrag nach Abzug des hinterlegten Skonto-Prozentsatzes — undefined wenn kein Skonto gepflegt
 * ist. Skonto-Tage/-Frist spielen hier bewusst keine Rolle: der Bankabgleich soll die Zahlung
 * einer Rechnung erkennen, nicht die Fristeinhaltung durchsetzen (das bleibt Sache des manuellen
 * "Skonto wurde genutzt"-Häkchens auf der Lieferungs-Detailseite). */
function skontoBetrag(brutto: number, skontoProzent: number | null): number | undefined {
  return skontoProzent != null ? brutto * (1 - skontoProzent / 100) : undefined;
}

async function ladeLieferungKandidaten(where: Prisma.LieferungWhereInput, take: number): Promise<ReconCandidate[]> {
  const lieferungen = await prisma.lieferung.findMany({
    where,
    include: LIEFERUNG_INCLUDE,
    take,
    orderBy: { rechnungDatum: "desc" },
  });
  return lieferungen.map((l) => {
    const amount = berechneLieferungBrutto(l);
    return {
      kind: "lieferung",
      id: l.id,
      date: toIso(l.rechnungDatum ?? l.datum),
      amount,
      description: `Lieferung ${l.rechnungNr ?? ""}`.trim(),
      counterparty: l.kunde.name,
      receiptNumber: l.rechnungNr ?? undefined,
      skontoAmount: skontoBetrag(amount, l.skontoProzent),
    };
  });
}

async function ladeSammelrechnungKandidaten(where: Prisma.SammelrechnungWhereInput, take: number): Promise<ReconCandidate[]> {
  const sammelrechnungen = await prisma.sammelrechnung.findMany({
    where,
    include: SAMMELRECHNUNG_INCLUDE,
    take,
    orderBy: { rechnungDatum: "desc" },
  });
  return sammelrechnungen.map((s) => {
    const amount = berechneSammelrechnungBrutto(s);
    return {
      kind: "sammelrechnung",
      id: s.id,
      date: toIso(s.rechnungDatum ?? s.createdAt),
      amount,
      description: `Sammelrechnung ${s.rechnungNr ?? ""}`.trim(),
      counterparty: s.kunde.name,
      receiptNumber: s.rechnungNr ?? undefined,
      skontoAmount: skontoBetrag(amount, s.skontoProzent),
    };
  });
}

async function ladeAusgabeKandidaten(where: Prisma.AusgabeWhereInput, take: number): Promise<ReconCandidate[]> {
  const ausgaben = await prisma.ausgabe.findMany({
    where,
    include: { lieferant: { select: { name: true } } },
    take,
    orderBy: { datum: "desc" },
  });
  return ausgaben.map((a) => ({
    kind: "ausgabe",
    id: a.id,
    date: toIso(a.datum),
    amount: -(a.betragNetto * (1 + a.mwstSatz / 100)),
    description: a.beschreibung,
    counterparty: a.lieferant?.name ?? a.ausleger ?? "",
    receiptNumber: a.belegNr ?? undefined,
  }));
}

async function ladeEingangsrechnungKandidaten(where: Prisma.EingangsRechnungWhereInput, take: number): Promise<ReconCandidate[]> {
  const eingangsrechnungen = await prisma.eingangsRechnung.findMany({
    where,
    include: { lieferant: { select: { name: true } } },
    take,
    orderBy: { datum: "desc" },
  });
  return eingangsrechnungen.map((r) => ({
    kind: "eingangsrechnung",
    id: r.id,
    // Betrag ist netto gepflegt (siehe app/eingangsrechnungen/neu), Brutto = betrag*(1+mwst/100)
    date: toIso(r.datum),
    amount: -(r.betrag * (1 + r.mwst / 100)),
    description: `Rechnung ${r.nummer ?? ""}`.trim(),
    counterparty: r.lieferant.name,
    receiptNumber: r.nummer ?? undefined,
  }));
}

/** Offene Kandidaten auf der Verkaufsseite (Zahlungseingänge): Lieferungen + Sammelrechnungen. */
export async function ladeVerkaufsKandidaten(): Promise<ReconCandidate[]> {
  const [lieferungKandidaten, sammelKandidaten] = await Promise.all([
    ladeLieferungKandidaten({ bezahltAm: null, rechnungNr: { not: null } }, MAX_KANDIDATEN),
    ladeSammelrechnungKandidaten({ bezahltAm: null, rechnungNr: { not: null } }, MAX_KANDIDATEN),
  ]);
  return [...lieferungKandidaten, ...sammelKandidaten];
}

/** Offene Kandidaten auf der Einkaufsseite (Zahlungsausgänge): Ausgaben + Lieferantenrechnungen. */
export async function ladeEinkaufsKandidaten(): Promise<ReconCandidate[]> {
  const [ausgabeKandidaten, eingangKandidaten] = await Promise.all([
    ladeAusgabeKandidaten({ bezahltAm: null }, MAX_KANDIDATEN),
    ladeEingangsrechnungKandidaten({ status: "OFFEN" }, MAX_KANDIDATEN),
  ]);
  return [...ausgabeKandidaten, ...eingangKandidaten];
}

/**
 * Gezielte Text-/Rechnungsnummer-Suche direkt gegen die Datenbank (statt gegen den nach Datum
 * begrenzten "alle offenen Kandidaten"-Pool von ladeVerkaufsKandidaten/ladeEinkaufsKandidaten).
 * Ohne diesen eigenen DB-Query fiel eine ältere, aber noch offene Rechnung aus der Suche heraus,
 * sobald mehr als MAX_KANDIDATEN (300) neuere offene Rechnungen/Sammelrechnungen existierten —
 * exakt das gleiche Muster wie der frühere Kunden-Picker-Bug (siehe AGENTS.md).
 */
export async function sucheVerkaufsKandidaten(q: string): Promise<ReconCandidate[]> {
  const [lieferungKandidaten, sammelKandidaten] = await Promise.all([
    ladeLieferungKandidaten(
      {
        bezahltAm: null,
        rechnungNr: { not: null },
        OR: [{ rechnungNr: { contains: q } }, { kunde: { name: { contains: q } } }],
      },
      SEARCH_LIMIT
    ),
    ladeSammelrechnungKandidaten(
      {
        bezahltAm: null,
        rechnungNr: { not: null },
        OR: [{ rechnungNr: { contains: q } }, { kunde: { name: { contains: q } } }],
      },
      SEARCH_LIMIT
    ),
  ]);
  return [...lieferungKandidaten, ...sammelKandidaten];
}

export async function sucheEinkaufsKandidaten(q: string): Promise<ReconCandidate[]> {
  const [ausgabeKandidaten, eingangKandidaten] = await Promise.all([
    ladeAusgabeKandidaten(
      {
        bezahltAm: null,
        OR: [{ belegNr: { contains: q } }, { beschreibung: { contains: q } }, { lieferant: { name: { contains: q } } }],
      },
      SEARCH_LIMIT
    ),
    ladeEingangsrechnungKandidaten(
      {
        status: "OFFEN",
        OR: [{ nummer: { contains: q } }, { lieferant: { name: { contains: q } } }],
      },
      SEARCH_LIMIT
    ),
  ]);
  return [...ausgabeKandidaten, ...eingangKandidaten];
}

/** Passende Kandidaten je nach Vorzeichen des Bankbetrags (spart unnötige Kandidaten). */
export async function ladeKandidatenFuerBetrag(betrag: number): Promise<ReconCandidate[]> {
  return betrag >= 0 ? ladeVerkaufsKandidaten() : ladeEinkaufsKandidaten();
}

/** Wie ladeKandidatenFuerBetrag, aber als gezielte DB-Suche nach Text/Rechnungsnummer (siehe
 * sucheVerkaufsKandidaten/sucheEinkaufsKandidaten). */
export async function sucheKandidatenFuerBetrag(betrag: number, q: string): Promise<ReconCandidate[]> {
  return betrag >= 0 ? sucheVerkaufsKandidaten(q) : sucheEinkaufsKandidaten(q);
}

export async function ladeAlleOffenenKandidaten(): Promise<ReconCandidate[]> {
  const [verkauf, einkauf] = await Promise.all([ladeVerkaufsKandidaten(), ladeEinkaufsKandidaten()]);
  return [...verkauf, ...einkauf];
}
