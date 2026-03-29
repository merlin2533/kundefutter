"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatEuro, formatDatum } from "@/lib/utils";

interface AngebotListItem {
  id: number;
  nummer: string;
  datum: string;
  gueltigBis: string | null;
  status: string;
  notiz: string | null;
  gesamtbetrag: number;
  positionenAnzahl: number;
  kunde: { id: number; name: string; firma: string | null };
}

const STATUS_LABELS: Record<string, string> = {
  OFFEN: "Offen",
  ANGENOMMEN: "Angenommen",
  ABGELEHNT: "Abgelehnt",
  ABGELAUFEN: "Abgelaufen",
};

const STATUS_FARBEN: Record<string, string> = {
  OFFEN: "bg-yellow-100 text-yellow-800",
  ANGENOMMEN: "bg-green-100 text-green-800",
  ABGELEHNT: "bg-red-100 text-red-800",
  ABGELAUFEN: "bg-gray-100 text-gray-600",
};

export default function AngebotePage() {
  const [angebote, setAngebote] = useState<AngebotListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("alle");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter !== "alle") params.set("status", statusFilter);
    if (search) params.set("search", search);
    fetch(`/api/angebote?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => { setAngebote(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [statusFilter, search]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput);
  }

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Angebote</h1>
          <p className="text-sm text-gray-500 mt-0.5">{angebote.length} Angebote gefunden</p>
        </div>
        <Link
          href="/angebote/neu"
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-800 transition-colors"
        >
          + Neues Angebot
        </Link>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        {/* Status filter */}
        <div className="flex gap-1 flex-wrap">
          {["alle", "OFFEN", "ANGENOMMEN", "ABGELEHNT", "ABGELAUFEN"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                statusFilter === s
                  ? "bg-green-700 text-white border-green-700"
                  : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
              }`}
            >
              {s === "alle" ? "Alle" : STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-2 ml-auto">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Suchen (Nummer, Kunde)…"
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 w-56"
          />
          <button
            type="submit"
            className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition-colors border border-gray-300"
          >
            Suchen
          </button>
          {search && (
            <button
              type="button"
              onClick={() => { setSearch(""); setSearchInput(""); }}
              className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          )}
        </form>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Lade…</div>
      ) : angebote.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-gray-200 rounded-xl text-gray-400">
          <p className="text-3xl mb-2">📋</p>
          <p className="text-sm">Keine Angebote gefunden.</p>
          <Link href="/angebote/neu" className="mt-3 inline-block text-green-700 text-sm hover:underline">
            Erstes Angebot erstellen
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nummer</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Datum</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Gültig bis</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Kunde</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Positionen</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Gesamtbetrag</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {angebote.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-gray-900">{a.nummer}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDatum(a.datum)}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {a.gueltigBis ? (
                        <span className={new Date(a.gueltigBis) < new Date() && a.status === "OFFEN" ? "text-red-600 font-medium" : ""}>
                          {formatDatum(a.gueltigBis)}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/kunden/${a.kunde.id}`} className="text-green-700 hover:underline font-medium">
                        {a.kunde.name}
                      </Link>
                      {a.kunde.firma && <span className="text-gray-400 text-xs ml-1">{a.kunde.firma}</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">{a.positionenAnzahl}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{formatEuro(a.gesamtbetrag)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_FARBEN[a.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {STATUS_LABELS[a.status] ?? a.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/angebote/${a.id}`}
                        className="text-xs text-green-700 hover:underline font-medium"
                      >
                        Details →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
