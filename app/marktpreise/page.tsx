"use client";

import { Fragment, useEffect, useState, useCallback } from "react";
import { Card } from "@/components/Card";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MarktpreisEintrag {
  produktCode: string;
  produktName: string;
  zeitraum: string; // "2024-Q3"
  indexWert: number;
}

interface MarktpreisData {
  daten: MarktpreisEintrag[];
}

interface AktuellKpi {
  kategorie: string;
  produktCode: string;
  aktuell: number;
  vorquartal: number;
  veraenderung: number; // percent change
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseZeitraum(z: string): { jahr: number; quartal: number } {
  const [jahrStr, qStr] = z.split("-Q");
  return { jahr: parseInt(jahrStr), quartal: qStr ? parseInt(qStr) : 0 };
}

function zeitraumSortKey(z: string): number {
  const { jahr, quartal } = parseZeitraum(z);
  return jahr * 10 + quartal;
}

function formatZeitraum(z: string): string {
  const { jahr, quartal } = parseZeitraum(z);
  return `Q${quartal} ${jahr}`;
}

const KATEGORIE_GRUPPEN: Record<string, { label: string; farbeClass: string; farbeSvg: string; bgClass: string }> = {
  "206000": { label: "Futtermittel", farbeClass: "text-green-600", farbeSvg: "#16a34a", bgClass: "bg-green-50" },
  "203000": { label: "Dünger", farbeClass: "text-amber-600", farbeSvg: "#d97706", bgClass: "bg-amber-50" },
  "201000": { label: "Saatgut", farbeClass: "text-blue-600", farbeSvg: "#2563eb", bgClass: "bg-blue-50" },
};

const HAUPT_CODES = ["206000", "203000", "201000"];

// ─── Mini Sparkline ───────────────────────────────────────────────────────────

function Sparkline({ werte, farbe }: { werte: number[]; farbe: string }) {
  if (werte.length < 2) return null;
  const w = 60;
  const h = 20;
  const pad = 2;
  const min = Math.min(...werte);
  const max = Math.max(...werte);
  const range = max - min || 1;
  const stepX = (w - pad * 2) / (werte.length - 1);

  const points = werte.map((v, i) => {
    const x = pad + i * stepX;
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  });

  return (
    <svg width={60} height={20} viewBox={`0 0 ${w} ${h}`}>
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={farbe}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── SVG Line Chart ───────────────────────────────────────────────────────────

function LinienChart({ daten }: { daten: MarktpreisEintrag[] }) {
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);

  // Group by produktCode (only main categories)
  const grouped: Record<string, MarktpreisEintrag[]> = {};
  for (const d of daten) {
    if (!HAUPT_CODES.includes(d.produktCode)) continue;
    if (!grouped[d.produktCode]) grouped[d.produktCode] = [];
    grouped[d.produktCode].push(d);
  }

  // Sort each group by zeitraum
  for (const code of Object.keys(grouped)) {
    grouped[code].sort((a, b) => zeitraumSortKey(a.zeitraum) - zeitraumSortKey(b.zeitraum));
  }

  // Collect all unique zeitraeume sorted
  const alleZeitraeume = Array.from(new Set(daten.map((d) => d.zeitraum))).sort(
    (a, b) => zeitraumSortKey(a) - zeitraumSortKey(b)
  );

  if (alleZeitraeume.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-gray-400">
        Keine Daten vorhanden
      </div>
    );
  }

  const W = 800;
  const H = 320;
  const paddingLeft = 60;
  const paddingRight = 30;
  const paddingTop = 20;
  const paddingBottom = 60;
  const chartW = W - paddingLeft - paddingRight;
  const chartH = H - paddingTop - paddingBottom;

  // Compute y range across all data
  const alleWerte = daten.filter((d) => HAUPT_CODES.includes(d.produktCode)).map((d) => d.indexWert);
  const minY = Math.floor(Math.min(...alleWerte, 100) / 10) * 10;
  const maxY = Math.ceil(Math.max(...alleWerte, 100) / 10) * 10;
  const yRange = maxY - minY || 1;

  function xPos(idx: number): number {
    return paddingLeft + (idx / Math.max(alleZeitraeume.length - 1, 1)) * chartW;
  }

  function yPos(val: number): number {
    return paddingTop + chartH - ((val - minY) / yRange) * chartH;
  }

  // Y-axis ticks
  const yTickCount = 6;
  const yTicks: number[] = [];
  for (let i = 0; i <= yTickCount; i++) {
    yTicks.push(minY + (yRange / yTickCount) * i);
  }

  // X-axis: show every Nth label to avoid clutter
  const xLabelStep = Math.max(1, Math.floor(alleZeitraeume.length / 12));

  return (
    <div className="relative overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ minWidth: 500 }}
        onMouseLeave={() => setTooltip(null)}
      >
        {/* Y-axis grid lines + labels */}
        {yTicks.map((tick, i) => {
          const y = yPos(tick);
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
                x={paddingLeft - 8}
                y={y + 4}
                textAnchor="end"
                fontSize={10}
                fill="#9ca3af"
              >
                {tick.toFixed(0)}
              </text>
            </g>
          );
        })}

        {/* Dashed baseline at 100 */}
        <line
          x1={paddingLeft}
          y1={yPos(100)}
          x2={W - paddingRight}
          y2={yPos(100)}
          stroke="#6b7280"
          strokeWidth={1}
          strokeDasharray="6 3"
        />
        <text
          x={W - paddingRight + 4}
          y={yPos(100) + 3}
          fontSize={9}
          fill="#6b7280"
        >
          100
        </text>

        {/* X-axis line */}
        <line
          x1={paddingLeft}
          y1={paddingTop + chartH}
          x2={W - paddingRight}
          y2={paddingTop + chartH}
          stroke="#d1d5db"
          strokeWidth={1}
        />

        {/* X-axis labels */}
        {alleZeitraeume.map((z, i) => {
          if (i % xLabelStep !== 0) return null;
          const x = xPos(i);
          return (
            <text
              key={z}
              x={x}
              y={paddingTop + chartH + 18}
              textAnchor="middle"
              fontSize={9}
              fill="#6b7280"
              transform={`rotate(-30 ${x} ${paddingTop + chartH + 18})`}
            >
              {formatZeitraum(z)}
            </text>
          );
        })}

        {/* Lines + dots for each category */}
        {Object.entries(grouped).map(([code, eintraege]) => {
          const meta = KATEGORIE_GRUPPEN[code];
          if (!meta) return null;
          const farbe = meta.farbeSvg;

          // Build path + dot positions
          const points: { x: number; y: number; eintrag: MarktpreisEintrag }[] = [];
          for (const e of eintraege) {
            const idx = alleZeitraeume.indexOf(e.zeitraum);
            if (idx < 0) continue;
            points.push({ x: xPos(idx), y: yPos(e.indexWert), eintrag: e });
          }

          if (points.length === 0) return null;

          const pathD = points
            .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
            .join(" ");

          return (
            <g key={code}>
              <path d={pathD} fill="none" stroke={farbe} strokeWidth={2} />
              {points.map((p, i) => (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={3}
                  fill={farbe}
                  stroke="white"
                  strokeWidth={1.5}
                  className="cursor-pointer"
                  onMouseEnter={() =>
                    setTooltip({
                      x: p.x,
                      y: p.y,
                      text: `${meta.label}: ${p.eintrag.indexWert.toFixed(1)} (${formatZeitraum(p.eintrag.zeitraum)})`,
                    })
                  }
                />
              ))}
            </g>
          );
        })}

        {/* Tooltip */}
        {tooltip && (
          <g>
            <rect
              x={Math.max(paddingLeft, Math.min(tooltip.x - 90, W - paddingRight - 190))}
              y={tooltip.y - 30}
              width={200}
              height={24}
              rx={4}
              fill="#1f2937"
              opacity={0.9}
            />
            <text
              x={Math.max(paddingLeft, Math.min(tooltip.x - 90, W - paddingRight - 190)) + 8}
              y={tooltip.y - 14}
              fontSize={10}
              fill="white"
            >
              {tooltip.text}
            </text>
          </g>
        )}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-6 mt-3 justify-center">
        {HAUPT_CODES.map((code) => {
          const meta = KATEGORIE_GRUPPEN[code];
          if (!meta) return null;
          return (
            <div key={code} className="flex items-center gap-2 text-sm text-gray-600">
              <svg width={20} height={4}>
                <line x1={0} y1={2} x2={20} y2={2} stroke={meta.farbeSvg} strokeWidth={2} />
              </svg>
              <span>{meta.label}</span>
            </div>
          );
        })}
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <svg width={20} height={4}>
            <line x1={0} y1={2} x2={20} y2={2} stroke="#6b7280" strokeWidth={1} strokeDasharray="4 2" />
          </svg>
          <span>Basis 2015 = 100</span>
        </div>
      </div>
    </div>
  );
}

