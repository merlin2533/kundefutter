import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseYearMonth, parseBisYearMonth } from "@/lib/utils";
export const dynamic = "force-dynamic";

// GET /api/statistik/vorbestellungen?von=YYYY-MM&bis=YYYY-MM
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
    type SaisonRow = { saison: string; anzahl: number; wert: number | null };
    type UmwandlungsRow = { status: string; anzahl: number };

    const [nachStatus, nachSaison, allStatus] = await Promise.all([
      prisma.$queryRawUnsafe<StatusRow[]>(
        `SELECT
           v.status,
           COUNT(DISTINCT v.id) as anzahl,
           CAST(SUM(vp.menge * COALESCE(vp.preis, 0)) AS REAL) as wert
         FROM Vorbestellung v
         LEFT JOIN VorbestellungPosition vp ON vp.vorbestellungId = v.id
         WHERE v.bestelldatum >= ? AND v.bestelldatum < ?
         GROUP BY v.status
         ORDER BY v.status`,
        vonIso, bisIso
      ),
      prisma.$queryRawUnsafe<SaisonRow[]>(
        `SELECT
           v.saison,
           COUNT(DISTINCT v.id) as anzahl,
           CAST(SUM(vp.menge * COALESCE(vp.preis, 0)) AS REAL) as wert
         FROM Vorbestellung v
         LEFT JOIN VorbestellungPosition vp ON vp.vorbestellungId = v.id
         WHERE v.bestelldatum >= ? AND v.bestelldatum < ?
         GROUP BY v.saison
         ORDER BY v.saison`,
        vonIso, bisIso
      ),
      prisma.$queryRawUnsafe<UmwandlungsRow[]>(
        `SELECT status, COUNT(id) as anzahl
         FROM Vorbestellung
         WHERE bestelldatum >= ? AND bestelldatum < ?
         GROUP BY status`,
        vonIso, bisIso
      ),
    ]);

    const r2 = (n: number | null | undefined) => Math.round((n ?? 0) * 100) / 100;

    const statusMapped = nachStatus.map((s) => ({
      status: s.status,
      anzahl: Number(s.anzahl) || 0,
      wert: r2(s.wert),
    }));

    const saisonMapped = nachSaison.map((s) => ({
      saison: s.saison,
      anzahl: Number(s.anzahl) || 0,
      wert: r2(s.wert),
    }));

    // Umwandlungsquote = UMGEWANDELT / (alle außer STORNIERT)
    let umgewandelt = 0;
    let ohneStorno = 0;
    for (const r of allStatus) {
      const n = Number(r.anzahl) || 0;
      if (r.status === "UMGEWANDELT") umgewandelt += n;
      if (r.status !== "STORNIERT") ohneStorno += n;
    }
    const umwandlungsquote = ohneStorno > 0
      ? Math.round((umgewandelt / ohneStorno) * 1000) / 10
      : 0;

    const anzahlGesamt = statusMapped.reduce((s, r) => s + r.anzahl, 0);
    const wertGesamt = r2(statusMapped.reduce((s, r) => s + r.wert, 0));

    return NextResponse.json({
      nachStatus: statusMapped,
      nachSaison: saisonMapped,
      umwandlungsquote,
      summe: {
        anzahl: anzahlGesamt,
        wert: wertGesamt,
      },
    });
  } catch (e) {
    console.error("Statistik/Vorbestellungen API Fehler:", e);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
