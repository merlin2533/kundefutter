"use client";

import { Fragment, useEffect, useState, useCallback } from "react";
import { Card } from "@/components/Card";
import { PRODUKT_BAUM, type ProduktNode } from "@/lib/eurostat";
import type { MatifProdukt } from "@/lib/matif";

// ─── MATIF Zeitraumfilter + Chart ─────────────────────────────────────────────

type Zeitraum = "1M" | "3M" | "6M" | "1J" | "Max";

const ZEITRAUM_TAGE: Record<Zeitraum, number> = {
  "1M": 30, "3M": 90, "6M": 180, "1J": 365, Max: 99999,
};

const MATIF_CHART_FARBEN: Record<string, string> = {
  WEIZEN: "#d97706",  // amber-600
  RAPS:   "#ca8a04",  // yellow-600
  MAIS:   "#65a30d",  // lime-600
};

function MatifChart({
  preise,
  zeitraum,
}: {
  preise: MatifProdukt[];
  zeitraum: Zeitraum;
}) {
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  // Verlauf je Produkt auf Zeitraum begrenzen
  const cutoffDatum = (() => {
    const d = new Date();
    d.setDate(d.getDate() - ZEITRAUM_TAGE[zeitraum]);
    return d.toISOString().slice(0, 10);
  })();

  const filteredPreise = preise.map((p) => ({
    ...p,
    filtered: zeitraum === "Max"
      ? p.verlauf
      : p.verlauf.filter((d) => d.datum >= cutoffDatum),
  }));

  // Union aller Daten + Horizont-Daten
  const dateSet = new Set<string>();
  filteredPreise.forEach((p) => p.filtered.forEach((d) => dateSet.add(d.datum)));
  filteredPreise.forEach((p) => {
    if (p.statPrognose?.horizonDatum) dateSet.add(p.statPrognose.horizonDatum);
  });
  const allDates = [...dateSet].sort();
  const n = allDates.length;

  if (n < 2) {
    return (
      <div className="text-sm text-gray-400 py-6 text-center">
        Nicht genug Daten für den gewählten Zeitraum
      </div>
    );
  }

  // Chart-Dimensionen
  const W = 800, H = 260;
  const pL = 52, pR = 20, pT = 16, pB = 36;
  const cW = W - pL - pR, cH = H - pT - pB;

  const dateIndex = new Map<string, number>(allDates.map((d, i) => [d, i]));
  const horizonStartIdx = allDates.findIndex((d) => d > today);

  // Y-Achse
  const allPrices: number[] = [];
  filteredPreise.forEach((p) => {
    p.filtered.forEach((d) => allPrices.push(d.preis));
    if (p.statPrognose) {
      allPrices.push(p.statPrognose.band95Hi, p.statPrognose.band95Lo);
    }
  });
  if (allPrices.length === 0) return null;

  const rawMin = Math.min(...allPrices);
  const rawMax = Math.max(...allPrices);
  const pad    = Math.max((rawMax - rawMin) * 0.08, 5);
  const minY   = Math.floor((rawMin - pad) / 5) * 5;
  const maxY   = Math.ceil((rawMax + pad) / 5) * 5;
  const yRange = maxY - minY || 1;

  const xPos = (i: number) => pL + (i / (n - 1)) * cW;
  const yPos = (v: number) => pT + (1 - (v - minY) / yRange) * cH;

  // Y-Gitterlinien
  const yRange_ = maxY - minY;
  const yStep = yRange_ <= 40 ? 5 : yRange_ <= 100 ? 10 : yRange_ <= 250 ? 20 : 50;
  const yGridValues: number[] = [];
  for (let v = Math.ceil(minY / yStep) * yStep; v <= maxY; v += yStep) {
    yGridValues.push(v);
  }

  // X-Achsenbeschriftung: max. 7 Labels
  const xLabelStep = Math.max(1, Math.floor(n / 7));

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: "260px" }}
        onMouseLeave={() => setTooltip(null)}
      >
        {/* Prognose-Bereich (Hintergrund) */}
        {horizonStartIdx >= 0 && (
          <rect
            x={xPos(horizonStartIdx)}
            y={pT}
            width={W - pR - xPos(horizonStartIdx)}
            height={cH}
            fill="#fffbeb"
            opacity={0.7}
          />
        )}

        {/* Y-Gitter */}
        {yGridValues.map((v) => (
          <g key={v}>
            <line
              x1={pL} y1={yPos(v)} x2={W - pR} y2={yPos(v)}
              stroke="#e5e7eb" strokeWidth={1}
            />
            <text
              x={pL - 5} y={yPos(v) + 4}
              textAnchor="end" fontSize={9} fill="#6b7280"
            >
              {v}
            </text>
          </g>
        ))}

        {/* X-Achse */}
        {allDates.map((d, i) => {
          if (i % xLabelStep !== 0) return null;
          const x = xPos(i);
          const label = d.slice(5).replace("-", ".");
          return (
            <text
              key={d}
              x={x}
              y={pT + cH + 18}
              textAnchor="middle"
              fontSize={9}
              fill={d > today ? "#d97706" : "#6b7280"}
              transform={`rotate(-30 ${x} ${pT + cH + 18})`}
            >
              {label}
            </text>
          );
        })}

        {/* Trennlinie Ist/Prognose */}
        {horizonStartIdx >= 0 && (
          <line
            x1={xPos(horizonStartIdx)} y1={pT}
            x2={xPos(horizonStartIdx)} y2={pT + cH}
            stroke="#d97706" strokeWidth={1} strokeDasharray="4 3" opacity={0.6}
          />
        )}

        {/* Linien + Prognose-Kegel je Produkt */}
        {filteredPreise.map((p) => {
          const farbe = MATIF_CHART_FARBEN[p.produktCode] ?? "#6b7280";

          const points = p.filtered
            .map((d) => {
              const i = dateIndex.get(d.datum);
              if (i == null) return null;
              return { x: xPos(i), y: yPos(d.preis), datum: d.datum, preis: d.preis };
            })
            .filter(
              (x): x is { x: number; y: number; datum: string; preis: number } =>
                x !== null
            );

          if (points.length === 0) return null;

          const pathD = points
            .map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x} ${pt.y}`)
            .join(" ");
          const last = points[points.length - 1];
          const sp   = p.statPrognose;

          return (
            <g key={p.produktCode}>
              {/* Verlaufslinie */}
              <path d={pathD} fill="none" stroke={farbe} strokeWidth={2} />

              {/* Prognose-Kegel */}
              {sp && (() => {
                const hIdx = dateIndex.get(sp.horizonDatum);
                if (hIdx == null) return null;
                const hx = xPos(hIdx);
                const hy = yPos(sp.mittelwert);
                return (
                  <g>
                    {/* ±2σ Kegel */}
                    <polygon
                      points={`${last.x},${last.y} ${hx},${yPos(sp.band95Lo)} ${hx},${yPos(sp.band95Hi)}`}
                      fill={farbe} fillOpacity={0.07}
                    />
                    {/* ±1σ Kegel */}
                    <polygon
                      points={`${last.x},${last.y} ${hx},${yPos(sp.band68Lo)} ${hx},${yPos(sp.band68Hi)}`}
                      fill={farbe} fillOpacity={0.18}
                    />
                    {/* Gestrichelte Mittellinie */}
                    <line
                      x1={last.x} y1={last.y} x2={hx} y2={hy}
                      stroke={farbe} strokeWidth={1.5} strokeDasharray="5 3"
                    />
                    {/* ±1σ Balken am Zielpunkt */}
                    <line
                      x1={hx} y1={yPos(sp.band68Lo)}
                      x2={hx} y2={yPos(sp.band68Hi)}
                      stroke={farbe} strokeWidth={3} strokeLinecap="round" opacity={0.45}
                    />
                    {/* Prognose-Punkt */}
                    <circle
                      cx={hx} cy={hy} r={5}
                      fill="white" stroke={farbe} strokeWidth={2}
                    />
                  </g>
                );
              })()}

              {/* Hover-Punkte */}
              {points.map((pt, i) => (
                <circle
                  key={i}
                  cx={pt.x} cy={pt.y} r={4}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() =>
                    setTooltip({
                      x: pt.x,
                      y: pt.y,
                      text: `${p.produktName}: ${pt.preis.toLocaleString("de-DE", {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1,
                      })} EUR/t · ${pt.datum.slice(8)}.${pt.datum.slice(5, 7)}.${pt.datum.slice(0, 4)}`,
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
              x={Math.max(pL, Math.min(tooltip.x - 110, W - pR - 240))}
              y={tooltip.y - 34}
              width={240} height={24} rx={4}
              fill="#1f2937" opacity={0.92}
            />
            <text
              x={Math.max(pL, Math.min(tooltip.x - 110, W - pR - 240)) + 8}
              y={tooltip.y - 18}
              fontSize={10} fill="white"
            >
              {tooltip.text}
            </text>
          </g>
        )}
      </svg>

      {/* Legende */}
      <div className="flex flex-wrap gap-x-5 gap-y-1 mt-1 justify-center">
        {filteredPreise.map((p) => {
          const farbe = MATIF_CHART_FARBEN[p.produktCode] ?? "#6b7280";
          return (
            <div key={p.produktCode} className="flex items-center gap-1.5 text-xs text-gray-600">
              <svg width={20} height={4}>
                <line x1={0} y1={2} x2={20} y2={2} stroke={farbe} strokeWidth={2} />
              </svg>
              {p.produktName}
              {p.statPrognose && (
                <span className="text-gray-400 ml-0.5">
                  → ~{p.statPrognose.mittelwert.toLocaleString("de-DE", {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })} ±{p.statPrognose.sigma.toLocaleString("de-DE", {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })}
                </span>
              )}
            </div>
          );
        })}
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <svg width={20} height={4}>
            <line x1={0} y1={2} x2={20} y2={2} stroke="#9ca3af" strokeWidth={1.5} strokeDasharray="4 2" />
          </svg>
          Prognose ±1σ/±2σ (Volatilitätskegel)
        </div>
      </div>
    </div>
  );
}

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

// Fixed color palette for dynamic chart lines
const LINE_PALETTE = [
  "#16a34a", // green-600
  "#d97706", // amber-600
  "#2563eb", // blue-600
  "#dc2626", // red-600
  "#7c3aed", // violet-600
  "#0891b2", // cyan-600
  "#ea580c", // orange-600
  "#4f46e5", // indigo-600
  "#be185d", // pink-700
  "#15803d", // green-700
  "#b45309", // amber-700
  "#1d4ed8", // blue-700
];

function codeColor(code: string, index: number): string {
  return LINE_PALETTE[index % LINE_PALETTE.length];
}

// Betriebsmittel main codes
const BETRIEBSMITTEL_CODES = ["203000", "203110", "203120", "203130"];
// Erzeuger main codes
const ERZEUGER_CODES = ["WH_SOFT", "RYE", "OATS", "MAIZE", "RAPE", "SOY", "SUNFL"];

// ─── Produkt Baum Navigator ───────────────────────────────────────────────────

function ProduktBaumNav({
  selectedCodes,
  onToggle,
  verfuegbareCodes,
}: {
  selectedCodes: Set<string>;
  onToggle: (code: string) => void;
  verfuegbareCodes: Set<string>;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(
    new Set(["betriebsmittel", "erzeuger", "203000", "C0000", "D0000"])
  );

  function toggleExpand(code: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function renderNode(node: ProduktNode, depth = 0): React.ReactNode {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expanded.has(node.code);
    const isSelected = selectedCodes.has(node.code);
    const hasData = verfuegbareCodes.has(node.code);

    return (
      <div key={node.code}>
        <div
          className={[
            "flex items-center gap-1 py-1 rounded cursor-pointer hover:bg-gray-100 text-sm",
            depth === 0 ? "font-semibold text-gray-700 mt-2" : "",
            isSelected ? "bg-green-50 text-green-800" : "",
            !hasData && !node.isGroup ? "opacity-40" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          style={{ paddingLeft: `${(depth + 1) * 12}px`, paddingRight: "8px" }}
        >
          {hasChildren && (
            <button
              onClick={() => toggleExpand(node.code)}
              className="text-gray-400 w-4 flex-shrink-0 text-xs"
            >
              {isExpanded ? "▾" : "▸"}
            </button>
          )}
          {!hasChildren && !node.isGroup && (
            <input
              type="checkbox"
              checked={isSelected}
              disabled={!hasData}
              onChange={() => onToggle(node.code)}
              className="mr-1 flex-shrink-0"
            />
          )}
          {hasChildren && !node.isGroup && (
            <input
              type="checkbox"
              checked={isSelected}
              disabled={!hasData}
              onChange={() => onToggle(node.code)}
              className="mr-1 flex-shrink-0"
            />
          )}
          <span
            className="flex-1 truncate"
            onClick={() => !node.isGroup && hasData && onToggle(node.code)}
          >
            {node.name}
          </span>
          {!hasData && !node.isGroup && (
            <span
              className="text-xs text-gray-300 ml-1 flex-shrink-0"
              title="Keine Daten von Eurostat verfügbar"
            >
              –
            </span>
          )}
        </div>
        {hasChildren && isExpanded &&
          node.children!.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  }

  function selectAllBetriebsmittel() {
    BETRIEBSMITTEL_CODES.forEach((c) => {
      if (verfuegbareCodes.has(c) && !selectedCodes.has(c)) onToggle(c);
    });
  }

  function selectAllErzeuger() {
    ERZEUGER_CODES.forEach((c) => {
      if (verfuegbareCodes.has(c) && !selectedCodes.has(c)) onToggle(c);
    });
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-2">
      <div className="flex flex-col gap-1 mb-2 px-1">
        <button
          onClick={selectAllBetriebsmittel}
          className="text-xs px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded text-left"
        >
          Alle Betriebsmittel
        </button>
        <button
          onClick={selectAllErzeuger}
          className="text-xs px-2 py-1 bg-green-50 hover:bg-green-100 text-green-700 rounded text-left"
        >
          Alle Erzeugerpreise
        </button>
      </div>
      {PRODUKT_BAUM.map((node) => renderNode(node))}
    </div>
  );
}

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

function LinienChart({
  daten,
  selectedCodes,
}: {
  daten: MarktpreisEintrag[];
  selectedCodes: Set<string>;
}) {
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);

  // Collect selected codes that actually have data
  const activeCodes = Array.from(selectedCodes).filter((code) =>
    daten.some((d) => d.produktCode === code)
  );

  // Group by produktCode (only selected codes)
  const grouped: Record<string, MarktpreisEintrag[]> = {};
  for (const d of daten) {
    if (!activeCodes.includes(d.produktCode)) continue;
    if (!grouped[d.produktCode]) grouped[d.produktCode] = [];
    grouped[d.produktCode].push(d);
  }

  // Sort each group by zeitraum
  for (const code of Object.keys(grouped)) {
    grouped[code].sort(
      (a, b) => zeitraumSortKey(a.zeitraum) - zeitraumSortKey(b.zeitraum)
    );
  }

  // Collect all unique zeitraeume sorted
  const alleZeitraeume = Array.from(
    new Set(daten.map((d) => d.zeitraum))
  ).sort((a, b) => zeitraumSortKey(a) - zeitraumSortKey(b));

  if (alleZeitraeume.length === 0 || activeCodes.length === 0) {
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

  // Compute y range across selected data
  const alleWerte = daten
    .filter((d) => activeCodes.includes(d.produktCode))
    .map((d) => d.indexWert);
  const minY = Math.floor(Math.min(...alleWerte, 100) / 10) * 10;
  const maxY = Math.ceil(Math.max(...alleWerte, 100) / 10) * 10;
  const yRange = maxY - minY || 1;

  function xPos(idx: number): number {
    return (
      paddingLeft + (idx / Math.max(alleZeitraeume.length - 1, 1)) * chartW
    );
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
        style={{ minWidth: 300 }}
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

        {/* Lines + dots for each selected code */}
        {activeCodes.map((code, colorIdx) => {
          const eintraege = grouped[code];
          if (!eintraege) return null;
          const farbe = codeColor(code, colorIdx);
          const label =
            eintraege[0]?.produktName ?? code;

          const points: {
            x: number;
            y: number;
            eintrag: MarktpreisEintrag;
          }[] = [];
          for (const e of eintraege) {
            const idx = alleZeitraeume.indexOf(e.zeitraum);
            if (idx < 0) continue;
            points.push({
              x: xPos(idx),
              y: yPos(e.indexWert),
              eintrag: e,
            });
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
                      text: `${label}: ${p.eintrag.indexWert.toFixed(1)} (${formatZeitraum(p.eintrag.zeitraum)})`,
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
              x={Math.max(
                paddingLeft,
                Math.min(tooltip.x - 90, W - paddingRight - 190)
              )}
              y={tooltip.y - 30}
              width={200}
              height={24}
              rx={4}
              fill="#1f2937"
              opacity={0.9}
            />
            <text
              x={
                Math.max(
                  paddingLeft,
                  Math.min(tooltip.x - 90, W - paddingRight - 190)
                ) + 8
              }
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
      <div className="flex flex-wrap gap-4 mt-3 justify-center">
        {activeCodes.map((code, colorIdx) => {
          const farbe = codeColor(code, colorIdx);
          const label =
            grouped[code]?.[0]?.produktName ?? code;
          return (
            <div
              key={code}
              className="flex items-center gap-2 text-sm text-gray-600"
            >
              <svg width={20} height={4}>
                <line
                  x1={0}
                  y1={2}
                  x2={20}
                  y2={2}
                  stroke={farbe}
                  strokeWidth={2}
                />
              </svg>
              <span>{label}</span>
            </div>
          );
        })}
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <svg width={20} height={4}>
            <line
              x1={0}
              y1={2}
              x2={20}
              y2={2}
              stroke="#6b7280"
              strokeWidth={1}
              strokeDasharray="4 2"
            />
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
    grouped[code].sort(
      (a, b) => zeitraumSortKey(a.zeitraum) - zeitraumSortKey(b.zeitraum)
    );
  }

  // Codes belonging to Erzeuger sections (mapped codes from LABEL_MAPPING)
  const GETREIDE_ERZEUGER_CODES = new Set(["C0000", "WH_SOFT", "RYE", "OATS", "MAIZE"]);
  const OELSAATEN_ERZEUGER_CODES = new Set(["D0000", "RAPE", "SOY", "SUNFL"]);

  // Determine section groupings from prefixes
  const prefixGroups: {
    prefix: string;
    label: string;
    bg: string;
    farbe: string;
    matchFn?: (code: string) => boolean;
  }[] = [
    { prefix: "203", label: "Dünger", bg: "bg-amber-50", farbe: "#d97706" },
    {
      prefix: "C_ERZEUGER",
      label: "Getreide (Erzeugerpreise)",
      bg: "bg-yellow-50",
      farbe: "#ca8a04",
      matchFn: (code) => GETREIDE_ERZEUGER_CODES.has(code),
    },
    {
      prefix: "D_ERZEUGER",
      label: "Ölsaaten (Erzeugerpreise)",
      bg: "bg-lime-50",
      farbe: "#65a30d",
      matchFn: (code) => OELSAATEN_ERZEUGER_CODES.has(code),
    },
  ];

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
      isMain: boolean;
    }[];
  }[] = [];

  const mainCodes = new Set(["203000", "C0000", "D0000"]);

  for (const { prefix, label, bg, farbe, matchFn } of prefixGroups) {
    const codes = Object.keys(grouped)
      .filter((c) => matchFn ? matchFn(c) : c.startsWith(prefix))
      .sort();
    const zeilen = codes.map((code) => {
      const reihe = grouped[code];
      const aktuell = reihe[reihe.length - 1]?.indexWert ?? 0;
      const vorquartal =
        reihe.length >= 2 ? reihe[reihe.length - 2].indexWert : aktuell;
      const veraenderung =
        vorquartal !== 0 ? ((aktuell - vorquartal) / vorquartal) * 100 : 0;
      const letzte4 = reihe.slice(-4).map((e) => e.indexWert);
      return {
        code,
        name: reihe[0]?.produktName ?? code,
        aktuell,
        vorquartal,
        veraenderung,
        letzte4,
        isMain: mainCodes.has(code),
      };
    });

    if (zeilen.length > 0) {
      sections.push({ prefix, label, bg, farbe, zeilen });
    }
  }

  if (sections.length === 0) {
    return (
      <div className="text-sm text-gray-400 py-4 text-center">
        Keine Produkte ausgewählt
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 px-3 font-medium text-gray-600">
              Kategorie
            </th>
            <th className="text-right py-2 px-3 font-medium text-gray-600">
              Aktuell
            </th>
            <th className="text-right py-2 px-3 font-medium text-gray-600 hidden sm:table-cell">
              Vorquartal
            </th>
            <th className="text-right py-2 px-3 font-medium text-gray-600">
              Veränd.
            </th>
            <th className="text-center py-2 px-3 font-medium text-gray-600 hidden sm:table-cell">
              Trend
            </th>
          </tr>
        </thead>
        <tbody>
          {sections.map((section) => (
            <Fragment key={section.prefix}>
              {/* Group header */}
              <tr className={section.bg}>
                <td
                  colSpan={3}
                  className="py-2 px-3 font-semibold text-gray-700 sm:hidden"
                >
                  {section.label}
                </td>
                <td
                  colSpan={5}
                  className="py-2 px-3 font-semibold text-gray-700 hidden sm:table-cell"
                >
                  {section.label}
                </td>
              </tr>
              {section.zeilen.map((z) => {
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
                    className={`border-b border-gray-50 hover:bg-gray-50 ${z.isMain ? "font-semibold" : ""}`}
                  >
                    <td className="py-2 px-3 text-gray-800">
                      {!z.isMain && (
                        <span className="text-gray-300 mr-2">--</span>
                      )}
                      {z.name}
                    </td>
                    <td className="py-2 px-3 text-right font-mono">
                      {z.aktuell.toFixed(1)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-gray-500 hidden sm:table-cell">
                      {z.vorquartal.toFixed(1)}
                    </td>
                    <td
                      className={`py-2 px-3 text-right font-mono ${changeColor}`}
                    >
                      {arrow} {z.veraenderung >= 0 ? "+" : ""}
                      {z.veraenderung.toFixed(1)}%
                    </td>
                    <td className="py-2 px-3 text-center hidden sm:table-cell">
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

const KPI_META: Record<
  string,
  { label: string; farbeClass: string; bgClass: string }
> = {
  "203000": {
    label: "Dünger",
    farbeClass: "text-amber-600",
    bgClass: "bg-amber-50",
  },
  C0000: {
    label: "Getreide",
    farbeClass: "text-yellow-600",
    bgClass: "bg-yellow-50",
  },
  D0000: {
    label: "Ölsaaten",
    farbeClass: "text-lime-600",
    bgClass: "bg-lime-50",
  },
};

const KPI_CODES = ["203000", "C0000", "D0000"];

function KpiKarten({
  daten,
  selectedCodes,
}: {
  daten: MarktpreisEintrag[];
  selectedCodes: Set<string>;
}) {
  const visibleKpiCodes = KPI_CODES.filter((code) => selectedCodes.has(code));

  if (visibleKpiCodes.length === 0) return null;

  const kpis: AktuellKpi[] = visibleKpiCodes
    .map((code) => {
      const reihe = daten
        .filter((d) => d.produktCode === code)
        .sort(
          (a, b) =>
            zeitraumSortKey(a.zeitraum) - zeitraumSortKey(b.zeitraum)
        );
      if (reihe.length === 0) return null;
      const aktuell = reihe[reihe.length - 1]?.indexWert ?? 0;
      const vorquartal =
        reihe.length >= 2 ? reihe[reihe.length - 2].indexWert : aktuell;
      const veraenderung =
        vorquartal !== 0 ? ((aktuell - vorquartal) / vorquartal) * 100 : 0;
      return {
        kategorie: KPI_META[code]?.label ?? code,
        produktCode: code,
        aktuell,
        vorquartal,
        veraenderung,
      };
    })
    .filter((k): k is AktuellKpi => k !== null);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {kpis.map((kpi) => {
        const meta = KPI_META[kpi.produktCode];
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
            <p
              className={`text-sm font-medium ${meta?.farbeClass ?? "text-gray-600"}`}
            >
              {kpi.kategorie}
            </p>
            <p className="text-3xl font-bold mt-1 text-gray-900">
              {kpi.aktuell.toFixed(1)}
            </p>
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

// ─── MATIF Spotpreise + Prognose ──────────────────────────────────────────────

const MATIF_META: Record<string, { farbeClass: string; borderClass: string }> = {
  WEIZEN: { farbeClass: "text-amber-700",  borderClass: "border-l-4 border-amber-400" },
  RAPS:   { farbeClass: "text-yellow-700", borderClass: "border-l-4 border-yellow-500" },
  MAIS:   { farbeClass: "text-lime-700",   borderClass: "border-l-4 border-lime-500"  },
};

function MatifSpotSection() {
  const [preise, setPreise] = useState<MatifProdukt[] | null>(null);
  const [letzteAktualisierung, setLetzteAktualisierung] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [zeitraum, setZeitraum] = useState<Zeitraum>("3M");

  const laden = useCallback(async (force = false) => {
    try {
      setFehler(null);
      const url = force
        ? "/api/marktpreise/spot?force=true"
        : "/api/marktpreise/spot";
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setPreise(json.preise ?? []);
      if (json.letzteAktualisierung) {
        setLetzteAktualisierung(
          new Date(json.letzteAktualisierung).toLocaleString("de-DE", {
            day:    "2-digit",
            month:  "2-digit",
            year:   "numeric",
            hour:   "2-digit",
            minute: "2-digit",
          })
        );
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setFehler("Zeitüberschreitung beim Laden der MATIF-Daten");
      } else {
        setFehler(err instanceof Error ? err.message : "Unbekannter Fehler");
      }
      setPreise([]);
    }
  }, []);

  useEffect(() => { laden(); }, [laden]);

  async function handleSync() {
    setSyncing(true);
    try { await laden(true); } finally { setSyncing(false); }
  }

  if (preise === null) {
    return (
      <Card>
        <p className="text-sm text-gray-400">Lade MATIF-Futurespreise…</p>
      </Card>
    );
  }

  if (fehler || preise.length === 0) {
    return (
      <Card>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-800">
              Aktuelle Futurespreise (MATIF) + 1-Wochen-Prognose
            </h2>
            <p className="text-sm text-red-500 mt-1">
              {fehler
                ? `MATIF-Daten nicht verfügbar: ${fehler}`
                : "Keine MATIF-Daten verfügbar (Yahoo Finance / Euronext)"}
            </p>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-3 py-1.5 text-xs bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
          >
            {syncing ? "Lade…" : "Erneut versuchen"}
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3 mb-3">
        <div>
          <h2 className="text-base font-semibold text-gray-800">
            Aktuelle Futurespreise (MATIF) + 1-Wochen-Prognose
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Quelle: Euronext MATIF via Yahoo Finance · Schlusskurse in EUR/t ·{" "}
            Stand: {letzteAktualisierung || "–"} · Automatische Aktualisierung alle 6 h
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Zeitraumfilter */}
          <div className="flex gap-1">
            {(["1M", "3M", "6M", "1J", "Max"] as Zeitraum[]).map((z) => (
              <button
                key={z}
                onClick={() => setZeitraum(z)}
                className={`px-2 py-1 text-xs rounded-md font-medium transition-colors ${
                  zeitraum === z
                    ? "bg-amber-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {z}
              </button>
            ))}
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-3 py-1.5 text-xs bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
          >
            {syncing ? "Lade…" : "↺"}
          </button>
        </div>
      </div>

      {/* Preisverlauf-Chart */}
      <MatifChart preise={preise} zeitraum={zeitraum} />

      <div className="border-t border-gray-100 my-4" />

      {/* Karten */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {preise.map((p) => {
          const meta = MATIF_META[p.produktCode] ?? {
            farbeClass:  "text-gray-700",
            borderClass: "border-l-4 border-gray-400",
          };
          const isUp     = (p.veraenderung ?? 0) > 0.5;
          const isDown   = (p.veraenderung ?? 0) < -0.5;
          const arrow    = isUp ? "▲" : isDown ? "▼" : "–";
          const deltaClr = isUp
            ? "text-red-600"
            : isDown
              ? "text-green-600"
              : "text-gray-500";

          const prognosePreis = p.statPrognose?.mittelwert ?? p.prognose1W;
          const pDiff =
            prognosePreis != null
              ? Math.round((prognosePreis - p.preis) * 10) / 10
              : null;
          const pUp     = (pDiff ?? 0) > 0.5;
          const pDown   = (pDiff ?? 0) < -0.5;
          const pArrow  = pUp ? "▲" : pDown ? "▼" : "→";
          const pColor  = pUp
            ? "text-red-600"
            : pDown
              ? "text-green-600"
              : "text-gray-500";

          return (
            <div
              key={p.produktCode}
              className={`rounded-lg p-4 bg-white border border-gray-100 shadow-sm ${meta.borderClass}`}
            >
              <p className={`text-sm font-medium ${meta.farbeClass}`}>
                {p.produktName}
              </p>
              <p className="text-3xl font-bold text-gray-900 mt-1 tabular-nums">
                {p.preis.toLocaleString("de-DE", {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })}{" "}
                <span className="text-base font-normal text-gray-500">EUR/t</span>
              </p>

              {/* Vorwoche */}
              {p.veraenderung != null ? (
                <p className={`text-sm mt-1 ${deltaClr}`}>
                  {arrow}{" "}
                  {p.veraenderung >= 0 ? "+" : ""}
                  {p.veraenderung.toLocaleString("de-DE", {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })}{" "}
                  EUR/t ggü. Vorwoche
                </p>
              ) : (
                <p className="text-sm mt-1 text-gray-400">Keine Vorwochendaten</p>
              )}

              {/* Trennlinie */}
              <div className="border-t border-gray-100 my-3" />

              {/* 1-Wochen-Prognose */}
              <p className="text-xs font-medium text-gray-500 mb-1">
                Prognose nächste Woche
              </p>
              {p.statPrognose != null ? (
                <>
                  <p className={`text-lg font-semibold tabular-nums ${pColor}`}>
                    {pArrow}{" "}
                    ~{p.statPrognose.mittelwert.toLocaleString("de-DE", {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    })}{" "}
                    EUR/t
                  </p>
                  <p className={`text-xs mt-0.5 ${pColor}`}>
                    {pDiff != null && (pDiff >= 0 ? "+" : "")}
                    {pDiff != null && pDiff.toLocaleString("de-DE", {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    })}{" "}
                    EUR/t
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    ±1σ: {p.statPrognose.band68Lo.toLocaleString("de-DE", { maximumFractionDigits: 0 })}–
                    {p.statPrognose.band68Hi.toLocaleString("de-DE", { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-xs text-gray-300">
                    ±2σ: {p.statPrognose.band95Lo.toLocaleString("de-DE", { maximumFractionDigits: 0 })}–
                    {p.statPrognose.band95Hi.toLocaleString("de-DE", { maximumFractionDigits: 0 })}
                  </p>
                </>
              ) : p.prognose1W != null ? (
                <>
                  <p className={`text-lg font-semibold tabular-nums ${pColor}`}>
                    {pArrow} ~{p.prognose1W.toLocaleString("de-DE", {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    })} EUR/t
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">lineare Extrapolation</p>
                </>
              ) : (
                <p className="text-sm text-gray-400">
                  Zu wenig Datenpunkte
                </p>
              )}

              {/* Letzter Handelstag */}
              {p.datum && (
                <p className="text-xs text-gray-300 mt-2">
                  Letzter Kurs:{" "}
                  {new Date(p.datum).toLocaleDateString("de-DE", {
                    day:   "2-digit",
                    month: "2-digit",
                    year:  "numeric",
                  })}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-300 mt-3">
        Prognose = linearer Trend + √T-skalierte historische Volatilität (σ täglicher Preisänderungen) ·
        Keine Anlageberatung · Futures = Terminpreise, nicht Spotpreise
      </p>
    </Card>
  );
}

// ─── Produkt-Summe (linkes Panel) ────────────────────────────────────────────

function ProduktSumme({
  daten,
  selectedCodes,
}: {
  daten: MarktpreisEintrag[];
  selectedCodes: Set<string>;
}) {
  // Alle Leaf-Codes (keine Gruppen) die ausgewählt und mit Daten vorhanden sind
  const aktiveCodes = Array.from(selectedCodes).filter((c) =>
    daten.some((d) => d.produktCode === c)
  );

  if (aktiveCodes.length === 0) {
    return (
      <p className="text-xs text-gray-400 px-2 py-3 text-center">
        Keine Produkte ausgewählt
      </p>
    );
  }

  const zeilen = aktiveCodes.map((code, idx) => {
    const reihe = daten
      .filter((d) => d.produktCode === code)
      .sort((a, b) => zeitraumSortKey(a.zeitraum) - zeitraumSortKey(b.zeitraum));
    const aktuell = reihe[reihe.length - 1]?.indexWert ?? 0;
    const vorq = reihe.length >= 2 ? reihe[reihe.length - 2].indexWert : aktuell;
    const delta = vorq !== 0 ? ((aktuell - vorq) / vorq) * 100 : 0;
    const name = reihe[0]?.produktName ?? code;
    const farbe = LINE_PALETTE[idx % LINE_PALETTE.length];
    return { code, name, aktuell, delta, farbe };
  });

  return (
    <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden">
      <div className="bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
        Ausgewählt ({aktiveCodes.length})
      </div>
      <div className="divide-y divide-gray-100">
        {zeilen.map((z) => {
          const isUp = z.delta > 2;
          const isDown = z.delta < -2;
          const deltaColor = isUp ? "text-red-600" : isDown ? "text-green-600" : "text-gray-400";
          const arrow = isUp ? "▲" : isDown ? "▼" : "–";
          return (
            <div key={z.code} className="flex items-center gap-2 px-3 py-2">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: z.farbe }}
              />
              <span className="flex-1 text-xs text-gray-700 truncate">{z.name}</span>
              <span className="text-xs font-mono font-semibold text-gray-800">
                {z.aktuell.toFixed(1)}
              </span>
              <span className={`text-xs ${deltaColor} w-10 text-right`}>
                {arrow} {Math.abs(z.delta).toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>
      <div className="bg-gray-50 px-3 py-2 flex items-center justify-between">
        <span className="text-xs text-gray-500">Ø Index</span>
        <span className="text-xs font-mono font-bold text-gray-800">
          {(zeilen.reduce((s, z) => s + z.aktuell, 0) / zeilen.length).toFixed(1)}
        </span>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const DEFAULT_SELECTED = new Set(["WH_SOFT", "RYE", "OATS", "MAIZE", "RAPE", "SOY", "SUNFL"]);

export default function MarktpreisePage() {
  const [daten, setDaten] = useState<MarktpreisEintrag[] | null>(null);
  const [letzteAktualisierung, setLetzteAktualisierung] = useState<string>("");
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(DEFAULT_SELECTED);
  const [aktiveTab, setAktiveTab] = useState<"verlauf" | "detail">("verlauf");

  const loadData = useCallback(async (force = false) => {
    try {
      setError(null);
      const url = force ? "/api/marktpreise?force=true" : "/api/marktpreise";
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
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
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("Zeitüberschreitung beim Laden der Marktpreise");
      } else {
        setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      }
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleSync() {
    setSyncing(true);
    try { await loadData(true); } finally { setSyncing(false); }
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

  const verfuegbareCodes = new Set(daten.map((d) => d.produktCode));
  const filteredDaten = daten.filter((d) => selectedCodes.has(d.produktCode));

  function toggleCode(code: string) {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Marktpreise — Agrarpreisindex</h1>
          <p className="text-sm text-gray-500">
            Quelle: Eurostat apri_pi15_inq / apri_pi15_outq · Preisindex 2015 = 100
            {letzteAktualisierung && (
              <span className="ml-2 text-gray-400">· Stand: {letzteAktualisierung}</span>
            )}
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
        >
          {syncing ? "Aktualisiere…" : "↺ Daten aktualisieren"}
        </button>
      </div>

      {/* MATIF Spotpreise + Prognose */}
      <MatifSpotSection />

      {/* Eurostat-Sektion: 2-spaltig */}
      <div className="flex flex-col lg:flex-row gap-5">

        {/* ── Linke Spalte: Produktbaum + Summe ── */}
        <div className="w-full lg:w-64 lg:flex-shrink-0">
          <div className="lg:sticky lg:top-4 space-y-1">
            <h3 className="text-sm font-semibold text-gray-600">Produktauswahl</h3>
            <p className="text-xs text-gray-400 mb-2">
              Eurostat-Preisindex · {verfuegbareCodes.size} Produkte verfügbar
            </p>
            <ProduktBaumNav
              selectedCodes={selectedCodes}
              onToggle={toggleCode}
              verfuegbareCodes={verfuegbareCodes}
            />
            <ProduktSumme daten={daten} selectedCodes={selectedCodes} />
          </div>
        </div>

        {/* ── Rechte Spalte: KPIs + Tabs ── */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* KPI-Leiste */}
          <KpiKarten daten={filteredDaten} selectedCodes={selectedCodes} />

          {/* Tab-Card */}
          <Card>
            {/* Tab-Header */}
            <div className="flex items-center gap-0 mb-5 border-b border-gray-200 -mt-1">
              <button
                onClick={() => setAktiveTab("verlauf")}
                className={[
                  "px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                  aktiveTab === "verlauf"
                    ? "border-green-600 text-green-700"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300",
                ].join(" ")}
              >
                Preisverlauf
              </button>
              <button
                onClick={() => setAktiveTab("detail")}
                className={[
                  "px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                  aktiveTab === "detail"
                    ? "border-green-600 text-green-700"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300",
                ].join(" ")}
              >
                Detailtabelle
              </button>
            </div>

            {/* Tab-Inhalt */}
            {aktiveTab === "verlauf" ? (
              <>
                <p className="text-xs text-gray-400 mb-3">
                  Quartalsindex (Basis 2015 = 100) · ausgewählte Produkte im Vergleich
                </p>
                <LinienChart daten={filteredDaten} selectedCodes={selectedCodes} />
              </>
            ) : (
              <>
                <p className="text-xs text-gray-400 mb-3">
                  Aktuelle Indexwerte, Vorquartal und Trend je Produkt
                </p>
                <DetailTabelle daten={filteredDaten} />
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
