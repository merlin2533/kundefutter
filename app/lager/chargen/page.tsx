"use client";
import { useState } from "react";
import Link from "next/link";

interface ChargeWareneingang {
  id: number;
  datum: string;
  artikel: { name: string; einheit: string };
  menge: number;
  lieferant?: { name: string };
  chargeNr: string;
}

interface ChargeLieferung {
  lieferpositionId: number;
  chargeNr: string;
  datum: string;
  lieferungId: number;
  status: string;
  kunde: { id: number; name: string; firma?: string | null };
  artikel: { id: number; name: string; einheit: string };
  menge: number;
}

interface ChargenResult {
  wareneingaenge: ChargeWareneingang[];
  lieferungen: ChargeLieferung[];
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    geplant: "bg-yellow-100 text-yellow-800",
    geliefert: "bg-green-100 text-green-800",
    storniert: "bg-red-100 text-red-700",
    offen: "bg-yellow-100 text-yellow-800",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status.toLowerCase()] ?? "bg-gray-100 text-gray-700"}`}>
      {status}
    </span>
  );
}

export default function ChargenPage() {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<ChargenResult | null>(null);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setError("");
    setResult(null);
    setSearched(true);
    try {
      const res = await fetch(`/api/lager/chargen?charge=${encodeURIComponent(q)}`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Fehler bei der Suche");
        return;
      }
      const data: ChargenResult = await res.json();
      setResult(data);
    } catch {
      setError("Netzwerkfehler");
    } finally {
      setSearching(false);
    }
  }

  const totalFound = (result?.wareneingaenge.length ?? 0) + (result?.lieferungen.length ?? 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Chargenrückverfolgung</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Suche nach Chargen-/Losnummern in Wareneingängen und Lieferungen.
          </p>
        </div>
        <Link
          href="/lager"
          className="text-sm text-gray-500 hover:text-gray-700 border border-gray-300 px-3 py-2 rounded-lg bg-white hover:bg-gray-50 transition-colors"
        >
          ← Zurück zum Lager
        </Link>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-3 items-end flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">Chargenummer</label>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="z.B. CH-2024-001…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
            autoFocus
          />
        </div>
        <button
          type="submit"
          disabled={searching || !query.trim()}
          className="px-5 py-2 text-sm bg-green-800 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          {searching ? "Suche…" : "Suchen"}
        </button>
      </form>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>
      )}

      {searched && result && (
        <div className="space-y-6">
          {totalFound === 0 ? (
            <div className="text-center py-12 text-gray-400 border border-dashed border-gray-200 rounded-xl">
              <p className="text-3xl mb-3">🔍</p>
              <p className="text-sm">Keine Einträge mit Charge „{query}" gefunden.</p>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <p className="text-sm text-gray-600 font-medium">{totalFound} Treffer für „{query}"</p>
              {result.lieferungen.length >= 500 && (
                <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                  Anzeige auf 500 Lieferungen begrenzt — Suchbegriff präzisieren
                </span>
              )}
            </div>
          )}

          {/* Wareneingänge */}
          <div>
            <h2 className="text-base font-semibold text-gray-800 mb-3">
              Wareneingänge
              <span className="ml-2 text-sm font-normal text-gray-400">({result.wareneingaenge.length})</span>
            </h2>
            {result.wareneingaenge.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Keine Wareneingänge mit dieser Charge gefunden.</p>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Datum</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Artikel</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Menge</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Lieferant</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {result.wareneingaenge.map((w) => (
                      <tr key={w.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 whitespace-nowrap">{new Date(w.datum).toLocaleDateString("de-DE")}</td>
                        <td className="px-4 py-2.5 font-medium">
                          {w.artikel.name}
                          <div className="sm:hidden text-xs text-gray-500 mt-0.5">
                            {w.menge} {w.artikel.einheit} · {w.lieferant?.name ?? "—"}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 font-mono hidden sm:table-cell">{w.menge} {w.artikel.einheit}</td>
                        <td className="px-4 py-2.5 text-gray-600 hidden sm:table-cell">{w.lieferant?.name ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Lieferungen */}
          <div>
            <h2 className="text-base font-semibold text-gray-800 mb-3">
              Lieferungen
              <span className="ml-2 text-sm font-normal text-gray-400">({result.lieferungen.length})</span>
            </h2>
            {result.lieferungen.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Keine Lieferungen mit dieser Charge gefunden.</p>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Datum</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Kunde</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Artikel</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Menge</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {result.lieferungen.map((l) => (
                      <tr key={l.lieferpositionId} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 whitespace-nowrap hidden sm:table-cell">{new Date(l.datum).toLocaleDateString("de-DE")}</td>
                        <td className="px-4 py-2.5">
                          <Link href={`/kunden/${l.kunde.id}`} className="font-medium text-green-700 hover:underline">
                            {l.kunde.firma ? `${l.kunde.firma} (${l.kunde.name})` : l.kunde.name}
                          </Link>
                          <div className="sm:hidden text-xs text-gray-500 mt-0.5">
                            {new Date(l.datum).toLocaleDateString("de-DE")} · {l.menge} {l.artikel.einheit}
                          </div>
                          <div className="md:hidden sm:hidden text-xs text-gray-400">{l.artikel.name}</div>
                        </td>
                        <td className="px-4 py-2.5 font-medium hidden md:table-cell">{l.artikel.name}</td>
                        <td className="px-4 py-2.5 font-mono whitespace-nowrap hidden sm:table-cell">{l.menge} {l.artikel.einheit}</td>
                        <td className="px-4 py-2.5">{statusBadge(l.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
