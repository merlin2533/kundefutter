import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const heute = new Date();
    const vor12Monaten = new Date(heute.getFullYear(), heute.getMonth() - 12, heute.getDate());

    // Fetch all delivered Lieferungen with positionen and kunde in last 12 months
    const lieferungen = await prisma.lieferung.findMany({
      where: {
        status: "geliefert",
        datum: { gte: vor12Monaten },
      },
      include: {
        positionen: true,
        kunde: { select: { id: true, name: true, firma: true } },
      },
      take: 5000,
    });

    // Aggregate umsatz per customer
    const kundeMap = new Map<number, { kundeId: number; name: string; firma: string | null; umsatz: number }>();
    for (const l of lieferungen) {
      const umsatz = l.positionen.reduce((s: number, p: { menge: number; verkaufspreis: number }) => s + p.menge * p.verkaufspreis, 0);
      const existing = kundeMap.get(l.kundeId);
      if (existing) {
        existing.umsatz += umsatz;
      } else {
        kundeMap.set(l.kundeId, {
          kundeId: l.kundeId,
          name: l.kunde.name,
          firma: l.kunde.firma ?? null,
          umsatz,
        });
      }
    }

    // Sort descending by umsatz
    const sorted = Array.from(kundeMap.values()).sort((a, b) => b.umsatz - a.umsatz);
    const gesamt = sorted.reduce((s, k) => s + k.umsatz, 0);

    // Classify A/B/C using cumulative revenue:
    // A: customers accounting for top 80% of revenue
    // B: next 15% (80–95%)
    // C: remaining 5%
    let kumuliert = 0;
    const kunden = sorted.map((k) => {
      const anteil = gesamt > 0 ? (k.umsatz / gesamt) * 100 : 0;
      kumuliert += anteil;
      let klasse: "A" | "B" | "C";
      if (kumuliert - anteil < 80) {
        klasse = "A";
      } else if (kumuliert - anteil < 95) {
        klasse = "B";
      } else {
        klasse = "C";
      }
      return {
        id: k.kundeId,
        kundeId: k.kundeId,
        name: k.name,
        firma: k.firma ?? null,
        umsatz: Math.round(k.umsatz * 100) / 100,
        anteil: Math.round(anteil * 100) / 100,
        klasse,
        kumuliert: Math.round(kumuliert * 100) / 100,
      };
    });

    const aKunden = kunden.filter((k) => k.klasse === "A");
    const bKunden = kunden.filter((k) => k.klasse === "B");
    const cKunden = kunden.filter((k) => k.klasse === "C");

    return NextResponse.json({
      kunden,
      gesamt: Math.round(gesamt * 100) / 100,
      aKunden: {
        anzahl: aKunden.length,
        umsatz: Math.round(aKunden.reduce((s, k) => s + k.umsatz, 0) * 100) / 100,
        anteil: Math.round(aKunden.reduce((s, k) => s + k.anteil, 0) * 100) / 100,
      },
      bKunden: {
        anzahl: bKunden.length,
        umsatz: Math.round(bKunden.reduce((s, k) => s + k.umsatz, 0) * 100) / 100,
        anteil: Math.round(bKunden.reduce((s, k) => s + k.anteil, 0) * 100) / 100,
      },
      cKunden: {
        anzahl: cKunden.length,
        umsatz: Math.round(cKunden.reduce((s, k) => s + k.umsatz, 0) * 100) / 100,
        anteil: Math.round(cKunden.reduce((s, k) => s + k.anteil, 0) * 100) / 100,
      },
    });
  } catch (e) {
    console.error("ABC-Analyse Fehler:", e);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
