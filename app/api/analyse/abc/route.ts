import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseYearMonth, parseBisYearMonth } from "@/lib/utils";
export const dynamic = "force-dynamic";

// GET /api/analyse/abc — ohne von/bis: letzte 12 Monate (rückwärtskompatibel).
// Mit ?von=YYYY-MM[&bis=YYYY-MM]: expliziter Zeitraum.
// Mit ?vonVP=YYYY-MM&bisVP=YYYY-MM: Vorperiode für Migrations-Vergleich.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const von = searchParams.get("von");
    const bis = searchParams.get("bis");
    const vonVP = searchParams.get("vonVP");
    const bisVP = searchParams.get("bisVP");

    const heute = new Date();
    let vonIso: string;
    let bisIso: string | null = null;
    if (von) {
      vonIso = parseYearMonth(von).toISOString();
      bisIso = parseBisYearMonth(bis).toISOString();
    } else {
      vonIso = new Date(heute.getFullYear(), heute.getMonth() - 12, heute.getDate()).toISOString();
    }

    type Row = { kundeId: number; name: string; firma: string | null; umsatz: number };

    function buildAbcKlasse(rows: Row[]) {
      const gesamt = rows.reduce((s, k) => s + k.umsatz, 0);
      let kumuliert = 0;
      return rows.map((k) => {
        const anteil = gesamt > 0 ? (k.umsatz / gesamt) * 100 : 0;
        kumuliert += anteil;
        let klasse: "A" | "B" | "C";
        if (kumuliert - anteil < 80) klasse = "A";
        else if (kumuliert - anteil < 95) klasse = "B";
        else klasse = "C";
        return { kundeId: k.kundeId, klasse, umsatz: Math.round(k.umsatz * 100) / 100 };
      });
    }

    const abcQuery = (vIso: string, bIso: string) =>
      prisma.$queryRawUnsafe<Row[]>(
        `SELECT
          l.kundeId, k.name, k.firma,
          CAST(SUM(lp.menge * lp.verkaufspreis) AS REAL) as umsatz
        FROM Lieferung l
        JOIN Lieferposition lp ON lp.lieferungId = l.id
        JOIN Kunde k ON k.id = l.kundeId
        WHERE l.status = 'geliefert' AND l.datum >= ? AND l.datum < ?
        GROUP BY l.kundeId, k.name, k.firma
        ORDER BY umsatz DESC`,
        vIso, bIso
      );

    const rows = bisIso
      ? await abcQuery(vonIso, bisIso)
      : await prisma.$queryRawUnsafe<Row[]>(
          `SELECT
            l.kundeId, k.name, k.firma,
            CAST(SUM(lp.menge * lp.verkaufspreis) AS REAL) as umsatz
          FROM Lieferung l
          JOIN Lieferposition lp ON lp.lieferungId = l.id
          JOIN Kunde k ON k.id = l.kundeId
          WHERE l.status = 'geliefert' AND l.datum >= ?
          GROUP BY l.kundeId, k.name, k.firma
          ORDER BY umsatz DESC`,
          vonIso
        );

    const gesamt = rows.reduce((s, k) => s + k.umsatz, 0);

    let kumuliert = 0;
    const kunden = rows.map((k) => {
      const anteil = gesamt > 0 ? (k.umsatz / gesamt) * 100 : 0;
      kumuliert += anteil;
      let klasse: "A" | "B" | "C";
      if (kumuliert - anteil < 80) klasse = "A";
      else if (kumuliert - anteil < 95) klasse = "B";
      else klasse = "C";
      return {
        id: k.kundeId,
        kundeId: k.kundeId,
        name: k.name,
        firma: k.firma ?? null,
        umsatz: Math.round(k.umsatz * 100) / 100,
        anteil: Math.round(anteil * 100) / 100,
        klasse,
        kumuliert: Math.round(kumuliert * 100) / 100,
      };
    });

    const aKunden = kunden.filter((k) => k.klasse === "A");
    const bKunden = kunden.filter((k) => k.klasse === "B");
    const cKunden = kunden.filter((k) => k.klasse === "C");

    // ── Migrations-Vergleich (optional) ──────────────────────────────────────
    let migrationen: {
      kundeId: number; name: string; firma: string | null;
      klasseAktuell: "A" | "B" | "C";
      klasseVorperiode: "A" | "B" | "C" | "neu" | "weg";
      umsatzAktuell: number; umsatzVorperiode: number;
    }[] = [];

    if (vonVP && bisIso) {
      const vpVonIso = parseYearMonth(vonVP).toISOString();
      const vpBisIso = parseBisYearMonth(bisVP).toISOString();
      const vpRows = await abcQuery(vpVonIso, vpBisIso);
      const vpKlassen = buildAbcKlasse(vpRows);
      const vpMap = new Map(vpKlassen.map((k) => [k.kundeId, k]));
      const aktuelleKlassen = buildAbcKlasse(rows);
      const aktuelleMap = new Map(aktuelleKlassen.map((k) => [k.kundeId, k]));

      // Alle Kunden aus beiden Zeiträumen kombinieren
      const alleKundenIds = new Set([...rows.map((r) => r.kundeId), ...vpRows.map((r) => r.kundeId)]);
      const nameMap = new Map([...rows, ...vpRows].map((r) => [r.kundeId, { name: r.name, firma: r.firma }]));

      for (const kundeId of alleKundenIds) {
        const aktuell = aktuelleMap.get(kundeId);
        const vorperiode = vpMap.get(kundeId);
        const info = nameMap.get(kundeId)!;
        if (!aktuell && vorperiode) {
          migrationen.push({
            kundeId, name: info.name, firma: info.firma ?? null,
            klasseAktuell: "C", // wegfallend
            klasseVorperiode: vorperiode.klasse,
            umsatzAktuell: 0, umsatzVorperiode: vorperiode.umsatz,
          });
        } else if (aktuell) {
          migrationen.push({
            kundeId, name: info.name, firma: info.firma ?? null,
            klasseAktuell: aktuell.klasse,
            klasseVorperiode: vorperiode ? vorperiode.klasse : "neu",
            umsatzAktuell: aktuell.umsatz,
            umsatzVorperiode: vorperiode?.umsatz ?? 0,
          });
        }
      }

      // Sortierung: Absteiger zuerst (A→C), dann alphabetisch
      const abstiegOrder = (m: typeof migrationen[0]) => {
        const from = m.klasseVorperiode === "neu" ? 0 : m.klasseVorperiode === "A" ? 3 : m.klasseVorperiode === "B" ? 2 : 1;
        const to = m.klasseAktuell === "A" ? 3 : m.klasseAktuell === "B" ? 2 : 1;
        return from - to; // positiv = Abstieg
      };
      migrationen.sort((a, b) => abstiegOrder(b) - abstiegOrder(a));
    }

    return NextResponse.json({
      kunden,
      gesamt: Math.round(gesamt * 100) / 100,
      aKunden: {
        anzahl: aKunden.length,
        umsatz: Math.round(aKunden.reduce((s, k) => s + k.umsatz, 0) * 100) / 100,
        anteil: Math.round(aKunden.reduce((s, k) => s + k.anteil, 0) * 100) / 100,
      },
      bKunden: {
        anzahl: bKunden.length,
        umsatz: Math.round(bKunden.reduce((s, k) => s + k.umsatz, 0) * 100) / 100,
        anteil: Math.round(bKunden.reduce((s, k) => s + k.anteil, 0) * 100) / 100,
      },
      cKunden: {
        anzahl: cKunden.length,
        umsatz: Math.round(cKunden.reduce((s, k) => s + k.umsatz, 0) * 100) / 100,
        anteil: Math.round(cKunden.reduce((s, k) => s + k.anteil, 0) * 100) / 100,
      },
      migrationen,
    });
  } catch (e) {
    console.error("ABC-Analyse Fehler:", e);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
