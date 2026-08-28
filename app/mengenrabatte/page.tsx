"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";

interface Mengenrabatt {
  id: number;
  kundeId: number | null;
  artikelId: number | null;
  kategorie: string | null;
  vonMenge: number;
  preis: number | null;
  rabattProzent: number;
  aktiv: boolean;
  artikel: { id: number; name: string; artikelnummer: string; kategorie: string } | null;
  kunde: { id: number; name: string; firma?: string } | null;
}

function formatEuro(n: number): string {
  return n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

/** Legacy-Einträge (vor der Umstellung auf absolute Staffelpreise) haben weiterhin nur
 *  rabattProzent — die Liste zeigt sie unterscheidbar als "X % Rabatt" statt eines Preises. */
function preisLabel(r: Mengenrabatt): string {
  return r.preis !== null ? formatEuro(r.preis) : `${r.rabattProzent} % Rabatt`;
}

export default function MengenrabattePage() {
  const [rabatte, setRabatte] = useState<Mengenrabatt[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);

  const fetchRabatte = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/mengenrabatte");
      if (!res.ok) {
        setRabatte([]);
        return;
      }
      const data = await res.json();
      setRabatte(Array.isArray(data) ? data : []);
    } catch (err) {
      Sentry.captureException(err);
      setRabatte([]);
    } finally {
      setLoading(false);
    }
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
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">Mengenstaffeln</h1>
        <Link
          href="/mengenrabatte/neu"
          className="w-full sm:w-auto text-center bg-green-800 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + Staffelpreis hinzufügen
        </Link>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto shadow-sm">
        {loading ? (
          <p className="p-6 text-gray-400 text-sm">Lade Mengenstaffeln…</p>
        ) : rabatte.length === 0 ? (
          <p className="p-6 text-gray-400 text-sm">Keine Mengenstaffeln erfasst.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Artikel / Kategorie</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap hidden sm:table-cell">Kunde</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap hidden md:table-cell">Ab Menge</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Preis</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap hidden sm:table-cell">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"></th>
              </tr>
            </thead>
            <tbody>
              {rabatte.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-green-50 transition-colors">
                  <td className="px-4 py-3 font-medium">
                    {beschreibung(r)}
                    <div className="sm:hidden text-xs text-gray-500 mt-0.5">
                      {kundeLabel(r)} · ab {r.vonMenge}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{kundeLabel(r)}</td>
                  <td className="px-4 py-3 font-mono hidden md:table-cell">{r.vonMenge}</td>
                  <td className="px-4 py-3 font-mono font-semibold text-green-700">{preisLabel(r)}</td>
                  <td className="px-4 py-3 hidden sm:table-cell">
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
