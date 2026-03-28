"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LagerBadge } from "@/components/Badge";
import { formatEuro, lagerStatus } from "@/lib/utils";

interface ArtikelLieferant {
  id: number;
  lieferantId: number;
  bevorzugt: boolean;
  einkaufspreis: number;
  lieferant: { id: number; name: string };
}

interface Artikel {
  id: number;
  artikelnummer: string;
  name: string;
  kategorie: string;
  einheit: string;
  standardpreis: number;
  aktuellerBestand: number;
  mindestbestand: number;
  beschreibung?: string | null;
  aktiv: boolean;
  lagerort?: string | null;
  lieferanten: ArtikelLieferant[];
}

const KATEGORIEN = ["Futter", "Duenger", "Saatgut"];

export default function ArtikelPage() {
  const router = useRouter();
  const [artikel, setArtikel] = useState<Artikel[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [kategorie, setKategorie] = useState("alle");

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (kategorie !== "alle") params.set("kategorie", kategorie);
    const res = await fetch(`/api/artikel?${params}`);
    const data = await res.json();
    setArtikel(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, kategorie]);

  function bevorzugterLieferant(a: Artikel): string {
    const bev = a.lieferanten.find((l) => l.bevorzugt) ?? a.lieferanten[0];
    return bev?.lieferant.name ?? "–";
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">Artikel</h1>
        <Link
          href="/artikel/neu"
          className="bg-green-800 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + Neuer Artikel
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input
          type="text"
          placeholder="Suche nach Name oder Artikelnr…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-[200px] focus:outline-none focus:ring-2 focus:ring-green-700"
        />
        <div className="flex gap-1">
          {["alle", ...KATEGORIEN].map((k) => (
            <button
              key={k}
              onClick={() => setKategorie(k)}
              className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                kategorie === k
                  ? "bg-green-800 text-white border-green-800"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
            >
              {k === "alle" ? "Alle" : k === "Duenger" ? "Dünger" : k}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto shadow-sm">
        {loading ? (
          <p className="p-6 text-gray-400 text-sm">Lade…</p>
        ) : artikel.length === 0 ? (
          <p className="p-6 text-gray-400 text-sm">Keine Artikel gefunden.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Artikelnr.", "Name", "Kategorie", "Einheit", "Standardpreis", "Bestand", "Ampel", "Lagerort", "Lieferant"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {artikel.map((a) => {
                const status = lagerStatus(a.aktuellerBestand, a.mindestbestand);
                return (
                  <tr
                    key={a.id}
                    className="border-b last:border-0 hover:bg-green-50 cursor-pointer transition-colors"
                    onClick={() => router.push(`/artikel/${a.id}`)}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{a.artikelnummer}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{a.name}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {a.kategorie === "Duenger" ? "Dünger" : a.kategorie}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{a.einheit}</td>
                    <td className="px-4 py-3 font-mono">{formatEuro(a.standardpreis)}</td>
                    <td className="px-4 py-3 font-mono">
                      {a.aktuellerBestand} {a.einheit}
                    </td>
                    <td className="px-4 py-3">
                      <LagerBadge status={status} />
                    </td>
                    <td className="px-4 py-3">
                      {a.lagerort ? (
                        <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-700 border border-gray-200 rounded text-xs font-medium">
                          {a.lagerort}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{bevorzugterLieferant(a)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
