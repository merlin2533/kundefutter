"use client";

import { useEffect, useState, useCallback } from "react";

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

function fmt(n: number) {
  return n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

function fmtPct(n: number) {
  return n.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " %";
}

function margeColor(pct: number) {
  if (pct >= 20) return "text-green-700";
  if (pct >= 10) return "text-yellow-700";
  return "text-red-600";
}

function margeBarColor(pct: number) {
  if (pct >= 20) return "bg-green-500";
  if (pct >= 10) return "bg-yellow-400";
  return "bg-red-400";
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

  const load = useCallback((t: string, v: string, b: string) => {
    setLoading(true);
    fetch(`/api/analyse/deckungsbeitrag?typ=${t}&von=${v}&bis=${b}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => { setError("Fehler beim Laden der Daten"); setLoading(false); });
  }, []);

  useEffect(() => {
    load(typ, von, bis);
  }, [typ, von, bis, load]);

  const maxDB = data ? Math.max(1, ...data.items.map((i) => i.deckungsbeitrag)) : 1;

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-6 print:px-0 print:py-0">
      <div className="flex items-center justify-between mb-6 print:mb-3">
        <h1 className="text-2xl font-bold text-gray-800">Deckungsbeitrag-Analyse</h1>
        <button
          onClick={() => window.print()}
          className="print:hidden px-4 py-2 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 transition-colors"
        >
          Drucken
        </button>
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
        <div className="flex items-center gap-2 text-sm">
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
          <span className="text-gray-500">Marge &gt; 20 %</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-yellow-400" />
          <span className="text-gray-500">Marge 10–20 %</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-red-400" />
          <span className="text-gray-500">Marge &lt; 10 %</span>
        </span>
      </div>

      {loading && <div className="py-16 text-center text-gray-500">Lade Daten…</div>}
      {error && <div className="py-8 text-red-600">{error}</div>}

      {data && !loading && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {data.items.length === 0 ? (
            <div className="py-12 text-center text-gray-400">Keine Daten für den gewählten Zeitraum</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 w-10">Rang</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Name</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">Umsatz</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">Einkauf</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">Deckungsbeitrag</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">DB-Marge %</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 w-32 print:hidden">Anteil</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item, i) => (
                  <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-400">{i + 1}</td>
                    <td className="px-4 py-2.5 font-medium text-gray-800">{item.name}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-gray-600">{fmt(item.umsatz)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-gray-500">{fmt(item.einkauf)}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold text-gray-800">
                      {fmt(item.deckungsbeitrag)}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-semibold ${margeColor(item.dbMarge)}`}>
                      {fmtPct(item.dbMarge)}
                    </td>
                    <td className="px-4 py-2.5 print:hidden">
                      <div className="w-full bg-gray-100 rounded-full h-2.5">
                        <div
                          className={`h-2.5 rounded-full transition-all ${margeBarColor(item.dbMarge)}`}
                          style={{
                            width: `${Math.max(2, Math.round((item.deckungsbeitrag / maxDB) * 100))}%`,
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
