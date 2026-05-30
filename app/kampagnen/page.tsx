"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface Kampagne {
  id: number;
  name: string;
  beschreibung: string | null;
  von: string;
  bis: string;
  rabattProzent: number | null;
  aktiv: boolean;
  _count: { artikel: number };
}

function KampagneBadge({ von, bis, aktiv }: { von: string; bis: string; aktiv: boolean }) {
  const now = new Date();
  const vonDate = new Date(von);
  const bisDate = new Date(bis);

  if (!aktiv) {
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">Inaktiv</span>;
  }
  if (now > bisDate) {
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Abgelaufen</span>;
  }
  if (now < vonDate) {
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">Zukünftig</span>;
  }
  return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Aktiv</span>;
}

export default function KampagnenPage() {
  const [data, setData] = useState<Kampagne[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/kampagnen");
      if (!res.ok) { setLoading(false); return; }
      const d = await res.json();
      setData(Array.isArray(d) ? d : []);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function toggleAktiv(id: number, aktiv: boolean) {
    setTogglingId(id);
    try {
      const res = await fetch(`/api/kampagnen/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aktiv: !aktiv }),
      });
      if (res.ok) {
        setData((prev) => prev.map((k) => k.id === id ? { ...k, aktiv: !aktiv } : k));
      }
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900">Kampagnen</h1>
        <Link
          href="/kampagnen/neu"
          title="Neue Kampagne"
          className="inline-flex items-center gap-1.5 bg-green-700 text-white px-2.5 sm:px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-800 transition-colors"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          <span className="hidden sm:inline">Neue Kampagne</span>
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <p className="p-6 text-gray-400 text-sm">Lade Kampagnen…</p>
        ) : data.length === 0 ? (
          <p className="p-6 text-gray-400 text-sm">Keine Kampagnen gefunden.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                  <th className="hidden sm:table-cell text-left px-4 py-3 font-medium text-gray-600">Zeitraum</th>
                  <th className="hidden md:table-cell text-right px-4 py-3 font-medium text-gray-600">Rabatt %</th>
                  <th className="hidden md:table-cell text-right px-4 py-3 font-medium text-gray-600">Artikel</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Aktiv</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900">{item.name}</span>
                      {item.beschreibung && (
                        <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[200px]">{item.beschreibung}</p>
                      )}
                      <div className="sm:hidden text-xs text-gray-500 mt-0.5">
                        {new Date(item.von).toLocaleDateString("de-DE")} – {new Date(item.bis).toLocaleDateString("de-DE")}
                      </div>
                    </td>
                    <td className="hidden sm:table-cell px-4 py-3 text-gray-600 whitespace-nowrap">
                      {new Date(item.von).toLocaleDateString("de-DE")} – {new Date(item.bis).toLocaleDateString("de-DE")}
                    </td>
                    <td className="hidden md:table-cell px-4 py-3 text-right text-gray-700">
                      {item.rabattProzent != null ? `${item.rabattProzent}%` : "—"}
                    </td>
                    <td className="hidden md:table-cell px-4 py-3 text-right text-gray-700">
                      {item._count.artikel}
                    </td>
                    <td className="px-4 py-3">
                      <KampagneBadge von={item.von} bis={item.bis} aktiv={item.aktiv} />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleAktiv(item.id, item.aktiv)}
                        disabled={togglingId === item.id}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${item.aktiv ? "bg-green-600" : "bg-gray-300"}`}
                        aria-label={item.aktiv ? "Deaktivieren" : "Aktivieren"}
                      >
                        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${item.aktiv ? "translate-x-4" : "translate-x-0.5"}`} />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/kampagnen/${item.id}`} className="text-green-700 hover:underline text-xs font-medium">
                        Bearbeiten
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
