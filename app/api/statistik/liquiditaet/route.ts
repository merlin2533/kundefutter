import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseYearMonth, parseBisYearMonth } from "@/lib/utils";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  const isDev = process.env.NODE_ENV === "development";

  try {
    const { searchParams } = req.nextUrl;
    const von = parseYearMonth(searchParams.get("von"));
    const bis = parseBisYearMonth(searchParams.get("bis"));

    // 1. Bezahlte Lieferungen im Zeitraum → Einnahmen
    const bezahltelieferungen = await prisma.lieferung.findMany({
      where: {
        bezahltAm: { gte: von, lte: bis },
        status: { not: "storniert" },
      },
      select: {
        bezahltAm: true,
        positionen: { select: { menge: true, verkaufspreis: true } },
      },
      take: 5000,
    });

    // 2. Ausgaben im Zeitraum
    const ausgabenList = await prisma.ausgabe.findMany({
      where: {
        datum: { gte: von, lte: bis },
      },
      select: { datum: true, betragNetto: true },
      take: 5000,
    });

    // 3. Offene Forderungen (Stichtag)
    const offeneForderungen = await prisma.lieferung.findMany({
      where: {
        rechnungNr: { not: null },
        bezahltAm: null,
        status: { not: "storniert" },
      },
      select: {
        positionen: { select: { menge: true, verkaufspreis: true } },
      },
      take: 2000,
    });

    // 4. Offene Verbindlichkeiten (Stichtag)
    const offeneVerbindlichkeiten = await prisma.eingangsRechnung.findMany({
      where: { status: "OFFEN" },
      select: { betrag: true },
      take: 2000,
    });

    // 5. Lagerwert (Einstandspreis × Bestand)
    const artikel = await prisma.artikel.findMany({
      where: { aktiv: true },
      select: { aktuellerBestand: true, standardpreis: true },
      take: 5000,
    });

    // ── Aggregation nach Monat ────────────────────────────────────────────────

    const monatMap = new Map<string, { einnahmen: number; ausgaben: number }>();

    for (const l of bezahltelieferungen) {
      if (!l.bezahltAm) continue;
      const monat = l.bezahltAm.toISOString().substring(0, 7);
      const betrag = l.positionen.reduce((s, p) => s + p.menge * p.verkaufspreis, 0);
      const entry = monatMap.get(monat) ?? { einnahmen: 0, ausgaben: 0 };
      entry.einnahmen += betrag;
      monatMap.set(monat, entry);
    }

    for (const a of ausgabenList) {
      if (!a.datum) continue;
      const monat = a.datum.toISOString().substring(0, 7);
      const entry = monatMap.get(monat) ?? { einnahmen: 0, ausgaben: 0 };
      entry.ausgaben += a.betragNetto;
      monatMap.set(monat, entry);
    }

    // Ensure all months in range are represented
    const cur = new Date(von);
    const end = new Date(bis);
    while (cur <= end) {
      const key = cur.toISOString().substring(0, 7);
      if (!monatMap.has(key)) monatMap.set(key, { einnahmen: 0, ausgaben: 0 });
      cur.setMonth(cur.getMonth() + 1);
    }

    const monate = [...monatMap.keys()].sort();
    let kumulativ = 0;
    const monatlicherCashflow = monate.map((monat) => {
      const d = monatMap.get(monat)!;
      const netto = d.einnahmen - d.ausgaben;
      kumulativ += netto;
      return {
        monat,
        einnahmen: Math.round(d.einnahmen * 100) / 100,
        ausgaben: Math.round(d.ausgaben * 100) / 100,
        netto: Math.round(netto * 100) / 100,
        kumulativ: Math.round(kumulativ * 100) / 100,
      };
    });

    // Trend: gleitender 3-Monats-Durchschnitt des Netto-Cashflows
    const trend = monatlicherCashflow.map((m, i) => {
      const window = monatlicherCashflow.slice(Math.max(0, i - 2), i + 1);
      const avg = window.reduce((s, w) => s + w.netto, 0) / window.length;
      return { monat: m.monat, trendNetto: Math.round(avg * 100) / 100 };
    });

    // ── Bilanz (Stichtagswerte) ───────────────────────────────────────────────

    const forderungGesamt = offeneForderungen.reduce(
      (s, l) => s + l.positionen.reduce((ps, p) => ps + p.menge * p.verkaufspreis, 0),
      0
    );
    const verbindlichkeitGesamt = offeneVerbindlichkeiten.reduce((s, e) => s + e.betrag, 0);
    const lagerwert = artikel.reduce((s, a) => s + a.aktuellerBestand * a.standardpreis, 0);
    const aktivaGesamt = forderungGesamt + lagerwert;
    const passivaGesamt = verbindlichkeitGesamt;
    const eigenkapital = aktivaGesamt - passivaGesamt;

    // ── KPI ───────────────────────────────────────────────────────────────────

    const now = new Date();
    const aktuellerMonat = now.toISOString().substring(0, 7);
    const vorMonatDt = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const vormonat = vorMonatDt.toISOString().substring(0, 7);

    const aktMonat = monatMap.get(aktuellerMonat);
    const vMonat = monatMap.get(vormonat);
    const cashflowAktuell = aktMonat ? aktMonat.einnahmen - aktMonat.ausgaben : 0;
    const cashflowVormonat = vMonat ? vMonat.einnahmen - vMonat.ausgaben : 0;
    const liquiditaetsgrad =
      verbindlichkeitGesamt > 0
        ? Math.round((forderungGesamt / verbindlichkeitGesamt) * 100 * 10) / 10
        : null;

    return NextResponse.json({
      monatlicherCashflow,
      trend,
      bilanz: {
        aktiva: {
          forderungen: Math.round(forderungGesamt * 100) / 100,
          lagerwert: Math.round(lagerwert * 100) / 100,
          gesamt: Math.round(aktivaGesamt * 100) / 100,
        },
        passiva: {
          verbindlichkeiten: Math.round(verbindlichkeitGesamt * 100) / 100,
          gesamt: Math.round(passivaGesamt * 100) / 100,
        },
        eigenkapital: Math.round(eigenkapital * 100) / 100,
      },
      kpi: {
        cashflowAktuell: Math.round(cashflowAktuell * 100) / 100,
        cashflowVormonat: Math.round(cashflowVormonat * 100) / 100,
        liquiditaetsgrad,
        forderungGesamt: Math.round(forderungGesamt * 100) / 100,
        verbindlichkeitGesamt: Math.round(verbindlichkeitGesamt * 100) / 100,
        lagerwert: Math.round(lagerwert * 100) / 100,
      },
    });
  } catch (err) {
    const msg = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
