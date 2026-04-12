"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { formatEuro, formatDatum } from "@/lib/utils";

interface Lieferposition {
  id: number;
  menge: number;
  verkaufspreis: number;
  rabattProzent: number;
  chargeNr: string | null;
  artikel: { id: number; name: string; einheit: string };
}

interface Rechnung {
  id: number;
  rechnungNr: string;
  rechnungDatum: string | null;
  datum: string;
  notiz: string | null;
  kunde: { id: number; name: string; firma: string | null };
  positionen: Lieferposition[];
  bezahltAm: string | null;
  zahlungsziel: number | null;
}

type FilterStatus = "alle" | "offen" | "ueberfaellig" | "bezahlt";

function berechneBetrag(positionen: Lieferposition[]) {
  return positionen.reduce(
    (sum, p) => sum + p.menge * p.verkaufspreis * (1 - p.rabattProzent / 100),
    0
  );
}

function getRechnungStatus(r: Rechnung): "bezahlt" | "ueberfaellig" | "offen" {
  if (r.bezahltAm) return "bezahlt";
  const basis = r.rechnungDatum ?? r.datum;
  const faelligAm = new Date(basis);
  faelligAm.setDate(faelligAm.getDate() + (r.zahlungsziel ?? 30));
  if (faelligAm < new Date()) return "ueberfaellig";
  return "offen";
}

