"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { formatEuro, MONATE_KURZ } from "@/lib/utils";
import ZeitraumFilter from "@/components/ZeitraumFilter";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MonatsCashflow {
  monat: string;
  einnahmen: number;
  ausgaben: number;
  netto: number;
  kumulativ: number;
}

interface TrendPunkt {
  monat: string;
  trendNetto: number;
}

interface PrognosePunkt {
  monat: string;
  netto: number;
}

interface Warnung {
  typ: "ok" | "warnung" | "kritisch";
  message: string;
  monateBisNull: number | null;
}

interface LiquiditaetData {
  monatlicherCashflow: MonatsCashflow[];
  trend: TrendPunkt[];
  prognose: PrognosePunkt[];
  warnung: Warnung;
  bilanz: {
    aktiva: { forderungen: number; lagerwert: number; gesamt: number };
    passiva: { verbindlichkeiten: number; gesamt: number };
    eigenkapital: number;
  };
  kpi: {
    cashflowAktuell: number;
    cashflowVormonat: number;
    liquiditaetsgrad: number | null;
    forderungGesamt: number;
    verbindlichkeitGesamt: number;
    lagerwert: number;
  };
}

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function formatMonat(m: string): string {
  const [y, mo] = m.split("-");
  return `${MONATE_KURZ[Number(mo) - 1]} ${y}`;
}

function formatMonatKurz(m: string): string {
  const mo = Number(m.split("-")[1]);
  return MONATE_KURZ[mo - 1] ?? m;
}

// ─── Cashflow-Chart (SVG) ─────────────────────────────────────────────────────

