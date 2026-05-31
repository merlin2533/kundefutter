"use client";

import { useEffect, useState, useCallback } from "react";
import { formatEuro, formatPercent, MONATE_KURZ } from "@/lib/utils";
import Link from "next/link";
import ZeitraumFilter from "@/components/ZeitraumFilter";

// ─── Typen ────────────────────────────────────────────────────────────────────

interface DBItem {
  id: number;
  name: string;
  umsatz: number;
  einkauf: number;
  gutschriften: number;
  deckungsbeitrag: number;
  dbMarge: number;
}

interface DBData {
  typ: "artikel" | "kunde";
  von: string;
  bis: string;
  items: DBItem[];
  schwellwertGut: number;
  schwellwertKritisch: number;
}

type SortField = "name" | "umsatz" | "einkauf" | "deckungsbeitrag" | "dbMarge";
type SortDir = "asc" | "desc";
type Ansicht = "rangliste" | "monatsverlauf";

interface GesamtMonat {
  monat: string;
  umsatz: number;
  einkauf: number;
  deckungsbeitrag: number;
  dbMarge: number;
}

interface TopArtikel {
  id: number;
  name: string;
  monate: { monat: string; umsatz: number; einkauf: number; deckungsbeitrag: number }[];
}

interface Auftrag {
  id: number;
  datum: string;
  monat: string;
  kundeName: string;
  kundeId: number;
  umsatz: number;
  einkauf: number;
  deckungsbeitrag: number;
  dbMarge: number;
}

interface MonatlichData {
  gesamt: GesamtMonat[];
  topArtikel: TopArtikel[];
  auftraege: Auftrag[];
}

type AuftragSortField = "datum" | "kundeName" | "umsatz" | "deckungsbeitrag" | "dbMarge";

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

function formatMonat(m: string): string {
  const [y, mo] = m.split("-");
  return `${MONATE_KURZ[Number(mo) - 1]} ${y}`;
}

function formatMonatKurz(m: string): string {
  const mo = Number(m.split("-")[1]);
  return MONATE_KURZ[mo - 1] ?? m;
}

function margeColor(pct: number, gut = 30, kritisch = 15) {
  if (pct >= gut) return "text-green-700";
  if (pct >= kritisch) return "text-yellow-700";
  return "text-red-600";
}

function margeBgColor(pct: number, gut = 30, kritisch = 15) {
  if (pct >= gut) return "bg-green-50";
  if (pct >= kritisch) return "bg-yellow-50";
  return "bg-red-50";
}

function margeBarColor(pct: number, gut = 30, kritisch = 15) {
  if (pct >= gut) return "bg-green-500";
  if (pct >= kritisch) return "bg-yellow-400";
  return "bg-red-400";
}

