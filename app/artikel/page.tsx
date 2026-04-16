"use client";
import { useEffect, useState, useRef } from "react";
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

const FALLBACK_KATEGORIEN = ["Futter", "Duenger", "Saatgut", "Analysen", "Beratung"];

export default function ArtikelPage() {
  const router = useRouter();
  const [artikel, setArtikel] = useState<Artikel[]>([]);
  const [kategorien, setKategorien] = useState<string[]>(FALLBACK_KATEGORIEN);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [kategorie, setKategorie] = useState("alle");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    fetch("/api/einstellungen?prefix=system.")
      .then((r) => r.json())
      .then((d) => {
        if (d["system.artikelkategorien"]) {
          try {
            const parsed = JSON.parse(d["system.artikelkategorien"]);
            if (Array.isArray(parsed) && parsed.length) setKategorien(parsed);
          } catch {
            /* ignore */
          }
        }
      })
      .catch(() => {});
  }, []);

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/artikel/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setImportResult({ created: 0, skipped: 0, errors: [data.error ?? "Fehler"] }); return; }
      setImportResult(data);
      if (data.created > 0) load();
    } catch {
      setImportResult({ created: 0, skipped: 0, errors: ["Netzwerkfehler"] });
    } finally {
      setImporting(false);
      if (importRef.current) importRef.current.value = "";
    }
  }

  function bevorzugterLieferant(a: Artikel): string {
    const bev = a.lieferanten.find((l) => l.bevorzugt) ?? a.lieferanten[0];
    return bev?.lieferant.name ?? "–";
  }

  function bevorzugterEK(a: Artikel): number | null {
    const bev = a.lieferanten.find((l) => l.bevorzugt);
    if (bev) return bev.einkaufspreis;
    if (a.lieferanten.length === 1) return a.lieferanten[0].einkaufspreis;
    return null;
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
        <div className="flex gap-2 flex-wrap">
          <a
            href="/api/exporte?typ=artikel"
            download
            className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors w-full sm:w-auto text-center"
          >
            Exportieren
          </a>
          <button
            onClick={() => importRef.current?.click()}
            disabled={importing}
            className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors w-full sm:w-auto disabled:opacity-60"
          >
            {importing ? "Importiert…" : "Importieren"}
          </button>
          <input ref={importRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
          <Link
            href="/artikel/neu"
            className="bg-green-800 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors w-full sm:w-auto text-center"
          >
            + Neuer Artikel
          </Link>
        </div>
      </div>

      {importResult && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm border ${importResult.errors.length && !importResult.created ? "bg-red-50 border-red-200 text-red-700" : "bg-green-50 border-green-200 text-green-800"}`}>
          <div className="font-medium">{importResult.created} Artikel importiert{importResult.skipped > 0 ? `, ${importResult.skipped} übersprungen` : ""}.</div>
          {importResult.errors.length > 0 && (
            <ul className="mt-1 list-disc list-inside text-xs text-red-600 space-y-0.5">
              {importResult.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
          <button onClick={() => setImportResult(null)} className="mt-1 text-xs underline opacity-70 hover:opacity-100">Schließen</button>
        </div>
      )}

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
          {["alle", ...kategorien].map((k) => (
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
                  { label: "EK (bev.)", cls: "hidden md:table-cell" },
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
                    <td className="hidden md:table-cell px-4 py-3 font-mono">
                      {(() => {
                        const ek = bevorzugterEK(a);
                        return ek !== null ? formatEuro(ek) : <span className="text-gray-400">—</span>;
                      })()}
                    </td>
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
                      <div className="flex items-center gap-1">
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            const res = await fetch("/api/artikel", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                name: `${a.name} (Kopie)`,
                                kategorie: a.kategorie,
                                einheit: a.einheit,
                                standardpreis: a.standardpreis,
                                mindestbestand: a.mindestbestand,
                              }),
                            });
                            if (res.ok) {
                              const neu = await res.json();
                              router.push(`/artikel/${neu.id}`);
                            }
                          }}
                          className="text-gray-400 hover:text-gray-600 transition-colors"
                          title="Duplizieren"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        </button>
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
                      </div>
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
