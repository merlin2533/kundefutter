"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Lieferant {
  id: number;
  name: string;
  ansprechpartner?: string | null;
  email?: string | null;
  telefon?: string | null;
  strasse?: string | null;
  plz?: string | null;
  ort?: string | null;
  notizen?: string | null;
  _count?: { artikelZuordnungen: number };
}

export default function LieferantenPage() {
  const router = useRouter();
  const [lieferanten, setLieferanten] = useState<Lieferant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchLieferanten = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    const res = await fetch(`/api/lieferanten?${params}`);
    const data = await res.json();
    setLieferanten(data);
    setLoading(false);
  }, [search]);

  useEffect(() => {
    const t = setTimeout(fetchLieferanten, 300);
    return () => clearTimeout(t);
  }, [fetchLieferanten]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">Lieferanten</h1>
        <Link
          href="/lieferanten/neu"
          className="bg-green-800 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors w-full sm:w-auto text-center"
        >
          + Neuer Lieferant
        </Link>
      </div>

      {/* Search */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input
          type="text"
          placeholder="Suche nach Name, Ort, Ansprechpartner…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm w-full sm:w-72 focus:outline-none focus:ring-2 focus:ring-green-700"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        {loading ? (
          <p className="p-6 text-gray-400 text-sm">Lade Lieferanten…</p>
        ) : lieferanten.length === 0 ? (
          <p className="p-6 text-gray-400 text-sm">Keine Lieferanten gefunden.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {[
                  { label: "Name", cls: "" },
                  { label: "Ansprechpartner", cls: "hidden sm:table-cell" },
                  { label: "Email", cls: "hidden md:table-cell" },
                  { label: "Telefon", cls: "hidden sm:table-cell" },
                  { label: "Ort", cls: "hidden md:table-cell" },
                  { label: "Anzahl Artikel", cls: "hidden lg:table-cell" },
                ].map((h) => (
                  <th key={h.label} className={`px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide ${h.cls}`}>
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lieferanten.map((l) => (
                <tr
                  key={l.id}
                  className="hover:bg-green-50 cursor-pointer transition-colors"
                  onClick={() => router.push(`/lieferanten/${l.id}`)}
                >
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {l.name}
                    <div className="sm:hidden text-xs text-gray-500 mt-0.5">
                      {l.ansprechpartner ? `${l.ansprechpartner} · ` : ""}{l.telefon ?? ""}{l.ort ? ` · ${l.ort}` : ""}
                    </div>
                  </td>
                  <td className="hidden sm:table-cell px-4 py-3 text-gray-600">{l.ansprechpartner ?? "—"}</td>
                  <td className="hidden md:table-cell px-4 py-3 text-gray-600">
                    {l.email ? (
                      <a
                        href={`mailto:${l.email}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-green-700 hover:underline"
                      >
                        {l.email}
                      </a>
                    ) : "—"}
                  </td>
                  <td className="hidden sm:table-cell px-4 py-3 text-gray-600">{l.telefon ?? "—"}</td>
                  <td className="hidden md:table-cell px-4 py-3 text-gray-600">
                    {[l.plz, l.ort].filter(Boolean).join(" ") || "—"}
                  </td>
                  <td className="hidden lg:table-cell px-4 py-3 text-gray-600 text-center">
                    {l._count?.artikelZuordnungen ?? "—"}
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