// ─── Detail Table ─────────────────────────────────────────────────────────────

function DetailTabelle({ daten }: { daten: MarktpreisEintrag[] }) {
  // Group by produktCode
  const grouped: Record<string, MarktpreisEintrag[]> = {};
  for (const d of daten) {
    if (!grouped[d.produktCode]) grouped[d.produktCode] = [];
    grouped[d.produktCode].push(d);
  }

  // Sort each group by zeitraum
  for (const code of Object.keys(grouped)) {
    grouped[code].sort((a, b) => zeitraumSortKey(a.zeitraum) - zeitraumSortKey(b.zeitraum));
  }

  // Build rows grouped by parent category
  const kategorieReihenfolge = ["206", "203", "201"];
  const kategorieLabel: Record<string, string> = {
    "206": "Futtermittel",
    "203": "Dünger",
    "201": "Saatgut",
  };
  const kategorieBg: Record<string, string> = {
    "206": "bg-green-50",
    "203": "bg-amber-50",
    "201": "bg-blue-50",
  };
  const kategorieFarbe: Record<string, string> = {
    "206": "#16a34a",
    "203": "#d97706",
    "201": "#2563eb",
  };

  const sections: {
    prefix: string;
    label: string;
    bg: string;
    farbe: string;
    zeilen: {
      code: string;
      name: string;
      aktuell: number;
      vorquartal: number;
      veraenderung: number;
      letzte4: number[];
    }[];
  }[] = [];

  for (const prefix of kategorieReihenfolge) {
    const codes = Object.keys(grouped)
      .filter((c) => c.startsWith(prefix))
      .sort();
    const zeilen = codes.map((code) => {
      const reihe = grouped[code];
      const aktuell = reihe[reihe.length - 1]?.indexWert ?? 0;
      const vorquartal = reihe.length >= 2 ? reihe[reihe.length - 2].indexWert : aktuell;
      const veraenderung = vorquartal !== 0 ? ((aktuell - vorquartal) / vorquartal) * 100 : 0;
      const letzte4 = reihe.slice(-4).map((e) => e.indexWert);
      return {
        code,
        name: reihe[0]?.produktName ?? code,
        aktuell,
        vorquartal,
        veraenderung,
        letzte4,
      };
    });

    if (zeilen.length > 0) {
      sections.push({
        prefix,
        label: kategorieLabel[prefix] ?? prefix,
        bg: kategorieBg[prefix] ?? "bg-gray-50",
        farbe: kategorieFarbe[prefix] ?? "#6b7280",
        zeilen,
      });
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 px-3 font-medium text-gray-600">Kategorie</th>
            <th className="text-right py-2 px-3 font-medium text-gray-600">Aktuell</th>
            <th className="text-right py-2 px-3 font-medium text-gray-600">Vorquartal</th>
            <th className="text-right py-2 px-3 font-medium text-gray-600">Veraenderung</th>
            <th className="text-center py-2 px-3 font-medium text-gray-600">Trend</th>
          </tr>
        </thead>
        <tbody>
          {sections.map((section) => (
            <Fragment key={section.prefix}>
              {/* Group header */}
              <tr className={section.bg}>
                <td colSpan={5} className="py-2 px-3 font-semibold text-gray-700">
                  {section.label}
                </td>
              </tr>
              {section.zeilen.map((z) => {
                const istHauptCode = HAUPT_CODES.includes(z.code);
                const changeColor =
                  Math.abs(z.veraenderung) <= 2
                    ? "text-gray-500"
                    : z.veraenderung > 0
                      ? "text-red-600"
                      : "text-green-600";
                const arrow =
                  Math.abs(z.veraenderung) <= 2
                    ? ""
                    : z.veraenderung > 0
                      ? "▲"
                      : "▼";
                return (
                  <tr
                    key={z.code}
                    className={`border-b border-gray-50 hover:bg-gray-50 ${istHauptCode ? "font-semibold" : ""}`}
                  >
                    <td className="py-2 px-3 text-gray-800">
                      {!istHauptCode && <span className="text-gray-300 mr-2">--</span>}
                      {z.name}
                    </td>
                    <td className="py-2 px-3 text-right font-mono">{z.aktuell.toFixed(1)}</td>
                    <td className="py-2 px-3 text-right font-mono text-gray-500">{z.vorquartal.toFixed(1)}</td>
                    <td className={`py-2 px-3 text-right font-mono ${changeColor}`}>
                      {arrow} {z.veraenderung >= 0 ? "+" : ""}
                      {z.veraenderung.toFixed(1)}%
                    </td>
                    <td className="py-2 px-3 text-center">
                      <Sparkline werte={z.letzte4} farbe={section.farbe} />
                    </td>
                  </tr>
                );
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── KPI Cards ────────────────────────────────────────────────────────────────

function KpiKarten({ daten }: { daten: MarktpreisEintrag[] }) {
  // Build KPIs from main category codes
  const kpis: AktuellKpi[] = HAUPT_CODES.map((code) => {
    const reihe = daten
      .filter((d) => d.produktCode === code)
      .sort((a, b) => zeitraumSortKey(a.zeitraum) - zeitraumSortKey(b.zeitraum));
    const aktuell = reihe[reihe.length - 1]?.indexWert ?? 0;
    const vorquartal = reihe.length >= 2 ? reihe[reihe.length - 2].indexWert : aktuell;
    const veraenderung = vorquartal !== 0 ? ((aktuell - vorquartal) / vorquartal) * 100 : 0;
    return {
      kategorie: KATEGORIE_GRUPPEN[code]?.label ?? code,
      produktCode: code,
      aktuell,
      vorquartal,
      veraenderung,
    };
  });

  return (
    <div className="grid sm:grid-cols-3 gap-4">
      {kpis.map((kpi) => {
        const meta = KATEGORIE_GRUPPEN[kpi.produktCode];
        const isStable = Math.abs(kpi.veraenderung) <= 2;
        const isUp = kpi.veraenderung > 2;
        const borderColor = isStable
          ? "border-l-4 border-gray-400"
          : isUp
            ? "border-l-4 border-red-500"
            : "border-l-4 border-green-500";
        const changeColor = isStable
          ? "text-gray-500"
          : isUp
            ? "text-red-600"
            : "text-green-600";
        const arrow = isStable ? "" : isUp ? "▲" : "▼";

        return (
          <Card key={kpi.produktCode} className={borderColor}>
            <p className={`text-sm font-medium ${meta?.farbeClass ?? "text-gray-600"}`}>
              {kpi.kategorie}
            </p>
            <p className="text-3xl font-bold mt-1 text-gray-900">{kpi.aktuell.toFixed(1)}</p>
            <p className={`text-sm mt-1 ${changeColor}`}>
              {arrow} {kpi.veraenderung >= 0 ? "+" : ""}
              {kpi.veraenderung.toFixed(1)}% ggü. Vorquartal
            </p>
          </Card>
        );
      })}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MarktpreisePage() {
  const [daten, setDaten] = useState<MarktpreisEintrag[] | null>(null);
  const [letzteAktualisierung, setLetzteAktualisierung] = useState<string>("");
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (force = false) => {
    try {
      setError(null);
      const url = force ? "/api/marktpreise?force=true" : "/api/marktpreise";
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Fehler: ${res.status}`);
      const json: MarktpreisData = await res.json();
      setDaten(json.daten);
      setLetzteAktualisierung(
        new Date().toLocaleString("de-DE", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleSync() {
    setSyncing(true);
    try {
      await loadData(true);
    } finally {
      setSyncing(false);
    }
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Marktpreise — Agrarpreisindex</h1>
        <p className="text-red-500 mt-4">Fehler beim Laden: {error}</p>
        <button
          onClick={() => loadData()}
          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
        >
          Erneut versuchen
        </button>
      </div>
    );
  }

  if (!daten) return <p className="text-gray-400 mt-8">Lade Marktpreise…</p>;

  return (
    <div className="space-y-6">
      {/* A) Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Marktpreise — Agrarpreisindex</h1>
        <p className="text-sm text-gray-500">
          Quelle: Eurostat apri_pi15_inq · Preisindex 2015 = 100
        </p>
      </div>

      {/* B) KPI Cards */}
      <KpiKarten daten={daten} />

      {/* E) Sync Button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSync}
          disabled={syncing}
          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {syncing ? "Aktualisiere…" : "Daten aktualisieren"}
        </button>
        {syncing && <span className="text-sm text-gray-400">Lade neue Daten…</span>}
      </div>

      {/* C) Line Chart */}
      <Card>
        <h2 className="text-base font-semibold text-gray-800 mb-4">
          Preisentwicklung (Quartalsindex)
        </h2>
        <LinienChart daten={daten} />
      </Card>

      {/* D) Detail Table */}
      <Card>
        <h2 className="text-base font-semibold text-gray-800 mb-4">
          Detailansicht nach Unterkategorien
        </h2>
        <DetailTabelle daten={daten} />
      </Card>

      {/* F) Footer */}
      <p className="text-xs text-gray-400 mt-4">
        Letzte Aktualisierung: {letzteAktualisierung}
      </p>
    </div>
  );
}
