"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { formatEuro, formatDatum } from "@/lib/utils";

interface Lieferposition {
  menge: number;
  verkaufspreis: number;
}

interface Rechnung {
  id: number;
  rechnungNr: string;
  rechnungDatum: string;
  datum: string;
  kunde: { id: number; name: string; firma: string | null };
  positionen: Lieferposition[];
  bezahltAm: string | null;
  zahlungsziel: number | null;
  status: string;
}

type FilterStatus = "alle" | "offen" | "ueberfaellig" | "bezahlt";

function berechneBetrag(positionen: Lieferposition[]) {
  return positionen.reduce((sum, p) => sum + p.menge * p.verkaufspreis, 0);
}

function getRechnungStatus(r: Rechnung): "bezahlt" | "ueberfaellig" | "offen" {
  if (r.bezahltAm) return "bezahlt";
  const faelligAm = new Date(r.rechnungDatum);
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
  const label = {
    bezahlt: "Bezahlt",
    ueberfaellig: "Überfällig",
    offen: "Offen",
  };
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
  const [buchungId, setBuchungId] = useState<number | null>(null);
  const [buchungDatum, setBuchungDatum] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    fetch("/api/lieferungen?hatRechnung=true")
      .then((r) => r.json())
      .then((data) => {
        setRechnungen(data);
        setLoading(false);
      });
  }, []);

  function reload() {
    setLoading(true);
    fetch("/api/lieferungen?hatRechnung=true")
      .then((r) => r.json())
      .then((data) => {
        setRechnungen(data);
        setLoading(false);
      });
  }

  async function buchungSpeichern(id: number) {
    await fetch(`/api/lieferungen/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bezahltAm: buchungDatum }),
    });
    setBuchungId(null);
    reload();
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
    <main className="max-w-screen-xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rechnungen</h1>
          <p className="text-sm text-gray-500 mt-0.5">Alle erstellten Rechnungen</p>
        </div>
        <Link
          href="/rechnungen/neu"
          className="bg-green-700 hover:bg-green-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + Neue Rechnung
        </Link>
      </div>

      {/* KPI-Kacheln */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Gesamt Rechnungen</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{rechnungen.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-yellow-200 shadow-sm p-4">
          <p className="text-xs text-yellow-700 uppercase tracking-wide">Offen</p>
          <p className="text-2xl font-bold text-yellow-700 mt-1">{formatEuro(gesamtOffen)}</p>
        </div>
        <div className="bg-white rounded-xl border border-red-200 shadow-sm p-4">
          <p className="text-xs text-red-700 uppercase tracking-wide">Überfällig</p>
          <p className="text-2xl font-bold text-red-700 mt-1">{formatEuro(gesamtUeberfaellig)}</p>
        </div>
      </div>

      {/* Filter & Suche */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="Suche nach Rechnung-Nr oder Kunde…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-green-600"
        />
        <div className="flex gap-1">
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

      {/* Tabelle */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Lade…</div>
      ) : gefiltert.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          {rechnungen.length === 0
            ? "Noch keine Rechnungen vorhanden."
            : "Keine Rechnungen für diesen Filter."}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Rechnung-Nr</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Datum</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Fällig am</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Kunde</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Betrag</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {gefiltert.map((r) => {
                const st = getRechnungStatus(r);
                const betrag = berechneBetrag(r.positionen);
                const faelligAm = new Date(r.rechnungDatum);
                faelligAm.setDate(faelligAm.getDate() + (r.zahlungsziel ?? 30));
                return (
                  <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-gray-900">{r.rechnungNr}</td>
                    <td className="px-4 py-3 text-gray-700">{formatDatum(r.rechnungDatum)}</td>
                    <td className={`px-4 py-3 ${st === "ueberfaellig" ? "text-red-600 font-medium" : "text-gray-700"}`}>
                      {formatDatum(faelligAm)}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/kunden/${r.kunde.id}`} className="text-green-700 hover:underline font-medium">
                        {r.kunde.name}
                      </Link>
                      {r.kunde.firma && (
                        <span className="text-xs text-gray-400 block">{r.kunde.firma}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{formatEuro(betrag)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={st} />
                      {r.bezahltAm && (
                        <span className="text-xs text-gray-400 block mt-0.5">{formatDatum(r.bezahltAm)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/lieferungen/${r.id}`}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Details
                        </Link>
                        {st !== "bezahlt" && (
                          <button
                            onClick={() => {
                              setBuchungId(r.id);
                              setBuchungDatum(new Date().toISOString().slice(0, 10));
                            }}
                            className="text-xs text-green-700 hover:underline"
                          >
                            Zahlung buchen
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 border-t-2 border-gray-200">
                <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-gray-700">
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
