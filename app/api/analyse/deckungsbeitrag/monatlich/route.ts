import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  const isDev = process.env.NODE_ENV === "development";

  try {
    const { searchParams } = new URL(request.url);
    const heute = new Date();
    const von = searchParams.get("von") ?? new Date(heute.getFullYear(), 0, 1).toISOString().slice(0, 10);
    const bis = searchParams.get("bis") ?? heute.toISOString().slice(0, 10);
    const vonDate = new Date(von).toISOString();
    const bisDate = new Date(bis + "T23:59:59").toISOString();

    // 1. Gesamt-DB pro Monat
    type GesamtRow = { monat: string; umsatz: number; einkauf: number };
    const gesamtRows = await prisma.$queryRawUnsafe<GesamtRow[]>(
      `SELECT
        strftime('%Y-%m', l.datum) as monat,
        CAST(SUM(lp.menge * lp.verkaufspreis) AS REAL) as umsatz,
        CAST(SUM(lp.menge * lp.einkaufspreis) AS REAL) as einkauf
      FROM Lieferposition lp
      JOIN Lieferung l ON l.id = lp.lieferungId
      WHERE l.status = 'geliefert' AND l.datum >= ? AND l.datum <= ?
      GROUP BY strftime('%Y-%m', l.datum)
      ORDER BY monat ASC`,
      vonDate, bisDate
    );
    const gesamt = gesamtRows.map(r => {
      const u = Math.round(r.umsatz * 100) / 100;
      const e = Math.round(r.einkauf * 100) / 100;
      const db = Math.round((u - e) * 100) / 100;
      return {
        monat: r.monat,
        umsatz: u,
        einkauf: e,
        deckungsbeitrag: db,
        dbMarge: u > 0 ? Math.round((db / u) * 10000) / 100 : 0,
      };
    });

    // 2. Top-10-Artikel nach Gesamt-DB
    type TopArtikelRow = { id: number; name: string; totalDB: number };
    const topArtikelRows = await prisma.$queryRawUnsafe<TopArtikelRow[]>(
      `SELECT
        lp.artikelId as id,
        a.name,
        CAST(SUM(lp.menge * (lp.verkaufspreis - lp.einkaufspreis)) AS REAL) as totalDB
      FROM Lieferposition lp
      JOIN Lieferung l ON l.id = lp.lieferungId
      JOIN Artikel a ON a.id = lp.artikelId
      WHERE l.status = 'geliefert' AND l.datum >= ? AND l.datum <= ?
      GROUP BY lp.artikelId, a.name
      ORDER BY totalDB DESC
      LIMIT 10`,
      vonDate, bisDate
    );

    // Monatliche Aufschlüsselung je Top-Artikel
    type ArtikelMonatRow = { artikelId: number; monat: string; umsatz: number; einkauf: number };
    const topIds = topArtikelRows.map(r => r.id);
    let topArtikel: { id: number; name: string; monate: { monat: string; umsatz: number; einkauf: number; deckungsbeitrag: number }[] }[] = [];

    if (topIds.length > 0) {
      const placeholders = topIds.map(() => "?").join(",");
      const artikelMonatRows = await prisma.$queryRawUnsafe<ArtikelMonatRow[]>(
        `SELECT
          lp.artikelId,
          strftime('%Y-%m', l.datum) as monat,
          CAST(SUM(lp.menge * lp.verkaufspreis) AS REAL) as umsatz,
          CAST(SUM(lp.menge * lp.einkaufspreis) AS REAL) as einkauf
        FROM Lieferposition lp
        JOIN Lieferung l ON l.id = lp.lieferungId
        WHERE l.status = 'geliefert' AND l.datum >= ? AND l.datum <= ?
          AND lp.artikelId IN (${placeholders})
        GROUP BY lp.artikelId, strftime('%Y-%m', l.datum)
        ORDER BY monat ASC`,
        vonDate, bisDate, ...topIds
      );

      // Gruppieren nach artikelId
      const byArtikel = new Map<number, ArtikelMonatRow[]>();
      for (const row of artikelMonatRows) {
        const arr = byArtikel.get(row.artikelId) ?? [];
        arr.push(row);
        byArtikel.set(row.artikelId, arr);
      }

      topArtikel = topArtikelRows.map(a => ({
        id: a.id,
        name: a.name,
        monate: (byArtikel.get(a.id) ?? []).map(r => {
          const u = Math.round(r.umsatz * 100) / 100;
          const e = Math.round(r.einkauf * 100) / 100;
          return {
            monat: r.monat,
            umsatz: u,
            einkauf: e,
            deckungsbeitrag: Math.round((u - e) * 100) / 100,
          };
        }),
      }));
    }

    // 3. Pro Auftrag (Lieferung) mit Kundennamen
    type AuftragRow = { id: number; datum: string; monat: string; kundeName: string; kundeId: number; umsatz: number; einkauf: number };
    const auftragRows = await prisma.$queryRawUnsafe<AuftragRow[]>(
      `SELECT
        l.id,
        l.datum,
        strftime('%Y-%m', l.datum) as monat,
        l.kundeId,
        COALESCE(k.firma, k.name) as kundeName,
        CAST(SUM(lp.menge * lp.verkaufspreis) AS REAL) as umsatz,
        CAST(SUM(lp.menge * lp.einkaufspreis) AS REAL) as einkauf
      FROM Lieferposition lp
      JOIN Lieferung l ON l.id = lp.lieferungId
      JOIN Kunde k ON k.id = l.kundeId
      WHERE l.status = 'geliefert' AND l.datum >= ? AND l.datum <= ?
      GROUP BY l.id, l.datum, l.kundeId, kundeName
      ORDER BY l.datum DESC
      LIMIT 500`,
      vonDate, bisDate
    );
    const auftraege = auftragRows.map(r => {
      const u = Math.round(r.umsatz * 100) / 100;
      const e = Math.round(r.einkauf * 100) / 100;
      const db = Math.round((u - e) * 100) / 100;
      return {
        id: r.id,
        datum: r.datum,
        monat: r.monat,
        kundeName: r.kundeName,
        kundeId: r.kundeId,
        umsatz: u,
        einkauf: e,
        deckungsbeitrag: db,
        dbMarge: u > 0 ? Math.round((db / u) * 10000) / 100 : 0,
      };
    });

    return NextResponse.json({ gesamt, topArtikel, auftraege, von, bis });
  } catch (err) {
    const msg = isDev && err instanceof Error ? err.message : "Datenbankfehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
