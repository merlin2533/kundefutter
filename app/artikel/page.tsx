"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LagerBadge } from "@/components/Badge";
import { formatEuro, lagerStatus } from "@/lib/utils";
import {
  DEFAULT_ARTIKEL_KATEGORIEN,
  DEFAULT_UNTERKATEGORIEN,
  istAnalyseArtikel,
  parseListSetting,
  getUnterkategorienKey,
} from "@/lib/auswahllisten";
import { useScrollRestoration } from "@/lib/useScrollRestoration";

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
  unterkategorie?: string | null;
  einheit: string;
  standardpreis: number;
  aktuellerBestand: number;
  mindestbestand: number;
  beschreibung?: string | null;
  aktiv: boolean;
  lagerort?: string | null;
  sprengstoffvorlaeufer: boolean;
  lieferanten: ArtikelLieferant[];
}

interface LieferantOption {
  id: number;
  name: string;
}

export default function ArtikelPage() {
  const router = useRouter();
  const [artikel, setArtikel] = useState<Artikel[]>([]);
  const [kategorien, setKategorien] = useState<string[]>(DEFAULT_ARTIKEL_KATEGORIEN);
  const [systemSettings, setSystemSettings] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [kategorie, setKategorie] = useState("alle");
  const [unterkategorie, setUnterkategorie] = useState("alle");
  const [lieferantId, setLieferantId] = useState("");
  const [preisVon, setPreisVon] = useState("");
  const [preisBis, setPreisBis] = useState("");
  const [nurSprengstoff, setNurSprengstoff] = useState(false);
  const [lieferanten, setLieferanten] = useState<LieferantOption[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ neu: number; aktualisiert: number; lieferantenGesetzt: number; skipped: number; errors: string[] } | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [vorschauLoading, setVorschauLoading] = useState(false);
  const [vorschau, setVorschau] = useState<{
    plan: { zeile: number; name: string; aktion: "neu" | "aktualisieren" | "überspringen"; details: string[] }[];
    summary: { neu: number; aktualisieren: number; ueberspringen: number; neueLieferanten: number };
  } | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const PAGE_SIZE = 100;
  const importRef = useRef<HTMLInputElement>(null);

  async function load(pageNum = page) {
    setLoading(true);
    setFetchError(null);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (kategorie !== "alle") params.set("kategorie", kategorie);
    if (unterkategorie !== "alle") params.set("unterkategorie", unterkategorie);
    if (lieferantId) params.set("lieferantId", lieferantId);
    if (preisVon) params.set("preisVon", preisVon);
    if (preisBis) params.set("preisBis", preisBis);
    if (nurSprengstoff) params.set("sprengstoffvorlaeufer", "1");
    params.set("limit", String(PAGE_SIZE));
    params.set("page", String(pageNum));
    try {
      const res = await fetch(`/api/artikel?${params}`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        setFetchError(d.error ?? `Serverfehler ${res.status}`);
        setArtikel([]);
      } else {
        const data = await res.json();
        setArtikel(Array.isArray(data) ? data : []);
        const t = res.headers.get("X-Total-Count");
        if (t) setTotal(parseInt(t, 10));
      }
    } catch {
      setFetchError("Netzwerkfehler – Seite neu laden");
    } finally {
      setLoading(false);
    }
  }

  // Restore filters from sessionStorage on mount (preserves state on back navigation)
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem("artikel-filters") ?? "{}") as Record<string, string>;
      if (saved.search !== undefined) setSearch(saved.search);
      if (saved.kategorie !== undefined) setKategorie(saved.kategorie);
      if (saved.unterkategorie !== undefined) setUnterkategorie(saved.unterkategorie);
      if (saved.lieferantId !== undefined) setLieferantId(saved.lieferantId);
      if (saved.preisVon !== undefined) setPreisVon(saved.preisVon);
      if (saved.preisBis !== undefined) setPreisBis(saved.preisBis);
      if (saved.nurSprengstoff !== undefined) setNurSprengstoff(saved.nurSprengstoff === "1");
    } catch { /* ignore */ }
  }, []);

  // Persist filters to sessionStorage on change
  useEffect(() => {
    try { sessionStorage.setItem("artikel-filters", JSON.stringify({ search, kategorie, unterkategorie, lieferantId, preisVon, preisBis, nurSprengstoff: nurSprengstoff ? "1" : "0" })); } catch { /* ignore */ }
  }, [search, kategorie, unterkategorie]);

  useEffect(() => {
    setPage(1);
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, kategorie, unterkategorie, lieferantId, preisVon, preisBis, nurSprengstoff]);

  useEffect(() => {
    if (page > 1) load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useEffect(() => {
    setUnterkategorie("alle");
  }, [kategorie]);

  useScrollRestoration(!loading && artikel.length > 0);

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === artikel.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(artikel.map((a) => a.id)));
    }
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return;
    if (!confirm(`${selected.size} Artikel wirklich löschen?`)) return;
    setBulkDeleting(true);
    const errors: string[] = [];
    for (const id of selected) {
      const res = await fetch(`/api/artikel/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        errors.push(d.error ?? `Artikel ${id} konnte nicht gelöscht werden`);
      }
    }
    setBulkDeleting(false);
    setSelected(new Set());
    if (errors.length > 0) alert(errors.join("\n"));
    load(page);
  }

  useEffect(() => {
    fetch("/api/einstellungen?prefix=system.")
      .then((r) => r.ok ? r.json() : {})
      .then((d: Record<string, string>) => {
        setKategorien(parseListSetting(d, "system.artikelkategorien", DEFAULT_ARTIKEL_KATEGORIEN));
        setSystemSettings(d);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/lieferanten?limit=500")
      .then((r) => r.ok ? r.json() : [])
      .then((d: unknown) => { if (Array.isArray(d)) setLieferanten(d as LieferantOption[]); })
      .catch(() => {});
  }, []);

  const aktuelleUnterkategorien =
    systemSettings !== null
      ? kategorie !== "alle"
        ? parseListSetting(systemSettings, getUnterkategorienKey(kategorie), DEFAULT_UNTERKATEGORIEN[kategorie] ?? [])
        : [...new Set(
            kategorien.flatMap((k) =>
              parseListSetting(systemSettings!, getUnterkategorienKey(k), DEFAULT_UNTERKATEGORIEN[k] ?? [])
            )
          )].sort()
      : [];

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreviewFile(file);
    setImportResult(null);
    setVorschau(null);
    setVorschauLoading(true);

    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/artikel/import/vorschau", { method: "POST", body: fd });
      if (res.ok) {
        const data = await res.json();
        setVorschau(data);
      }
    } catch {
      // Vorschau nicht verfügbar — Import trotzdem erlauben
    } finally {
      setVorschauLoading(false);
    }
  }

  async function doImport() {
    if (!previewFile) return;
    setImporting(true);
    setImportResult(null);
    setPreviewFile(null);
    setVorschau(null);
    const fd = new FormData();
    fd.append("file", previewFile);
    try {
      const res = await fetch("/api/artikel/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setImportResult({ neu: 0, aktualisiert: 0, lieferantenGesetzt: 0, skipped: 0, errors: [data.error ?? "Fehler"] }); return; }
      setImportResult(data);
      if ((data.neu ?? 0) > 0 || (data.aktualisiert ?? 0) > 0) load();
    } catch {
      setImportResult({ neu: 0, aktualisiert: 0, lieferantenGesetzt: 0, skipped: 0, errors: ["Netzwerkfehler"] });
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
          {selected.size > 0 && (
            <button
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
            >
              {bulkDeleting ? "Lösche…" : `${selected.size} löschen`}
            </button>
          )}
          <a
            href="/api/exporte?typ=artikel"
            download
            title="Exportieren"
            className="inline-flex items-center gap-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-2.5 sm:px-4 py-2.5 rounded-lg text-sm font-medium transition-colors w-auto text-center"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            <span className="hidden sm:inline">Exportieren</span>
          </a>
          <a
            href="/api/artikel/import/vorlage"
            download
            title="Import-Vorlage herunterladen"
            className="inline-flex items-center gap-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-2.5 sm:px-4 py-2.5 rounded-lg text-sm font-medium transition-colors w-auto text-center"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            <span className="hidden sm:inline">Vorlage</span>
          </a>
          <button
            onClick={() => importRef.current?.click()}
            disabled={importing}
            title="Importieren"
            className="inline-flex items-center gap-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-2.5 sm:px-4 py-2.5 rounded-lg text-sm font-medium transition-colors w-auto disabled:opacity-60"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-16-4l4-4 4 4m-4-4v12" /></svg>
            <span className="hidden sm:inline">{importing ? "Importiert…" : "Importieren"}</span>
          </button>
          <input ref={importRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileSelect} />
          <Link
            href="/artikel/neu"
            title="Neuer Artikel"
            className="inline-flex items-center gap-1.5 bg-green-800 hover:bg-green-700 text-white px-2.5 sm:px-4 py-2.5 rounded-lg text-sm font-medium transition-colors w-auto text-center"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            <span className="hidden sm:inline">Neuer Artikel</span>
          </Link>
        </div>
      </div>

      {/* Import Vorschau */}
      {previewFile && !importing && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
          <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
            <div className="font-semibold text-blue-800">
              Import-Vorschau: {previewFile.name}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => { setPreviewFile(null); setVorschau(null); if (importRef.current) importRef.current.value = ""; }}
                className="px-3 py-1.5 rounded border border-gray-300 bg-white text-gray-600 text-xs hover:bg-gray-50"
              >
                Abbrechen
              </button>
              <button
                onClick={doImport}
                disabled={vorschauLoading}
                className="px-4 py-1.5 rounded bg-green-700 text-white text-xs font-medium hover:bg-green-800 disabled:opacity-60"
              >
                Jetzt importieren
              </button>
            </div>
          </div>

          {vorschauLoading && (
            <div className="flex items-center gap-2 text-blue-700 text-xs py-2">
              <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin shrink-0" />
              Datei wird analysiert…
            </div>
          )}

          {vorschau && !vorschauLoading && (
            <>
              {/* Zusammenfassung */}
              <div className="flex flex-wrap gap-3 mb-3">
                {vorschau.summary.neu > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                    + {vorschau.summary.neu} neu anlegen
                  </span>
                )}
                {vorschau.summary.aktualisieren > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                    ~ {vorschau.summary.aktualisieren} aktualisieren
                  </span>
                )}
                {vorschau.summary.ueberspringen > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                    — {vorschau.summary.ueberspringen} überspringen
                  </span>
                )}
                {vorschau.summary.neueLieferanten > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">
                    {vorschau.summary.neueLieferanten} neue Lieferanten
                  </span>
                )}
              </div>

              {/* Detailplan */}
              <div className="overflow-y-auto max-h-64 rounded border border-blue-100 bg-white">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-1.5 text-left font-medium text-gray-500 w-12">Zeile</th>
                      <th className="px-3 py-1.5 text-left font-medium text-gray-500">Artikel</th>
                      <th className="px-3 py-1.5 text-left font-medium text-gray-500 w-28">Aktion</th>
                      <th className="px-3 py-1.5 text-left font-medium text-gray-500">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vorschau.plan.map((z) => (
                      <tr key={z.zeile} className="border-t border-gray-100">
                        <td className="px-3 py-1.5 text-gray-400 font-mono">{z.zeile}</td>
                        <td className="px-3 py-1.5 font-medium text-gray-800 max-w-[180px] truncate" title={z.name}>{z.name}</td>
                        <td className="px-3 py-1.5">
                          {z.aktion === "neu" && (
                            <span className="inline-block px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">+ neu</span>
                          )}
                          {z.aktion === "aktualisieren" && (
                            <span className="inline-block px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">~ update</span>
                          )}
                          {z.aktion === "überspringen" && (
                            <span className="inline-block px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">— skip</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-gray-500 text-xs">{z.details.join(" · ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div className="mt-2 text-xs text-blue-600">
            Vorhandene Artikel (gleicher Name) werden aktualisiert, nicht doppelt angelegt.
          </div>
        </div>
      )}

      {importResult && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm border ${importResult.errors.length && !importResult.neu && !importResult.aktualisiert ? "bg-red-50 border-red-200 text-red-700" : "bg-green-50 border-green-200 text-green-800"}`}>
          <div className="font-medium">Import abgeschlossen:</div>
          <ul className="mt-1 space-y-0.5 text-sm">
            {importResult.neu > 0 && <li>✓ {importResult.neu} Artikel neu angelegt</li>}
            {importResult.aktualisiert > 0 && <li>✓ {importResult.aktualisiert} Artikel aktualisiert (Duplikate)</li>}
            {importResult.lieferantenGesetzt > 0 && <li>✓ {importResult.lieferantenGesetzt} Lieferanten-Verknüpfungen gesetzt</li>}
            {importResult.skipped > 0 && <li className="text-amber-700">— {importResult.skipped} Zeilen übersprungen (Fehler)</li>}
          </ul>
          {importResult.errors.length > 0 && (
            <ul className="mt-2 list-disc list-inside text-xs text-red-600 space-y-0.5">
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
        <div className="flex gap-1 flex-wrap">
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

      {/* Zusätzliche Filter: Lieferant, Preis, Sprengstoffvorläufer */}
      <div className="flex flex-wrap gap-3 mb-4 -mt-2">
        {lieferanten.length > 0 && (
          <select
            value={lieferantId}
            onChange={(e) => setLieferantId(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700 bg-white"
          >
            <option value="">Alle Lieferanten</option>
            {lieferanten.map((l) => (
              <option key={l.id} value={String(l.id)}>{l.name}</option>
            ))}
          </select>
        )}
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            placeholder="Preis von €"
            value={preisVon}
            onChange={(e) => setPreisVon(e.target.value)}
            min={0}
            step={0.01}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-green-700"
          />
          <span className="text-gray-400 text-sm">–</span>
          <input
            type="number"
            placeholder="bis €"
            value={preisBis}
            onChange={(e) => setPreisBis(e.target.value)}
            min={0}
            step={0.01}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-green-700"
          />
        </div>
        <button
          onClick={() => setNurSprengstoff((v) => !v)}
          title="Nur Sprengstoffvorläufer anzeigen"
          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
            nurSprengstoff
              ? "bg-orange-600 text-white border-orange-600"
              : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
          }`}
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
          Sprengstoffvorläufer
        </button>
        {(lieferantId || preisVon || preisBis || nurSprengstoff) && (
          <button
            onClick={() => { setLieferantId(""); setPreisVon(""); setPreisBis(""); setNurSprengstoff(false); }}
            className="text-xs text-gray-500 hover:text-red-600 underline self-center"
          >
            Filter zurücksetzen
          </button>
        )}
      </div>

      {aktuelleUnterkategorien.length > 0 && (
        <div className="flex gap-1 flex-wrap mb-5 -mt-2">
          <span className="text-xs uppercase tracking-wide text-gray-500 self-center mr-1">Unterkat.:</span>
          {["alle", ...aktuelleUnterkategorien].map((u) => (
            <button
              key={u}
              onClick={() => setUnterkategorie(u)}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                unterkategorie === u
                  ? "bg-green-700 text-white border-green-700"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
            >
              {u === "alle" ? "Alle" : u}
            </button>
          ))}
        </div>
      )}

      {/* Ergebnis-Info */}
      {!loading && !fetchError && total > 0 && (
        <div className="mb-2 text-xs text-gray-500">
          {total > PAGE_SIZE
            ? `Zeige ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} von ${total} Artikeln`
            : `${total} Artikel${total !== 1 ? "" : ""} gesamt`}
          {selected.size > 0 && (
            <span className="ml-2 text-green-700 font-medium">{selected.size} ausgewählt</span>
          )}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto shadow-sm">
        {loading ? (
          <div className="flex items-center gap-3 p-6 text-gray-400 text-sm">
            <div className="w-4 h-4 border-2 border-green-700 border-t-transparent rounded-full animate-spin shrink-0" />
            Artikel werden geladen…
          </div>
        ) : fetchError ? (
          <div className="flex items-center gap-2 p-6 text-red-600 text-sm">
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            {fetchError}
          </div>
        ) : artikel.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <svg className="w-12 h-12 mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <p className="font-medium text-gray-500">Keine Artikel gefunden</p>
            <p className="text-xs mt-1">Suchbegriff oder Kategoriefilter anpassen</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={artikel.length > 0 && selected.size === artikel.length}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300 text-green-700 focus:ring-green-700"
                    title="Alle auswählen"
                  />
                </th>
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
                const istAnalyse = istAnalyseArtikel(a.kategorie);
                const status = lagerStatus(a.aktuellerBestand, a.mindestbestand);
                const kategorieAnzeige = a.kategorie === "Duenger" ? "Dünger" : a.kategorie;
                const kategorieMitKultur = a.unterkategorie ? `${kategorieAnzeige} · ${a.unterkategorie}` : kategorieAnzeige;
                return (
                  <tr
                    key={a.id}
                    className={`border-b last:border-0 hover:bg-green-50 cursor-pointer transition-colors ${selected.has(a.id) ? "bg-green-50" : ""}`}
                    onClick={() => router.push(`/artikel/${a.id}`)}
                  >
                    <td className="px-4 py-3 w-8" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(a.id)}
                        onChange={() => toggleSelect(a.id)}
                        className="rounded border-gray-300 text-green-700 focus:ring-green-700"
                      />
                    </td>
                    <td className="hidden md:table-cell px-4 py-3 font-mono text-xs text-gray-500">{a.artikelnummer}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <span className="inline-flex items-center gap-1.5 flex-wrap">
                        {a.name}
                        {a.sprengstoffvorlaeufer && (
                          <span
                            title="Sprengstoffvorläufer (EU-VO 2019/1148)"
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-semibold bg-orange-100 text-orange-700 border border-orange-200 shrink-0"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                            SV
                          </span>
                        )}
                      </span>
                      <div className="sm:hidden text-xs text-gray-500 mt-0.5">
                        {kategorieMitKultur} · {formatEuro(a.standardpreis)}
                      </div>
                    </td>
                    <td className="hidden sm:table-cell px-4 py-3 text-gray-600">
                      {kategorieMitKultur}
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
                      {istAnalyse ? <span className="text-gray-400">—</span> : <>{a.aktuellerBestand} {a.einheit}</>}
                    </td>
                    <td className="px-4 py-3">
                      {istAnalyse ? <span className="text-gray-300 text-xs">—</span> : <LagerBadge status={status} />}
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
                            } else {
                              const d = await res.json().catch(() => ({}));
                              alert(d.error ?? "Duplizieren fehlgeschlagen");
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
                            if (res.ok) load(page);
                            else { const d = await res.json().catch(() => ({})); alert(d.error ?? "Löschen fehlgeschlagen"); }
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

      {/* Bottom bar: bulk delete + pagination */}
      {(selected.size > 0 || total > PAGE_SIZE) && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-600 flex-wrap gap-3">
          <div>
            {selected.size > 0 && (
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
              >
                {bulkDeleting ? "Lösche…" : `${selected.size} ausgewählte löschen`}
              </button>
            )}
          </div>
          {total > PAGE_SIZE && (
            <div className="flex items-center gap-2">
              <span className="text-gray-500">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} von {total}
              </span>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                ← Zurück
              </button>
              <span className="px-3 py-1.5 bg-green-700 text-white rounded-lg font-medium">
                {page} / {Math.ceil(total / PAGE_SIZE)}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(Math.ceil(total / PAGE_SIZE), p + 1))}
                disabled={page >= Math.ceil(total / PAGE_SIZE)}
                className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Weiter →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
