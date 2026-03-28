"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface AntragEmpfaenger {
  id: number;
  haushaltsjahr: number;
  name: string;
  plz: string | null;
  gemeinde: string | null;
  land: string | null;
  steuerNr: string | null;
  egflGesamt: number;
  elerGesamt: number;
  nationalKofiGesamt: number;
  elerUndKofiGesamt: number;
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
  nationalKofi: number;
  anfang: string;
  ende: string;
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

      {/* Import-Hinweis */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl px-5 py-3 mb-6 print:hidden flex items-center justify-between gap-4">
        <p className="text-sm text-gray-600">
          CSV-Import von agrarzahlungen.de
        </p>
        <Link
          href="/einstellungen/agrarantraege"
          className="text-sm px-3 py-1.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap"
        >
          → CSV importieren
        </Link>
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
                          <table className="text-xs w-full">
                            <thead>
                              <tr className="text-gray-500">
                                <th className="text-left pb-1 pr-3">Code</th>
                                <th className="text-left pb-1 pr-3">Spezifisches Ziel</th>
                                <th className="text-left pb-1 pr-3">Zeitraum</th>
                                <th className="text-right pb-1 pr-3">EGFL</th>
                                <th className="text-right pb-1 pr-3">ELER (EU)</th>
                                <th className="text-right pb-1">Nat. Kofi</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(() => {
                                let ms: Massnahme[] = [];
                                try { ms = JSON.parse(item.massnahmen!); } catch { return null; }
                                return ms.map((m, i) => (
                                  <tr key={i} className="border-t border-green-100">
                                    <td className="py-1 pr-3 font-mono font-medium">{m.code}</td>
                                    <td className="py-1 pr-3 text-gray-600">{m.ziel || "—"}</td>
                                    <td className="py-1 pr-3 text-gray-500 whitespace-nowrap">
                                      {m.anfang || m.ende ? `${m.anfang || ""}${m.anfang && m.ende ? " – " : ""}${m.ende || ""}` : "—"}
                                    </td>
                                    <td className="py-1 pr-3 text-right font-mono">{m.egfl > 0 ? formatEurAntrag(m.egfl) : "—"}</td>
                                    <td className="py-1 pr-3 text-right font-mono">{m.eler > 0 ? formatEurAntrag(m.eler) : "—"}</td>
                                    <td className="py-1 text-right font-mono">{m.nationalKofi > 0 ? formatEurAntrag(m.nationalKofi) : "—"}</td>
                                  </tr>
                                ));
                              })()}
                            </tbody>
                          </table>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-600">
                          <span>EGFL gesamt: <strong>{formatEurAntrag(item.egflGesamt)}</strong></span>
                          <span>ELER (EU) gesamt: <strong>{formatEurAntrag(item.elerGesamt)}</strong></span>
                          {item.nationalKofiGesamt > 0 && (
                            <span>Nat. Kofinanzierung: <strong>{formatEurAntrag(item.nationalKofiGesamt)}</strong></span>
                          )}
                          {item.elerUndKofiGesamt > 0 && (
                            <span>ELER + Kofi: <strong>{formatEurAntrag(item.elerUndKofiGesamt)}</strong></span>
                          )}
                        </div>
                        {item.mutterunternehmen && (
                          <p className="text-xs text-gray-500 mt-2">Mutterunternehmen: {item.mutterunternehmen}</p>
                        )}
                        {item.steuerNr && (
                          <p className="text-xs text-gray-500 mt-1">Steuer-Nr.: {item.steuerNr}</p>
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

    </div>
  );
}
