import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseYearMonth, parseBisYearMonth } from "@/lib/utils";
export const dynamic = "force-dynamic";

// GET /api/statistik/crm?von=YYYY-MM&bis=YYYY-MM
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const von = searchParams.get("von");
    const bis = searchParams.get("bis");

    const vonDate = parseYearMonth(von);
    const bisDate = parseBisYearMonth(bis);
    const vonIso = vonDate.toISOString();
    const bisIso = bisDate.toISOString();

    type TypRow = { typ: string; anzahl: number };
    type MonatRow = { monat: string; anzahl: number };
    type OffeneRow = { anzahl: number };
    type GesamtRow = { anzahl: number };
    type DormantRow = { kundeId: number; name: string; firma: string | null; letzteAktivitaet: string | null; umsatz12M: number | null };

    const vor12MonateIso = new Date(new Date().getFullYear(), new Date().getMonth() - 12, 1).toISOString();
    const vor60TageIso = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

    const [nachTypRaw, nachMonatRaw, offeneRaw, gesamtRaw, dormantRaw] = await Promise.all([
      prisma.$queryRawUnsafe<TypRow[]>(
        `SELECT
           typ,
           COUNT(id) as anzahl
         FROM KundeAktivitaet
         WHERE datum >= ? AND datum < ?
         GROUP BY typ
         ORDER BY anzahl DESC`,
        vonIso,
        bisIso
      ),
      prisma.$queryRawUnsafe<MonatRow[]>(
        `SELECT
           strftime('%Y-%m', datum) as monat,
           COUNT(id) as anzahl
         FROM KundeAktivitaet
         WHERE datum >= ? AND datum < ?
         GROUP BY monat
         ORDER BY monat`,
        vonIso,
        bisIso
      ),
      prisma.$queryRawUnsafe<OffeneRow[]>(
        `SELECT COUNT(id) as anzahl
         FROM KundeAktivitaet
         WHERE erledigt = 0 AND faelligAm IS NOT NULL`
      ),
      prisma.$queryRawUnsafe<GesamtRow[]>(
        `SELECT COUNT(id) as anzahl
         FROM KundeAktivitaet
         WHERE datum >= ? AND datum < ?`,
        vonIso,
        bisIso
      ),
      // Dormant-Kunden: letzte Aktivität > 60 Tage + Umsatz in letzten 12 Monaten > 0
      prisma.$queryRawUnsafe<DormantRow[]>(
        `SELECT k.id as kundeId, k.name, k.firma,
                MAX(ka.datum) as letzteAktivitaet,
                CAST(COALESCE((
                  SELECT SUM(lp.menge * lp.verkaufspreis)
                  FROM Lieferung l
                  JOIN Lieferposition lp ON lp.lieferungId = l.id
                  WHERE l.kundeId = k.id AND l.status = 'geliefert' AND l.datum >= ?
                ), 0) AS REAL) as umsatz12M
         FROM Kunde k
         LEFT JOIN KundeAktivitaet ka ON ka.kundeId = k.id
         WHERE k.aktiv = 1
         GROUP BY k.id
         HAVING (letzteAktivitaet IS NULL OR letzteAktivitaet < ?) AND umsatz12M > 0
         ORDER BY umsatz12M DESC
         LIMIT 50`,
        vor12MonateIso,
        vor60TageIso
      ),
    ]);

    const nachTyp = nachTypRaw.map((row) => ({
      typ: row.typ,
      anzahl: Number(row.anzahl) || 0,
    }));

    const nachMonat = nachMonatRaw.map((row) => ({
      monat: row.monat,
      anzahl: Number(row.anzahl) || 0,
    }));

    const offeneAufgaben = Number(offeneRaw[0]?.anzahl ?? 0);
    const anzahl = Number(gesamtRaw[0]?.anzahl ?? 0);

    const dormantKunden = dormantRaw.map((d) => ({
      kundeId: Number(d.kundeId),
      name: d.name,
      firma: d.firma ?? null,
      letzteAktivitaet: d.letzteAktivitaet ?? null,
      umsatz12M: Math.round((Number(d.umsatz12M) || 0) * 100) / 100,
    }));

    return NextResponse.json({
      nachTyp,
      nachMonat,
      offeneAufgaben,
      dormantKunden,
      summe: { anzahl },
    });
  } catch (e) {
    console.error("Statistik/CRM API Fehler:", e);
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && e instanceof Error ? e.message : "Datenbankfehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
