"use client";
import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { formatEuro, formatDatum } from "@/lib/utils";
import * as Sentry from "@sentry/nextjs";

interface Lieferposition {
  menge: number;
  verkaufspreis: number;
  rabattProzent: number;
}

interface Lieferung {
  id: number;
  rechnungNr: string | null;
  rechnungDatum: string | null;
  datum: string;
  positionen: Lieferposition[];
}

interface Rechnungsuebersicht {
  id: number;
  titel: string | null;
  notiz: string | null;
  createdAt: string;
  kunde: { id: number; name: string; firma: string | null };
  eintraege: { lieferung: Lieferung }[];
}

function nettoBetrag(positionen: Lieferposition[]) {
  return positionen.reduce((s, p) => s + p.menge * p.verkaufspreis * (1 - p.rabattProzent / 100), 0);
}

function gesamtBetrag(u: Rechnungsuebersicht) {
  return u.eintraege.reduce((s, e) => s + nettoBetrag(e.lieferung.positionen), 0);
}

export default function RechnungsuebersichtListePage() {
  const [items, setItems] = useState<Rechnungsuebersicht[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/rechnungsuebersicht");
      if (!res.ok) throw new Error("Fehler beim Laden");
      setItems(await res.json());
    } catch (err) {
      Sentry.captureException(err);
      setError("Fehler beim Laden der Rechnungsübersichten.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function loeschen(id: number) {
    if (!confirm("Diese Rechnungsübersicht löschen? Die zugrundeliegenden Rechnungen bleiben unverändert erhalten.")) return;
    setActionLoading(id);
    try {
      const res = await fetch(`/api/rechnungsuebersicht/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Fehler");
      await load();
    } catch (err) {
      Sentry.captureException(err);
      setError("Fehler beim Löschen.");
    } finally {
      setActionLoading(null);
    }
  }

  const q = search.toLowerCase();
  const filtered = items.filter((u) => {
    if (!q) return true;
    return (
      (u.titel?.toLowerCase().includes(q) ?? false) ||
      u.kunde.name.toLowerCase().includes(q) ||
      (u.kunde.firma?.toLowerCase().includes(q) ?? false)
    );
  });

  return (
    <div className="max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rechnungsübersichten</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Mehrere bereits ausgestellte Rechnungen zu einer Übersicht mit Gesamtsumme zusammenfassen
          </p>
        </div>
        <Link
          href="/rechnungsuebersicht/neu"
          title="Neue Rechnungsübersicht"
          className="inline-flex items-center gap-1.5 w-auto text-center px-2.5 sm:px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          <span className="hidden sm:inline">Neue Übersicht</span>
        </Link>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
      )}

      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="Suchen nach Titel oder Kunde…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-72 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Lade Rechnungsübersichten…</p>
      ) : filtered.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center text-gray-400">
          {items.length === 0 ? "Noch keine Rechnungsübersichten erstellt." : "Keine Übersichten für diese Suche."}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Titel</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Kunde</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap hidden sm:table-cell">Erstellt am</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap hidden md:table-cell">Rechnungen</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Nettobetrag</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/rechnungsuebersicht/${u.id}`} className="font-medium text-green-800 hover:text-green-600 hover:underline">
                        {u.titel ?? `Übersicht #${u.id}`}
                      </Link>
                      <div className="sm:hidden text-xs text-gray-400 mt-0.5">{formatDatum(u.createdAt)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/kunden/${u.kunde.id}`} className="text-green-700 hover:underline font-medium">
                        {u.kunde.firma ?? u.kunde.name}
                      </Link>
                      {u.kunde.firma && <div className="text-xs text-gray-400">{u.kunde.name}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap hidden sm:table-cell">{formatDatum(u.createdAt)}</td>
                    <td className="px-4 py-3 text-center hidden md:table-cell">
                      <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                        {u.eintraege.length}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900 whitespace-nowrap">
                      {formatEuro(gesamtBetrag(u))}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-0.5">
                        <a
                          href={`/api/exporte/rechnungsuebersicht?id=${u.id}`}
                          download
                          className="p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800 rounded transition-colors"
                          title="PDF herunterladen"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        </a>
                        <button
                          onClick={() => loeschen(u.id)}
                          disabled={actionLoading === u.id}
                          className="p-1.5 text-red-600 hover:bg-red-50 hover:text-red-800 rounded transition-colors disabled:opacity-60"
                          title="Löschen"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
