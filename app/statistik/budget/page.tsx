"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { getBudgetJahre, MONATE_KURZ } from "@/lib/utils";

const KATEGORIEN = ["Futter", "Duenger", "Saatgut", "Analysen", "Beratung", "Pflege", "Sonstiges"];
const BUDGET_JAHRE = getBudgetJahre();
const AKTUELLES_JAHR = new Date().getFullYear();

function fmt(val: number) {
  return val.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function ProgressBar({ pct }: { pct: number | null }) {
  const clamped = Math.min(pct ?? 0, 100);
  const color =
    (pct ?? 0) >= 100
      ? "bg-green-500"
      : (pct ?? 0) >= 70
      ? "bg-amber-400"
      : "bg-red-500";
  return (
    <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
      <div
        className={`h-2.5 rounded-full transition-all ${color}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

function ErreichungBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-gray-400 text-sm">–</span>;
  const color =
    pct >= 100 ? "text-green-700 bg-green-50" : pct >= 70 ? "text-amber-700 bg-amber-50" : "text-red-700 bg-red-50";
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${color}`}>{pct.toFixed(1)} %</span>
  );
}

interface ZielRow {
  id: number;
  jahr: number;
  monat: number | null;
  kategorie: string | null;
  zielBetrag: number;
  notiz: string | null;
  istBetrag: number;
  erreichungProzent: number | null;
}

interface MonatsRow {
  monat: number;
  istBetrag: number;
  zielBetrag: number;
}

interface BudgetData {
  ziele: ZielRow[];
  gesamt: { zielBetrag: number; istBetrag: number; erreichungProzent: number | null };
  monatsUebersicht: MonatsRow[];
}

export default function BudgetPage() {
  const [jahr, setJahr] = useState(AKTUELLES_JAHR);
  const [data, setData] = useState<BudgetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Inline editing state
  const [editingZielId, setEditingZielId] = useState<string | null>(null); // "gesamt" | "kat:Futter" | "id:123"
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/budget?jahr=${jahr}`);
      if (!res.ok) throw new Error("Fehler beim Laden");
      const d: BudgetData = await res.json();
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }, [jahr]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Calculate prognosis: istBetrag / vergangene Monate * 12
  const prognose = (() => {
    if (!data) return null;
    const jetzt = new Date();
    const aktuellesJahr = jetzt.getFullYear();
    if (jahr > aktuellesJahr) return null;
    let vergangeneMonateAnzahl: number;
    if (jahr < aktuellesJahr) {
      vergangeneMonateAnzahl = 12;
    } else {
      vergangeneMonateAnzahl = jetzt.getMonth() + 1;
    }
    if (vergangeneMonateAnzahl === 0) return null;
    return (data.gesamt.istBetrag / vergangeneMonateAnzahl) * 12;
  })();

  async function saveZiel(
    monat: number | null,
    kategorie: string | null,
    existingId: number | null,
    zielBetrag: number
  ) {
    setSaving(true);
    try {
      if (existingId) {
        const res = await fetch(`/api/budget/${existingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ zielBetrag }),
        });
        if (!res.ok) throw new Error("Fehler beim Speichern");
      } else {
        const res = await fetch("/api/budget", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jahr, monat, kategorie, zielBetrag }),
        });
        if (!res.ok) throw new Error("Fehler beim Anlegen");
      }
      await loadData();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Fehler");
    } finally {
      setSaving(false);
      setEditingZielId(null);
      setEditValue("");
    }
  }

  async function resetAlle() {
    if (!data) return;
    if (
      !confirm(
        `Alle Budgetziele für ${jahr} wirklich löschen?`
      )
    )
      return;
    setSaving(true);
    try {
      for (const z of data.ziele) {
        await fetch(`/api/budget/${z.id}`, { method: "DELETE" });
      }
      await loadData();
    } finally {
      setSaving(false);
    }
  }

  function startEdit(key: string, currentVal: number) {
    setEditingZielId(key);
    setEditValue(String(Math.round(currentVal)));
  }

  function handleEditKeyDown(
    e: React.KeyboardEvent,
    monat: number | null,
    kategorie: string | null,
    existingId: number | null
  ) {
    if (e.key === "Enter") {
      const v = parseFloat(editValue.replace(",", "."));
      if (!isNaN(v) && v >= 0) saveZiel(monat, kategorie, existingId, v);
    } else if (e.key === "Escape") {
      setEditingZielId(null);
      setEditValue("");
    }
  }

  // Find existing ziel by monat+kategorie
  function findZiel(monat: number | null, kategorie: string | null): ZielRow | undefined {
    return data?.ziele.find(
      (z) => z.monat === monat && z.kategorie === kategorie
    );
  }

  // Chart max value
  const chartMax = data
    ? Math.max(
        ...data.monatsUebersicht.map((m) => Math.max(m.istBetrag, m.zielBetrag)),
        1
      )
    : 1;

  return (
    <main className="max-w-screen-xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link href="/statistik" className="hover:text-green-700">Statistik</Link>
            <span>›</span>
            <span className="text-gray-800 font-medium">Budgetplanung</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Budgetplanung</h1>
          <p className="text-sm text-gray-500 mt-0.5">Umsatzziele und Soll/Ist-Vergleich</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-600">Jahr:</label>
          <select
            value={jahr}
            onChange={(e) => setJahr(parseInt(e.target.value, 10))}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
          >
            {BUDGET_JAHRE.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button
            onClick={resetAlle}
            disabled={saving || !data || data.ziele.length === 0}
            className="px-3 py-1.5 text-xs border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50"
          >
            Ziele zurücksetzen
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-gray-400">Wird geladen…</div>
      ) : data ? (
        <>
          {/* KPI Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Gesamtziel */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Gesamtziel</p>
                <button
                  onClick={() => startEdit("gesamt", data.gesamt.zielBetrag)}
                  className="text-gray-400 hover:text-green-700 p-0.5"
                  title="Bearbeiten"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              </div>
              {editingZielId === "gesamt" ? (
                <input
                  autoFocus
                  type="number"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => handleEditKeyDown(e, null, null, findZiel(null, null)?.id ?? null)}
                  onBlur={() => {
                    const v = parseFloat(editValue.replace(",", "."));
                    if (!isNaN(v) && v >= 0) saveZiel(null, null, findZiel(null, null)?.id ?? null, v);
                    else { setEditingZielId(null); setEditValue(""); }
                  }}
                  className="w-full border border-green-400 rounded px-2 py-1 text-sm font-semibold"
                  placeholder="0"
                />
              ) : (
                <p className="text-xl font-bold text-gray-800">
                  {data.gesamt.zielBetrag > 0 ? `${fmt(data.gesamt.zielBetrag)} €` : <span className="text-gray-400 text-sm">Kein Ziel</span>}
                </p>
              )}
            </div>

            {/* Ist-Umsatz */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Ist-Umsatz</p>
              <p className="text-xl font-bold text-gray-800">{fmt(data.gesamt.istBetrag)} €</p>
            </div>

            {/* Erreichung */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-2">Erreichung</p>
              <div className="flex items-center gap-2">
                <ErreichungBadge pct={data.gesamt.erreichungProzent} />
              </div>
              {data.gesamt.zielBetrag > 0 && (
                <div className="mt-2">
                  <ProgressBar pct={data.gesamt.erreichungProzent} />
                </div>
              )}
            </div>

            {/* Prognose */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Prognose (Hochrechnung)</p>
              {prognose !== null ? (
                <>
                  <p className="text-xl font-bold text-gray-800">{fmt(prognose)} €</p>
                  {data.gesamt.zielBetrag > 0 && (
                    <p className={`text-xs mt-1 font-medium ${prognose >= data.gesamt.zielBetrag ? "text-green-600" : "text-red-600"}`}>
                      {prognose >= data.gesamt.zielBetrag ? "Ziel voraussichtlich erreicht" : "Ziel voraussichtlich verfehlt"}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-400">Nicht verfügbar</p>
              )}
            </div>
          </div>

          {/* Monthly Chart */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Monatsverlauf</h2>
            <div className="flex items-end gap-1 h-48">
              {data.monatsUebersicht.map((m) => {
                const istH = chartMax > 0 ? (m.istBetrag / chartMax) * 100 : 0;
                const zielH = chartMax > 0 ? (m.zielBetrag / chartMax) * 100 : 0;
                const monatName = MONATE_KURZ[m.monat - 1];
                return (
                  <div key={m.monat} className="flex-1 flex flex-col items-center gap-1 group relative">
                    {/* Tooltip */}
                    <div className="hidden group-hover:block absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10 pointer-events-none">
                      {monatName}: {fmt(m.istBetrag)} € / Ziel {fmt(m.zielBetrag)} €
                    </div>
                    {/* Bars container */}
                    <div className="w-full flex items-end gap-0.5 h-40">
                      {/* Ziel bar */}
                      <div
                        className="flex-1 rounded-t bg-green-100 transition-all"
                        style={{ height: `${zielH}%`, minHeight: m.zielBetrag > 0 ? "2px" : "0" }}
                        title={`Ziel: ${fmt(m.zielBetrag)} €`}
                      />
                      {/* Ist bar */}
                      <div
                        className="flex-1 rounded-t bg-green-500 transition-all"
                        style={{ height: `${istH}%`, minHeight: m.istBetrag > 0 ? "2px" : "0" }}
                        title={`Ist: ${fmt(m.istBetrag)} €`}
                      />
                    </div>
                    <span className="text-[10px] text-gray-500">{monatName}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-green-100 border border-green-300" />
                <span className="text-xs text-gray-500">Ziel</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-green-500" />
                <span className="text-xs text-gray-500">Ist</span>
              </div>
            </div>
          </div>

          {/* Category Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">Kategorien-Übersicht</h2>
              <p className="text-xs text-gray-400 mt-0.5">Klick auf Ziel-Betrag zum Bearbeiten · Enter zum Speichern</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                    <th className="px-4 py-2.5">Kategorie</th>
                    <th className="px-4 py-2.5 text-right">Ziel (€)</th>
                    <th className="px-4 py-2.5 text-right">Ist (€)</th>
                    <th className="px-4 py-2.5 text-right">Erreichung</th>
                    <th className="px-4 py-2.5 hidden sm:table-cell">Fortschritt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {/* Gesamt row */}
                  {(() => {
                    const ziel = findZiel(null, null);
                    const key = "kat:__gesamt__";
                    return (
                      <tr className="bg-green-50/60 font-semibold">
                        <td className="px-4 py-3 text-gray-800">Gesamt</td>
                        <td className="px-4 py-3 text-right">
                          {editingZielId === key ? (
                            <input
                              autoFocus
                              type="number"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => handleEditKeyDown(e, null, null, ziel?.id ?? null)}
                              onBlur={() => {
                                const v = parseFloat(editValue.replace(",", "."));
                                if (!isNaN(v) && v >= 0) saveZiel(null, null, ziel?.id ?? null, v);
                                else { setEditingZielId(null); setEditValue(""); }
                              }}
                              className="w-28 text-right border border-green-400 rounded px-2 py-0.5 text-sm"
                            />
                          ) : (
                            <button
                              onClick={() => startEdit(key, ziel?.zielBetrag ?? 0)}
                              className="hover:text-green-700 hover:underline"
                            >
                              {ziel ? `${fmt(ziel.zielBetrag)} €` : <span className="text-gray-400 font-normal text-xs">Ziel setzen</span>}
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">{fmt(data.gesamt.istBetrag)} €</td>
                        <td className="px-4 py-3 text-right">
                          <ErreichungBadge pct={data.gesamt.erreichungProzent} />
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell w-32">
                          {ziel && <ProgressBar pct={data.gesamt.erreichungProzent} />}
                        </td>
                      </tr>
                    );
                  })()}
                  {/* Category rows */}
                  {KATEGORIEN.map((kat) => {
                    const ziel = findZiel(null, kat);
                    const istBetrag = ziel?.istBetrag ?? 0;
                    // Get ist from lieferungen aggregate (ziel has it if exists, else calculate)
                    const key = `kat:${kat}`;
                    const erreichung = ziel?.erreichungProzent ?? null;
                    return (
                      <tr key={kat} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-2.5 text-gray-700">{kat}</td>
                        <td className="px-4 py-2.5 text-right">
                          {editingZielId === key ? (
                            <input
                              autoFocus
                              type="number"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => handleEditKeyDown(e, null, kat, ziel?.id ?? null)}
                              onBlur={() => {
                                const v = parseFloat(editValue.replace(",", "."));
                                if (!isNaN(v) && v >= 0) saveZiel(null, kat, ziel?.id ?? null, v);
                                else { setEditingZielId(null); setEditValue(""); }
                              }}
                              className="w-28 text-right border border-green-400 rounded px-2 py-0.5 text-sm"
                            />
                          ) : (
                            <button
                              onClick={() => startEdit(key, ziel?.zielBetrag ?? 0)}
                              className="hover:text-green-700 hover:underline"
                            >
                              {ziel ? `${fmt(ziel.zielBetrag)} €` : <span className="text-gray-400 text-xs">Ziel setzen</span>}
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-800">
                          {fmt(istBetrag)} €
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {ziel ? <ErreichungBadge pct={erreichung} /> : <span className="text-gray-300 text-xs">–</span>}
                        </td>
                        <td className="px-4 py-2.5 hidden sm:table-cell w-32">
                          {ziel && <ProgressBar pct={erreichung} />}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </main>
  );
}
