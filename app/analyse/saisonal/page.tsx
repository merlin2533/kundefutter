"use client";

import { useEffect, useState, useCallback } from "react";

const MONAT_LABELS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

// Seasonal background bands (index 0-based)
// Frühjahr: Mar-May (2-4), Ernte: Jul-Sep (6-8)
const SEASON_BG: Record<number, string> = {
  2: "bg-green-50",
  3: "bg-green-50",
  4: "bg-green-50",
  6: "bg-amber-50",
  7: "bg-amber-50",
  8: "bg-amber-50",
};

type JahrEntry = { umsatz: number; anzahl: number };
type MonatRow = { monat: number; label: string } & Record<string, JahrEntry>;

interface SaisonalData {
  jahre: number[];
  monatsData: MonatRow[];
  topArtikel: { artikelId: number; name: string; umsatzGesamt: number; umsatzProMonat: number[] }[];
}

function fmt(n: number) {
  return n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

const BAR_COLORS = ["#166534", "#15803d", "#4ade80", "#bbf7d0"];

function SvgBarChart({ data, jahre }: { data: MonatRow[]; jahre: number[] }) {
  const chartH = 220;
  const chartW = 700;
  const paddingLeft = 60;
  const paddingBottom = 30;
  const paddingTop = 10;
  const innerW = chartW - paddingLeft;
  const innerH = chartH - paddingBottom - paddingTop;

  const maxUmsatz = Math.max(
    1,
    ...data.flatMap((m) => jahre.map((j) => (m[String(j)] as JahrEntry | undefined)?.umsatz ?? 0))
  );

  const slotW = innerW / 12;
  const barGroupW = slotW * 0.8;
  const barW = jahre.length > 0 ? barGroupW / jahre.length : barGroupW;

  return (
    <svg
      viewBox={`0 0 ${chartW} ${chartH}`}
      className="w-full"
      style={{ maxHeight: 260 }}
      aria-label="Saisonaler Umsatz Balkendiagramm"
    >
      {/* Season tints */}
      {[2, 3, 4].map((mi) => (
        <rect
          key={`fj-${mi}`}
          x={paddingLeft + mi * slotW}
          y={paddingTop}
          width={slotW}
          height={innerH}
          fill="#d1fae5"
          opacity={0.5}
        />
      ))}
      {[6, 7, 8].map((mi) => (
        <rect
          key={`er-${mi}`}
          x={paddingLeft + mi * slotW}
          y={paddingTop}
          width={slotW}
          height={innerH}
          fill="#fef3c7"
          opacity={0.5}
        />
      ))}

      {/* Y-axis ticks */}
      {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
        const y = paddingTop + innerH * (1 - frac);
        return (
          <g key={frac}>
            <line x1={paddingLeft} y1={y} x2={chartW} y2={y} stroke="#e5e7eb" strokeWidth={1} />
            <text x={paddingLeft - 4} y={y + 4} fontSize={9} textAnchor="end" fill="#9ca3af">
              {(maxUmsatz * frac / 1000).toFixed(0)}k
            </text>
          </g>
        );
      })}

      {/* Bars */}
      {data.map((m, mi) => {
        const groupX = paddingLeft + mi * slotW + slotW * 0.1;
        return jahre.map((j, ji) => {
          const umsatz = (m[String(j)] as JahrEntry | undefined)?.umsatz ?? 0;
          const barH = innerH * (umsatz / maxUmsatz);
          const x = groupX + ji * barW;
          const y = paddingTop + innerH - barH;
          return (
            <rect
              key={`${mi}-${j}`}
              x={x}
              y={y}
              width={barW - 1}
              height={barH}
              fill={BAR_COLORS[ji % BAR_COLORS.length]}
              rx={1}
            >
              <title>{`${MONAT_LABELS[mi]} ${j}: ${fmt(umsatz)}`}</title>
            </rect>
          );
        });
      })}

      {/* X-axis labels */}
      {MONAT_LABELS.map((label, mi) => (
        <text
          key={label}
          x={paddingLeft + mi * slotW + slotW / 2}
          y={chartH - 4}
          fontSize={10}
          textAnchor="middle"
          fill="#6b7280"
        >
          {label}
        </text>
      ))}
    </svg>
  );
}

