"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { formatEuro, formatDatum } from "@/lib/utils";
import { GutschriftStatusBadge } from "@/components/Badge";

interface GutschriftPosition {
  menge: number;
  preis: number;
}

interface Gutschrift {
  id: number;
  nummer: string;
  datum: string;
  grund: string;
  status: string;
  notiz?: string;
  kunde: { id: number; name: string; firma?: string };
  lieferung?: { id: number } | null;
  positionen: GutschriftPosition[];
}

export default function GutschriftenPage() {
  const [gutschriften, setGutschriften] = useState<Gutschrift[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("alle");
  const [vonFilter, setVonFilter] = useState("");
  const [bisFilter, setBisFilter] = useState("");
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<number | null>(null);

  const fetchGutschriften = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter !== "alle") params.set("status", statusFilter);
    if (vonFilter) params.set("von", vonFilter);
    if (bisFilter) params.set("bis", bisFilter);
    const res = await fetch(`/api/gutschriften?${params}`);
    const data = await res.json();
    setGutschriften(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [statusFilter, vonFilter, bisFilter]);

  useEffect(() => {
    const t = setTimeout(fetchGutschriften, 300);
    return () => clearTimeout(t);
  }, [fetchGutschriften]);

  function betrag(gs: Gutschrift): number {
    return gs.positionen.reduce((sum, p) => sum + p.menge * p.preis, 0);
  }

  const filtered = gutschriften.filter((gs) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      gs.nummer.toLowerCase().includes(q) ||
      gs.kunde.name.toLowerCase().includes(q) ||
      (gs.kunde.firma ?? "").toLowerCase().includes(q) ||
      gs.grund.toLowerCase().includes(q)
    );
  });

  async function handleDelete(id: number) {
    if (!confirm("Gutschrift wirklich löschen?")) return;
    setDeleting(id);
    const res = await fetch(`/api/gutschriften/${id}`, { method: "DELETE" });
    if (res.ok) {
      setGutschriften((prev) => prev.filter((g) => g.id !== id));
    } else {
      const data = await res.json();
      alert(data.error ?? "Fehler beim Löschen");
    }
    setDeleting(null);
  }

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Gutschriften</h1>
        <Link
          href="/gutschriften/neu"
          className="px-4 py-2 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-800 transition-colors"
        >
          + Neue Gutschrift
        </Link>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="Suchen (Nummer, Kunde, Grund)…"
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
          <option value="OFFEN">Offen</option>
          <option value="VERBUCHT">Verbucht</option>
          <option value="STORNIERT">Storniert</option>
        </select>
        <input
          type="date"
          value={vonFilter}
          onChange={(e) => setVonFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
        />
        <input
          type="date"
          value={bisFilter}
          onChange={(e) => setBisFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
        />
        {(vonFilter || bisFilter || statusFilter !== "alle" || search) && (
          <button
            onClick={() => { setVonFilter(""); setBisFilter(""); setStatusFilter("alle"); setSearch(""); }}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Filter zurücksetzen
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Lade…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">Keine Gutschriften gefunden.</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Nummer</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Datum</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Kunde</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Grund</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Betrag</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((gs) => (
                <tr key={gs.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">
                    {gs.nummer}
                    <div className="sm:hidden text-xs text-gray-500 mt-0.5">
                      {formatDatum(gs.datum)} &middot; {gs.grund}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
                    {formatDatum(gs.datum)}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/kunden/${gs.kunde.id}`} className="font-medium text-gray-900 hover:text-green-700">
                      {gs.kunde.name}
                    </Link>
                    {gs.kunde.firma && (
                      <div className="text-xs text-gray-500">{gs.kunde.firma}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{gs.grund}</td>
                  <td className="px-4 py-3 text-right font-medium hidden sm:table-cell">
                    {formatEuro(betrag(gs))}
                  </td>
                  <td className="px-4 py-3">
                    <GutschriftStatusBadge status={gs.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <Link
                        href={`/gutschriften/${gs.id}`}
                        className="text-xs text-green-700 hover:underline"
                      >
                        Details
                      </Link>
                      {gs.status === "OFFEN" && (
                        <button
                          onClick={() => handleDelete(gs.id)}
                          disabled={deleting === gs.id}
                          className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                        >
                          {deleting === gs.id ? "…" : "Löschen"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <p className="mt-3 text-xs text-gray-400">{filtered.length} Gutschrift(en)</p>
      )}
    </div>
  );
}
