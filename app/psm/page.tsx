"use client";
import { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import SearchableSelect from "@/components/SearchableSelect";

interface Kunde {
  id: number;
  name: string;
  firma: string | null;
}

interface PSMAusbringung {
  id: number;
  datum: string;
  mittel: string;
  wirkstoff: string | null;
  menge: number;
  einheit: string;
  kultur: string | null;
  flaeche: number | null;
  anwendungsgrund: string | null;
  wartezeit: number | null;
  notiz: string | null;
  kundeId: number;
  schlagId: number | null;
  kunde: { id: number; name: string; firma: string | null } | null;
  schlag: { id: number; name: string } | null;
}

function PSMListeInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [data, setData] = useState<PSMAusbringung[]>([]);
  const [loading, setLoading] = useState(true);
  const [kunden, setKunden] = useState<Kunde[]>([]);
  const [kundeId, setKundeId] = useState(searchParams.get("kundeId") ?? "");
  const [von, setVon] = useState("");
  const [bis, setBis] = useState("");
  const [deleting, setDeleting] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/kunden?limit=500")
      .then((r) => r.json())
      .then((d) => setKunden(Array.isArray(d) ? d : (d.kunden ?? [])))
      .catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (kundeId) params.set("kundeId", kundeId);
    if (von) params.set("von", von);
    if (bis) params.set("bis", bis);
    try {
      const res = await fetch(`/api/psm?${params}`);
      if (!res.ok) { setLoading(false); return; }
      const d = await res.json();
      setData(Array.isArray(d) ? d : []);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [kundeId, von, bis]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleDelete(id: number, mittel: string) {
    if (!confirm(`PSM-Ausbringung "${mittel}" löschen?`)) return;
    setDeleting(id);
    try {
      await fetch(`/api/psm/${id}`, { method: "DELETE" });
      setData((prev) => prev.filter((d) => d.id !== id));
    } finally { setDeleting(null); }
  }

  const kundenOptions = kunden.map((k) => ({
    value: k.id,
    label: k.firma ?? k.name,
    sub: k.firma ? k.name : undefined,
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900">PSM-Ausbringungen</h1>
        <Link
          href="/psm/neu"
          title="Neue Ausbringung"
          className="inline-flex items-center gap-1.5 bg-green-700 text-white px-2.5 sm:px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-800 transition-colors"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          <span className="hidden sm:inline">Neue Ausbringung</span>
        </Link>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="w-full sm:w-64">
          <SearchableSelect
            options={kundenOptions}
            value={kundeId}
            onChange={setKundeId}
            placeholder="Alle Kunden"
            allowClear
          />
        </div>
        <input
          type="date"
          value={von}
          onChange={(e) => setVon(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          title="Von"
        />
        <input
          type="date"
          value={bis}
          onChange={(e) => setBis(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          title="Bis"
        />
        {(kundeId || von || bis) && (
          <button
            onClick={() => { setKundeId(""); setVon(""); setBis(""); }}
            className="text-sm text-gray-500 hover:text-gray-700 border border-gray-300 px-3 py-2 rounded-lg"
          >
            Filter zurücksetzen
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <p className="p-6 text-gray-400 text-sm">Lade PSM-Ausbringungen…</p>
        ) : data.length === 0 ? (
          <p className="p-6 text-gray-400 text-sm">Keine Ausbringungen gefunden.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Datum</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Kunde</th>
                  <th className="hidden sm:table-cell text-left px-4 py-3 font-medium text-gray-600">Schlag</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Mittel</th>
                  <th className="hidden sm:table-cell text-left px-4 py-3 font-medium text-gray-600">Menge</th>
                  <th className="hidden md:table-cell text-left px-4 py-3 font-medium text-gray-600">Kultur</th>
                  <th className="hidden lg:table-cell text-left px-4 py-3 font-medium text-gray-600">Fläche (ha)</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {new Date(item.datum).toLocaleDateString("de-DE")}
                      {/* Mobile info */}
                      <div className="sm:hidden text-xs text-gray-500 mt-0.5">
                        {item.menge} {item.einheit}
                        {item.flaeche != null && ` · ${item.flaeche} ha`}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {item.kunde ? (
                        <Link href={`/kunden/${item.kunde.id}`} className="text-green-700 hover:underline">
                          {item.kunde.firma ?? item.kunde.name}
                        </Link>
                      ) : "—"}
                    </td>
                    <td className="hidden sm:table-cell px-4 py-3 text-gray-600">
                      {item.schlag?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800">{item.mittel}</td>
                    <td className="hidden sm:table-cell px-4 py-3 text-gray-600">
                      {item.menge} {item.einheit}
                    </td>
                    <td className="hidden md:table-cell px-4 py-3 text-gray-600">{item.kultur ?? "—"}</td>
                    <td className="hidden lg:table-cell px-4 py-3 text-gray-600">
                      {item.flaeche != null ? item.flaeche : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link href={`/psm/${item.id}`} className="text-green-700 hover:underline text-xs font-medium">
                          Bearbeiten
                        </Link>
                        <button
                          onClick={() => handleDelete(item.id, item.mittel)}
                          disabled={deleting === item.id}
                          className="text-red-500 hover:text-red-700 text-xs disabled:opacity-40 p-1"
                          title="Löschen"
                        >
                          {deleting === item.id ? "…" : "✕"}
                        </button>
                      </div>
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

export default function PSMPage() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-400">Lade…</div>}>
      <PSMListeInner />
    </Suspense>
  );
}
