"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Lieferung {
  id: number;
  datum: string;
  status: string;
  notiz: string | null;
  positionenAnzahl: number;
}

function formatDatum(s: string) {
  return new Date(s).toLocaleDateString("de-DE");
}

const STATUS_STYLE: Record<string, string> = {
  geliefert: "bg-green-100 text-green-700",
  geplant: "bg-blue-100 text-blue-700",
  storniert: "bg-red-100 text-red-700",
};

export default function PortalLieferscheinePage() {
  const [lieferungen, setLieferungen] = useState<Lieferung[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/portal/lieferscheine")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setLieferungen(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/portal" className="text-sm text-gray-500 hover:text-gray-700">
          ← Zurück
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Lieferscheine</h1>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 text-center mt-8">Lade…</p>
      ) : lieferungen.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-gray-500">Keine Lieferungen vorhanden.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Datum</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden sm:table-cell">Notiz</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600 hidden sm:table-cell">Positionen</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {lieferungen.map((l) => (
                <tr key={l.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {formatDatum(l.datum)}
                    <div className="sm:hidden text-xs text-gray-400 mt-0.5">
                      {l.positionenAnzahl} Pos.{l.notiz ? ` · ${l.notiz}` : ""}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 hidden sm:table-cell truncate max-w-[200px]">
                    {l.notiz ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600 hidden sm:table-cell">
                    {l.positionenAnzahl}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block text-xs px-2 py-1 rounded-full font-medium ${STATUS_STYLE[l.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {l.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
