"use client";

import { useEffect, useState, useCallback } from "react";
import { formatEuro } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UmsatzMonat {
  monat: string; // "YYYY-MM"
  umsatz: number;
  anzahl: number;
}

interface TopArtikel {
  artikelId: number;
  name: string;
  menge: number;
  umsatz: number;
}

interface TopKunde {
  kundeId: number;
  name: string;
  umsatz: number;
  anzahl: number;
}

interface KategorieUmsatz {
  kategorie: string;
  umsatz: number;
  menge: number;
}

interface StatistikData {
  umsatzNachMonat: UmsatzMonat[];
  topArtikel: TopArtikel[];
  topKunden: TopKunde[];
  umsatzNachKategorie: KategorieUmsatz[];
  saisonaleVerteilung: { monat: number; umsatz: number }[];
}

// ─── SVG Balkenchart ──────────────────────────────────────────────────────────

function BalkenChart({ data }: { data: UmsatzMonat[] }) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-gray-400">
        Keine Daten im gewählten Zeitraum
      </div>
    );
  }

  const W = 700;
  const H = 220;
  const paddingLeft = 70;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 50;
  const chartW = W - paddingLeft - paddingRight;
  const chartH = H - paddingTop - paddingBottom;

  const maxUmsatz = Math.max(...data.map((d) => d.umsatz), 1);
  const barW = Math.min(40, chartW / data.length - 4);
  const step = chartW / data.length;

  // Y-axis ticks
  const tickCount = 5;
  const yTicks: number[] = [];
  for (let i = 0; i <= tickCount; i++) {
    yTicks.push((maxUmsatz / tickCount) * i);
  }

  function formatMonat(m: string) {
    const [y, mo] = m.split("-");
    const monate = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
    return `${monate[Number(mo) - 1]} ${y}`;
  }

  return (
    <div className="relative overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ minWidth: Math.max(400, data.length * 60) }}
        onMouseLeave={() => setTooltip(null)}
      >
        {/* Y-axis grid + labels */}
        {yTicks.map((tick, i) => {
          const y = paddingTop + chartH - (tick / maxUmsatz) * chartH;
          return (
            <g key={i}>
              <line
                x1={paddingLeft}
                y1={y}
                x2={W - paddingRight}
                y2={y}
                stroke="#e5e7eb"
                strokeWidth={1}
              />
              <text
                x={paddingLeft - 6}
                y={y + 4}
                textAnchor="end"
                fontSize={10}
                fill="#9ca3af"
              >
                {tick >= 1000 ? `${(tick / 1000).toFixed(0)}k` : tick.toFixed(0)}
              </text>
            </g>
          );
        })}

        {/* X-axis line */}
        <line
          x1={paddingLeft}
          y1={paddingTop + chartH}
          x2={W - paddingRight}
          y2={paddingTop + chartH}
          stroke="#d1d5db"
          strokeWidth={1}
        />

        {/* Bars */}
        {data.map((d, i) => {
          const barH = Math.max(2, (d.umsatz / maxUmsatz) * chartH);
          const cx = paddingLeft + i * step + step / 2;
          const x = cx - barW / 2;
          const y = paddingTop + chartH - barH;
          return (
            <g key={d.monat}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={barH}
                fill="#16a34a"
                rx={3}
                className="cursor-pointer hover:fill-green-500 transition-colors"
                onMouseEnter={(e) => {
                  const svgRect = (e.target as SVGElement)
                    .closest("svg")!
                    .getBoundingClientRect();
                  setTooltip({
                    x: cx,
                    y: y - 8,
                    text: `${formatMonat(d.monat)}: ${formatEuro(d.umsatz)} (${d.anzahl} Lief.)`,
                  });
                }}
              />
              {/* X-axis label */}
              <text
                x={cx}
                y={paddingTop + chartH + 16}
                textAnchor="middle"
                fontSize={9}
                fill="#6b7280"
                transform={`rotate(-30 ${cx} ${paddingTop + chartH + 16})`}
              >
                {formatMonat(d.monat)}
              </text>
            </g>
          );
        })}

        {/* Tooltip */}
        {tooltip && (
          <g>
            <rect
              x={Math.min(tooltip.x - 80, W - paddingRight - 160)}
              y={tooltip.y - 24}
              width={200}
              height={26}
              rx={4}
              fill="#1f2937"
              opacity={0.9}
            />
            <text
              x={Math.min(tooltip.x - 80, W - paddingRight - 160) + 8}
              y={tooltip.y - 8}
              fontSize={10}
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

// ─── Kategorie Balken ─────────────────────────────────────────────────────────

function KategorieProzentBalken({ data }: { data: KategorieUmsatz[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-gray-400">Keine Daten</p>;
  }
  const gesamtUmsatz = data.reduce((s, d) => s + d.umsatz, 0);
  const farben: Record<string, string> = {
    Futter: "bg-green-500",
    Duenger: "bg-blue-500",
    Saatgut: "bg-yellow-500",
  };

  return (
    <div className="space-y-3">
      {data.map((d) => {
        const pct = gesamtUmsatz > 0 ? (d.umsatz / gesamtUmsatz) * 100 : 0;
        const farbe = farben[d.kategorie] ?? "bg-gray-400";
        return (
          <div key={d.kategorie}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-700">{d.kategorie}</span>
              <span className="text-sm text-gray-500">
                {pct.toFixed(1)}% &middot; {formatEuro(d.umsatz)}
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden">
              <div
                className={`${farbe} h-4 rounded-full transition-all duration-500`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const JAHRE = ["2024", "2025", "2026"];
const MONATE = [
  { value: "01", label: "Januar" },
  { value: "02", label: "Februar" },
  { value: "03", label: "März" },
  { value: "04", label: "April" },
  { value: "05", label: "Mai" },
  { value: "06", label: "Juni" },
  { value: "07", label: "Juli" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "Oktober" },
  { value: "11", label: "November" },
  { value: "12", label: "Dezember" },
];

export default function StatistikPage() {
  const now = new Date();
  const defaultJahr = String(now.getFullYear());
  const defaultMonat = String(now.getMonth() + 1).padStart(2, "0");

  const [jahr, setJahr] = useState(defaultJahr);
  const [vonMonat, setVonMonat] = useState("01");
  const [bisMonat, setBisMonat] = useState(defaultMonat);
  const [data, setData] = useState<StatistikData | null>(null);
  const [loading, setLoading] = useState(false);

  const laden = useCallback(async () => {
    setLoading(true);
    try {
      const von = `${jahr}-${vonMonat}`;
      const bis = `${jahr}-${bisMonat}`;
      const res = await fetch(`/api/statistik?von=${von}&bis=${bis}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } finally {
      setLoading(false);
    }
  }, [jahr, vonMonat, bisMonat]);

  useEffect(() => {
    laden();
  }, [laden]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Statistik-Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Umsatzauswertungen und Kennzahlen</p>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Jahr</label>
            <select
              value={jahr}
              onChange={(e) => setJahr(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {JAHRE.map((j) => (
                <option key={j} value={j}>{j}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Von Monat</label>
            <select
              value={vonMonat}
              onChange={(e) => setVonMonat(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {MONATE.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Bis Monat</label>
            <select
              value={bisMonat}
              onChange={(e) => setBisMonat(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {MONATE.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          {loading && (
            <span className="text-sm text-gray-400">Lade…</span>
          )}
        </div>
      </div>

      {data && (
        <>
          {/* Umsatz Balkenchart */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Umsatz nach Monat</h2>
            <BalkenChart data={data.umsatzNachMonat} />
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Top 5 Artikel */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-base font-semibold text-gray-800 mb-4">Top 5 Artikel</h2>
              {data.topArtikel.length === 0 ? (
                <p className="text-sm text-gray-400">Keine Daten im gewählten Zeitraum</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left pb-2 font-medium text-gray-600">Artikel</th>
                      <th className="text-right pb-2 font-medium text-gray-600">Menge</th>
                      <th className="text-right pb-2 font-medium text-gray-600">Umsatz</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.topArtikel.map((a, i) => (
                      <tr key={a.artikelId} className="hover:bg-gray-50">
                        <td className="py-2.5">
                          <span className="text-xs text-gray-400 mr-2">#{i + 1}</span>
                          {a.name}
                        </td>
                        <td className="py-2.5 text-right font-mono text-gray-600">
                          {a.menge.toLocaleString("de-DE")}
                        </td>
                        <td className="py-2.5 text-right font-mono font-semibold">
                          {formatEuro(a.umsatz)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Top 5 Kunden */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-base font-semibold text-gray-800 mb-4">Top 5 Kunden</h2>
              {data.topKunden.length === 0 ? (
                <p className="text-sm text-gray-400">Keine Daten im gewählten Zeitraum</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left pb-2 font-medium text-gray-600">Kunde</th>
                      <th className="text-right pb-2 font-medium text-gray-600">Lieferungen</th>
                      <th className="text-right pb-2 font-medium text-gray-600">Umsatz</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.topKunden.map((k, i) => (
                      <tr key={k.kundeId} className="hover:bg-gray-50">
                        <td className="py-2.5">
                          <span className="text-xs text-gray-400 mr-2">#{i + 1}</span>
                          {k.name}
                        </td>
                        <td className="py-2.5 text-right text-gray-600">{k.anzahl}</td>
                        <td className="py-2.5 text-right font-mono font-semibold">
                          {formatEuro(k.umsatz)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Umsatz nach Kategorie */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Umsatz nach Kategorie</h2>
            <KategorieProzentBalken data={data.umsatzNachKategorie} />
          </div>
        </>
      )}
    </div>
  );
}