function StatusBadge({ status }: { status: "bezahlt" | "ueberfaellig" | "offen" }) {
  const map = {
    bezahlt: "bg-green-100 text-green-800",
    ueberfaellig: "bg-red-100 text-red-800",
    offen: "bg-yellow-100 text-yellow-800",
  };
  const label = { bezahlt: "Bezahlt", ueberfaellig: "Überfällig", offen: "Offen" };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${map[status]}`}>
      {label[status]}
    </span>
  );
}

export default function RechnungenPage() {
  const [rechnungen, setRechnungen] = useState<Rechnung[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>("alle");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [buchungId, setBuchungId] = useState<number | null>(null);
  const [buchungDatum, setBuchungDatum] = useState(new Date().toISOString().slice(0, 10));

  function load() {
    fetch("/api/lieferungen?hatRechnung=true")
      .then((r) => r.json())
      .then((data) => { setRechnungen(data); setLoading(false); })
      .catch(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function buchungSpeichern(id: number) {
    try {
      await fetch(`/api/lieferungen/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bezahltAm: buchungDatum }),
      });
      setBuchungId(null);
      setLoading(true);
      load();
    } catch {
      setLoading(false);
    }
  }

  async function zahlungLoesen(id: number) {
    try {
      await fetch(`/api/lieferungen/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bezahltAm: null }),
      });
      setLoading(true);
      load();
    } catch {
      setLoading(false);
    }
  }

  const gefiltert = rechnungen.filter((r) => {
    const st = getRechnungStatus(r);
    const matchFilter =
      filter === "alle" ||
      (filter === "offen" && st === "offen") ||
      (filter === "ueberfaellig" && st === "ueberfaellig") ||
      (filter === "bezahlt" && st === "bezahlt");
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      r.rechnungNr.toLowerCase().includes(q) ||
      r.kunde.name.toLowerCase().includes(q) ||
      (r.kunde.firma ?? "").toLowerCase().includes(q);
    return matchFilter && matchSearch;
  });

  const gesamtOffen = rechnungen
    .filter((r) => getRechnungStatus(r) === "offen")
    .reduce((s, r) => s + berechneBetrag(r.positionen), 0);

  const gesamtUeberfaellig = rechnungen
    .filter((r) => getRechnungStatus(r) === "ueberfaellig")
    .reduce((s, r) => s + berechneBetrag(r.positionen), 0);

  return (
    <main className="max-w-screen-xl mx-auto px-4 py-4 sm:py-8">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rechnungen</h1>
          <p className="text-sm text-gray-500 mt-0.5">Alle erstellten Rechnungen aus Lieferscheinen</p>
        </div>
        <Link
          href="/rechnungen/neu"
          className="w-full sm:w-auto text-center bg-green-700 hover:bg-green-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + Neue Rechnung
        </Link>
      </div>

      {/* KPI-Kacheln */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Gesamt</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{rechnungen.length}</p>
          <p className="text-xs text-gray-400 mt-1">
            {formatEuro(rechnungen.reduce((s, r) => s + berechneBetrag(r.positionen), 0))}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-yellow-200 shadow-sm p-4">
          <p className="text-xs text-yellow-700 uppercase tracking-wide">Offen</p>
          <p className="text-2xl font-bold text-yellow-700 mt-1">{formatEuro(gesamtOffen)}</p>
          <p className="text-xs text-yellow-600 mt-1">
            {rechnungen.filter((r) => getRechnungStatus(r) === "offen").length} Rechnungen
          </p>
        </div>
        <div className="bg-white rounded-xl border border-red-200 shadow-sm p-4">
          <p className="text-xs text-red-700 uppercase tracking-wide">Überfällig</p>
          <p className="text-2xl font-bold text-red-700 mt-1">{formatEuro(gesamtUeberfaellig)}</p>
          <p className="text-xs text-red-600 mt-1">
            {rechnungen.filter((r) => getRechnungStatus(r) === "ueberfaellig").length} Rechnungen
          </p>
        </div>
      </div>

      {/* Filter & Suche */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="Suche nach Rechnung-Nr oder Kunde…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full sm:w-72 focus:outline-none focus:ring-2 focus:ring-green-600"
        />
        <div className="flex gap-1 flex-wrap">
          {(["alle", "offen", "ueberfaellig", "bezahlt"] as FilterStatus[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === f
                  ? "bg-green-700 text-white"
                  : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
            >
              {f === "alle" ? "Alle" : f === "offen" ? "Offen" : f === "ueberfaellig" ? "Überfällig" : "Bezahlt"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Lade…</div>
      ) : gefiltert.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          {rechnungen.length === 0 ? "Noch keine Rechnungen vorhanden." : "Keine Rechnungen für diesen Filter."}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="w-8" />
                <th className="text-left px-4 py-3 font-medium text-gray-600">Rechnung-Nr</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Datum</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Fällig am</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Kunde</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Betrag</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {gefiltert.map((r) => {
                const st = getRechnungStatus(r);
                const betrag = berechneBetrag(r.positionen);
                const faelligAm = new Date(r.rechnungDatum ?? r.datum);
                faelligAm.setDate(faelligAm.getDate() + (r.zahlungsziel ?? 30));
                const isExpanded = expanded === r.id;
                return (
                  <React.Fragment key={r.id}>
                    <tr
                      className={`border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer ${isExpanded ? "bg-green-50" : ""}`}
                      onClick={() => setExpanded(isExpanded ? null : r.id)}
                    >
                      <td className="px-3 py-3 text-gray-400 text-xs text-center">
                        {isExpanded ? "▲" : "▼"}
                      </td>
                      <td className="px-4 py-3 font-mono font-medium text-gray-900">
                        {r.rechnungNr}
                        <div className="sm:hidden text-xs text-gray-500 font-sans font-normal mt-0.5">
                          {r.kunde.firma ?? r.kunde.name} · {formatDatum(r.rechnungDatum ?? r.datum)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700 hidden sm:table-cell">{formatDatum(r.rechnungDatum ?? r.datum)}</td>
                      <td className={`px-4 py-3 hidden md:table-cell ${st === "ueberfaellig" ? "text-red-600 font-medium" : "text-gray-700"}`}>
                        {formatDatum(faelligAm)}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <Link
                          href={`/kunden/${r.kunde.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-green-700 hover:underline font-medium"
                        >
                          {r.kunde.firma ?? r.kunde.name}
                        </Link>
                        {r.kunde.firma && (
                          <span className="text-xs text-gray-400 block">{r.kunde.name}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">{formatEuro(betrag)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={st} />
                        {r.bezahltAm && (
                          <span className="text-xs text-gray-400 block mt-0.5">{formatDatum(r.bezahltAm)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-0.5">
                          {/* Rechnung öffnen */}
                          <Link
                            href={`/lieferungen/${r.id}/rechnung`}
                            className="p-1.5 text-green-800 hover:bg-green-50 hover:text-green-900 rounded transition-colors"
                            title="Rechnung öffnen"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                          </Link>
                          {/* Lieferschein */}
                          <Link
                            href={`/lieferungen/${r.id}/lieferschein`}
                            className="p-1.5 text-gray-600 hover:bg-gray-100 hover:text-gray-900 rounded transition-colors"
                            title="Lieferschein"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                          </Link>
                          {/* PDF + ZUGFeRD herunterladen */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const a = document.createElement("a");
                              a.href = `/api/exporte/rechnung?lieferungId=${r.id}`;
                              a.download = "";
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                              if (r.rechnungNr) {
                                setTimeout(() => {
                                  const b = document.createElement("a");
                                  b.href = `/api/exporte/zugferd?lieferungId=${r.id}`;
                                  b.download = "";
                                  document.body.appendChild(b);
                                  b.click();
                                  document.body.removeChild(b);
                                }, 600);
                              }
                            }}
                            className="p-1.5 text-gray-600 hover:bg-gray-100 hover:text-gray-900 rounded transition-colors"
                            title="PDF + ZUGFeRD XML herunterladen"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          </button>
                          {/* Zahlung buchen / Rückgängig */}
                          {st !== "bezahlt" ? (
                            <button
                              onClick={() => {
                                setBuchungId(r.id);
                                setBuchungDatum(new Date().toISOString().slice(0, 10));
                              }}
                              className="p-1.5 text-green-700 hover:bg-green-50 hover:text-green-900 rounded transition-colors"
                              title="Zahlung buchen"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </button>
                          ) : (
                            <button
                              onClick={() => zahlungLoesen(r.id)}
                              className="p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 rounded transition-colors"
                              title="Zahlung rückgängig"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {/* Positionen-Zeile */}
                    {isExpanded && (
                      <tr key={`${r.id}-pos`} className="bg-green-50 border-b border-green-100">
                        <td colSpan={8} className="px-6 py-3">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-gray-500">
                                <th className="text-left pb-1 pr-4 font-medium">Artikel</th>
                                <th className="text-right pb-1 pr-4 font-medium">Menge</th>
                                <th className="text-right pb-1 pr-4 font-medium">Einzelpreis</th>
                                <th className="text-right pb-1 pr-4 font-medium">Rabatt</th>
                                <th className="text-right pb-1 font-medium">Gesamt</th>
                              </tr>
                            </thead>
                            <tbody>
                              {r.positionen.map((p) => {
                                const netto = p.menge * p.verkaufspreis * (1 - p.rabattProzent / 100);
                                return (
                                  <tr key={p.id} className="border-t border-green-100">
                                    <td className="py-1 pr-4 font-medium text-gray-800">
                                      {p.artikel.name}
                                      {p.chargeNr && <span className="text-gray-400 ml-1">[{p.chargeNr}]</span>}
                                    </td>
                                    <td className="py-1 pr-4 text-right font-mono">
                                      {p.menge.toLocaleString("de-DE", { maximumFractionDigits: 3 })} {p.artikel.einheit}
                                    </td>
                                    <td className="py-1 pr-4 text-right font-mono">{formatEuro(p.verkaufspreis)}</td>
                                    <td className="py-1 pr-4 text-right text-gray-500">
                                      {p.rabattProzent > 0 ? `${p.rabattProzent} %` : "—"}
                                    </td>
                                    <td className="py-1 text-right font-mono font-medium">{formatEuro(netto)}</td>
                                  </tr>
                                );
                              })}
                              <tr className="border-t-2 border-green-200 font-semibold">
                                <td colSpan={4} className="py-1.5 pr-4 text-right text-gray-700">Netto gesamt:</td>
                                <td className="py-1.5 text-right font-mono text-green-800">{formatEuro(betrag)}</td>
                              </tr>
                            </tbody>
                          </table>
                          {r.notiz && (
                            <p className="text-xs text-gray-500 mt-2 italic">{r.notiz}</p>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 border-t-2 border-gray-200">
                <td colSpan={5} className="px-4 py-3 text-sm font-semibold text-gray-700">
                  {gefiltert.length} Rechnung{gefiltert.length !== 1 ? "en" : ""}
                </td>
                <td className="px-4 py-3 text-right font-bold text-gray-900">
                  {formatEuro(gefiltert.reduce((s, r) => s + berechneBetrag(r.positionen), 0))}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Zahlung buchen Dialog */}
      {buchungId !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Zahlung buchen</h2>
            <label className="block text-sm font-medium text-gray-700 mb-1">Zahlungsdatum</label>
            <input
              type="date"
              value={buchungDatum}
              onChange={(e) => setBuchungDatum(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
            />
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => buchungSpeichern(buchungId)}
                className="flex-1 bg-green-700 hover:bg-green-800 text-white py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Speichern
              </button>
              <button
                onClick={() => setBuchungId(null)}
                className="flex-1 border border-gray-300 text-gray-700 hover:bg-gray-50 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