function CashflowChart({ data, prognose }: { data: MonatsCashflow[]; prognose?: PrognosePunkt[] }) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-gray-400">
        Keine Daten im gewählten Zeitraum
      </div>
    );
  }

  const W = 720;
  const H = 240;
  const PL = 75;
  const PR = 20;
  const PT = 20;
  const PB = 48;
  const CW = W - PL - PR;
  const CH = H - PT - PB;

  const totalCols = data.length + (prognose?.length ?? 0);
  const maxWert = Math.max(
    ...data.map((d) => Math.max(d.einnahmen, d.ausgaben)),
    ...(prognose ?? []).map((p) => Math.abs(p.netto)),
    1
  );
  const minKumulativ = Math.min(...data.map((d) => d.kumulativ), 0);
  const maxKumulativ = Math.max(...data.map((d) => d.kumulativ), 0);

  const step = CW / Math.max(totalCols, 1);
  const barW = Math.min(28, step / 2 - 2);

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => maxWert * f);

  // Kumultiv-Linie (auf separater y-Skala)
  const kRange = maxKumulativ - minKumulativ || 1;

  function kumY(v: number) {
    return PT + CH - ((v - minKumulativ) / kRange) * CH;
  }

  const linePoints = data
    .map((d, i) => {
      const cx = PL + i * step + step / 2;
      return `${cx},${kumY(d.kumulativ)}`;
    })
    .join(" ");

  return (
    <div className="relative overflow-x-auto">
      {/* Legende */}
      <div className="flex gap-4 mb-3 text-xs text-gray-500 flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-green-500 inline-block" />
          Einnahmen (bezahlt)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-red-400 inline-block" />
          Ausgaben
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-6 h-0.5 bg-blue-500 inline-block" />
          Kumulativer Cashflow
        </span>
        {prognose && prognose.length > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-green-100 border border-dashed border-green-400 inline-block" />
            Prognose (3 Monate)
          </span>
        )}
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ minWidth: Math.max(400, data.length * 64) }}
        onMouseLeave={() => setTooltip(null)}
      >
        {/* Raster + Y-Achse */}
        {yTicks.map((tick, i) => {
          const y = PT + CH - (tick / maxWert) * CH;
          return (
            <g key={i}>
              <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="#e5e7eb" strokeWidth={1} />
              <text x={PL - 6} y={y + 4} textAnchor="end" fontSize={9} fill="#9ca3af">
                {tick >= 1000 ? `${(tick / 1000).toFixed(0)}k` : tick.toFixed(0)}
              </text>
            </g>
          );
        })}

        {/* Null-Linie */}
        <line
          x1={PL}
          y1={PT + CH}
          x2={W - PR}
          y2={PT + CH}
          stroke="#d1d5db"
          strokeWidth={1}
        />

        {/* Balken */}
        {data.map((d, i) => {
          const cx = PL + i * step + step / 2;
          const einH = Math.max(2, (d.einnahmen / maxWert) * CH);
          const ausH = Math.max(2, (d.ausgaben / maxWert) * CH);
          return (
            <g
              key={d.monat}
              onMouseEnter={() =>
                setTooltip({
                  x: cx,
                  y: PT + CH - Math.max(einH, ausH) - 12,
                  text: `${formatMonat(d.monat)}: +${formatEuro(d.einnahmen)} / −${formatEuro(d.ausgaben)} = ${d.netto >= 0 ? "+" : ""}${formatEuro(d.netto)}`,
                })
              }
            >
              {/* Einnahmen-Balken */}
              <rect
                x={cx - barW - 1}
                y={PT + CH - einH}
                width={barW}
                height={einH}
                fill="#22c55e"
                rx={2}
                className="cursor-pointer hover:fill-green-400 transition-colors"
              />
              {/* Ausgaben-Balken */}
              <rect
                x={cx + 1}
                y={PT + CH - ausH}
                width={barW}
                height={ausH}
                fill="#f87171"
                rx={2}
                className="cursor-pointer hover:fill-red-300 transition-colors"
              />
              {/* X-Label */}
              <text
                x={cx}
                y={PT + CH + 14}
                textAnchor="middle"
                fontSize={9}
                fill="#6b7280"
                transform={`rotate(-30 ${cx} ${PT + CH + 14})`}
              >
                {formatMonatKurz(d.monat)}
              </text>
            </g>
          );
        })}

        {/* Prognose-Balken (gestrichelt) */}
        {prognose && prognose.map((p, i) => {
          const idx = data.length + i;
          const cx = PL + idx * step + step / 2;
          const netH = Math.max(2, (Math.abs(p.netto) / maxWert) * CH);
          const isPos = p.netto >= 0;
          return (
            <g key={`prog-${p.monat}`}>
              <rect
                x={cx - barW / 2}
                y={PT + CH - (isPos ? netH : 0)}
                width={barW}
                height={netH}
                fill={isPos ? "#bbf7d0" : "#fecaca"}
                rx={2}
                stroke={isPos ? "#86efac" : "#fca5a5"}
                strokeWidth={1}
                strokeDasharray="3 2"
                opacity={0.85}
              />
              <text
                x={cx}
                y={PT + CH + 14}
                textAnchor="middle"
                fontSize={9}
                fill="#9ca3af"
                transform={`rotate(-30 ${cx} ${PT + CH + 14})`}
              >
                {formatMonatKurz(p.monat)}
              </text>
            </g>
          );
        })}

        {/* Kumultiv-Linie */}
        {data.length > 1 && (
          <polyline
            points={linePoints}
            fill="none"
            stroke="#3b82f6"
            strokeWidth={2}
            strokeLinejoin="round"
          />
        )}

        {/* Punkte auf der Linie */}
        {data.map((d, i) => {
          const cx = PL + i * step + step / 2;
          return (
            <circle
              key={`k${d.monat}`}
              cx={cx}
              cy={kumY(d.kumulativ)}
              r={3}
              fill="#3b82f6"
            />
          );
        })}

        {/* Tooltip */}
        {tooltip && (
          <g>
            <rect
              x={Math.max(PL, Math.min(tooltip.x - 120, W - PR - 260))}
              y={tooltip.y - 22}
              width={260}
              height={26}
              rx={4}
              fill="#1f2937"
              opacity={0.92}
            />
            <text
              x={Math.max(PL, Math.min(tooltip.x - 120, W - PR - 260)) + 8}
              y={tooltip.y - 6}
              fontSize={9.5}
              fill="white"
            >
              {tooltip.text}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

// ─── Trend-Chart (SVG Linienchart) ───────────────────────────────────────────

function TrendChart({ data }: { data: TrendPunkt[] }) {
  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-gray-400">
        Zu wenige Datenpunkte für Trend
      </div>
    );
  }

  const W = 720;
  const H = 160;
  const PL = 75;
  const PR = 20;
  const PT = 16;
  const PB = 36;
  const CW = W - PL - PR;
  const CH = H - PT - PB;

  const values = data.map((d) => d.trendNetto);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const range = maxV - minV || 1;
  const step = CW / (data.length - 1);

  function py(v: number) {
    return PT + CH - ((v - minV) / range) * CH;
  }

  const points = data.map((d, i) => `${PL + i * step},${py(d.trendNetto)}`).join(" ");

  const zeroY = py(0);
  const showZeroLine = minV < 0 && maxV > 0;

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ minWidth: Math.max(400, data.length * 48) }}
      >
        {showZeroLine && (
          <line x1={PL} y1={zeroY} x2={W - PR} y2={zeroY} stroke="#d1d5db" strokeWidth={1} strokeDasharray="4 3" />
        )}

        {/* Area fill */}
        <polygon
          points={`${PL},${PT + CH} ${points} ${PL + (data.length - 1) * step},${PT + CH}`}
          fill={values[values.length - 1] >= 0 ? "#dcfce7" : "#fee2e2"}
          opacity={0.5}
        />

        {/* Trend line */}
        <polyline
          points={points}
          fill="none"
          stroke={values[values.length - 1] >= 0 ? "#16a34a" : "#dc2626"}
          strokeWidth={2.5}
          strokeLinejoin="round"
        />

        {/* Punkte */}
        {data.map((d, i) => (
          <circle
            key={d.monat}
            cx={PL + i * step}
            cy={py(d.trendNetto)}
            r={3}
            fill={d.trendNetto >= 0 ? "#16a34a" : "#dc2626"}
          />
        ))}

        {/* X-Labels */}
        {data.map((d, i) => {
          if (data.length > 8 && i % 2 !== 0) return null;
          const cx = PL + i * step;
          return (
            <text
              key={`l${d.monat}`}
              x={cx}
              y={H - PT + 4}
              textAnchor="middle"
              fontSize={9}
              fill="#6b7280"
            >
              {formatMonatKurz(d.monat)}
            </text>
          );
        })}

        {/* Y-Labels */}
        {[minV, (minV + maxV) / 2, maxV].map((v, i) => (
          <text key={i} x={PL - 6} y={py(v) + 4} textAnchor="end" fontSize={9} fill="#9ca3af">
            {v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v < -1000 ? `${(v / 1000).toFixed(0)}k` : v.toFixed(0)}
          </text>
        ))}
      </svg>
    </div>
  );
}

