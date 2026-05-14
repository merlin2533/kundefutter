import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseYearMonth, parseBisYearMonth } from "@/lib/utils";
export const dynamic = "force-dynamic";

// GET /api/statistik/angebote?von=YYYY-MM&bis=YYYY-MM
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const von = searchParams.get("von");
    const bis = searchParams.get("bis");

    const vonDate = parseYearMonth(von);
    const bisDate = parseBisYearMonth(bis);
    const vonIso = vonDate.toISOString();
    const bisIso = bisDate.toISOString();

    type StatusRow = { status: string; anzahl: number; wert: number | null };
    type GesamtRow = { anzahl: number; gesamtwert: number | null; angenommenWert: number | null };

    const [nachStatusRaw, gesamtRaw] = await Promise.all([
      prisma.$queryRawUnsafe<StatusRow[]>(
        `SELECT
           a.status,
           COUNT(DISTINCT a.id) as anzahl,
           CAST(SUM(ap.menge * ap.preis * (1.0 - ap.rabatt / 100.0)) AS REAL) as wert
         FROM Angebot a
         LEFT JOIN AngebotPosition ap ON ap.angebotId = a.id
         WHERE a.datum >= ? AND a.datum < ?
         GROUP BY a.status
         ORDER BY a.status`,
        vonIso,
        bisIso
      ),
      prisma.$queryRawUnsafe<GesamtRow[]>(
        `SELECT
           COUNT(DISTINCT a.id) as anzahl,
           CAST(SUM(ap.menge * ap.preis * (1.0 - ap.rabatt / 100.0)) AS REAL) as gesamtwert,
           CAST(SUM(CASE WHEN a.status = 'ANGENOMMEN' THEN ap.menge * ap.preis * (1.0 - ap.rabatt / 100.0) ELSE 0 END) AS REAL) as angenommenWert
         FROM Angebot a
         LEFT JOIN AngebotPosition ap ON ap.angebotId = a.id
         WHERE a.datum >= ? AND a.datum < ?`,
        vonIso,
        bisIso
      ),
    ]);

    const r2 = (n: number | null | undefined) => Math.round((n ?? 0) * 100) / 100;

    const nachStatus = nachStatusRaw.map((row) => ({
      status: row.status,
      anzahl: Number(row.anzahl) || 0,
      wert: r2(row.wert),
    }));

    const gesamt = gesamtRaw[0] ?? { anzahl: 0, gesamtwert: null, angenommenWert: null };
    const anzahlGesamt = Number(gesamt.anzahl) || 0;
    const gesamtwert = r2(gesamt.gesamtwert);
    const angenommenWert = r2(gesamt.angenommenWert);

    const angenommenAnzahl = nachStatus.find((s) => s.status === "ANGENOMMEN")?.anzahl ?? 0;
    const abgelehntAnzahl = nachStatus.find((s) => s.status === "ABGELEHNT")?.anzahl ?? 0;
    const nenner = angenommenAnzahl + abgelehntAnzahl;
    const annahmequote = nenner > 0 ? Math.round((angenommenAnzahl / nenner) * 1000) / 10 : 0;

    const durchschnittswert = anzahlGesamt > 0 ? r2(gesamtwert / anzahlGesamt) : 0;

    return NextResponse.json({
      nachStatus,
      annahmequote,
      summe: {
        anzahl: anzahlGesamt,
        gesamtwert,
        angenommenWert,
        durchschnittswert,
      },
    });
  } catch (e) {
    console.error("Statistik/Angebote API Fehler:", e);
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && e instanceof Error ? e.message : "Datenbankfehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
