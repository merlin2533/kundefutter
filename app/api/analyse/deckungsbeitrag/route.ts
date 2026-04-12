import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const typ = searchParams.get("gruppierung") ?? searchParams.get("typ") ?? "artikel";
    const heute = new Date();
    const von = searchParams.get("von") ?? new Date(heute.getFullYear(), 0, 1).toISOString().slice(0, 10);
    const bis = searchParams.get("bis") ?? heute.toISOString().slice(0, 10);

    const vonDate = new Date(von).toISOString();
    const bisDate = new Date(bis + "T23:59:59").toISOString();

    type ArtikelRow = { id: number; name: string; kategorie: string | null; umsatz: number; einkauf: number };
    type KundeRow  = { id: number; name: string; firma: string | null; umsatz: number; einkauf: number };

    let items: { id: number; name: string; umsatz: number; einkauf: number; deckungsbeitrag: number; dbMarge: number }[];

    if (typ === "artikel") {
      const rows = await prisma.$queryRawUnsafe<ArtikelRow[]>(
        `SELECT
          lp.artikelId as id,
          a.name,
          a.kategorie,
          CAST(SUM(lp.menge * lp.verkaufspreis) AS REAL) as umsatz,
          CAST(SUM(lp.menge * lp.einkaufspreis) AS REAL) as einkauf
        FROM Lieferposition lp
        JOIN Lieferung l ON l.id = lp.lieferungId
        JOIN Artikel a ON a.id = lp.artikelId
        WHERE l.status = 'geliefert' AND l.datum >= ? AND l.datum <= ?
        GROUP BY lp.artikelId, a.name, a.kategorie
        ORDER BY umsatz DESC`,
        vonDate, bisDate
      );
      items = rows.map((r) => ({
        id: r.id,
        name: r.name,
        umsatz: Math.round(r.umsatz * 100) / 100,
        einkauf: Math.round(r.einkauf * 100) / 100,
        deckungsbeitrag: Math.round((r.umsatz - r.einkauf) * 100) / 100,
        dbMarge: r.umsatz > 0 ? Math.round(((r.umsatz - r.einkauf) / r.umsatz) * 10000) / 100 : 0,
      }));
    } else {
      const rows = await prisma.$queryRawUnsafe<KundeRow[]>(
        `SELECT
          l.kundeId as id,
          k.name,
          k.firma,
          CAST(SUM(lp.menge * lp.verkaufspreis) AS REAL) as umsatz,
          CAST(SUM(lp.menge * lp.einkaufspreis) AS REAL) as einkauf
        FROM Lieferposition lp
        JOIN Lieferung l ON l.id = lp.lieferungId
        JOIN Kunde k ON k.id = l.kundeId
        WHERE l.status = 'geliefert' AND l.datum >= ? AND l.datum <= ?
        GROUP BY l.kundeId, k.name, k.firma
        ORDER BY umsatz DESC`,
        vonDate, bisDate
      );
      items = rows.map((r) => ({
        id: r.id,
        name: r.firma ? `${r.name} (${r.firma})` : r.name,
        umsatz: Math.round(r.umsatz * 100) / 100,
        einkauf: Math.round(r.einkauf * 100) / 100,
        deckungsbeitrag: Math.round((r.umsatz - r.einkauf) * 100) / 100,
        dbMarge: r.umsatz > 0 ? Math.round(((r.umsatz - r.einkauf) / r.umsatz) * 10000) / 100 : 0,
      }));
    }

    items.sort((a, b) => b.deckungsbeitrag - a.deckungsbeitrag);
    return NextResponse.json({ typ: typ === "artikel" ? "artikel" : "kunde", von, bis, items });
  } catch (e) {
    console.error("Deckungsbeitrag-Analyse Fehler:", e);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
