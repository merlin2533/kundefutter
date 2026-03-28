"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface Mengenrabatt {
  id: number;
  kundeId: number | null;
  artikelId: number | null;
  kategorie: string | null;
  vonMenge: number;
  rabattProzent: number;
  aktiv: boolean;
  artikel: { id: number; name: string; artikelnummer: string; kategorie: string } | null;
  kunde: { id: number; name: string; firma?: string } | null;
}

export default function MengenrabattePage() {
  const [rabatte, setRabatte] = useState<Mengenrabatt[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);

  const fetchRabatte = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/mengenrabatte");
    const data = await res.json();
    setRabatte(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchRabatte(); }, [fetchRabatte]);

  async function handleDelete(id: number) {
    setDeleting(id);
    try {
      await fetch(`/api/mengenrabatte?id=${id}`, { method: "DELETE" });
      await fetchRabatte();
    } finally {
      setDeleting(null);
    }
  }

  function beschreibung(r: Mengenrabatt): string {
    if (r.artikel) return `${r.artikel.name} (${r.artikel.artikelnummer})`;
    if (r.kategorie) return `Kategorie: ${r.kategorie}`;
    return "—";
  }

  function kundeLabel(r: Mengenrabatt): string {
    if (!r.kunde) return "Alle Kunden";
    return r.kunde.firma ? `${r.kunde.firma} (${r.kunde.name})` : r.kunde.name;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Mengenrabatte</h1>
        <Link
          href="/mengenrabatte/neu"
          className="bg-green-800 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + Rabatt hinzufügen
        </Link>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto shadow-sm">
        {loading ? (
          <p className="p-6 text-gray-400 text-sm">Lade Mengenrabatte…</p>
        ) : rabatte.length === 0 ? (
          <p className="p-6 text-gray-400 text-sm">Keine Mengenrabatte erfasst.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Artikel / Kategorie", "Kunde", "Ab Menge", "Rabatt %", "Status", ""].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rabatte.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-green-50 transition-colors">
                  <td className="px-4 py-3 font-medium">{beschreibung(r)}</td>
                  <td className="px-4 py-3 text-gray-600">{kundeLabel(r)}</td>
                  <td className="px-4 py-3 font-mono">{r.vonMenge}</td>
                  <td className="px-4 py-3 font-mono font-semibold text-green-700">{r.rabattProzent}%</td>
                  <td className="px-4 py-3">
                    {r.aktiv ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Aktiv</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Inaktiv</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(r.id)}
                      disabled={deleting === r.id}
                      className="text-red-500 hover:text-red-700 text-xs font-medium disabled:opacity-50"
                    >
                      {deleting === r.id ? "…" : "Löschen"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