// ─── Bilanz-Tabelle ───────────────────────────────────────────────────────────

function BilanzTabelle({ bilanz }: { bilanz: LiquiditaetData["bilanz"] }) {
  const aktPos = [
    { label: "Offene Forderungen (Debitoren)", wert: bilanz.aktiva.forderungen, farbe: "text-blue-700" },
    { label: "Lagerwert (Bestand × Standardpreis)", wert: bilanz.aktiva.lagerwert, farbe: "text-indigo-700" },
  ];
  const pasPos = [
    { label: "Offene Verbindlichkeiten (Kreditoren)", wert: bilanz.passiva.verbindlichkeiten, farbe: "text-red-700" },
  ];

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {/* Aktiva */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="bg-blue-50 border-b border-blue-100 px-4 py-2.5 flex items-center justify-between">
          <span className="text-sm font-semibold text-blue-800">Aktiva (Vermögen)</span>
          <span className="text-sm font-bold text-blue-800">{formatEuro(bilanz.aktiva.gesamt)}</span>
        </div>
        <div className="divide-y divide-gray-100">
          {aktPos.map((p) => (
            <div key={p.label} className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-gray-600">{p.label}</span>
              <span className={`text-sm font-semibold font-mono tabular-nums ${p.farbe}`}>
                {formatEuro(p.wert)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Passiva + Eigenkapital */}
      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="bg-red-50 border-b border-red-100 px-4 py-2.5 flex items-center justify-between">
            <span className="text-sm font-semibold text-red-800">Passiva (Verbindlichkeiten)</span>
            <span className="text-sm font-bold text-red-800">{formatEuro(bilanz.passiva.gesamt)}</span>
          </div>
          <div className="divide-y divide-gray-100">
            {pasPos.map((p) => (
              <div key={p.label} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-gray-600">{p.label}</span>
                <span className={`text-sm font-semibold font-mono tabular-nums ${p.farbe}`}>
                  {formatEuro(p.wert)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div
          className={`rounded-xl border px-4 py-3 flex items-center justify-between ${
            bilanz.eigenkapital >= 0
              ? "bg-green-50 border-green-200"
              : "bg-red-50 border-red-200"
          }`}
        >
          <span className="text-sm font-semibold text-gray-700">
            Nettovermögen (Aktiva − Passiva)
          </span>
          <span
            className={`text-lg font-bold font-mono tabular-nums ${
              bilanz.eigenkapital >= 0 ? "text-green-700" : "text-red-700"
            }`}
          >
            {bilanz.eigenkapital >= 0 ? "+" : ""}
            {formatEuro(bilanz.eigenkapital)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Hauptseite (innere Komponente) ──────────────────────────────────────────

function LiquiditaetInner() {
  const now = new Date();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [jahr, setJahr] = useState(
    searchParams.get("jahr") ?? String(now.getFullYear())
  );
  const [vonMonat, setVonMonat] = useState(searchParams.get("von") ?? "01");
  const [bisMonat, setBisMonat] = useState(
    searchParams.get("bis") ?? String(now.getMonth() + 1).padStart(2, "0")
  );
  const [data, setData] = useState<LiquiditaetData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const laden = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/statistik/liquiditaet?von=${jahr}-${vonMonat}&bis=${jahr}-${bisMonat}`
      );
      if (!res.ok) {
        setError("Auswertung konnte nicht geladen werden.");
        return;
      }
      setData(await res.json());
    } catch {
      setError("Netzwerkfehler beim Laden.");
    } finally {
      setLoading(false);
    }
  }, [jahr, vonMonat, bisMonat]);

  useEffect(() => {
    void laden();
  }, [laden]);

  // Update URL params
  useEffect(() => {
    const params = new URLSearchParams({ jahr, von: vonMonat, bis: bisMonat });
    router.replace(`/statistik/liquiditaet?${params.toString()}`, { scroll: false });
  }, [jahr, vonMonat, bisMonat, router]);

  const kpi = data?.kpi;
  const trend = data?.kpi.cashflowAktuell !== undefined && data?.kpi.cashflowVormonat !== undefined
    ? data.kpi.cashflowAktuell - data.kpi.cashflowVormonat
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Liquiditätsanalyse</h1>
          <p className="text-sm text-gray-500 mt-1">
            Cashflow-Verlauf, Trend und Bilanz auf einen Blick
          </p>
        </div>
        <Link
          href="/finanzen/cashflow"
          className="text-sm text-green-700 hover:text-green-800 underline underline-offset-2"
        >
          → Cashflow-Übersicht (Stichtag)
        </Link>
      </div>

      {/* Filter */}
      <ZeitraumFilter
        jahr={jahr}
        setJahr={setJahr}
        vonMonat={vonMonat}
        setVonMonat={setVonMonat}
        bisMonat={bisMonat}
        setBisMonat={setBisMonat}
        showQuickButtons
        loading={loading}
      />

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {data && kpi && (
        <>
          {/* KPI-Kacheln */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Cashflow aktueller Monat
              </p>
              <p
                className={`text-2xl font-bold mt-1 ${
                  kpi.cashflowAktuell >= 0 ? "text-green-700" : "text-red-600"
                }`}
              >
                {kpi.cashflowAktuell >= 0 ? "+" : ""}
                {formatEuro(kpi.cashflowAktuell)}
              </p>
              {trend !== 0 && (
                <p
                  className={`text-xs mt-0.5 font-medium ${
                    trend >= 0 ? "text-green-600" : "text-red-500"
                  }`}
                >
                  {trend >= 0 ? "▲" : "▼"} {formatEuro(Math.abs(trend))} ggü. Vormonat
                </p>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Liquiditätsgrad
              </p>
              <p
                className={`text-2xl font-bold mt-1 ${
                  kpi.liquiditaetsgrad === null
                    ? "text-gray-400"
                    : kpi.liquiditaetsgrad >= 100
                    ? "text-green-700"
                    : kpi.liquiditaetsgrad >= 50
                    ? "text-amber-600"
                    : "text-red-600"
                }`}
              >
                {kpi.liquiditaetsgrad !== null ? `${kpi.liquiditaetsgrad.toLocaleString("de-DE")} %` : "–"}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">Forderungen / Verbindlichkeiten</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Offene Forderungen
              </p>
              <p className="text-2xl font-bold mt-1 text-blue-700">
                {formatEuro(kpi.forderungGesamt)}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">ausstehende Kundenzahlungen</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Offene Verbindlichkeiten
              </p>
              <p className="text-2xl font-bold mt-1 text-red-700">
                {formatEuro(kpi.verbindlichkeitGesamt)}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">Eingangsrechnungen offen</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Prognose (3 Monate)
              </p>
              <p
                className={`text-2xl font-bold mt-1 ${
                  data.warnung?.typ === "ok"
                    ? "text-green-700"
                    : data.warnung?.typ === "kritisch"
                    ? "text-red-600"
                    : "text-amber-600"
                }`}
              >
                {data.warnung?.typ === "ok"
                  ? "Stabil"
                  : data.warnung?.monateBisNull
                  ? `${data.warnung.monateBisNull} Mon.`
                  : "Rückläufig"}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {data.warnung?.typ === "ok" ? "Positiver Ausblick" : "bis Nulllinie"}
              </p>
            </div>
          </div>

          {/* Prognose-Warnung */}
          {data.warnung && data.warnung.typ !== "ok" && (
            <div
              className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${
                data.warnung.typ === "kritisch"
                  ? "bg-red-50 border-red-300 text-red-800"
                  : "bg-amber-50 border-amber-300 text-amber-800"
              }`}
            >
              <span className="text-xl flex-shrink-0">
                {data.warnung.typ === "kritisch" ? "🔴" : "⚠️"}
              </span>
              <span className="text-sm font-medium">{data.warnung.message}</span>
            </div>
          )}

          {/* Cashflow-Chart */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-semibold text-gray-800">
                Cashflow-Verlauf
              </h2>
              <span className="text-xs text-gray-400">bezahlte Einnahmen vs. Ausgaben</span>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              Blaue Linie: kumulativer Cashflow im Zeitraum (rechte Skala)
            </p>
            <CashflowChart data={data.monatlicherCashflow} prognose={data.prognose} />
          </div>

          {/* Cashflow-Tabelle */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-800">Cashflow nach Monat</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Monat</th>
                    <th className="text-right px-4 py-3 font-medium text-green-700">Einnahmen</th>
                    <th className="text-right px-4 py-3 font-medium text-red-600">Ausgaben</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-700">Netto</th>
                    <th className="text-right px-4 py-3 font-medium text-blue-700 hidden sm:table-cell">Kumulativ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.monatlicherCashflow.map((m) => (
                    <tr key={m.monat} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-700">
                        {formatMonat(m.monat)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-green-700 tabular-nums">
                        {formatEuro(m.einnahmen)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-red-600 tabular-nums">
                        {formatEuro(m.ausgaben)}
                      </td>
                      <td
                        className={`px-4 py-2.5 text-right font-mono font-semibold tabular-nums ${
                          m.netto >= 0 ? "text-green-700" : "text-red-600"
                        }`}
                      >
                        {m.netto >= 0 ? "+" : ""}
                        {formatEuro(m.netto)}
                      </td>
                      <td
                        className={`px-4 py-2.5 text-right font-mono tabular-nums hidden sm:table-cell ${
                          m.kumulativ >= 0 ? "text-blue-700" : "text-red-700"
                        }`}
                      >
                        {m.kumulativ >= 0 ? "+" : ""}
                        {formatEuro(m.kumulativ)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {data.monatlicherCashflow.length > 0 && (() => {
                  const totEin = data.monatlicherCashflow.reduce((s, m) => s + m.einnahmen, 0);
                  const totAus = data.monatlicherCashflow.reduce((s, m) => s + m.ausgaben, 0);
                  const totNet = totEin - totAus;
                  return (
                    <tfoot className="bg-gray-50 border-t border-gray-200">
                      <tr>
                        <td className="px-4 py-3 font-semibold text-gray-700 text-sm">Gesamt</td>
                        <td className="px-4 py-3 text-right font-bold font-mono text-green-700 tabular-nums">
                          {formatEuro(totEin)}
                        </td>
                        <td className="px-4 py-3 text-right font-bold font-mono text-red-600 tabular-nums">
                          {formatEuro(totAus)}
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-bold font-mono tabular-nums ${
                            totNet >= 0 ? "text-green-700" : "text-red-600"
                          }`}
                        >
                          {totNet >= 0 ? "+" : ""}
                          {formatEuro(totNet)}
                        </td>
                        <td className="hidden sm:table-cell" />
                      </tr>
                    </tfoot>
                  );
                })()}
              </table>
            </div>
          </div>

          {/* Trend-Chart */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-1">
              Cashflow-Trend (gleitender 3-Monats-Ø)
            </h2>
            <p className="text-xs text-gray-400 mb-4">
              Geglätteter Verlauf des monatlichen Netto-Cashflows — zeigt strukturelle Entwicklung
            </p>
            <TrendChart data={data.trend} />
          </div>

          {/* Bilanz */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
              <div>
                <h2 className="text-base font-semibold text-gray-800">
                  Vereinfachte Bilanz (Stichtag heute)
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Aktuelle Forderungen, Lagerwert und Verbindlichkeiten
                </p>
              </div>
              <div className="flex gap-2 text-xs">
                <Link
                  href="/statistik/aging"
                  className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-600 transition-colors"
                >
                  Aging-Analyse →
                </Link>
                <Link
                  href="/statistik/ausgaben"
                  className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-600 transition-colors"
                >
                  Ausgaben-Detail →
                </Link>
              </div>
            </div>
            <BilanzTabelle bilanz={data.bilanz} />
          </div>

          {/* Quick Links */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { href: "/finanzen/cashflow", label: "Cashflow-Übersicht", icon: "💰" },
              { href: "/statistik/aging", label: "Offene Posten Aging", icon: "⏳" },
              { href: "/statistik/ausgaben", label: "Ausgaben-Auswertung", icon: "🧾" },
              { href: "/bankabgleich", label: "Bankabgleich", icon: "🏦" },
            ].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="flex items-center gap-2 p-3 rounded-lg border border-gray-100 hover:border-green-400 hover:bg-green-50 transition-colors text-sm text-gray-700 hover:text-green-700"
              >
                <span>{l.icon}</span>
                <span>{l.label}</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Export (mit Suspense für useSearchParams) ────────────────────────────────

export default function LiquiditaetPage() {
  return (
    <Suspense>
      <LiquiditaetInner />
    </Suspense>
  );
}
