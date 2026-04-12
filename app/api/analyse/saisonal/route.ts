import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const MONAT_LABELS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const jahreParam = searchParams.get("jahre");

    const heute = new Date();
    const aktuellesJahr = heute.getFullYear();

    let jahre: number[];
    if (jahreParam) {
      jahre = jahreParam.split(",").map(Number).filter((n) => !isNaN(n));
    } else {
      jahre = [aktuellesJahr - 2, aktuellesJahr - 1, aktuellesJahr];
    }

    const minJahr = Math.min(...jahre);
    const vonDate = new Date(minJahr, 0, 1).toISOString();

    type AggRow = {
      monat: number;
      jahr: number;
      kategorie: string | null;
      artikelId: number;
      artikelName: string;
      umsatz: number;
    };

    type CountRow = { monat: number; jahr: number; anzahl: number };

    // Two focused queries instead of loading 10 000 full records
    const [aggRows, countRows] = await Promise.all([
      prisma.$queryRawUnsafe<AggRow[]>(
        `SELECT
          CAST(strftime('%m', l.datum) AS INTEGER) as monat,
          CAST(strftime('%Y', l.datum) AS INTEGER) as jahr,
          COALESCE(a.kategorie, 'Sonstige') as kategorie,
          a.id as artikelId,
          a.name as artikelName,
          CAST(SUM(lp.menge * lp.verkaufspreis) AS REAL) as umsatz
        FROM Lieferung l
        JOIN Lieferposition lp ON lp.lieferungId = l.id
        JOIN Artikel a ON a.id = lp.artikelId
        WHERE l.status = 'geliefert' AND l.datum >= ?
        GROUP BY monat, jahr, a.kategorie, a.id
        ORDER BY jahr, monat`,
        vonDate
      ),
      prisma.$queryRawUnsafe<CountRow[]>(
        `SELECT
          CAST(strftime('%m', l.datum) AS INTEGER) as monat,
          CAST(strftime('%Y', l.datum) AS INTEGER) as jahr,
          COUNT(*) as anzahl
        FROM Lieferung l
        WHERE l.status = 'geliefert' AND l.datum >= ?
        GROUP BY monat, jahr`,
        vonDate
      ),
    ]);

    // Build monat × jahr umsatz matrix
    type JahrDaten = { umsatz: number; anzahl: number };
    const matrix: Record<number, Record<number, JahrDaten>> = {};
    for (let m = 1; m <= 12; m++) {
      matrix[m] = {};
      for (const j of jahre) matrix[m][j] = { umsatz: 0, anzahl: 0 };
    }

    // Fill counts
    for (const row of countRows) {
      if (jahre.includes(row.jahr) && matrix[row.monat]?.[row.jahr]) {
        matrix[row.monat][row.jahr].anzahl = row.anzahl;
      }
    }

    // Kategorie × monat matrix + Artikel map
    const kategorien = new Set<string>();
    const kategorieMatrix: Record<number, Record<string, number>> = {};
    for (let m = 0; m < 12; m++) kategorieMatrix[m] = {};

    const artikelMonatMap = new Map<number, { name: string; umsatz: number[] }>();

    for (const row of aggRows) {
      if (!jahre.includes(row.jahr)) continue;

      const kat = row.kategorie ?? "Sonstige";
      kategorien.add(kat);

      // Accumulate umsatz in month×year matrix (sum over all articles/categories)
      matrix[row.monat][row.jahr].umsatz += row.umsatz;

      // Kategorie breakdown (all years combined)
      kategorieMatrix[row.monat - 1][kat] = (kategorieMatrix[row.monat - 1][kat] ?? 0) + row.umsatz;

      // Artikel breakdown
      if (!artikelMonatMap.has(row.artikelId)) {
        artikelMonatMap.set(row.artikelId, { name: row.artikelName, umsatz: Array(12).fill(0) });
      }
      artikelMonatMap.get(row.artikelId)!.umsatz[row.monat - 1] += row.umsatz;
    }

    // Build monatsData response
    const monatsData = Array.from({ length: 12 }, (_, i) => {
      const monat = i + 1;
      const entry: Record<string, unknown> = { monat, label: MONAT_LABELS[i] };
      for (const j of jahre) {
        const d = matrix[monat][j];
        entry[String(j)] = {
          umsatz: Math.round(d.umsatz * 100) / 100,
          anzahl: d.anzahl,
        };
      }
      const katEntry: Record<string, number> = {};
      for (const kat of kategorien) {
        katEntry[kat] = Math.round((kategorieMatrix[i][kat] ?? 0) * 100) / 100;
      }
      entry.kategorien = katEntry;
      return entry;
    });

    // Stärkster Monat je Kategorie
    const staerksterMonat: Record<string, { monat: string; umsatz: number }> = {};
    for (const kat of kategorien) {
      let maxUmsatz = 0;
      let maxMonat = "";
      for (let i = 0; i < 12; i++) {
        const u = kategorieMatrix[i][kat] ?? 0;
        if (u > maxUmsatz) { maxUmsatz = u; maxMonat = MONAT_LABELS[i]; }
      }
      if (maxUmsatz > 0) staerksterMonat[kat] = { monat: maxMonat, umsatz: Math.round(maxUmsatz * 100) / 100 };
    }

    // Top 5 Artikel by total umsatz
    const topArtikel = Array.from(artikelMonatMap.entries())
      .map(([artikelId, v]) => ({
        artikelId,
        name: v.name,
        umsatzGesamt: Math.round(v.umsatz.reduce((s, x) => s + x, 0) * 100) / 100,
        umsatzProMonat: v.umsatz.map((u) => Math.round(u * 100) / 100),
      }))
      .sort((a, b) => b.umsatzGesamt - a.umsatzGesamt)
      .slice(0, 5);

    return NextResponse.json({
      jahre,
      monatsData,
      topArtikel,
      kategorien: Array.from(kategorien).sort(),
      staerksterMonat,
    });
  } catch (e) {
    console.error("Saisonal-Analyse Fehler:", e);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
