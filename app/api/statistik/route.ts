import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseYearMonth, parseBisYearMonth } from "@/lib/utils";
export const dynamic = "force-dynamic";


export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const von = searchParams.get("von"); // YYYY-MM
    const bis = searchParams.get("bis"); // YYYY-MM

    // Build and validate date range
    const vonDate = parseYearMonth(von);
    const bisDate = parseBisYearMonth(bis);

    const vonIso = vonDate.toISOString();
    const bisIso = bisDate.toISOString();

    // Gleicher Zeitraum im Vorjahr (für den Vorjahresvergleich)
    const vonVorjahr = new Date(vonDate); vonVorjahr.setFullYear(vonVorjahr.getFullYear() - 1);
    const bisVorjahr = new Date(bisDate); bisVorjahr.setFullYear(bisVorjahr.getFullYear() - 1);
    const vonVorjahrIso = vonVorjahr.toISOString();
    const bisVorjahrIso = bisVorjahr.toISOString();

    // All aggregations run in the DB — no full-table load into Node.js
    type MonatRow    = { monat: string; umsatz: number; anzahl: number };
    type ArtikelRow  = { artikelId: number; name: string; menge: number; umsatz: number };
    type KundeRow    = { kundeId: number; name: string; umsatz: number; anzahl: number };
    type KatRow      = { kategorie: string; umsatz: number; menge: number };
    type SaisonRow   = { monat: number; umsatz: number };
    type KpiRow      = { umsatz: number | null; marge: number | null; anzahl: number };
    type StatusRow   = { status: string; anzahl: number };
    type OpRow       = { anzahl: number; summe: number | null };
    type AusgabeRow  = { kategorie: string; summe: number | null };
    type LagerRow    = { unterMindest: number; lagerwert: number | null };
    type VorjahrRow  = { umsatz: number | null };

    const [
      umsatzNachMonatRaw, topArtikelRaw, topKundenRaw, umsatzNachKategorieRaw, saisonRaw,
      kpiRaw, lieferStatusRaw, offenePostenRaw, ausgabenRaw, lagerRaw, vorjahrRaw,
    ] =
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
        // KPI-Summen: Umsatz, Rohertrag/Marge, Anzahl Lieferungen
        prisma.$queryRawUnsafe<KpiRow[]>(
          `SELECT
            CAST(SUM(lp.menge * lp.verkaufspreis) AS REAL) as umsatz,
            CAST(SUM(lp.menge * (lp.verkaufspreis - lp.einkaufspreis)) AS REAL) as marge,
            COUNT(DISTINCT l.id) as anzahl
          FROM Lieferung l
          JOIN Lieferposition lp ON lp.lieferungId = l.id
          WHERE l.status = 'geliefert' AND l.datum >= ? AND l.datum < ?`,
          vonIso, bisIso
        ),
        // Lieferungen nach Status
        prisma.$queryRawUnsafe<StatusRow[]>(
          `SELECT l.status as status, COUNT(*) as anzahl
          FROM Lieferung l
          WHERE l.datum >= ? AND l.datum < ?
          GROUP BY l.status`,
          vonIso, bisIso
        ),
        // Offene Posten (unbezahlte gelieferte Rechnungen — stichtagsbezogen, kein Zeitraumfilter)
        prisma.$queryRawUnsafe<OpRow[]>(
          `SELECT
            COUNT(DISTINCT l.id) as anzahl,
            CAST(SUM(lp.menge * lp.verkaufspreis) AS REAL) as summe
          FROM Lieferung l
          JOIN Lieferposition lp ON lp.lieferungId = l.id
          WHERE l.status = 'geliefert' AND l.bezahltAm IS NULL AND l.rechnungNr IS NOT NULL`
        ),
        // Ausgaben nach Kategorie
        prisma.$queryRawUnsafe<AusgabeRow[]>(
          `SELECT
            COALESCE(a.kategorie, 'Sonstige') as kategorie,
            CAST(SUM(a.betrag) AS REAL) as summe
          FROM Ausgabe a
          WHERE a.datum >= ? AND a.datum < ?
          GROUP BY kategorie
          ORDER BY summe DESC`,
          vonIso, bisIso
        ),
        // Lager: Artikel unter Mindestbestand + Lagerwert (stichtagsbezogen)
        prisma.$queryRawUnsafe<LagerRow[]>(
          `SELECT
            CAST(SUM(CASE WHEN a.aktuellerBestand < a.mindestbestand THEN 1 ELSE 0 END) AS INTEGER) as unterMindest,
            CAST(SUM(a.aktuellerBestand * a.standardpreis) AS REAL) as lagerwert
          FROM Artikel a
          WHERE a.aktiv = 1`
        ),
        // Umsatz im gleichen Zeitraum des Vorjahres
        prisma.$queryRawUnsafe<VorjahrRow[]>(
          `SELECT CAST(SUM(lp.menge * lp.verkaufspreis) AS REAL) as umsatz
          FROM Lieferung l
          JOIN Lieferposition lp ON lp.lieferungId = l.id
          WHERE l.status = 'geliefert' AND l.datum >= ? AND l.datum < ?`,
          vonVorjahrIso, bisVorjahrIso
        ),
      ]);

    // Fill missing months 1–12 with 0 for saisonaleVerteilung
    const saisonMap = new Map<number, number>();
    for (let i = 1; i <= 12; i++) saisonMap.set(i, 0);
    for (const row of saisonRaw) saisonMap.set(row.monat, row.umsatz);
    const saisonaleVerteilung = Array.from(saisonMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([monat, umsatz]) => ({ monat, umsatz: Math.round(umsatz * 100) / 100 }));

    const r2 = (n: number | null | undefined) => Math.round((n ?? 0) * 100) / 100;
    const kpi = kpiRaw[0] ?? { umsatz: 0, marge: 0, anzahl: 0 };
    const kpiUmsatz = r2(kpi.umsatz);
    const kpiMarge = r2(kpi.marge);
    const kpiAnzahl = Number(kpi.anzahl) || 0;
    const op = offenePostenRaw[0] ?? { anzahl: 0, summe: 0 };
    const lager = lagerRaw[0] ?? { unterMindest: 0, lagerwert: 0 };
    const vorjahrUmsatz = r2(vorjahrRaw[0]?.umsatz);

    return NextResponse.json({
      umsatzNachMonat: umsatzNachMonatRaw.map((r) => ({
        monat: r.monat,
        umsatz: r2(r.umsatz),
        anzahl: r.anzahl,
      })),
      topArtikel: topArtikelRaw.map((r) => ({
        artikelId: r.artikelId,
        name: r.name,
        menge: r2(r.menge),
        umsatz: r2(r.umsatz),
      })),
      topKunden: topKundenRaw.map((r) => ({
        kundeId: r.kundeId,
        name: r.name,
        umsatz: r2(r.umsatz),
        anzahl: r.anzahl,
      })),
      umsatzNachKategorie: umsatzNachKategorieRaw.map((r) => ({
        kategorie: r.kategorie,
        umsatz: r2(r.umsatz),
        menge: r2(r.menge),
      })),
      saisonaleVerteilung,
      kpi: {
        umsatz: kpiUmsatz,
        marge: kpiMarge,
        margeProzent: kpiUmsatz > 0 ? Math.round((kpiMarge / kpiUmsatz) * 1000) / 10 : 0,
        anzahlLieferungen: kpiAnzahl,
        durchschnittProLieferung: kpiAnzahl > 0 ? r2(kpiUmsatz / kpiAnzahl) : 0,
      },
      lieferStatus: lieferStatusRaw.map((r) => ({ status: r.status, anzahl: Number(r.anzahl) || 0 })),
      offenePosten: { anzahl: Number(op.anzahl) || 0, summe: r2(op.summe) },
      ausgabenNachKategorie: ausgabenRaw.map((r) => ({ kategorie: r.kategorie, summe: r2(r.summe) })),
      lager: { artikelUnterMindest: Number(lager.unterMindest) || 0, lagerwert: r2(lager.lagerwert) },
      vorjahr: {
        umsatz: vorjahrUmsatz,
        veraenderungProzent: vorjahrUmsatz > 0
          ? Math.round(((kpiUmsatz - vorjahrUmsatz) / vorjahrUmsatz) * 1000) / 10
          : null,
      },
    });
  } catch (e) {
    console.error("Statistik API Fehler:", e);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
