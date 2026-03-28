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
          className="bg-green-800 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + Neuer Lieferant
        </Link>
      </div>

      {/* Search */}
      <div className="mb-5">
        <input
          type="text"
          placeholder="Suche nach Name, Ort, Ansprechpartner…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-80 focus:outline-none focus:ring-2 focus:ring-green-700"
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
                {["Name", "Ansprechpartner", "Email", "Telefon", "Ort", "Anzahl Artikel"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {h}
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
                  <td className="px-4 py-3 font-medium text-gray-900">{l.name}</td>
                  <td className="px-4 py-3 text-gray-600">{l.ansprechpartner ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-600">
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
                  <td className="px-4 py-3 text-gray-600">{l.telefon ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {[l.plz, l.ort].filter(Boolean).join(" ") || "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-center">
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