function downloadCSV(items: DBItem[], typ: string) {
  const header = ["Rang", "Name", "Umsatz (EUR)", "Einkauf (EUR)", "Deckungsbeitrag (EUR)", "DB-Marge (%)"];
  const rows = items.map((item, i) => [
    String(i + 1),
    `"${item.name.replace(/"/g, '""')}"`,
    item.umsatz.toFixed(2).replace(".", ","),
    item.einkauf.toFixed(2).replace(".", ","),
    item.deckungsbeitrag.toFixed(2).replace(".", ","),
    item.dbMarge.toFixed(1).replace(".", ","),
  ]);
  const csv = [header.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `deckungsbeitrag-${typ}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) {
  if (field !== sortField) return <span className="text-gray-300 ml-1">↕</span>;
  return <span className="text-green-700 ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>;
}

// ─── DB-Monats-Chart (SVG) ────────────────────────────────────────────────────

function DBMonatsChart({
  data,
}: {
  data: { monat: string; umsatz: number; deckungsbeitrag: number }[];
}) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-gray-400">
        Keine Daten
      </div>
    );
  }

  const W = 720;
  const H = 200;
  const PL = 75;
  const PR = 20;
  const PT = 16;
  const PB = 44;
  const CW = W - PL - PR;
  const CH = H - PT - PB;

  const maxWert = Math.max(...data.map(d => Math.max(d.umsatz, Math.abs(d.deckungsbeitrag))), 1);
  const step = CW / Math.max(data.length, 1);
  const barW = Math.min(24, step / 2 - 2);
  const yTicks = [0, 0.5, 1].map(f => maxWert * f);

  function barH(v: number) {
    return Math.max(2, (Math.abs(v) / maxWert) * CH);
  }

  return (
    <div className="relative overflow-x-auto">
      <div className="flex gap-4 mb-2 text-xs text-gray-500 flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-gray-300 inline-block" />
          Umsatz
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-green-500 inline-block" />
          Deckungsbeitrag (positiv)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-red-400 inline-block" />
          Deckungsbeitrag (negativ)
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ minWidth: Math.max(400, data.length * 60) }}
        onMouseLeave={() => setTooltip(null)}
      >
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
        <line x1={PL} y1={PT + CH} x2={W - PR} y2={PT + CH} stroke="#d1d5db" strokeWidth={1} />

        {data.map((d, i) => {
          const cx = PL + i * step + step / 2;
          const uH = barH(d.umsatz);
          const dbH = barH(d.deckungsbeitrag);
          const isPos = d.deckungsbeitrag >= 0;
          return (
            <g
              key={d.monat}
              onMouseEnter={() =>
                setTooltip({
                  x: cx,
                  y: PT + CH - Math.max(uH, dbH) - 12,
                  text: `${formatMonat(d.monat)}: Umsatz ${formatEuro(d.umsatz)} / DB ${formatEuro(d.deckungsbeitrag)}`,
                })
              }
            >
              {/* Umsatz-Balken (grau) */}
              <rect
                x={cx - barW - 1}
                y={PT + CH - uH}
                width={barW}
                height={uH}
                fill="#d1d5db"
                rx={2}
                className="cursor-pointer hover:fill-gray-400 transition-colors"
              />
              {/* DB-Balken */}
              <rect
                x={cx + 1}
                y={PT + CH - (isPos ? dbH : 0)}
                width={barW}
                height={dbH}
                fill={isPos ? "#22c55e" : "#f87171"}
                rx={2}
                className="cursor-pointer hover:opacity-80 transition-opacity"
              />
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

        {tooltip && (
          <g>
            <rect
              x={Math.max(PL, Math.min(tooltip.x - 140, W - PR - 300))}
              y={tooltip.y - 22}
              width={300}
              height={26}
              rx={4}
              fill="#1f2937"
              opacity={0.92}
            />
            <text
              x={Math.max(PL, Math.min(tooltip.x - 140, W - PR - 300)) + 8}
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

// ─── Hauptseite ───────────────────────────────────────────────────────────────

export default function DeckungsbeitragPage() {
  const heute = new Date();

  const [ansicht, setAnsicht] = useState<Ansicht>("rangliste");
  const [typ, setTyp] = useState<"artikel" | "kunde">("artikel");
  const [jahr, setJahr] = useState(String(heute.getFullYear()));
  const [vonMonat, setVonMonat] = useState("01");
  const [bisMonat, setBisMonat] = useState(String(heute.getMonth() + 1).padStart(2, "0"));
  const [data, setData] = useState<DBData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("deckungsbeitrag");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Monatsverlauf-State
  const [monatlichData, setMonatlichData] = useState<MonatlichData | null>(null);
  const [monatlichLoading, setMonatlichLoading] = useState(false);
  const [monatlichError, setMonatlichError] = useState<string | null>(null);
  const [selectedArtikelId, setSelectedArtikelId] = useState<number | null>(null);
  const [auftragSortField, setAuftragSortField] = useState<AuftragSortField>("datum");
  const [auftragSortDir, setAuftragSortDir] = useState<SortDir>("desc");

  function datumRange() {
    const von = `${jahr}-${vonMonat}-01`;
    const letzterTag = new Date(parseInt(jahr, 10), parseInt(bisMonat, 10), 0).getDate();
    const bis = `${jahr}-${bisMonat}-${String(letzterTag).padStart(2, "0")}`;
    return { von, bis };
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { von, bis } = datumRange();
      const res = await fetch(`/api/analyse/deckungsbeitrag?gruppierung=${typ}&von=${von}&bis=${bis}`);
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      setError("Fehler beim Laden der Daten");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typ, jahr, vonMonat, bisMonat]);

  const loadMonatlich = useCallback(async () => {
    setMonatlichLoading(true);
    setMonatlichError(null);
    try {
      const { von, bis } = datumRange();
      const res = await fetch(`/api/analyse/deckungsbeitrag/monatlich?von=${von}&bis=${bis}`);
      if (!res.ok) throw new Error();
      const d = await res.json();
      setMonatlichData(Array.isArray(d.gesamt) ? d : null);
    } catch {
      setMonatlichError("Fehler beim Laden der Monatsdaten");
    } finally {
      setMonatlichLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jahr, vonMonat, bisMonat]);

  useEffect(() => {
    if (ansicht === "rangliste") load();
  }, [ansicht, load]);

  useEffect(() => {
    if (ansicht === "monatsverlauf") loadMonatlich();
  }, [ansicht, loadMonatlich]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  function handleAuftragSort(field: AuftragSortField) {
    if (auftragSortField === field) {
      setAuftragSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setAuftragSortField(field);
      setAuftragSortDir(field === "kundeName" ? "asc" : "desc");
    }
  }

  const sortedItems = data
    ? [...data.items].sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];
        if (typeof aVal === "string" && typeof bVal === "string") {
          return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        return sortDir === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
      })
    : [];

  const maxDB = data ? Math.max(1, ...data.items.map((i) => Math.abs(i.deckungsbeitrag))) : 1;

  const totalUmsatz = sortedItems.reduce((s, i) => s + i.umsatz, 0);
  const totalEinkauf = sortedItems.reduce((s, i) => s + i.einkauf, 0);
  const totalDB = sortedItems.reduce((s, i) => s + i.deckungsbeitrag, 0);
  const totalMarge = totalUmsatz > 0 ? (totalDB / totalUmsatz) * 100 : 0;

  const thSort = (field: SortField, label: string, align: "left" | "right" = "right") => (
    <th
      className={`px-4 py-3 text-${align} font-semibold text-gray-600 cursor-pointer select-none hover:bg-gray-100`}
      onClick={() => handleSort(field)}
    >
      {label}
      <SortIcon field={field} sortField={sortField} sortDir={sortDir} />
    </th>
  );

  function auftragSortIcon(field: AuftragSortField) {
    if (field !== auftragSortField) return <span className="text-gray-300 ml-1">↕</span>;
    return <span className="text-green-700 ml-1">{auftragSortDir === "asc" ? "↑" : "↓"}</span>;
  }

  const sortedAuftraege = monatlichData
    ? [...monatlichData.auftraege].sort((a, b) => {
        const av = a[auftragSortField];
        const bv = b[auftragSortField];
        if (typeof av === "string") {
          return auftragSortDir === "asc" ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
        }
        return auftragSortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
      })
    : [];

  return (
    <div className="max-w-screen-xl mx-auto print:px-0 print:py-0">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-1 print:hidden">
        <Link href="/statistik" className="hover:text-green-700">Statistik</Link>
        <span>›</span>
        <span className="text-gray-800 font-medium">Deckungsbeitrag</span>
      </div>
      <div className="flex items-center justify-between mb-6 print:mb-3">
        <h1 className="text-2xl font-bold text-gray-800">Deckungsbeitrag-Analyse</h1>
        <div className="flex items-center gap-2 print:hidden">
          {ansicht === "rangliste" && data && data.items.length > 0 && (
            <button
              onClick={() => downloadCSV(sortedItems, typ)}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              CSV-Export
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 transition-colors"
          >
            Drucken
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="mb-6 print:hidden">
        <ZeitraumFilter
          jahr={jahr} setJahr={setJahr}
          vonMonat={vonMonat} setVonMonat={setVonMonat}
          bisMonat={bisMonat} setBisMonat={setBisMonat}
          loading={ansicht === "rangliste" ? loading : monatlichLoading}
        >
          {/* Ansicht-Toggle */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Ansicht</label>
            <div className="flex rounded-lg border border-gray-300 overflow-hidden">
              <button
                onClick={() => setAnsicht("rangliste")}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  ansicht === "rangliste" ? "bg-green-700 text-white" : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                Rangliste
              </button>
              <button
                onClick={() => setAnsicht("monatsverlauf")}
                className={`px-4 py-2 text-sm font-medium transition-colors border-l border-gray-300 ${
                  ansicht === "monatsverlauf" ? "bg-green-700 text-white" : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                Monatsverlauf
              </button>
            </div>
          </div>

          {/* Gruppierung — nur für Rangliste */}
          {ansicht === "rangliste" && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Gruppierung</label>
              <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                <button
                  onClick={() => setTyp("artikel")}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    typ === "artikel" ? "bg-green-700 text-white" : "bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  Nach Artikel
                </button>
                <button
                  onClick={() => setTyp("kunde")}
                  className={`px-4 py-2 text-sm font-medium transition-colors border-l border-gray-300 ${
                    typ === "kunde" ? "bg-green-700 text-white" : "bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  Nach Kunde
                </button>
              </div>
            </div>
          )}
        </ZeitraumFilter>
      </div>

      {/* ── Rangliste-Ansicht ─────────────────────────────────────────────────── */}
      {ansicht === "rangliste" && (
        <>
          {/* Color legend – dynamische Schwellwerte aus Einstellungen */}
          <div className="flex items-center gap-4 mb-4 text-xs print:hidden flex-wrap">
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-sm bg-green-500" />
              <span className="text-gray-500">DB-Marge &gt; {data?.schwellwertGut ?? 30} %</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-sm bg-yellow-400" />
              <span className="text-gray-500">Marge {data?.schwellwertKritisch ?? 15}–{data?.schwellwertGut ?? 30} %</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-sm bg-red-400" />
              <span className="text-gray-500">Marge &lt; {data?.schwellwertKritisch ?? 15} %</span>
            </span>
          </div>

          {loading && (
            <div className="py-16 flex items-center justify-center gap-3 text-gray-500">
              <svg className="animate-spin h-5 w-5 text-green-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Lade Daten…
            </div>
          )}
          {error && <div className="py-8 text-red-600">{error}</div>}

          {data && !loading && (
            <>
              {sortedItems.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 print:grid-cols-4 print:gap-2">
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                    <div className="text-xs text-gray-500 font-medium mb-1">Gesamtumsatz</div>
                    <div className="text-lg font-bold text-gray-800 font-mono">{formatEuro(totalUmsatz)}</div>
                    <div className="text-xs text-gray-400 mt-1">{sortedItems.length} Positionen</div>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                    <div className="text-xs text-gray-500 font-medium mb-1">Gesamteinkauf</div>
                    <div className="text-lg font-bold text-gray-800 font-mono">{formatEuro(totalEinkauf)}</div>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                    <div className="text-xs text-gray-500 font-medium mb-1">Deckungsbeitrag</div>
                    <div className={`text-lg font-bold font-mono ${margeColor(totalMarge, data.schwellwertGut, data.schwellwertKritisch)}`}>{formatEuro(totalDB)}</div>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                    <div className="text-xs text-gray-500 font-medium mb-1">Ø DB-Marge</div>
                    <div className={`text-lg font-bold ${margeColor(totalMarge, data.schwellwertGut, data.schwellwertKritisch)}`}>{formatPercent(totalMarge)}</div>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
                {sortedItems.length === 0 ? (
                  <div className="py-12 text-center text-gray-400">Keine Daten für den gewählten Zeitraum</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-4 py-3 text-left font-semibold text-gray-600 w-10">Rang</th>
                        {thSort("name", "Name", "left")}
                        {thSort("umsatz", "Umsatz (inkl. Gutschriften)")}
                        {thSort("einkauf", "Einkauf")}
                        {thSort("deckungsbeitrag", "Deckungsbeitrag")}
                        {thSort("dbMarge", "DB-Marge %")}
                        <th className="px-4 py-3 text-left font-semibold text-gray-600 w-32 print:hidden">Anteil</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedItems.map((item, i) => (
                        <tr key={item.id} className={`border-b border-gray-100 hover:bg-gray-50 ${margeBgColor(item.dbMarge, data.schwellwertGut, data.schwellwertKritisch)}`}>
                          <td className="px-4 py-2.5 text-gray-400">{i + 1}</td>
                          <td className="px-4 py-2.5 font-medium text-gray-800">
                            {typ === "kunde" ? (
                              <Link href={`/kunden/${item.id}`} className="text-green-700 hover:underline">
                                {item.name}
                              </Link>
                            ) : (
                              item.name
                            )}
                            {item.gutschriften > 0 && (
                              <span className="ml-2 text-xs text-amber-600 font-normal" title={`Gutschriften: ${formatEuro(item.gutschriften)} abgezogen`}>
                                −GS
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-gray-600">{formatEuro(item.umsatz)}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-gray-500">{formatEuro(item.einkauf)}</td>
                          <td className="px-4 py-2.5 text-right font-mono font-semibold text-gray-800">
                            {formatEuro(item.deckungsbeitrag)}
                          </td>
                          <td className={`px-4 py-2.5 text-right font-semibold ${margeColor(item.dbMarge, data.schwellwertGut, data.schwellwertKritisch)}`}>
                            {formatPercent(item.dbMarge)}
                          </td>
                          <td className="px-4 py-2.5 print:hidden">
                            <div className="w-full bg-gray-100 rounded-full h-2.5">
                              <div
                                className={`h-2.5 rounded-full transition-all ${margeBarColor(item.dbMarge, data.schwellwertGut, data.schwellwertKritisch)}`}
                                style={{
                                  width: `${Math.max(2, Math.round((Math.abs(item.deckungsbeitrag) / maxDB) * 100))}%`,
                                }}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* ── Monatsverlauf-Ansicht ─────────────────────────────────────────────── */}
      {ansicht === "monatsverlauf" && (
        <>
          {monatlichLoading && (
            <div className="py-16 flex items-center justify-center gap-3 text-gray-500">
              <svg className="animate-spin h-5 w-5 text-green-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Lade Daten…
            </div>
          )}
          {monatlichError && <div className="py-8 text-red-600">{monatlichError}</div>}

          {monatlichData && !monatlichLoading && (
            <div className="space-y-6">
              {/* Gesamt-Summe KPIs */}
              {monatlichData.gesamt.length > 0 && (() => {
                const totU = monatlichData.gesamt.reduce((s, m) => s + m.umsatz, 0);
                const totE = monatlichData.gesamt.reduce((s, m) => s + m.einkauf, 0);
                const totDB = monatlichData.gesamt.reduce((s, m) => s + m.deckungsbeitrag, 0);
                const totMarge = totU > 0 ? (totDB / totU) * 100 : 0;
                return (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                      <div className="text-xs text-gray-500 font-medium mb-1">Gesamtumsatz</div>
                      <div className="text-lg font-bold text-gray-800 font-mono">{formatEuro(totU)}</div>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                      <div className="text-xs text-gray-500 font-medium mb-1">Gesamteinkauf</div>
                      <div className="text-lg font-bold text-gray-800 font-mono">{formatEuro(totE)}</div>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                      <div className="text-xs text-gray-500 font-medium mb-1">Deckungsbeitrag</div>
                      <div className={`text-lg font-bold font-mono ${margeColor(totMarge)}`}>{formatEuro(totDB)}</div>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                      <div className="text-xs text-gray-500 font-medium mb-1">Ø DB-Marge</div>
                      <div className={`text-lg font-bold ${margeColor(totMarge)}`}>{formatPercent(totMarge)}</div>
                    </div>
                  </div>
                );
              })()}

              {/* Sektion 1: Gesamt-DB pro Monat */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-base font-semibold text-gray-800 mb-4">Gesamt-DB pro Monat</h2>
                <DBMonatsChart data={monatlichData.gesamt} />
                {monatlichData.gesamt.length > 0 && (
                  <div className="overflow-x-auto mt-4">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium text-gray-600">Monat</th>
                          <th className="px-4 py-3 text-right font-medium text-gray-600">Umsatz</th>
                          <th className="px-4 py-3 text-right font-medium text-gray-500 hidden sm:table-cell">Einkauf</th>
                          <th className="px-4 py-3 text-right font-semibold text-gray-700">Deckungsbeitrag</th>
                          <th className="px-4 py-3 text-right font-medium text-gray-600">Marge</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {monatlichData.gesamt.map(m => (
                          <tr key={m.monat} className="hover:bg-gray-50">
                            <td className="px-4 py-2.5 font-medium text-gray-700">{formatMonat(m.monat)}</td>
                            <td className="px-4 py-2.5 text-right font-mono text-gray-600">{formatEuro(m.umsatz)}</td>
                            <td className="px-4 py-2.5 text-right font-mono text-gray-500 hidden sm:table-cell">{formatEuro(m.einkauf)}</td>
                            <td className={`px-4 py-2.5 text-right font-mono font-semibold ${margeColor(m.dbMarge)}`}>
                              {formatEuro(m.deckungsbeitrag)}
                            </td>
                            <td className={`px-4 py-2.5 text-right font-semibold ${margeColor(m.dbMarge)}`}>
                              {formatPercent(m.dbMarge)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Sektion 2: Top-Artikel Monatsverlauf */}
              {monatlichData.topArtikel.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h2 className="text-base font-semibold text-gray-800 mb-3">Top-Artikel Monatsverlauf</h2>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {monatlichData.topArtikel.map(a => (
                      <button
                        key={a.id}
                        onClick={() => setSelectedArtikelId(a.id === selectedArtikelId ? null : a.id)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          selectedArtikelId === a.id
                            ? "bg-green-700 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        {a.name}
                      </button>
                    ))}
                  </div>
                  {selectedArtikelId ? (
                    (() => {
                      const sel = monatlichData.topArtikel.find(a => a.id === selectedArtikelId);
                      return sel ? (
                        <DBMonatsChart data={sel.monate} />
                      ) : null;
                    })()
                  ) : (
                    <p className="text-sm text-gray-400 py-4 text-center">
                      Artikel auswählen um dessen Monatsverlauf zu sehen
                    </p>
                  )}
                </div>
              )}

              {/* Sektion 3: Pro Auftrag */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h2 className="text-base font-semibold text-gray-800">Pro Auftrag (Lieferung)</h2>
                  <span className="text-xs text-gray-400">{monatlichData.auftraege.length} Aufträge</span>
                </div>
                {monatlichData.auftraege.length === 0 ? (
                  <div className="py-12 text-center text-gray-400">Keine Aufträge im gewählten Zeitraum</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th
                            className="px-4 py-3 text-left font-semibold text-gray-600 cursor-pointer select-none hover:bg-gray-100"
                            onClick={() => handleAuftragSort("datum")}
                          >
                            Datum {auftragSortIcon("datum")}
                          </th>
                          <th
                            className="px-4 py-3 text-left font-semibold text-gray-600 cursor-pointer select-none hover:bg-gray-100"
                            onClick={() => handleAuftragSort("kundeName")}
                          >
                            Kunde {auftragSortIcon("kundeName")}
                          </th>
                          <th
                            className="px-4 py-3 text-right font-semibold text-gray-600 hidden sm:table-cell cursor-pointer select-none hover:bg-gray-100"
                            onClick={() => handleAuftragSort("umsatz")}
                          >
                            Umsatz {auftragSortIcon("umsatz")}
                          </th>
                          <th className="px-4 py-3 text-right font-semibold text-gray-500 hidden md:table-cell">
                            Einkauf
                          </th>
                          <th
                            className="px-4 py-3 text-right font-semibold text-gray-700 cursor-pointer select-none hover:bg-gray-100"
                            onClick={() => handleAuftragSort("deckungsbeitrag")}
                          >
                            DB {auftragSortIcon("deckungsbeitrag")}
                          </th>
                          <th
                            className="px-4 py-3 text-right font-semibold text-gray-600 cursor-pointer select-none hover:bg-gray-100"
                            onClick={() => handleAuftragSort("dbMarge")}
                          >
                            Marge {auftragSortIcon("dbMarge")}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {sortedAuftraege.map(a => (
                          <tr key={a.id} className={`hover:bg-gray-50 ${margeBgColor(a.dbMarge)}`}>
                            <td className="px-4 py-2.5 text-gray-600 tabular-nums">
                              <Link href={`/lieferungen/${a.id}`} className="hover:text-green-700">
                                {new Date(a.datum).toLocaleDateString("de-DE")}
                              </Link>
                            </td>
                            <td className="px-4 py-2.5 font-medium">
                              <Link href={`/kunden/${a.kundeId}`} className="text-green-700 hover:underline">
                                {a.kundeName}
                              </Link>
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono text-gray-600 hidden sm:table-cell">
                              {formatEuro(a.umsatz)}
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono text-gray-500 hidden md:table-cell">
                              {formatEuro(a.einkauf)}
                            </td>
                            <td className={`px-4 py-2.5 text-right font-mono font-semibold ${margeColor(a.dbMarge)}`}>
                              {formatEuro(a.deckungsbeitrag)}
                            </td>
                            <td className={`px-4 py-2.5 text-right font-semibold ${margeColor(a.dbMarge)}`}>
                              {formatPercent(a.dbMarge)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
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
