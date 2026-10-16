/**
 * lib/eier-rueckverfolgung.ts
 * Chargen-Rückverfolgung für Eier (Rückruf-Fall): von einer Chargennummer bzw. einem
 * Erzeugercode vorwärts zu den Sortierungen (Eingang) und den belieferten Kunden (Ausgang).
 * Die Treffer-Logik (Normalisierung, Zusammenfassung) ist rein und getrennt von der DB-Abfrage,
 * damit sie ohne Prisma testbar ist.
 */
import { prisma } from "@/lib/prisma";

export const RUECKVERFOLGUNG_MIN_ZEICHEN = 2;
const MAX_TREFFER = 1000;

export interface RueckverfolgungSuche {
  charge: string;
  erzeugercode: string;
}

export interface RueckverfolgungSortierung {
  positionId: number;
  sortierungId: number;
  datum: Date;
  artikel: string;
  gueteklasse: string;
  gewichtsklasse: string;
  menge: number;
  chargeNr: string | null;
  erzeugercode: string | null;
  legedatum: Date | null;
}

export interface RueckverfolgungLieferung {
  positionId: number;
  lieferungId: number;
  datum: Date;
  status: string;
  rechnungNr: string | null;
  kundeId: number;
  kundeName: string;
  kundeOrt: string | null;
  artikel: string;
  menge: number;
  einheit: string;
  chargeNr: string | null;
  erzeugercode: string | null;
  legedatum: Date | null;
}

export interface RueckverfolgungKunde {
  kundeId: number;
  kundeName: string;
  kundeOrt: string | null;
  lieferungen: number;
  menge: number;
}

export interface RueckverfolgungErgebnis {
  sortierungen: RueckverfolgungSortierung[];
  lieferungen: RueckverfolgungLieferung[];
  kunden: RueckverfolgungKunde[];
  mengeSortiert: number;
  mengeAusgeliefert: number;
  abgeschnitten: boolean;
}

/** Trimmt die Eingaben; liefert null, wenn beide Felder für eine sinnvolle Suche zu kurz sind. */
export function normalisiereSuche(charge: string | null | undefined, erzeugercode: string | null | undefined): RueckverfolgungSuche | null {
  const c = (charge ?? "").trim();
  const e = (erzeugercode ?? "").trim();
  const cOk = c.length >= RUECKVERFOLGUNG_MIN_ZEICHEN;
  const eOk = e.length >= RUECKVERFOLGUNG_MIN_ZEICHEN;
  if (!cOk && !eOk) return null;
  return { charge: cOk ? c : "", erzeugercode: eOk ? e : "" };
}

/** Fasst die Lieferungen je Kunde zusammen (nur nicht stornierte zählen als ausgeliefert/geplant). */
export function fasseKundenZusammen(lieferungen: RueckverfolgungLieferung[]): RueckverfolgungKunde[] {
  const map = new Map<number, RueckverfolgungKunde>();
  const gezaehlt = new Map<number, Set<number>>();
  for (const l of lieferungen) {
    if (l.status === "storniert") continue;
    let k = map.get(l.kundeId);
    if (!k) {
      k = { kundeId: l.kundeId, kundeName: l.kundeName, kundeOrt: l.kundeOrt, lieferungen: 0, menge: 0 };
      map.set(l.kundeId, k);
      gezaehlt.set(l.kundeId, new Set());
    }
    k.menge += l.menge;
    const set = gezaehlt.get(l.kundeId)!;
    if (!set.has(l.lieferungId)) {
      set.add(l.lieferungId);
      k.lieferungen += 1;
    }
  }
  return [...map.values()].sort((a, b) => b.menge - a.menge || a.kundeName.localeCompare(b.kundeName));
}

export async function sucheRueckverfolgung(suche: RueckverfolgungSuche): Promise<RueckverfolgungErgebnis> {
  const filter = [
    ...(suche.charge ? [{ chargeNr: { contains: suche.charge } }] : []),
    ...(suche.erzeugercode ? [{ erzeugercode: { contains: suche.erzeugercode } }] : []),
  ];

  const [sortPos, lieferPos] = await Promise.all([
    prisma.eierSortierungPosition.findMany({
      where: { OR: filter },
      select: {
        id: true,
        sortierungId: true,
        gueteklasse: true,
        gewichtsklasse: true,
        menge: true,
        chargeNr: true,
        erzeugercode: true,
        legedatum: true,
        artikel: { select: { name: true } },
        sortierung: { select: { datum: true } },
      },
      orderBy: { id: "desc" },
      take: MAX_TREFFER + 1,
    }),
    prisma.lieferposition.findMany({
      // gueteklasse gesetzt = Position ist ein Ei (siehe eierKennzeichnungZeile)
      where: { gueteklasse: { not: null }, OR: filter },
      select: {
        id: true,
        menge: true,
        chargeNr: true,
        erzeugercode: true,
        legedatum: true,
        artikel: { select: { name: true, einheit: true } },
        lieferung: {
          select: {
            id: true,
            datum: true,
            status: true,
            rechnungNr: true,
            kunde: { select: { id: true, name: true, firma: true, ort: true } },
          },
        },
      },
      orderBy: { id: "desc" },
      take: MAX_TREFFER + 1,
    }),
  ]);

  const abgeschnitten = sortPos.length > MAX_TREFFER || lieferPos.length > MAX_TREFFER;

  const sortierungen: RueckverfolgungSortierung[] = sortPos.slice(0, MAX_TREFFER).map((p) => ({
    positionId: p.id,
    sortierungId: p.sortierungId,
    datum: p.sortierung.datum,
    artikel: p.artikel.name,
    gueteklasse: p.gueteklasse,
    gewichtsklasse: p.gewichtsklasse,
    menge: p.menge,
    chargeNr: p.chargeNr,
    erzeugercode: p.erzeugercode,
    legedatum: p.legedatum,
  }));

  const lieferungen: RueckverfolgungLieferung[] = lieferPos.slice(0, MAX_TREFFER).map((p) => ({
    positionId: p.id,
    lieferungId: p.lieferung.id,
    datum: p.lieferung.datum,
    status: p.lieferung.status,
    rechnungNr: p.lieferung.rechnungNr,
    kundeId: p.lieferung.kunde.id,
    kundeName: p.lieferung.kunde.firma?.trim() || p.lieferung.kunde.name,
    kundeOrt: p.lieferung.kunde.ort,
    artikel: p.artikel.name,
    menge: p.menge,
    einheit: p.artikel.einheit,
    chargeNr: p.chargeNr,
    erzeugercode: p.erzeugercode,
    legedatum: p.legedatum,
  }));

  return {
    sortierungen,
    lieferungen,
    kunden: fasseKundenZusammen(lieferungen),
    mengeSortiert: sortierungen.reduce((s, p) => s + p.menge, 0),
    mengeAusgeliefert: lieferungen.filter((l) => l.status === "geliefert").reduce((s, l) => s + l.menge, 0),
    abgeschnitten,
  };
}
