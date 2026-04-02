"use client";
import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { formatEuro, formatDatum } from "@/lib/utils";

interface Lieferposition {
  menge: number;
  verkaufspreis: number;
  rabattProzent: number;
}

interface Lieferung {
  id: number;
  datum: string;
  positionen: Lieferposition[];
}

interface Sammelrechnung {
  id: number;
  rechnungNr: string | null;
  rechnungDatum: string | null;
  bezahltAm: string | null;
  zahlungsziel: number;
  notiz: string | null;
  createdAt: string;
  kunde: { id: number; name: string; firma: string | null };
  lieferungen: Lieferung[];
}

function berechneBetrag(lieferungen: Lieferung[]) {
  return lieferungen.reduce((sum, l) =>
    sum + l.positionen.reduce((s, p) => s + p.menge * p.verkaufspreis * (1 - p.rabattProzent / 100), 0),
    0
  );
}

function getStatus(sr: Sammelrechnung): "bezahlt" | "ueberfaellig" | "offen" {
  if (sr.bezahltAm) return "bezahlt";
  if (!sr.rechnungDatum) return "offen";
  const faelligAm = new Date(sr.rechnungDatum);
  faelligAm.setDate(faelligAm.getDate() + (sr.zahlungsziel ?? 30));
  if (faelligAm < new Date()) return "ueberfaellig";
  return "offen";
}

function StatusBadge({ status }: { status: "bezahlt" | "ueberfaellig" | "offen" }) {
  const cls = {
    bezahlt: "bg-green-100 text-green-800",
    ueberfaellig: "bg-red-100 text-red-800",
    offen: "bg-yellow-100 text-yellow-800",
  }[status];
  const label = { bezahlt: "Bezahlt", ueberfaellig: "Überfällig", offen: "Offen" }[status];
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{label}</span>;
}

export default function SammelrechnungenPage() {
  const [items, setItems] = useState<Sammelrechnung[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"alle" | "offen" | "bezahlt">("alle");
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "alle") params.set("status", statusFilter);
      const res = await fetch(`/api/sammelrechnungen?${params}`);
      if (!res.ok) throw new Error("Fehler beim Laden");
      setItems(await res.json());
    } catch {
      setError("Fehler beim Laden der Sammelrechnungen.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function markiereBezahlt(id: number) {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/sammelrechnungen/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bezahltAm: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error("Fehler");
      await load();
    } catch {
      setError("Fehler beim Markieren als bezahlt.");
    } finally {
      setActionLoading(null);
    }
  }

  async function loeschen(id: number) {
    if (!confirm("Sammelrechnung löschen? Die zugeordneten Lieferungen werden nicht gelöscht.")) return;
    setActionLoading(id);
    try {
      const res = await fetch(`/api/sammelrechnungen/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Fehler");
      await load();
    } catch {
      setError("Fehler beim Löschen.");
    } finally {
      setActionLoading(null);
    }
  }

  const q = search.toLowerCase();
  const filtered = items.filter((sr) => {
    if (!q) return true;
    return (
      sr.rechnungNr?.toLowerCase().includes(q) ||
      sr.kunde.name.toLowerCase().includes(q) ||
      (sr.kunde.firma?.toLowerCase().includes(q) ?? false)
    );
  });

  const gesamtOffen = items
    .filter((sr) => getStatus(sr) !== "bezahlt")
    .reduce((s, sr) => s + berechneBetrag(sr.lieferungen), 0);

  const anzahlOffen = items.filter((sr) => getStatus(sr) !== "bezahlt").length;
  const anzahlUeberfaellig = items.filter((sr) => getStatus(sr) === "ueberfaellig").length;

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sammelrechnungen</h1>
          <p className="text-sm text-gray-500 mt-0.5">Mehrere Lieferungen unter einer Rechnungsnummer zusammenfassen</p>
        </div>
        <Link
          href="/sammelrechnungen/neu"
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          + Neue Sammelrechnung
        </Link>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
      )}

      {/* KPIs */}
      {!loading && items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-2xl font-bold text-gray-900">{items.length}</div>
            <div className="text-xs text-gray-500 mt-0.5">Gesamt</div>
          </div>
          <div className={`rounded-xl border p-4 ${anzahlUeberfaellig > 0 ? "bg-red-50 border-red-200" : "bg-yellow-50 border-yellow-200"}`}>
            <div className={`text-2xl font-bold ${anzahlUeberfaellig > 0 ? "text-red-700" : "text-yellow-700"}`}>
              {anzahlOffen}
            </div>
            <div className="text-xs text-gray-600 mt-0.5">
              Offen{anzahlUeberfaellig > 0 ? ` · ${anzahlUeberfaellig} überfällig` : ""}
            </div>
          </div>
          <div className="col-span-2 sm:col-span-1 bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-2xl font-bold text-gray-900 font-mono">{formatEuro(gesamtOffen)}</div>
            <div className="text-xs text-gray-500 mt-0.5">Offene Forderungen</div>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="Suchen…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-64 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        {(["alle", "offen", "bezahlt"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
              statusFilter === s
                ? "bg-green-600 text-white border-green-600"
                : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
            }`}
          >
            {s === "alle" ? "Alle" : s === "offen" ? "Offen" : "Bezahlt"}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Lade Sammelrechnungen…</p>
      ) : filtered.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center text-gray-400">
          Keine Sammelrechnungen gefunden.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Rechnungsnr.</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Kunde</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap hidden sm:table-cell">Datum</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap hidden md:table-cell">Lieferungen</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Betrag</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap hidden sm:table-cell">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((sr) => {
                  const status = getStatus(sr);
                  const betrag = berechneBetrag(sr.lieferungen);
                  return (
                    <tr key={sr.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-sm">
                        {sr.rechnungNr ?? <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/kunden/${sr.kunde.id}`}
                          className="text-green-700 hover:underline font-medium"
                        >
                          {sr.kunde.firma ? `${sr.kunde.firma}` : sr.kunde.name}
                        </Link>
                        {sr.kunde.firma && (
                          <div className="text-xs text-gray-400">{sr.kunde.name}</div>
                        )}
                        <div className="sm:hidden text-xs text-gray-400 mt-0.5">
                          {sr.rechnungDatum ? formatDatum(sr.rechnungDatum) : "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap hidden sm:table-cell">
                        {sr.rechnungDatum ? formatDatum(sr.rechnungDatum) : "—"}
                      </td>
                      <td className="px-4 py-3 text-center hidden md:table-cell">
                        <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                          {sr.lieferungen.length}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900 whitespace-nowrap">
                        {formatEuro(betrag)}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <StatusBadge status={status} />
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {status !== "bezahlt" && (
                            <button
                              onClick={() => markiereBezahlt(sr.id)}
                              disabled={actionLoading === sr.id}
                              className="px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-60"
                            >
                              {actionLoading === sr.id ? "…" : "Bezahlt"}
                            </button>
                          )}
                          <button
                            onClick={() => loeschen(sr.id)}
                            disabled={actionLoading === sr.id}
                            className="px-2 py-1 text-xs bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded-lg font-medium transition-colors disabled:opacity-60"
                          >
                            Löschen
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