export default function SaisonalPage() {
  const aktuellesJahr = new Date().getFullYear();
  const verfuegbareJahre = [aktuellesJahr - 3, aktuellesJahr - 2, aktuellesJahr - 1, aktuellesJahr];
  const [selectedJahre, setSelectedJahre] = useState<number[]>([aktuellesJahr - 2, aktuellesJahr - 1, aktuellesJahr]);
  const [data, setData] = useState<SaisonalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback((jahre: number[]) => {
    setLoading(true);
    fetch(`/api/analyse/saisonal?jahre=${jahre.join(",")}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => { setError("Fehler beim Laden der Daten"); setLoading(false); });
  }, []);

  useEffect(() => {
    load(selectedJahre);
  }, [selectedJahre, load]);

  function toggleJahr(j: number) {
    setSelectedJahre((prev) =>
      prev.includes(j) ? (prev.length > 1 ? prev.filter((x) => x !== j) : prev) : [...prev, j].sort()
    );
  }

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-6 print:px-0 print:py-0">
      <div className="flex items-center justify-between mb-6 print:mb-3">
        <h1 className="text-2xl font-bold text-gray-800">Saisonale Auswertungen</h1>
        <button
          onClick={() => window.print()}
          className="print:hidden px-4 py-2 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 transition-colors"
        >
          Drucken
        </button>
      </div>

      {/* Year selector */}
      <div className="flex items-center gap-4 mb-6 print:hidden">
        <span className="text-sm font-medium text-gray-600">Jahre:</span>
        {verfuegbareJahre.map((j) => (
          <label key={j} className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedJahre.includes(j)}
              onChange={() => toggleJahr(j)}
              className="w-4 h-4 accent-green-700"
            />
            <span className="text-sm text-gray-700">{j}</span>
          </label>
        ))}
      </div>

      {/* Legend */}
      {data && (
        <div className="flex items-center gap-4 mb-4 text-xs text-gray-500 print:hidden">
          {data.jahre.map((j, i) => (
            <span key={j} className="flex items-center gap-1">
              <span
                className="inline-block w-3 h-3 rounded-sm"
                style={{ backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }}
              />
              {j}
            </span>
          ))}
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm bg-green-100 border border-green-300" />
            Frühjahr (Mär–Mai)
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm bg-amber-100 border border-amber-300" />
            Ernte (Jul–Sep)
          </span>
        </div>
      )}

      {loading && <div className="py-16 text-center text-gray-500">Lade Daten…</div>}
      {error && <div className="py-8 text-red-600">{error}</div>}

      {data && !loading && (
        <>
          {/* SVG Chart */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
            <SvgBarChart data={data.monatsData as MonatRow[]} jahre={data.jahre} />
          </div>

          {/* Summary matrix table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Monat</th>
                  {data.jahre.map((j) => (
                    <th key={j} className="px-4 py-3 text-right font-semibold text-gray-600" colSpan={2}>
                      {j}
                    </th>
                  ))}
                </tr>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500">
                  <th className="px-4 py-2"></th>
                  {data.jahre.map((j) => (
                    <>
                      <th key={`${j}-u`} className="px-3 py-1.5 text-right font-normal">Umsatz</th>
                      <th key={`${j}-a`} className="px-3 py-1.5 text-right font-normal">Lief.</th>
                    </>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.monatsData.map((m, mi) => (
                  <tr
                    key={m.monat}
                    className={`border-b border-gray-100 ${SEASON_BG[mi] ?? ""}`}
                  >
                    <td className="px-4 py-2.5 font-medium text-gray-700">{m.label}</td>
                    {data.jahre.map((j) => {
                      const entry = (m[String(j)] as JahrEntry | undefined) ?? { umsatz: 0, anzahl: 0 };
                      return (
                        <>
                          <td key={`${j}-u`} className="px-3 py-2.5 text-right font-mono text-gray-700">
                            {entry.umsatz > 0 ? fmt(entry.umsatz) : "—"}
                          </td>
                          <td key={`${j}-a`} className="px-3 py-2.5 text-right text-gray-400">
                            {entry.anzahl > 0 ? entry.anzahl : "—"}
                          </td>
                        </>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Top 5 Artikel */}
          {data.topArtikel.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <h2 className="text-base font-semibold text-gray-700 mb-3">Top 5 Artikel (Gesamtzeitraum)</h2>
              <div className="space-y-2">
                {data.topArtikel.map((a, i) => (
                  <div key={a.artikelId} className="flex items-center gap-3">
                    <span className="text-sm text-gray-400 w-5 text-right">{i + 1}.</span>
                    <span className="text-sm font-medium text-gray-700 flex-1">{a.name}</span>
                    <span className="text-sm font-mono text-gray-600">{fmt(a.umsatzGesamt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <style jsx global>{`
        @media print {
          nav, header, button { display: none !important; }
          body { font-size: 12px; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}
