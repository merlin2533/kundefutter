"use client";
import { useEffect, useState } from "react";

interface MhdPosition {
  id: number;
  mhd: string;
  menge: number;
  chargeNr: string | null;
  artikel: { id: number; name: string; einheit: string };
  wareneingang: { datum: string };
}

function mhdStatus(mhd: string): "abgelaufen" | "bald" | "ok" {
  const diff = Math.ceil((new Date(mhd).getTime() - Date.now()) / 86400000);
  if (diff < 0) return "abgelaufen";
  if (diff <= 30) return "bald";
  return "ok";
}

const STATUS_STYLE = {
  abgelaufen: "bg-red-50 text-red-700 border-red-200",
  bald: "bg-amber-50 text-amber-700 border-amber-200",
  ok: "bg-green-50 text-green-700 border-green-200",
};

const STATUS_LABEL = {
  abgelaufen: "Abgelaufen",
  bald: "< 30 Tage",
  ok: "OK",
};

export default function MhdPage() {
  const [positionen, setPositionen] = useState<MhdPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"alle" | "abgelaufen" | "bald">("alle");

  useEffect(() => {
    fetch("/api/lager/mhd")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => {
        setPositionen(Array.isArray(d) ? d : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const gefiltert = positionen.filter((p) => {
    if (filter === "alle") return true;
    return mhdStatus(p.mhd) === filter;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900">MHD-Übersicht</h1>
        <div className="flex gap-2 flex-wrap">
          {(["alle", "abgelaufen", "bald"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-sm rounded-lg border font-medium transition-colors ${
                filter === f
                  ? "bg-green-700 text-white border-green-700"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
            >
              {f === "alle" ? "Alle" : f === "abgelaufen" ? "Abgelaufen" : "Bald fällig (< 30 Tage)"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Lade…</div>
      ) : gefiltert.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <p className="text-lg font-semibold text-gray-600 mb-1">Keine Einträge</p>
          <p className="text-sm text-gray-400">Keine Positionen mit MHD gefunden.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Artikel</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden sm:table-cell">Charge</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">MHD</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">Menge</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {gefiltert.map((p) => {
                const status = mhdStatus(p.mhd);
                const diffTage = Math.ceil((new Date(p.mhd).getTime() - Date.now()) / 86400000);
                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {p.artikel.name}
                      <div className="sm:hidden text-xs text-gray-400 mt-0.5">{p.chargeNr ?? "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden sm:table-cell font-mono text-xs">
                      {p.chargeNr ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {new Date(p.mhd).toLocaleDateString("de-DE")}
                      <div className="text-xs text-gray-400 mt-0.5">
                        {diffTage < 0 ? `vor ${Math.abs(diffTage)} Tagen` : `in ${diffTage} Tagen`}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700 hidden md:table-cell">
                      {p.menge} {p.artikel.einheit}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-xs font-medium px-2 py-1 rounded-full border ${STATUS_STYLE[status]}`}>
                        {STATUS_LABEL[status]}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-700">
        <strong>Hinweis:</strong> MHD wird beim Wareneingang je Position erfasst. Rot = abgelaufen,
        Amber = weniger als 30 Tage bis Ablauf, Grün = länger haltbar.
      </div>
    </div>
  );
}
