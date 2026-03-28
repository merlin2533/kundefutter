import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const von = searchParams.get("von"); // YYYY-MM
  const bis = searchParams.get("bis"); // YYYY-MM

  // Build date range
  const vonDate = von ? new Date(`${von}-01T00:00:00.000Z`) : new Date("2024-01-01T00:00:00.000Z");
  const bisDate = bis
    ? (() => {
        const [y, m] = bis.split("-").map(Number);
        return new Date(y, m, 1); // first day of next month (exclusive upper bound)
      })()
    : new Date();

  // Fetch all delivered lieferungen in range, including positionen and artikel
  const lieferungen = await prisma.lieferung.findMany({
    where: {
      status: "geliefert",
      datum: {
        gte: vonDate,
        lt: bisDate,
      },
    },
    include: {
      positionen: {
        include: { artikel: true },
      },
      kunde: true,
    },
    orderBy: { datum: "asc" },
  });

  // ── Umsatz nach Monat ──────────────────────────────────────────────────────
  const monatMap = new Map<string, { umsatz: number; anzahl: number }>();
  for (const l of lieferungen) {
    const d = new Date(l.datum);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const total = l.positionen.reduce((s, p) => s + p.menge * p.verkaufspreis, 0);
    const existing = monatMap.get(key) ?? { umsatz: 0, anzahl: 0 };
    monatMap.set(key, {
      umsatz: existing.umsatz + total,
      anzahl: existing.anzahl + 1,
    });
  }
  const umsatzNachMonat = Array.from(monatMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monat, v]) => ({
      monat,
      umsatz: Math.round(v.umsatz * 100) / 100,
      anzahl: v.anzahl,
    }));

  // ── Top Artikel ────────────────────────────────────────────────────────────
  const artikelMap = new Map<number, { name: string; menge: number; umsatz: number }>();
  for (const l of lieferungen) {
    for (const p of l.positionen) {
      const existing = artikelMap.get(p.artikelId) ?? {
        name: p.artikel.name,
        menge: 0,
        umsatz: 0,
      };
      artikelMap.set(p.artikelId, {
        name: p.artikel.name,
        menge: existing.menge + p.menge,
        umsatz: existing.umsatz + p.menge * p.verkaufspreis,
      });
    }
  }
  const topArtikel = Array.from(artikelMap.entries())
    .map(([artikelId, v]) => ({
      artikelId,
      name: v.name,
      menge: Math.round(v.menge * 100) / 100,
      umsatz: Math.round(v.umsatz * 100) / 100,
    }))
    .sort((a, b) => b.umsatz - a.umsatz)
    .slice(0, 5);

  // ── Top Kunden ─────────────────────────────────────────────────────────────
  const kundeMap = new Map<number, { name: string; umsatz: number; anzahl: number }>();
  for (const l of lieferungen) {
    const total = l.positionen.reduce((s, p) => s + p.menge * p.verkaufspreis, 0);
    const existing = kundeMap.get(l.kundeId) ?? {
      name: l.kunde.name,
      umsatz: 0,
      anzahl: 0,
    };
    kundeMap.set(l.kundeId, {
      name: l.kunde.name,
      umsatz: existing.umsatz + total,
      anzahl: existing.anzahl + 1,
    });
  }
  const topKunden = Array.from(kundeMap.entries())
    .map(([kundeId, v]) => ({
      kundeId,
      name: v.name,
      umsatz: Math.round(v.umsatz * 100) / 100,
      anzahl: v.anzahl,
    }))
    .sort((a, b) => b.umsatz - a.umsatz)
    .slice(0, 5);

  // ── Umsatz nach Kategorie ──────────────────────────────────────────────────
  const kategorieMap = new Map<string, { umsatz: number; menge: number }>();
  for (const l of lieferungen) {
    for (const p of l.positionen) {
      const kat = p.artikel.kategorie;
      const existing = kategorieMap.get(kat) ?? { umsatz: 0, menge: 0 };
      kategorieMap.set(kat, {
        umsatz: existing.umsatz + p.menge * p.verkaufspreis,
        menge: existing.menge + p.menge,
      });
    }
  }
  const umsatzNachKategorie = Array.from(kategorieMap.entries())
    .map(([kategorie, v]) => ({
      kategorie,
      umsatz: Math.round(v.umsatz * 100) / 100,
      menge: Math.round(v.menge * 100) / 100,
    }))
    .sort((a, b) => b.umsatz - a.umsatz);

  // ── Saisonale Verteilung ───────────────────────────────────────────────────
  const saisonMap = new Map<number, number>();
  for (let i = 1; i <= 12; i++) saisonMap.set(i, 0);
  for (const l of lieferungen) {
    const monat = new Date(l.datum).getMonth() + 1;
    const total = l.positionen.reduce((s, p) => s + p.menge * p.verkaufspreis, 0);
    saisonMap.set(monat, (saisonMap.get(monat) ?? 0) + total);
  }
  const saisonaleVerteilung = Array.from(saisonMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([monat, umsatz]) => ({
      monat,
      umsatz: Math.round(umsatz * 100) / 100,
    }));

  return NextResponse.json({
    umsatzNachMonat,
    topArtikel,
    topKunden,
    umsatzNachKategorie,
    saisonaleVerteilung,
  });
}
