"use client";

import { useEffect, useState, useCallback } from "react";
import { formatEuro, formatPercent } from "@/lib/utils";
import Link from "next/link";

interface DBItem {
  id: number;
  name: string;
  umsatz: number;
  einkauf: number;
  deckungsbeitrag: number;
  dbMarge: number;
}

interface DBData {
  typ: "artikel" | "kunde";
  von: string;
  bis: string;
  items: DBItem[];
}

type SortField = "name" | "umsatz" | "einkauf" | "deckungsbeitrag" | "dbMarge";
type SortDir = "asc" | "desc";

function margeColor(pct: number) {
  if (pct >= 30) return "text-green-700";
  if (pct >= 15) return "text-yellow-700";
  return "text-red-600";
}

function margeBgColor(pct: number) {
  if (pct >= 30) return "bg-green-50";
  if (pct >= 15) return "bg-yellow-50";
  return "bg-red-50";
}

function margeBarColor(pct: number) {
  if (pct >= 30) return "bg-green-500";
  if (pct >= 15) return "bg-yellow-400";
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

export default function DeckungsbeitragPage() {
  const heute = new Date();
  const jahresStart = `${heute.getFullYear()}-01-01`;
  const heute_str = heute.toISOString().slice(0, 10);

  const [typ, setTyp] = useState<"artikel" | "kunde">("artikel");
  const [von, setVon] = useState(jahresStart);
  const [bis, setBis] = useState(heute_str);
  const [data, setData] = useState<DBData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("deckungsbeitrag");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const load = useCallback((t: string, v: string, b: string) => {
    setLoading(true);
    setError(null);
    fetch(`/api/analyse/deckungsbeitrag?gruppierung=${t}&von=${v}&bis=${b}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => { setError("Fehler beim Laden der Daten"); setLoading(false); });
  }, []);

  useEffect(() => {
    load(typ, von, bis);
  }, [typ, von, bis, load]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
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

  // Summary stats
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

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-6 print:px-0 print:py-0">
      <div className="flex items-center justify-between mb-6 print:mb-3">
        <h1 className="text-2xl font-bold text-gray-800">Deckungsbeitrag-Analyse</h1>
        <div className="flex items-center gap-2 print:hidden">
          {data && data.items.length > 0 && (
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
      <div className="flex flex-wrap items-center gap-4 mb-6 print:hidden">
        {/* Toggle */}
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

        {/* Date range */}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label className="text-gray-600 font-medium">Von:</label>
          <input
            type="date"
            value={von}
            onChange={(e) => setVon(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1 text-sm"
          />
          <label className="text-gray-600 font-medium">Bis:</label>
          <input
            type="date"
            value={bis}
            onChange={(e) => setBis(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1 text-sm"
          />
        </div>
      </div>

      {/* Color legend */}
      <div className="flex items-center gap-4 mb-4 text-xs print:hidden">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-green-500" />
          <span className="text-gray-500">DB-Marge &gt; 30 %</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-yellow-400" />
          <span className="text-gray-500">Marge 15–30 %</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-red-400" />
          <span className="text-gray-500">Marge &lt; 15 %</span>
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
          {/* Summary KPI row */}
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
                <div className={`text-lg font-bold font-mono ${margeColor(totalMarge)}`}>{formatEuro(totalDB)}</div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <div className="text-xs text-gray-500 font-medium mb-1">Ø DB-Marge</div>
                <div className={`text-lg font-bold ${margeColor(totalMarge)}`}>{formatPercent(totalMarge)}</div>
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
                    {thSort("umsatz", "Umsatz")}
                    {thSort("einkauf", "Einkauf")}
                    {thSort("deckungsbeitrag", "Deckungsbeitrag")}
                    {thSort("dbMarge", "DB-Marge %")}
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 w-32 print:hidden">Anteil</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedItems.map((item, i) => (
                    <tr key={item.id} className={`border-b border-gray-100 hover:bg-gray-50 ${margeBgColor(item.dbMarge)}`}>
                      <td className="px-4 py-2.5 text-gray-400">{i + 1}</td>
                      <td className="px-4 py-2.5 font-medium text-gray-800">
                        {typ === "kunde" ? (
                          <Link href={`/kunden/${item.id}`} className="text-green-700 hover:underline">
                            {item.name}
                          </Link>
                        ) : (
                          item.name
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-gray-600">{formatEuro(item.umsatz)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-gray-500">{formatEuro(item.einkauf)}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold text-gray-800">
                        {formatEuro(item.deckungsbeitrag)}
                      </td>
                      <td className={`px-4 py-2.5 text-right font-semibold ${margeColor(item.dbMarge)}`}>
                        {formatPercent(item.dbMarge)}
                      </td>
                      <td className="px-4 py-2.5 print:hidden">
                        <div className="w-full bg-gray-100 rounded-full h-2.5">
                          <div
                            className={`h-2.5 rounded-full transition-all ${margeBarColor(item.dbMarge)}`}
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
