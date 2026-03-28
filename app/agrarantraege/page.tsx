"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";

interface AntragEmpfaenger {
  id: number;
  haushaltsjahr: number;
  name: string;
  plz: string | null;
  gemeinde: string | null;
  land: string | null;
  egflGesamt: number;
  elerGesamt: number;
  gesamtBetrag: number;
  massnahmen: string | null;
  mutterunternehmen: string | null;
  importiertAm: string;
  kundeId: number | null;
  kunde: { id: number; name: string; firma: string | null } | null;
}

interface Massnahme {
  code: string;
  ziel: string;
  egfl: number;
  eler: number;
}

function formatEurAntrag(n: number) {
  return n.toLocaleString("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
}

function MassnahmenBadges({ json }: { json: string | null }) {
  if (!json) return <span className="text-gray-400 text-xs">—</span>;
  let items: Massnahme[] = [];
  try { items = JSON.parse(json); } catch { return <span className="text-red-400 text-xs">Parse-Fehler</span>; }
  return (
    <div className="flex flex-wrap gap-1">
      {items.slice(0, 5).map((m, i) => (
        <span key={i} className="text-xs px-1.5 py-0.5 bg-green-50 border border-green-200 text-green-800 rounded" title={m.ziel}>
          {m.code}
        </span>
      ))}
      {items.length > 5 && <span className="text-xs text-gray-400">+{items.length - 5}</span>}
    </div>
  );
}

export default function AgrarantraegeePage() {
  const [items, setItems] = useState<AntragEmpfaenger[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [plzFilter, setPlzFilter] = useState("");
  const [ortFilter, setOrtFilter] = useState("");
  const [jahrFilter, setJahrFilter] = useState("");
  const [nurUnverknuepft, setNurUnverknuepft] = useState(false);

  // Import
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ ok: boolean; importiert?: number; jahre?: number[]; modus?: string; error?: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Auto-import state
  const [autoYear, setAutoYear] = useState("2024");
  const [autoUrl, setAutoUrl] = useState("");
  const [autoImporting, setAutoImporting] = useState(false);
  const [autoImportResult, setAutoImportResult] = useState<{ ok: boolean; importiert?: number; jahre?: number[]; modus?: string; error?: string } | null>(null);

  // Serverpath import state
  const [serverPath, setServerPath] = useState("");
  const [serverImporting, setServerImporting] = useState(false);

  // Link modal
  const [linkItem, setLinkItem] = useState<AntragEmpfaenger | null>(null);
  const [linkKunden, setLinkKunden] = useState<{ id: number; name: string; firma: string | null }[]>([]);
  const [linkSearch, setLinkSearch] = useState("");
  const [linkSaving, setLinkSaving] = useState(false);

  // Detail expand
  const [expanded, setExpanded] = useState<number | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (plzFilter.trim()) params.set("plz", plzFilter.trim());
    if (ortFilter.trim()) params.set("ort", ortFilter.trim());
    if (jahrFilter) params.set("haushaltsjahr", jahrFilter);
    const res = await fetch(`/api/agrarantraege?${params}`);
    const data = await res.json();
    let list: AntragEmpfaenger[] = Array.isArray(data) ? data : [];
    if (nurUnverknuepft) list = list.filter((i) => !i.kundeId);
    setItems(list);
    setLoading(false);
  }, [search, plzFilter, ortFilter, jahrFilter, nurUnverknuepft]);

  useEffect(() => {
    const t = setTimeout(fetchItems, 300);
    return () => clearTimeout(t);
  }, [fetchItems]);

  async function handleImport() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append("csv", file);
      const res = await fetch("/api/agrarantraege/import", { method: "POST", body: formData });
      const data = await res.json();
      setImportResult(data);
      if (data.ok) {
        fetchItems();
        if (fileRef.current) fileRef.current.value = "";
      }
    } catch {
      setImportResult({ ok: false, error: "Netzwerkfehler beim Import" });
    } finally {
      setImporting(false);
    }
  }

  async function handleAutoImport() {
    const resolvedUrl = autoUrl.trim() || `https://www.agrarzahlungen.de/fileadmin/user_upload/files/impdata${autoYear}.csv`;
    setAutoImporting(true);
    setAutoImportResult(null);
    try {
      const res = await fetch("/api/agrarantraege/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "url", url: resolvedUrl }),
      });
      const data = await res.json();
      setAutoImportResult(data);
      if (data.ok) fetchItems();
    } catch {
      setAutoImportResult({ ok: false, error: "Netzwerkfehler beim Auto-Import" });
    } finally {
      setAutoImporting(false);
    }
  }

  async function handleServerPathImport() {
    if (!serverPath.trim()) return;
    setServerImporting(true);
    setAutoImportResult(null);
    try {
      const res = await fetch("/api/agrarantraege/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "serverpath", path: serverPath.trim() }),
      });
      const data = await res.json();
      setAutoImportResult(data);
      if (data.ok) { fetchItems(); setServerPath(""); }
    } catch {
      setAutoImportResult({ ok: false, error: "Netzwerkfehler beim Serverpfad-Import" });
    } finally {
      setServerImporting(false);
    }
  }

  async function openLink(item: AntragEmpfaenger) {
    setLinkItem(item);
    setLinkSearch(item.name.split(" ").slice(0, 2).join(" "));
    const res = await fetch("/api/kunden");
    const data = await res.json();
    setLinkKunden(Array.isArray(data) ? data : []);
  }

  async function handleLink(kundeId: number | null) {
    if (!linkItem) return;
    setLinkSaving(true);
    await fetch(`/api/agrarantraege?id=${linkItem.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kundeId }),
    });
    setLinkItem(null);
    setLinkSaving(false);
    fetchItems();
  }

  async function handleNeuKunde(item: AntragEmpfaenger) {
    // Create a new customer from AFIG data, then link
    const res = await fetch("/api/kunden", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: item.name,
        plz: item.plz ?? undefined,
        ort: item.gemeinde ?? undefined,
        land: item.land ?? "Deutschland",
        kategorie: "Landwirt",
      }),
    });
    if (res.ok) {
      const neu = await res.json();
      await fetch(`/api/agrarantraege?id=${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kundeId: neu.id }),
      });
      fetchItems();
    }
  }

  const filteredLinkKunden = linkKunden.filter((k) =>
    !linkSearch || k.name.toLowerCase().includes(linkSearch.toLowerCase()) ||
    (k.firma ?? "").toLowerCase().includes(linkSearch.toLowerCase())
  );

  const totalBetrag = items.reduce((s, i) => s + i.gesamtBetrag, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Agraranträge (AFIG)</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Daten aus{" "}
            <a href="https://www.agrarzahlungen.de" target="_blank" rel="noopener noreferrer" className="text-green-700 hover:underline">
              agrarzahlungen.de
            </a>
            {" "}— CSV importieren und mit Kunden verknüpfen
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1.5 print:hidden"
        >
          🖨 Drucken
        </button>
      </div>

      {/* CSV Import */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6 print:hidden">
        <h2 className="font-semibold mb-3">CSV-Import von agrarzahlungen.de</h2>
        <p className="text-sm text-gray-500 mb-3">
          CSV unter{" "}
          <a href="https://www.agrarzahlungen.de/agrarfonds/bs" target="_blank" rel="noopener noreferrer" className="text-green-700 hover:underline">
            agrarzahlungen.de → Gesamtliste
          </a>{" "}
          herunterladen (z.B. impdata2023.csv) und hier hochladen.
        </p>
        <div className="flex gap-3 items-center flex-wrap">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt"
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none"
          />
          <button
            onClick={handleImport}
            disabled={importing}
            className="px-4 py-2 text-sm bg-green-700 hover:bg-green-800 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {importing ? "Importiere…" : "CSV importieren"}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Bei 250MB-Dateien bitte Auto-Download oder Serverpfad verwenden, da Browser-Upload zu langsam ist.
        </p>
        {importResult && (
          <div className={`mt-3 text-sm px-3 py-2 rounded-lg border ${importResult.ok ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-700"}`}>
            {importResult.ok
              ? `✓ ${importResult.importiert?.toLocaleString("de-DE")} Datensätze importiert (Jahre: ${importResult.jahre?.join(", ")})`
              : `Fehler: ${importResult.error}`}
          </div>
        )}
      </div>

      {/* Auto-Import */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6 print:hidden">
        <h2 className="font-semibold mb-1">Auto-Download von agrarzahlungen.de</h2>
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
          Bei 250MB-Dateien bitte Auto-Download oder Serverpfad verwenden, da Browser-Upload zu langsam ist.
        </p>

        {/* URL download */}
        <div className="flex gap-3 items-center flex-wrap mb-2">
          <select
            value={autoYear}
            onChange={(e) => { setAutoYear(e.target.value); setAutoUrl(""); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
          >
            {[2024, 2023, 2022, 2021, 2020, 2019, 2018].map((y) => (
              <option key={y} value={String(y)}>{y}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder={`URL (optional): https://www.agrarzahlungen.de/…/impdata${autoYear}.csv`}
            value={autoUrl}
            onChange={(e) => setAutoUrl(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-96 focus:outline-none focus:ring-2 focus:ring-green-600"
          />
          <button
            onClick={handleAutoImport}
            disabled={autoImporting || serverImporting}
            className="px-4 py-2 text-sm bg-green-700 hover:bg-green-800 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {autoImporting ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Herunterladen…
              </>
            ) : (
              "Herunterladen und importieren"
            )}
          </button>
        </div>
        {autoImporting && (
          <p className="text-xs text-gray-500 mb-2">
            Wird heruntergeladen und importiert… (kann bei 250MB bis zu 2 Minuten dauern)
          </p>
        )}

        {/* Serverpath import */}
        <div className="border-t border-gray-100 mt-4 pt-4">
          <p className="text-sm text-gray-600 mb-2">
            Oder: Serverpfad der CSV-Datei (z.B. <code className="bg-gray-100 px-1 rounded text-xs">/data/impdata2024.csv</code>):
          </p>
          <div className="flex gap-3 items-center flex-wrap">
            <input
              type="text"
              placeholder="/data/impdata2024.csv"
              value={serverPath}
              onChange={(e) => setServerPath(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-green-600 font-mono"
            />
            <button
              onClick={handleServerPathImport}
              disabled={autoImporting || serverImporting || !serverPath.trim()}
              className="px-4 py-2 text-sm bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {serverImporting ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Importiere…
                </>
              ) : (
                "Importieren"
              )}
            </button>
          </div>
          {serverImporting && (
            <p className="text-xs text-gray-500 mt-2">
              Wird heruntergeladen und importiert… (kann bei 250MB bis zu 2 Minuten dauern)
            </p>
          )}
        </div>

        {autoImportResult && (
          <div className={`mt-3 text-sm px-3 py-2 rounded-lg border ${autoImportResult.ok ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-700"}`}>
            {autoImportResult.ok
              ? `✓ ${autoImportResult.importiert?.toLocaleString("de-DE")} Datensätze importiert (Jahre: ${autoImportResult.jahre?.join(", ")}, Modus: ${autoImportResult.modus})`
              : `Fehler: ${autoImportResult.error}`}
          </div>
        )}
      </div>

      {/* Suche + Filter */}
      <div className="flex flex-wrap gap-3 mb-4 print:hidden">
        <input
          type="text"
          placeholder="Name suchen…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-green-600"
        />
        <input
          type="text"
          placeholder="PLZ…"
          value={plzFilter}
          onChange={(e) => setPlzFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-green-600"
        />
        <input
          type="text"
          placeholder="Ort / Gemeinde…"
          value={ortFilter}
          onChange={(e) => setOrtFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-green-600"
        />
        <select
          value={jahrFilter}
          onChange={(e) => setJahrFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
        >
          <option value="">Alle Jahre</option>
          {[2024, 2023, 2022, 2021, 2020].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600 border border-gray-200 rounded-lg px-3 py-2 bg-white cursor-pointer hover:bg-gray-50">
          <input
            type="checkbox"
            checked={nurUnverknuepft}
            onChange={(e) => setNurUnverknuepft(e.target.checked)}
            className="rounded text-green-700"
          />
          Nur unverknüpfte
        </label>
      </div>

      {/* Statistik */}
      {items.length > 0 && (
        <div className="flex gap-4 mb-4 text-sm">
          <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2">
            <span className="text-gray-500">Treffer:</span>{" "}
            <span className="font-semibold">{items.length.toLocaleString("de-DE")}</span>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2">
            <span className="text-gray-500">Gesamtzahlungen:</span>{" "}
            <span className="font-semibold text-green-800">{formatEurAntrag(totalBetrag)}</span>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
            <span className="text-gray-500">Verknüpft:</span>{" "}
            <span className="font-semibold text-blue-800">{items.filter((i) => i.kundeId).length}</span>
          </div>
        </div>
      )}

      {/* Ergebnistabelle */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        {loading ? (
          <p className="p-6 text-gray-400 text-sm">Lade…</p>
        ) : items.length === 0 ? (
          <div className="p-10 text-center text-gray-400">
            <p className="text-3xl mb-2">📋</p>
            <p className="text-sm">
              {search || plzFilter || ortFilter ? "Keine Treffer gefunden." : "Noch keine Daten importiert."}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Jahr", "Name / Gemeinde", "EGFL", "ELER", "Gesamt", "Maßnahmen", "Verknüpfung", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <>
                  <tr
                    key={item.id}
                    className={`border-b hover:bg-gray-50 transition-colors cursor-pointer ${expanded === item.id ? "bg-green-50" : ""}`}
                    onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                  >
                    <td className="px-4 py-3 font-mono text-xs font-medium">{item.haushaltsjahr}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{item.name}</div>
                      {(item.plz || item.gemeinde) && (
                        <div className="text-xs text-gray-500">{[item.plz, item.gemeinde].filter(Boolean).join(" ")}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">
                      {item.egflGesamt > 0 ? formatEurAntrag(item.egflGesamt) : "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">
                      {item.elerGesamt > 0 ? formatEurAntrag(item.elerGesamt) : "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-green-700 whitespace-nowrap">
                      {formatEurAntrag(item.gesamtBetrag)}
                    </td>
                    <td className="px-4 py-3">
                      <MassnahmenBadges json={item.massnahmen} />
                    </td>
                    <td className="px-4 py-3">
                      {item.kunde ? (
                        <Link
                          href={`/kunden/${item.kunde.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs text-green-700 hover:underline font-medium"
                        >
                          {item.kunde.firma ?? item.kunde.name} →
                        </Link>
                      ) : (
                        <span className="text-xs text-gray-400">nicht verknüpft</span>
                      )}
                    </td>
                    <td className="px-4 py-3 print:hidden">
                      <div className="flex gap-1 justify-end">
                        {!item.kundeId && (
                          <>
                            <button
                              onClick={(e) => { e.stopPropagation(); openLink(item); }}
                              className="text-xs px-2 py-1 rounded border border-blue-300 text-blue-700 hover:bg-blue-50 transition-colors whitespace-nowrap"
                            >
                              Verknüpfen
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleNeuKunde(item); }}
                              className="text-xs px-2 py-1 rounded border border-green-300 text-green-700 hover:bg-green-50 transition-colors whitespace-nowrap"
                            >
                              Neu als Kunde
                            </button>
                          </>
                        )}
                        {item.kundeId && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleLink(null); }}
                            className="text-xs text-gray-400 hover:text-red-600 transition-colors"
                            title="Verknüpfung lösen"
                          >
                            Lösen
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {/* Expanded detail row */}
                  {expanded === item.id && item.massnahmen && (
                    <tr key={`${item.id}-detail`} className="bg-green-50 border-b">
                      <td colSpan={8} className="px-6 py-4">
                        <h4 className="text-xs font-semibold text-gray-700 mb-2">Maßnahmen-Details:</h4>
                        <div className="overflow-x-auto">
                          <table className="text-xs w-full max-w-2xl">
                            <thead>
                              <tr className="text-gray-500">
                                <th className="text-left pb-1 pr-4">Code</th>
                                <th className="text-left pb-1 pr-4">Spezifisches Ziel</th>
                                <th className="text-right pb-1 pr-4">EGFL (EUR)</th>
                                <th className="text-right pb-1">ELER (EUR)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(() => {
                                let ms: Massnahme[] = [];
                                try { ms = JSON.parse(item.massnahmen!); } catch { return null; }
                                return ms.map((m, i) => (
                                  <tr key={i} className="border-t border-green-100">
                                    <td className="py-1 pr-4 font-mono font-medium">{m.code}</td>
                                    <td className="py-1 pr-4 text-gray-600">{m.ziel || "—"}</td>
                                    <td className="py-1 pr-4 text-right font-mono">{m.egfl > 0 ? formatEurAntrag(m.egfl) : "—"}</td>
                                    <td className="py-1 text-right font-mono">{m.eler > 0 ? formatEurAntrag(m.eler) : "—"}</td>
                                  </tr>
                                ));
                              })()}
                            </tbody>
                          </table>
                        </div>
                        {item.mutterunternehmen && (
                          <p className="text-xs text-gray-500 mt-2">Mutterunternehmen: {item.mutterunternehmen}</p>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Verknüpfen-Modal */}
      {linkItem && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-1">Mit Kunden verknüpfen</h2>
            <p className="text-sm text-gray-500 mb-4">{linkItem.name}</p>
            <input
              type="text"
              placeholder="Kunden suchen…"
              value={linkSearch}
              onChange={(e) => setLinkSearch(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-green-600"
              autoFocus
            />
            <div className="max-h-52 overflow-y-auto border border-gray-200 rounded-lg">
              {filteredLinkKunden.slice(0, 20).map((k) => (
                <button
                  key={k.id}
                  onClick={() => handleLink(k.id)}
                  disabled={linkSaving}
                  className="w-full text-left px-3 py-2.5 text-sm hover:bg-green-50 border-b last:border-0 border-gray-100 transition-colors"
                >
                  <span className="font-medium">{k.firma ?? k.name}</span>
                  {k.firma && <span className="text-gray-500 ml-1.5 text-xs">{k.name}</span>}
                </button>
              ))}
              {filteredLinkKunden.length === 0 && (
                <p className="px-3 py-4 text-sm text-gray-400 text-center">Kein Kunde gefunden</p>
              )}
            </div>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setLinkItem(null)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          nav, .print\\:hidden { display: none !important; }
          body { font-size: 11px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ddd; padding: 4px 6px; }
          thead { background: #f0fdf4 !important; -webkit-print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}
