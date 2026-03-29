import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type DbEntry = { name: string; umsatz: number; einkauf: number; db: number };

function toResult(map: Map<number, DbEntry>, typ: string, von: string, bis: string) {
  const items = Array.from(map.entries())
    .map(([id, v]) => ({
      id,
      name: v.name,
      umsatz: Math.round(v.umsatz * 100) / 100,
      einkauf: Math.round(v.einkauf * 100) / 100,
      deckungsbeitrag: Math.round(v.db * 100) / 100,
      dbMarge: v.umsatz > 0 ? Math.round((v.db / v.umsatz) * 10000) / 100 : 0,
    }))
    .sort((a, b) => b.deckungsbeitrag - a.deckungsbeitrag);
  return NextResponse.json({ typ, von, bis, items });
}

function accumulate(map: Map<number, DbEntry>, id: number, name: string, umsatz: number, einkauf: number) {
  const existing = map.get(id);
  if (existing) {
    existing.umsatz += umsatz;
    existing.einkauf += einkauf;
    existing.db += umsatz - einkauf;
  } else {
    map.set(id, { name, umsatz, einkauf, db: umsatz - einkauf });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const typ = searchParams.get("typ") ?? "artikel";
    const heute = new Date();
    const von = searchParams.get("von") ?? new Date(heute.getFullYear(), 0, 1).toISOString().slice(0, 10);
    const bis = searchParams.get("bis") ?? heute.toISOString().slice(0, 10);

    const lieferungen = await prisma.lieferung.findMany({
      where: { status: "geliefert", datum: { gte: new Date(von), lte: new Date(bis + "T23:59:59") } },
      include: {
        positionen: { include: { artikel: { select: { id: true, name: true } } } },
        kunde: { select: { id: true, name: true } },
      },
      take: 5000,
    });

    const map = new Map<number, DbEntry>();

    if (typ === "artikel") {
      for (const l of lieferungen) {
        for (const pos of l.positionen) {
          accumulate(map, pos.artikelId, pos.artikel.name, pos.menge * pos.verkaufspreis, pos.menge * pos.einkaufspreis);
        }
      }
    } else {
      for (const l of lieferungen) {
        const umsatz = l.positionen.reduce((s, p) => s + p.menge * p.verkaufspreis, 0);
        const einkauf = l.positionen.reduce((s, p) => s + p.menge * p.einkaufspreis, 0);
        accumulate(map, l.kundeId, l.kunde.name, umsatz, einkauf);
      }
    }

    return toResult(map, typ === "artikel" ? "artikel" : "kunde", von, bis);
  } catch (e) {
    console.error("Deckungsbeitrag-Analyse Fehler:", e);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
