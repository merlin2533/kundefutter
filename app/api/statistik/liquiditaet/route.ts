import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseYearMonth, parseBisYearMonth } from "@/lib/utils";
import { getCurrentUser } from "@/lib/auth";

function monatlichePersonalkosten(m: { typ: string; grundgehalt: number | null; minijobPauschale: number | null; stundenlohn: number | null; wochenstunden: number | null }): number {
  if (m.typ === "festgehalt") return m.grundgehalt ?? 0;
  if (m.typ === "minijob") return m.minijobPauschale ?? 0;
  if (m.typ === "stundenbasis") return (m.stundenlohn ?? 0) * (m.wochenstunden ?? 0) * 4.33;
  return 0;
}

export async function GET(req: NextRequest) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  const isDev = process.env.NODE_ENV === "development";

  try {
    const { searchParams } = req.nextUrl;
    const von = parseYearMonth(searchParams.get("von"));
    const bis = parseBisYearMonth(searchParams.get("bis"));

    const [bezahltelieferungen, ausgabenList, offeneForderungen, offeneVerbindlichkeiten, artikel, aktiveMitarbeiter] = await Promise.all([
      // 1. Bezahlte Lieferungen im Zeitraum → Einnahmen
      prisma.lieferung.findMany({
        where: { bezahltAm: { gte: von, lte: bis }, status: { not: "storniert" } },
        select: { bezahltAm: true, positionen: { select: { menge: true, verkaufspreis: true } } },
        take: 5000,
      }),
      // 2. Ausgaben im Zeitraum
      prisma.ausgabe.findMany({
        where: { datum: { gte: von, lte: bis } },
        select: { datum: true, betragNetto: true },
        take: 5000,
      }),
      // 3. Offene Forderungen (Stichtag)
      prisma.lieferung.findMany({
        where: { rechnungNr: { not: null }, bezahltAm: null, status: { not: "storniert" } },
        select: { positionen: { select: { menge: true, verkaufspreis: true } } },
        take: 2000,
      }),
      // 4. Offene Verbindlichkeiten (Stichtag)
      prisma.eingangsRechnung.findMany({
        where: { status: "OFFEN" },
        select: { betrag: true },
        take: 2000,
      }),
      // 5. Lagerwert (Einstandspreis × Bestand)
      prisma.artikel.findMany({
        where: { aktiv: true },
        select: { aktuellerBestand: true, standardpreis: true },
        take: 5000,
      }),
      // 6. Personalkosten (monatliche Plankosten aus aktiven Mitarbeitern)
      prisma.mitarbeiter.findMany({
        where: { aktiv: true },
        select: { typ: true, grundgehalt: true, minijobPauschale: true, stundenlohn: true, wochenstunden: true },
        take: 500,
      }),
    ]);

    const personalkosten = Math.round(aktiveMitarbeiter.reduce((s, m) => s + monatlichePersonalkosten(m), 0) * 100) / 100;

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

    // ── Prognose: Lineare Regression auf letzten 6 Monaten → 3 Monate voraus ─

    const prognose: { monat: string; netto: number }[] = [];
    let warnung: { typ: "ok" | "warnung" | "kritisch"; message: string; monateBisNull: number | null } =
      { typ: "ok", message: "Zu wenige Daten für Prognose", monateBisNull: null };

    if (monatlicherCashflow.length >= 2) {
      const basis = monatlicherCashflow.slice(-6);
      const n = basis.length;
      const xMean = (n - 1) / 2;
      const yMean = basis.reduce((s, m) => s + m.netto, 0) / n;
      const ssXX = basis.reduce((s, _, i) => s + (i - xMean) ** 2, 0);
      const ssXY = basis.reduce((s, m, i) => s + (i - xMean) * (m.netto - yMean), 0);
      const slope = ssXX !== 0 ? ssXY / ssXX : 0;
      const intercept = yMean - slope * xMean;

      const lastMonat = monatlicherCashflow[monatlicherCashflow.length - 1].monat;
      for (let step = 1; step <= 3; step++) {
        const [y, mo] = lastMonat.split("-").map(Number);
        const d = new Date(y, mo - 1 + step, 1);
        const monat = d.toISOString().substring(0, 7);
        const netto = Math.round((intercept + slope * (n - 1 + step)) * 100) / 100;
        prognose.push({ monat, netto });
      }

      const lastKumulativ = monatlicherCashflow[monatlicherCashflow.length - 1].kumulativ;
      let monateBisNull: number | null = null;
      if (slope < 0 || (slope === 0 && yMean < 0)) {
        let cum = lastKumulativ;
        for (let i = 1; i <= 36; i++) {
          cum += intercept + slope * (n - 1 + i);
          if (cum < 0) { monateBisNull = i; break; }
        }
      }

      const allPositive = prognose.every(p => p.netto >= 0);
      const trendingDown = slope < -50;
      if (allPositive && !trendingDown) {
        warnung = { typ: "ok", message: "Cashflow stabil – keine kritischen Entwicklungen erkennbar", monateBisNull: null };
      } else if (monateBisNull !== null && monateBisNull <= 6) {
        warnung = { typ: "kritisch", message: `Kritisch: Kumulativer Cashflow in ca. ${monateBisNull} Monaten unter Null`, monateBisNull };
      } else {
        warnung = {
          typ: "warnung",
          message: monateBisNull
            ? `Cashflow rückläufig – in ca. ${monateBisNull} Monaten unter Null`
            : "Cashflow-Trend rückläufig – Entwicklung beobachten",
          monateBisNull,
        };
      }
    }

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
      prognose,
      warnung,
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
      personalkosten,
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
