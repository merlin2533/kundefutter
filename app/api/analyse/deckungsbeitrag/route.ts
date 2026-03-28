import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const typ = searchParams.get("typ") ?? "artikel";
  const heute = new Date();
  const vonDefault = new Date(heute.getFullYear(), 0, 1).toISOString().slice(0, 10);
  const bisDefault = heute.toISOString().slice(0, 10);
  const von = searchParams.get("von") ?? vonDefault;
  const bis = searchParams.get("bis") ?? bisDefault;

  const vonDate = new Date(von);
  const bisDate = new Date(bis + "T23:59:59");

  // Fetch all delivered Lieferungen in date range with positionen
  const lieferungen = await prisma.lieferung.findMany({
    where: {
      status: "geliefert",
      datum: { gte: vonDate, lte: bisDate },
    },
    include: {
      positionen: {
        include: {
          artikel: { select: { id: true, name: true } },
        },
      },
      kunde: { select: { id: true, name: true } },
    },
  });

  if (typ === "artikel") {
    const map = new Map<number, { name: string; umsatz: number; einkauf: number; db: number }>();

    for (const l of lieferungen) {
      for (const pos of l.positionen) {
        const umsatz = pos.menge * pos.verkaufspreis;
        const einkauf = pos.menge * pos.einkaufspreis;
        const db = umsatz - einkauf;
        const existing = map.get(pos.artikelId);
        if (existing) {
          existing.umsatz += umsatz;
          existing.einkauf += einkauf;
          existing.db += db;
        } else {
          map.set(pos.artikelId, { name: pos.artikel.name, umsatz, einkauf, db });
        }
      }
    }

    const result = Array.from(map.entries())
      .map(([id, v]) => ({
        id,
        name: v.name,
        umsatz: Math.round(v.umsatz * 100) / 100,
        einkauf: Math.round(v.einkauf * 100) / 100,
        deckungsbeitrag: Math.round(v.db * 100) / 100,
        dbMarge: v.umsatz > 0 ? Math.round((v.db / v.umsatz) * 10000) / 100 : 0,
      }))
      .sort((a, b) => b.deckungsbeitrag - a.deckungsbeitrag)
      .slice(0, 20);

    return NextResponse.json({ typ: "artikel", von, bis, items: result });
  } else {
    // By Kunde
    const map = new Map<number, { name: string; umsatz: number; einkauf: number; db: number }>();

    for (const l of lieferungen) {
      const umsatz = l.positionen.reduce((s, p) => s + p.menge * p.verkaufspreis, 0);
      const einkauf = l.positionen.reduce((s, p) => s + p.menge * p.einkaufspreis, 0);
      const db = umsatz - einkauf;
      const existing = map.get(l.kundeId);
      if (existing) {
        existing.umsatz += umsatz;
        existing.einkauf += einkauf;
        existing.db += db;
      } else {
        map.set(l.kundeId, { name: l.kunde.name, umsatz, einkauf, db });
      }
    }

    const result = Array.from(map.entries())
      .map(([id, v]) => ({
        id,
        name: v.name,
        umsatz: Math.round(v.umsatz * 100) / 100,
        einkauf: Math.round(v.einkauf * 100) / 100,
        deckungsbeitrag: Math.round(v.db * 100) / 100,
        dbMarge: v.umsatz > 0 ? Math.round((v.db / v.umsatz) * 10000) / 100 : 0,
      }))
      .sort((a, b) => b.deckungsbeitrag - a.deckungsbeitrag)
      .slice(0, 20);

    return NextResponse.json({ typ: "kunde", von, bis, items: result });
  }
}
