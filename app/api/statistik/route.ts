import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const von = searchParams.get("von"); // YYYY-MM
    const bis = searchParams.get("bis"); // YYYY-MM

    // Build and validate date range
    const vonDate = von
      ? (() => { const d = new Date(`${von}-01T00:00:00.000Z`); return isNaN(d.getTime()) ? new Date("2024-01-01T00:00:00.000Z") : d; })()
      : new Date("2024-01-01T00:00:00.000Z");
    const bisDate = bis
      ? (() => {
          const parts = bis.split("-").map(Number);
          if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return new Date();
          return new Date(parts[0], parts[1], 1);
        })()
      : new Date();

    const vonIso = vonDate.toISOString();
    const bisIso = bisDate.toISOString();

    // All aggregations run in the DB — no full-table load into Node.js
    type MonatRow    = { monat: string; umsatz: number; anzahl: number };
    type ArtikelRow  = { artikelId: number; name: string; menge: number; umsatz: number };
    type KundeRow    = { kundeId: number; name: string; umsatz: number; anzahl: number };
    type KatRow      = { kategorie: string; umsatz: number; menge: number };
    type SaisonRow   = { monat: number; umsatz: number };

    const [umsatzNachMonatRaw, topArtikelRaw, topKundenRaw, umsatzNachKategorieRaw, saisonRaw] =
      await Promise.all([
        // Umsatz nach Monat (YYYY-MM)
        prisma.$queryRawUnsafe<MonatRow[]>(
          `SELECT
            strftime('%Y-%m', l.datum) as monat,
            CAST(SUM(lp.menge * lp.verkaufspreis) AS REAL) as umsatz,
            COUNT(DISTINCT l.id) as anzahl
          FROM Lieferung l
          JOIN Lieferposition lp ON lp.lieferungId = l.id
          WHERE l.status = 'geliefert' AND l.datum >= ? AND l.datum < ?
          GROUP BY monat
          ORDER BY monat`,
          vonIso, bisIso
        ),
        // Top 5 Artikel by Umsatz
        prisma.$queryRawUnsafe<ArtikelRow[]>(
          `SELECT
            lp.artikelId,
            a.name,
            CAST(SUM(lp.menge) AS REAL) as menge,
            CAST(SUM(lp.menge * lp.verkaufspreis) AS REAL) as umsatz
          FROM Lieferposition lp
          JOIN Lieferung l ON l.id = lp.lieferungId
          JOIN Artikel a ON a.id = lp.artikelId
          WHERE l.status = 'geliefert' AND l.datum >= ? AND l.datum < ?
          GROUP BY lp.artikelId, a.name
          ORDER BY umsatz DESC
          LIMIT 5`,
          vonIso, bisIso
        ),
        // Top 5 Kunden by Umsatz
        prisma.$queryRawUnsafe<KundeRow[]>(
          `SELECT
            l.kundeId,
            k.name,
            CAST(SUM(lp.menge * lp.verkaufspreis) AS REAL) as umsatz,
            COUNT(DISTINCT l.id) as anzahl
          FROM Lieferung l
          JOIN Lieferposition lp ON lp.lieferungId = l.id
          JOIN Kunde k ON k.id = l.kundeId
          WHERE l.status = 'geliefert' AND l.datum >= ? AND l.datum < ?
          GROUP BY l.kundeId, k.name
          ORDER BY umsatz DESC
          LIMIT 5`,
          vonIso, bisIso
        ),
        // Umsatz nach Kategorie
        prisma.$queryRawUnsafe<KatRow[]>(
          `SELECT
            COALESCE(a.kategorie, 'Sonstige') as kategorie,
            CAST(SUM(lp.menge * lp.verkaufspreis) AS REAL) as umsatz,
            CAST(SUM(lp.menge) AS REAL) as menge
          FROM Lieferposition lp
          JOIN Lieferung l ON l.id = lp.lieferungId
          JOIN Artikel a ON a.id = lp.artikelId
          WHERE l.status = 'geliefert' AND l.datum >= ? AND l.datum < ?
          GROUP BY kategorie
          ORDER BY umsatz DESC`,
          vonIso, bisIso
        ),
        // Saisonale Verteilung (Monat 1–12, alle Jahre summiert)
        prisma.$queryRawUnsafe<SaisonRow[]>(
          `SELECT
            CAST(strftime('%m', l.datum) AS INTEGER) as monat,
            CAST(SUM(lp.menge * lp.verkaufspreis) AS REAL) as umsatz
          FROM Lieferung l
          JOIN Lieferposition lp ON lp.lieferungId = l.id
          WHERE l.status = 'geliefert' AND l.datum >= ? AND l.datum < ?
          GROUP BY monat
          ORDER BY monat`,
          vonIso, bisIso
        ),
      ]);

    // Fill missing months 1–12 with 0 for saisonaleVerteilung
    const saisonMap = new Map<number, number>();
    for (let i = 1; i <= 12; i++) saisonMap.set(i, 0);
    for (const row of saisonRaw) saisonMap.set(row.monat, row.umsatz);
    const saisonaleVerteilung = Array.from(saisonMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([monat, umsatz]) => ({ monat, umsatz: Math.round(umsatz * 100) / 100 }));

    return NextResponse.json({
      umsatzNachMonat: umsatzNachMonatRaw.map((r) => ({
        monat: r.monat,
        umsatz: Math.round(r.umsatz * 100) / 100,
        anzahl: r.anzahl,
      })),
      topArtikel: topArtikelRaw.map((r) => ({
        artikelId: r.artikelId,
        name: r.name,
        menge: Math.round(r.menge * 100) / 100,
        umsatz: Math.round(r.umsatz * 100) / 100,
      })),
      topKunden: topKundenRaw.map((r) => ({
        kundeId: r.kundeId,
        name: r.name,
        umsatz: Math.round(r.umsatz * 100) / 100,
        anzahl: r.anzahl,
      })),
      umsatzNachKategorie: umsatzNachKategorieRaw.map((r) => ({
        kategorie: r.kategorie,
        umsatz: Math.round(r.umsatz * 100) / 100,
        menge: Math.round(r.menge * 100) / 100,
      })),
      saisonaleVerteilung,
    });
  } catch (e) {
    console.error("Statistik API Fehler:", e);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
