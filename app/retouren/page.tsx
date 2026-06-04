"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { formatEuro, formatDatum } from "@/lib/utils";

interface RetourePosition {
  menge: number;
  einkaufspreis: number;
}

interface Retoure {
  id: number;
  nummer: string;
  datum: string;
  grund: string;
  status: string;
  notiz?: string | null;
  gutschriftBetrag?: number | null;
  lieferant: { id: number; name: string };
  eingangsRechnung?: { id: number; nummer: string | null } | null;
  positionen: RetourePosition[];
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    GEBUCHT: "bg-green-100 text-green-800",
    STORNIERT: "bg-red-100 text-red-700",
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${map[status] ?? "bg-gray-100 text-gray-700"}`}>
      {status === "GEBUCHT" ? "Gebucht" : status === "STORNIERT" ? "Storniert" : status}
    </span>
  );
}

export default function RetourenPage() {
  const [retouren, setRetouren] = useState<Retoure[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("alle");
  const [search, setSearch] = useState<string>("");

  const fetchRetouren = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "alle") params.set("status", statusFilter);
      const res = await fetch(`/api/retouren?${params}`);
      if (!res.ok) throw new Error(`Fehler ${res.status}`);
      const data = await res.json();
      setRetouren(Array.isArray(data) ? data : []);
    } catch {
      setRetouren([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    const t = setTimeout(fetchRetouren, 200);
    return () => clearTimeout(t);
  }, [fetchRetouren]);

  function betrag(r: Retoure): number {
    if (typeof r.gutschriftBetrag === "number") return r.gutschriftBetrag;
    return r.positionen.reduce((sum, p) => sum + p.menge * p.einkaufspreis, 0);
  }

  const filtered = retouren.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.nummer.toLowerCase().includes(q) ||
      r.lieferant.name.toLowerCase().includes(q) ||
      r.grund.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-screen-xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
        <h1 className="text-2xl font-bold text-gray-900">Retouren</h1>
        <Link
          href="/retouren/neu"
          title="Neue Retoure"
          className="inline-flex items-center gap-1.5 px-2.5 sm:px-4 py-2 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-800 transition-colors"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          <span className="hidden sm:inline">Neue Retoure</span>
        </Link>
      </div>
      <p className="text-sm text-gray-500 mb-6">Warenrückgaben an Lieferanten (z. B. Restmengen Kommissionsware nach der Saison).</p>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="Suchen (Nummer, Lieferant, Grund)…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-72 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
        >
          <option value="alle">Alle Status</option>
          <option value="GEBUCHT">Gebucht</option>
          <option value="STORNIERT">Storniert</option>
        </select>
        {(statusFilter !== "alle" || search) && (
          <button
            onClick={() => { setStatusFilter("alle"); setSearch(""); }}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Filter zurücksetzen
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Lade…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">Keine Retouren gefunden.</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Nummer</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Datum</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Lieferant</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Grund</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Gutschrift</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">
                    {r.nummer}
                    <div className="sm:hidden text-xs text-gray-500 mt-0.5">
                      {formatDatum(r.datum)} &middot; {r.grund}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{formatDatum(r.datum)}</td>
                  <td className="px-4 py-3">
                    <Link href={`/lieferanten/${r.lieferant.id}`} className="font-medium text-gray-900 hover:text-green-700">
                      {r.lieferant.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{r.grund}</td>
                  <td className="px-4 py-3 text-right font-medium hidden sm:table-cell">{formatEuro(betrag(r))}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/retouren/${r.id}`} className="text-xs text-green-700 hover:underline">Details</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <p className="mt-3 text-xs text-gray-400">{filtered.length} Retoure(n)</p>
      )}
    </div>
  );
}
