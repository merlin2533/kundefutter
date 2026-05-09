import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

interface ChurnKunde {
  id: number;
  name: string;
  firma: string | null;
  score: number;
  risiko: "hoch" | "mittel" | "niedrig";
  letzteAktivitaet: string | null;
  letztelieferung: string | null;
  volumeRueckgang: number;
}

function aktivitaetsScore(letzteAktivitaet: Date | null): number {
  if (!letzteAktivitaet) return 30;
  const tage = Math.floor((Date.now() - letzteAktivitaet.getTime()) / 86_400_000);
  if (tage <= 30) return 0;
  if (tage <= 60) return 10;
  if (tage <= 90) return 20;
  return 30;
}

function lieferungsScore(letzteLieferung: Date | null): number {
  if (!letzteLieferung) return 40;
  const tage = Math.floor((Date.now() - letzteLieferung.getTime()) / 86_400_000);
  if (tage <= 30) return 0;
  if (tage <= 60) return 10;
  if (tage <= 90) return 20;
  if (tage <= 180) return 30;
  return 40;
}

function volumenScore(vorher: number, nachher: number): { score: number; rueckgang: number } {
  if (vorher <= 0) return { score: 0, rueckgang: 0 };
  const rueckgang = ((vorher - nachher) / vorher) * 100;
  if (rueckgang <= 0) return { score: 0, rueckgang: 0 };
  if (rueckgang < 20) return { score: 5, rueckgang };
  if (rueckgang < 40) return { score: 10, rueckgang };
  if (rueckgang < 60) return { score: 20, rueckgang };
  return { score: 30, rueckgang };
}

export async function GET() {
  try {
    const now = new Date();
    const vor3Monate = new Date(now.getTime() - 90 * 86_400_000);
    const vor6Monate = new Date(now.getTime() - 180 * 86_400_000);

    // Hole alle aktiven Kunden
    const kunden = await prisma.kunde.findMany({
      where: { aktiv: true },
      select: { id: true, name: true, firma: true },
      take: 200,
    });

    if (kunden.length === 0) {
      return NextResponse.json({ kunden: [] });
    }

    const kundeIds = kunden.map((k) => k.id);

    // Letzte Aktivität je Kunde
    const aktivitaeten = await prisma.kundeAktivitaet.findMany({
      where: { kundeId: { in: kundeIds } },
      select: { kundeId: true, datum: true },
      orderBy: { datum: "desc" },
      take: kundeIds.length * 5,
    });

    const letzteAktMap = new Map<number, Date>();
    for (const a of aktivitaeten) {
      if (!letzteAktMap.has(a.kundeId)) {
        letzteAktMap.set(a.kundeId, a.datum);
      }
    }

    // Lieferungen letzte 3 Monate
    const lieferungen3M = await prisma.lieferung.findMany({
      where: {
        kundeId: { in: kundeIds },
        datum: { gte: vor3Monate },
        status: { not: "storniert" },
      },
      select: {
        kundeId: true,
        datum: true,
        positionen: { select: { menge: true, verkaufspreis: true } },
      },
    });

    // Lieferungen 3-6 Monate davor
    const lieferungen6M = await prisma.lieferung.findMany({
      where: {
        kundeId: { in: kundeIds },
        datum: { gte: vor6Monate, lt: vor3Monate },
        status: { not: "storniert" },
      },
      select: {
        kundeId: true,
        positionen: { select: { menge: true, verkaufspreis: true } },
      },
    });

    // Letzte Lieferung je Kunde (letzte 3 Monate)
    const letzteLiefMap = new Map<number, Date>();
    for (const l of lieferungen3M) {
      const existing = letzteLiefMap.get(l.kundeId);
      if (!existing || l.datum > existing) {
        letzteLiefMap.set(l.kundeId, l.datum);
      }
    }

    // Liefervolumen je Kunde (letzte 3 Monate)
    const vol3MMap = new Map<number, number>();
    for (const l of lieferungen3M) {
      const summe = l.positionen.reduce((s, p) => s + p.menge * p.verkaufspreis, 0);
      vol3MMap.set(l.kundeId, (vol3MMap.get(l.kundeId) ?? 0) + summe);
    }

    // Liefervolumen je Kunde (3-6 Monate davor)
    const vol6MMap = new Map<number, number>();
    for (const l of lieferungen6M) {
      const summe = l.positionen.reduce((s, p) => s + p.menge * p.verkaufspreis, 0);
      vol6MMap.set(l.kundeId, (vol6MMap.get(l.kundeId) ?? 0) + summe);
    }

    // Für Kunden ohne Lieferung in letzten 3 Monaten: älteste Lieferung suchen
    const ohneNeueLieferung = kundeIds.filter((id) => !letzteLiefMap.has(id));
    if (ohneNeueLieferung.length > 0) {
      const aeltere = await prisma.lieferung.findMany({
        where: {
          kundeId: { in: ohneNeueLieferung },
          status: { not: "storniert" },
        },
        select: { kundeId: true, datum: true },
        orderBy: { datum: "desc" },
        take: ohneNeueLieferung.length * 2,
      });
      for (const l of aeltere) {
        if (!letzteLiefMap.has(l.kundeId)) {
          letzteLiefMap.set(l.kundeId, l.datum);
        }
      }
    }

    const ergebnisse: ChurnKunde[] = [];

    for (const k of kunden) {
      const letzteAkt = letzteAktMap.get(k.id) ?? null;
      const letzteLief = letzteLiefMap.get(k.id) ?? null;
      const vol3M = vol3MMap.get(k.id) ?? 0;
      const vol6M = vol6MMap.get(k.id) ?? 0;

      const sAkt = aktivitaetsScore(letzteAkt);
      const sLief = lieferungsScore(letzteLief);
      const { score: sVol, rueckgang } = volumenScore(vol6M, vol3M);

      const score = sAkt + sLief + sVol;
      if (score < 40) continue;

      const risiko: "hoch" | "mittel" | "niedrig" =
        score >= 70 ? "hoch" : "mittel";

      ergebnisse.push({
        id: k.id,
        name: k.name,
        firma: k.firma,
        score,
        risiko,
        letzteAktivitaet: letzteAkt ? letzteAkt.toISOString() : null,
        letztelieferung: letzteLief ? letzteLief.toISOString() : null,
        volumeRueckgang: Math.round(rueckgang),
      });
    }

    // Sortieren nach Score absteigend, max 20
    ergebnisse.sort((a, b) => b.score - a.score);
    const top20 = ergebnisse.slice(0, 20);

    return NextResponse.json({ kunden: top20 });
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
