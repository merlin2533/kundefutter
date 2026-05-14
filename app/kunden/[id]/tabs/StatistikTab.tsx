"use client";

import React from "react";
import { formatEuro, formatPercent } from "@/lib/utils";
import { Kunde } from "../_shared";

export default function StatistikTab({ kunde }: { kunde: Kunde }) {
  const jetzt = new Date();
  const vor12Monaten = new Date(jetzt.getFullYear(), jetzt.getMonth() - 11, 1);

  // Berechne Monatsumsätze aus vorhandenen Lieferungen (letzte 12 Monate, nur geliefert)
  const monatMap = new Map<string, number>();
  for (let i = 0; i < 12; i++) {
    const d = new Date(jetzt.getFullYear(), jetzt.getMonth() - 11 + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monatMap.set(key, 0);
  }

  const gelieferteLieferungen = kunde.lieferungen.filter((l) => l.status === "geliefert");

  for (const l of gelieferteLieferungen) {
    const d = new Date(l.datum);
    if (d < vor12Monaten) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!monatMap.has(key)) continue;
    const total = l.positionen.reduce((s, p) => s + p.menge * p.verkaufspreis, 0);
    monatMap.set(key, (monatMap.get(key) ?? 0) + total);
  }

  const monatsDaten = Array.from(monatMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monat, umsatz]) => ({ monat, umsatz }));

  const gesamtUmsatz = gelieferteLieferungen.reduce(
    (s, l) => s + l.positionen.reduce((ss, p) => ss + p.menge * p.verkaufspreis, 0),
    0
  );
  const durchschnitt =
    gelieferteLieferungen.length > 0
      ? gesamtUmsatz / gelieferteLieferungen.length
      : 0;

  // Top 5 Artikel nach Umsatz
  const artikelMap = new Map<string, { menge: number; umsatz: number }>();
  for (const l of gelieferteLieferungen) {
    for (const p of l.positionen) {
      const existing = artikelMap.get(p.artikel.name) ?? { menge: 0, umsatz: 0 };
      artikelMap.set(p.artikel.name, {
        menge: existing.menge + p.menge,
        umsatz: existing.umsatz + p.menge * p.verkaufspreis,
      });
    }
  }
  const topArtikel = Array.from(artikelMap.entries())
    .map(([name, v]) => ({ name, menge: v.menge, umsatz: v.umsatz }))
    .sort((a, b) => b.umsatz - a.umsatz)
    .slice(0, 5);

  // Jahresvergleich
  const jahreMap = new Map<number, { umsatz: number; anzahl: number }>();
  for (const l of gelieferteLieferungen) {
    const jahr = new Date(l.datum).getFullYear();
    const total = l.positionen.reduce((s, p) => s + p.menge * p.verkaufspreis, 0);
    const existing = jahreMap.get(jahr) ?? { umsatz: 0, anzahl: 0 };
    jahreMap.set(jahr, { umsatz: existing.umsatz + total, anzahl: existing.anzahl + 1 });
  }
  const jahresDaten = Array.from(jahreMap.entries())
    .filter(([, v]) => v.anzahl > 0)
    .sort(([a], [b]) => b - a)
    .slice(0, 5)
    .map(([jahr, v]) => ({ jahr, umsatz: v.umsatz, anzahl: v.anzahl, durchschnitt: v.umsatz / v.anzahl }));

  // SVG Chart
  const maxUmsatz = Math.max(...monatsDaten.map((d) => d.umsatz), 1);
  const W = 600;
  const H = 180;
  const padL = 60;
  const padR = 16;
  const padT = 16;
  const padB = 44;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const barW = Math.min(32, chartW / monatsDaten.length - 4);
  const step = chartW / monatsDaten.length;

  const monatNamen = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

  const [tooltip, setTooltip] = React.useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = React.useState({ x: 0, y: 0 });

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-xs text-green-700 font-medium">Gesamtumsatz</p>
          <p className="text-lg font-bold text-green-800">{formatEuro(gesamtUmsatz)}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs text-blue-700 font-medium">Lieferungen gesamt</p>
          <p className="text-lg font-bold text-blue-800">{gelieferteLieferungen.length}</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <p className="text-xs text-gray-600 font-medium">Ø pro Lieferung</p>
          <p className="text-lg font-bold text-gray-800">{formatEuro(durchschnitt)}</p>
        </div>
      </div>

      {/* Balkenchart letzte 12 Monate */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Umsatz letzte 12 Monate</h3>
        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full"
            style={{ minWidth: 400 }}
            onMouseLeave={() => setTooltip(null)}
          >
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((frac, i) => {
              const y = padT + chartH - frac * chartH;
              const val = frac * maxUmsatz;
              return (
                <g key={i}>
                  <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#e5e7eb" strokeWidth={1} />
                  <text x={padL - 4} y={y + 4} textAnchor="end" fontSize={9} fill="#9ca3af">
                    {val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val.toFixed(0)}
                  </text>
                </g>
              );
            })}
            <line x1={padL} y1={padT + chartH} x2={W - padR} y2={padT + chartH} stroke="#d1d5db" strokeWidth={1} />

            {/* Bars */}
            {monatsDaten.map((d, i) => {
              const barH = Math.max(2, (d.umsatz / maxUmsatz) * chartH);
              const cx = padL + i * step + step / 2;
              const x = cx - barW / 2;
              const y = padT + chartH - barH;
              const [yr, mo] = d.monat.split("-");
              const label = `${monatNamen[Number(mo) - 1]} ${yr}`;
              return (
                <g key={d.monat}>
                  <rect
                    x={x}
                    y={y}
                    width={barW}
                    height={barH}
                    fill="#16a34a"
                    rx={2}
                    className="cursor-pointer hover:fill-green-500 transition-colors"
                    onMouseEnter={() => {
                      setTooltip(`${label}: ${formatEuro(d.umsatz)}`);
                      setTooltipPos({ x: cx, y: y - 8 });
                    }}
                  />
                  <text
                    x={cx}
                    y={padT + chartH + 14}
                    textAnchor="middle"
                    fontSize={8}
                    fill="#6b7280"
                    transform={`rotate(-30 ${cx} ${padT + chartH + 14})`}
                  >
                    {monatNamen[Number(mo) - 1]}
                  </text>
                </g>
              );
            })}

            {/* Tooltip */}
            {tooltip && (
              <g>
                <rect
                  x={Math.min(tooltipPos.x - 70, W - padR - 150)}
                  y={tooltipPos.y - 22}
                  width={160}
                  height={24}
                  rx={4}
                  fill="#1f2937"
                  opacity={0.9}
                />
                <text
                  x={Math.min(tooltipPos.x - 70, W - padR - 150) + 8}
                  y={tooltipPos.y - 6}
                  fontSize={10}
                  fill="white"
                >
                  {tooltip}
                </text>
              </g>
            )}
          </svg>
        </div>
      </div>

      {/* Jahresvergleich */}
      {jahresDaten.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Jahresvergleich</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border border-gray-200">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Jahr</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Umsatz</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Lieferungen</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Ø Lieferung</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Trend</th>
                </tr>
              </thead>
              <tbody>
                {jahresDaten.map((row, i) => {
                  const vorjahr = jahresDaten[i + 1];
                  let trendEl: React.ReactNode = <span className="text-gray-400">—</span>;
                  if (vorjahr && vorjahr.umsatz > 0) {
                    const diff = (row.umsatz - vorjahr.umsatz) / vorjahr.umsatz;
                    const absPct = formatPercent(Math.abs(diff) * 100);
                    trendEl = diff >= 0
                      ? <span className="text-green-600 font-medium">▲ +{absPct}</span>
                      : <span className="text-red-600 font-medium">▼ -{absPct}</span>;
                  }
                  return (
                    <tr key={row.jahr} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2.5 font-semibold text-gray-800">{row.jahr}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-gray-800">{formatEuro(row.umsatz)}</td>
                      <td className="px-3 py-2.5 text-right text-gray-700">{row.anzahl}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-gray-700">{formatEuro(row.durchschnitt)}</td>
                      <td className="px-3 py-2.5 text-right">{trendEl}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top 5 Artikel nach Umsatz */}
      {topArtikel.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Top Artikel nach Umsatz (Top 5)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border border-gray-200">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">#</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Artikel</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Menge</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Umsatz</th>
                </tr>
              </thead>
              <tbody>
                {topArtikel.map((a, i) => (
                  <tr key={a.name} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2.5 text-xs text-gray-400 font-medium">#{i + 1}</td>
                    <td className="px-3 py-2.5 font-medium text-gray-800">{a.name}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-gray-600">
                      {a.menge.toLocaleString("de-DE")} Einh.
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-gray-800 font-semibold">
                      {formatEuro(a.umsatz)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
