import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";


export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const typ = searchParams.get("gruppierung") ?? searchParams.get("typ") ?? "artikel";
    const heute = new Date();
    const von = searchParams.get("von") ?? new Date(heute.getFullYear(), 0, 1).toISOString().slice(0, 10);
    const bis = searchParams.get("bis") ?? heute.toISOString().slice(0, 10);

    const vonDate = new Date(von).toISOString();
    const bisDate = new Date(bis + "T23:59:59").toISOString();

    type ArtikelRow = { id: number; name: string; kategorie: string | null; umsatz: number; einkauf: number; gutschriften: number };
    type KundeRow  = { id: number; name: string; firma: string | null; umsatz: number; einkauf: number; gutschriften: number };

    let items: { id: number; name: string; umsatz: number; einkauf: number; gutschriften: number; deckungsbeitrag: number; dbMarge: number }[];

    if (typ === "artikel") {
      const rows = await prisma.$queryRawUnsafe<ArtikelRow[]>(
        `SELECT
          lp.artikelId as id,
          a.name,
          a.kategorie,
          CAST(SUM(lp.menge * lp.verkaufspreis) AS REAL) as umsatz,
          CAST(SUM(lp.menge * lp.einkaufspreis) AS REAL) as einkauf,
          CAST(COALESCE((
            SELECT SUM(gp.menge * gp.preis)
            FROM GutschriftPosition gp
            JOIN Gutschrift g ON g.id = gp.gutschriftId
            WHERE gp.artikelId = lp.artikelId
              AND g.status != 'STORNIERT'
              AND g.datum >= ? AND g.datum <= ?
          ), 0) AS REAL) as gutschriften
        FROM Lieferposition lp
        JOIN Lieferung l ON l.id = lp.lieferungId
        JOIN Artikel a ON a.id = lp.artikelId
        WHERE l.status = 'geliefert' AND l.datum >= ? AND l.datum <= ?
        GROUP BY lp.artikelId, a.name, a.kategorie
        ORDER BY umsatz DESC`,
        vonDate, bisDate, vonDate, bisDate
      );
      items = rows.map((r) => {
        const umsatzNetto = Math.round((r.umsatz - r.gutschriften) * 100) / 100;
        const einkauf = Math.round(r.einkauf * 100) / 100;
        const db = Math.round((umsatzNetto - einkauf) * 100) / 100;
        return {
          id: r.id,
          name: r.name,
          umsatz: umsatzNetto,
          einkauf,
          gutschriften: Math.round(r.gutschriften * 100) / 100,
          deckungsbeitrag: db,
          dbMarge: umsatzNetto > 0 ? Math.round((db / umsatzNetto) * 10000) / 100 : 0,
        };
      });
    } else {
      const rows = await prisma.$queryRawUnsafe<KundeRow[]>(
        `SELECT
          l.kundeId as id,
          k.name,
          k.firma,
          CAST(SUM(lp.menge * lp.verkaufspreis) AS REAL) as umsatz,
          CAST(SUM(lp.menge * lp.einkaufspreis) AS REAL) as einkauf,
          CAST(COALESCE((
            SELECT SUM(gp.menge * gp.preis)
            FROM GutschriftPosition gp
            JOIN Gutschrift g ON g.id = gp.gutschriftId
            WHERE g.kundeId = l.kundeId
              AND g.status != 'STORNIERT'
              AND g.datum >= ? AND g.datum <= ?
          ), 0) AS REAL) as gutschriften
        FROM Lieferposition lp
        JOIN Lieferung l ON l.id = lp.lieferungId
        JOIN Kunde k ON k.id = l.kundeId
        WHERE l.status = 'geliefert' AND l.datum >= ? AND l.datum <= ?
        GROUP BY l.kundeId, k.name, k.firma
        ORDER BY umsatz DESC`,
        vonDate, bisDate, vonDate, bisDate
      );
      items = rows.map((r) => {
        const umsatzNetto = Math.round((r.umsatz - r.gutschriften) * 100) / 100;
        const einkauf = Math.round(r.einkauf * 100) / 100;
        const db = Math.round((umsatzNetto - einkauf) * 100) / 100;
        return {
          id: r.id,
          name: r.firma ? `${r.name} (${r.firma})` : r.name,
          umsatz: umsatzNetto,
          einkauf,
          gutschriften: Math.round(r.gutschriften * 100) / 100,
          deckungsbeitrag: db,
          dbMarge: umsatzNetto > 0 ? Math.round((db / umsatzNetto) * 10000) / 100 : 0,
        };
      });
    }

    items.sort((a, b) => b.deckungsbeitrag - a.deckungsbeitrag);

    // Konfigurierbare Schwellwerte aus Einstellungen
    const schwellwertRows = await prisma.einstellung.findMany({
      where: { key: { in: ["statistik.db_schwellwert_gut", "statistik.db_schwellwert_kritisch"] } },
    });
    const schwellwertGut = Number(schwellwertRows.find((e) => e.key === "statistik.db_schwellwert_gut")?.value ?? 30);
    const schwellwertKritisch = Number(schwellwertRows.find((e) => e.key === "statistik.db_schwellwert_kritisch")?.value ?? 15);

    return NextResponse.json({ typ: typ === "artikel" ? "artikel" : "kunde", von, bis, items, schwellwertGut, schwellwertKritisch });
  } catch (e) {
    console.error("Deckungsbeitrag-Analyse Fehler:", e);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
