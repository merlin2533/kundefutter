import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseYearMonth, parseBisYearMonth } from "@/lib/utils";
export const dynamic = "force-dynamic";

// GET /api/statistik/lager?von=YYYY-MM&bis=YYYY-MM
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const von = searchParams.get("von");
    const bis = searchParams.get("bis");

    const vonDate = parseYearMonth(von);
    const bisDate = parseBisYearMonth(bis);
    const vonIso = vonDate.toISOString();
    const bisIso = bisDate.toISOString();

    type LagerwertRow = { lagerwert: number | null };
    type UnterMindestRow = { id: number; name: string; aktuellerBestand: number; mindestbestand: number; einheit: string };
    type BewegungRow = { typ: string; anzahl: number; mengeSumme: number | null };
    type SlowMoverRow = { id: number; name: string; aktuellerBestand: number; standardpreis: number; einheit: string; letzteBewegung: string | null };
    type AusgabenWertRow = { ausgabenWert: number | null };

    const [lagerwertRows, unterMindestRows, bewegungRows, slowMoverRows, ausgabenWertRows] = await Promise.all([
      // Lagerwert: Snapshot aller aktiven Artikel (aktuellerBestand * standardpreis)
      prisma.$queryRawUnsafe<LagerwertRow[]>(
        `SELECT CAST(SUM(aktuellerBestand * standardpreis) AS REAL) as lagerwert
         FROM Artikel
         WHERE aktiv = 1`
      ),
      // Artikel unter Mindestbestand (aktive)
      prisma.$queryRawUnsafe<UnterMindestRow[]>(
        `SELECT id, name,
                CAST(aktuellerBestand AS REAL) as aktuellerBestand,
                CAST(mindestbestand AS REAL) as mindestbestand,
                einheit
         FROM Artikel
         WHERE aktiv = 1 AND aktuellerBestand < mindestbestand
         ORDER BY (mindestbestand - aktuellerBestand) DESC
         LIMIT 200`
      ),
      // Bewegungen im Zeitraum nach Typ
      prisma.$queryRawUnsafe<BewegungRow[]>(
        `SELECT typ,
                COUNT(id) as anzahl,
                CAST(SUM(ABS(menge)) AS REAL) as mengeSumme
         FROM Lagerbewegung
         WHERE datum >= ? AND datum < ?
         GROUP BY typ
         ORDER BY typ`,
        vonIso, bisIso
      ),
      // Slow-Mover: aktive Artikel mit Bestand > 0 und letzter Bewegung > 90 Tage
      prisma.$queryRawUnsafe<SlowMoverRow[]>(
        `SELECT a.id, a.name,
                CAST(a.aktuellerBestand AS REAL) as aktuellerBestand,
                CAST(a.standardpreis AS REAL) as standardpreis,
                a.einheit,
                MAX(lb.datum) as letzteBewegung
         FROM Artikel a
         LEFT JOIN Lagerbewegung lb ON lb.artikelId = a.id
         WHERE a.aktiv = 1 AND a.aktuellerBestand > 0
         GROUP BY a.id
         HAVING letzteBewegung IS NULL OR letzteBewegung < date('now', '-90 days')
         ORDER BY a.aktuellerBestand * a.standardpreis DESC
         LIMIT 50`
      ),
      // Ausgaben-Wert im Zeitraum (für Turnover-Berechnung)
      prisma.$queryRawUnsafe<AusgabenWertRow[]>(
        `SELECT CAST(SUM(ABS(lb.menge) * a.standardpreis) AS REAL) as ausgabenWert
         FROM Lagerbewegung lb
         JOIN Artikel a ON a.id = lb.artikelId
         WHERE lb.datum >= ? AND lb.datum < ? AND lb.typ = 'ausgang'`,
        vonIso, bisIso
      ),
    ]);

    const r2 = (n: number | null | undefined) => Math.round((n ?? 0) * 100) / 100;

    const lagerwert = r2(lagerwertRows[0]?.lagerwert ?? 0);

    const artikelUnterMindest = unterMindestRows.map((a) => ({
      id: a.id,
      name: a.name,
      bestand: r2(a.aktuellerBestand),
      mindest: r2(a.mindestbestand),
      einheit: a.einheit,
    }));

    const bewegungenNachTyp = bewegungRows.map((b) => ({
      typ: b.typ,
      anzahl: Number(b.anzahl) || 0,
      mengeSumme: r2(b.mengeSumme),
    }));

    const anzahlBewegungen = bewegungenNachTyp.reduce((s, b) => s + b.anzahl, 0);

    const slowMover = slowMoverRows.map((a) => ({
      id: Number(a.id),
      name: a.name,
      bestand: r2(a.aktuellerBestand),
      lagerwert: r2(a.aktuellerBestand * a.standardpreis),
      einheit: a.einheit,
      letzteBewegung: a.letzteBewegung ?? null,
    }));

    const ausgabenWert = r2(ausgabenWertRows[0]?.ausgabenWert ?? 0);
    // Turnover-Ratio: Abgangswert im Zeitraum / aktueller Lagerwert
    const turnoverRatio = lagerwert > 0 ? r2(ausgabenWert / lagerwert) : 0;
    const slowMoverLagerwert = r2(slowMover.reduce((s, a) => s + a.lagerwert, 0));

    return NextResponse.json({
      lagerwert,
      artikelUnterMindest,
      bewegungenNachTyp,
      slowMover,
      turnoverRatio,
      slowMoverLagerwert,
      summe: {
        anzahlBewegungen,
      },
    });
  } catch (e) {
    console.error("Statistik/Lager API Fehler:", e);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
