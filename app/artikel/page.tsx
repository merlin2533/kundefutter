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
        <span className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">Artikel</h1>
          <Link href="/hilfe#artikel" title="Hilfe: Artikel & Lager" className="text-gray-400 hover:text-green-700 transition-colors" tabIndex={-1}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </Link>
        </span>
        <Link
          href="/artikel/neu"
          className="bg-green-800 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors w-full sm:w-auto text-center"
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
          className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm w-full sm:w-72 focus:outline-none focus:ring-2 focus:ring-green-700"
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
                {[
                  { label: "Artikelnr.", cls: "hidden md:table-cell" },
                  { label: "Name", cls: "" },
                  { label: "Kategorie", cls: "hidden sm:table-cell" },
                  { label: "Einheit", cls: "hidden md:table-cell" },
                  { label: "Standardpreis", cls: "hidden sm:table-cell" },
                  { label: "Bestand", cls: "" },
                  { label: "Ampel", cls: "" },
                  { label: "Lagerort", cls: "hidden lg:table-cell" },
                  { label: "Lieferant", cls: "hidden lg:table-cell" },
                  { label: "", cls: "w-10" },
                ].map((h) => (
                  <th key={h.label} className={`px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide ${h.cls}`}>
                    {h.label}
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
                    <td className="hidden md:table-cell px-4 py-3 font-mono text-xs text-gray-500">{a.artikelnummer}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {a.name}
                      <div className="sm:hidden text-xs text-gray-500 mt-0.5">
                        {a.kategorie === "Duenger" ? "Dünger" : a.kategorie} · {formatEuro(a.standardpreis)}
                      </div>
                    </td>
                    <td className="hidden sm:table-cell px-4 py-3 text-gray-600">
                      {a.kategorie === "Duenger" ? "Dünger" : a.kategorie}
                    </td>
                    <td className="hidden md:table-cell px-4 py-3 text-gray-600">{a.einheit}</td>
                    <td className="hidden sm:table-cell px-4 py-3 font-mono">{formatEuro(a.standardpreis)}</td>
                    <td className="px-4 py-3 font-mono whitespace-nowrap">
                      {a.aktuellerBestand} {a.einheit}
                    </td>
                    <td className="px-4 py-3">
                      <LagerBadge status={status} />
                    </td>
                    <td className="hidden lg:table-cell px-4 py-3">
                      {a.lagerort ? (
                        <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-700 border border-gray-200 rounded text-xs font-medium">
                          {a.lagerort}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="hidden lg:table-cell px-4 py-3 text-gray-600">{bevorzugterLieferant(a)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!confirm(`"${a.name}" wirklich löschen?`)) return;
                          const res = await fetch(`/api/artikel/${a.id}`, { method: "DELETE" });
                          if (res.ok) load();
                        }}
                        className="text-red-400 hover:text-red-600 transition-colors"
                        title="Löschen"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </td>
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
