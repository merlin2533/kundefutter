"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface KundeKontakt {
  id: number;
  typ: string;
  wert: string;
  label?: string;
}

interface Kunde {
  id: number;
  name: string;
  firma?: string;
  kategorie: string;
  strasse?: string;
  plz?: string;
  ort?: string;
  land: string;
  lat?: number | null;
  lng?: number | null;
  notizen?: string;
  tags?: string;
  aktiv: boolean;
  kontakte: KundeKontakt[];
}

const PAGE_LIMIT = 100;

export default function KundenPage() {
  const [kunden, setKunden] = useState<Kunde[]>([]);
  const [search, setSearch] = useState("");
  const [nurAktiv, setNurAktiv] = useState(true);
  const [tagFilter, setTagFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState<number | null>(null);

  const fetchKunden = useCallback(async (currentPage: number) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (nurAktiv) params.set("aktiv", "true");
    if (tagFilter.trim()) params.set("tag", tagFilter.trim());
    params.set("page", String(currentPage));
    params.set("limit", String(PAGE_LIMIT));
    const res = await fetch(`/api/kunden?${params.toString()}`);
    const json = await res.json();
    if (currentPage === 1) {
      setKunden(json.data ?? []);
    } else {
      setKunden((prev) => [...prev, ...(json.data ?? [])]);
    }
    setTotal(json.total ?? null);
    setLoading(false);
  }, [search, nurAktiv, tagFilter]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
    setTotal(null);
  }, [search, nurAktiv, tagFilter]);

  useEffect(() => {
    const t = setTimeout(() => fetchKunden(page), 300);
    return () => clearTimeout(t);
  }, [fetchKunden, page]);

  function getKontaktInfo(kontakte: KundeKontakt[]) {
    const phone = kontakte.find((k) => k.typ === "telefon" || k.typ === "mobil");
    const email = kontakte.find((k) => k.typ === "email");
    return { phone: phone?.wert, email: email?.wert };
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Kunden</h1>
        <Link
          href="/kunden/neu"
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + Neuer Kunde
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="Suche nach Name, Firma, Ort, PLZ…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <input
          type="text"
          placeholder="Tag filtern..."
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
          <button
            onClick={() => setNurAktiv(true)}
            className={`px-4 py-2 transition-colors ${nurAktiv ? "bg-green-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
          >
            Aktiv
          </button>
          <button
            onClick={() => setNurAktiv(false)}
            className={`px-4 py-2 transition-colors border-l border-gray-300 ${!nurAktiv ? "bg-green-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
          >
            Alle
          </button>
        </div>
      </div>

      {/* Geocoding-Hinweis */}
      {!loading && (() => {
        const ohneKoord = kunden.filter((k) => k.lat == null || k.lng == null).length;
        if (ohneKoord === 0) return null;
        return (
          <div className="mb-3 text-sm text-gray-500">
            {ohneKoord} von {total ?? kunden.length} Kunden ohne Koordinaten (aktuell geladen) —{" "}
            <Link href="/einstellungen/adressen" className="text-green-700 hover:underline font-medium">
              Batch-Geocoding →
            </Link>
          </div>
        );
      })()}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <p className="p-6 text-gray-400 text-sm">Lade Kunden…</p>
        ) : kunden.length === 0 ? (
          <p className="p-6 text-gray-400 text-sm">Keine Kunden gefunden.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                  <th className="hidden sm:table-cell text-left px-4 py-3 font-medium text-gray-600">Firma</th>
                  <th className="hidden md:table-cell text-center px-2 py-3 font-medium text-gray-600" title="Geocoding-Status">Geo</th>
                  <th className="hidden md:table-cell text-left px-4 py-3 font-medium text-gray-600">Kategorie</th>
                  <th className="hidden lg:table-cell text-left px-4 py-3 font-medium text-gray-600">Ort</th>
                  <th className="hidden sm:table-cell text-left px-4 py-3 font-medium text-gray-600">Kontakte</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {kunden.map((kunde) => {
                  const { phone, email } = getKontaktInfo(kunde.kontakte);
                  return (
                    <tr key={kunde.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium">
                        {kunde.name}
                        {!kunde.aktiv && (
                          <span className="ml-2 text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">inaktiv</span>
                        )}
                        <div className="sm:hidden text-xs text-gray-500 mt-0.5">{kunde.firma}</div>
                        {(() => { try { const t: string[] = JSON.parse(kunde.tags || "[]"); return t.length > 0 ? (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {t.map((tag) => (
                              <span key={tag} className="px-1.5 py-0.5 bg-green-100 text-green-800 rounded-full text-xs font-medium">{tag}</span>
                            ))}
                          </div>
                        ) : null; } catch { return null; } })()}
                      </td>
                      <td className="hidden sm:table-cell px-4 py-3 text-gray-600">{kunde.firma ?? "—"}</td>
                      <td className="hidden md:table-cell text-center px-2 py-3">
                        {kunde.lat != null && kunde.lng != null ? (
                          <span title={`${kunde.lat.toFixed(4)}, ${kunde.lng.toFixed(4)}`} className="inline-block w-3 h-3 rounded-full bg-green-500" />
                        ) : (
                          <span title="Keine Koordinaten" className="inline-block w-3 h-3 rounded-full bg-gray-300" />
                        )}
                      </td>
                      <td className="hidden md:table-cell px-4 py-3">
                        <KategorieBadge kategorie={kunde.kategorie} />
                      </td>
                      <td className="hidden lg:table-cell px-4 py-3 text-gray-600">
                        {[kunde.plz, kunde.ort].filter(Boolean).join(" ") || "—"}
                      </td>
                      <td className="hidden sm:table-cell px-4 py-3 text-gray-600 text-xs space-y-0.5">
                        {phone && <div>📞 {phone}</div>}
                        {email && <div>📧 {email}</div>}
                        {!phone && !email && <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/kunden/${kunde.id}`}
                          className="text-green-700 hover:text-green-900 hover:underline font-medium"
                        >
                          Details →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {total !== null && kunden.length < total && (
        <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
          <span>{kunden.length} von {total} Kunden geladen</span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={loading}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700 disabled:opacity-50"
          >
            {loading ? "Lade…" : "Mehr laden"}
          </button>
        </div>
      )}
      {total !== null && kunden.length >= total && total > PAGE_LIMIT && (
        <div className="mt-4 text-sm text-gray-400 text-center">
          Alle {total} Kunden geladen.
        </div>
      )}
    </div>
  );
}

function KategorieBadge({ kategorie }: { kategorie: string }) {
  const styles: Record<string, string> = {
    Landwirt: "bg-green-100 text-green-800",
    Pferdehof: "bg-blue-100 text-blue-800",
    Kleintierhalter: "bg-orange-100 text-orange-800",
    Großhändler: "bg-purple-100 text-purple-800",
    Sonstige: "bg-gray-100 text-gray-700",
  };
  const cls = styles[kategorie] ?? "bg-gray-100 text-gray-700";
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {kategorie}
    </span>
  );
}
