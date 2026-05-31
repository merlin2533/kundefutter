"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { MONATE_KURZ, getJahreListeNum } from "@/lib/utils";

const MONATE = MONATE_KURZ;
const STATUS_COLOR: Record<string, string> = {
  OFFEN: "bg-amber-100 text-amber-800",
  ABGERECHNET: "bg-blue-100 text-blue-800",
  AUSGEZAHLT: "bg-green-100 text-green-700",
};
const TYP_LABEL: Record<string, string> = { festgehalt: "Festgehalt", minijob: "Minijob", stundenbasis: "Stundenbasis" };

function loadFilters() {
  try { return JSON.parse(sessionStorage.getItem("personal-abrechnungen-filters") ?? "{}"); } catch { return {}; }
}

interface Abrechnung {
  id: number;
  monat: number;
  jahr: number;
  brutto: number;
  netto: number;
  status: string;
  stundenGesamt: number | null;
  zahlungsDatum: string | null;
  mitarbeiter: { id: number; vorname: string; nachname: string; typ: string };
}

export default function AbrechnungenPage() {
  const now = new Date();
  const f = loadFilters();
  const [monat, setMonat] = useState<number>(f.monat ?? now.getMonth() + 1);
  const [jahr, setJahr] = useState<number>(f.jahr ?? now.getFullYear());
  const [statusFilter, setStatusFilter] = useState<string>(f.status ?? "alle");
  const [abrechnungen, setAbrechnungen] = useState<Abrechnung[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    try { sessionStorage.setItem("personal-abrechnungen-filters", JSON.stringify({ monat, jahr, status: statusFilter })); } catch {}
  }, [monat, jahr, statusFilter]);

  function loadData() {
    setLoading(true);
    const params = new URLSearchParams({ monat: String(monat), jahr: String(jahr) });
    if (statusFilter !== "alle") params.set("status", statusFilter);
    fetch(`/api/personal/abrechnungen?${params}`)
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setAbrechnungen(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadData(); }, [monat, jahr, statusFilter]);

  async function handleBulkAbrechnen() {
    const offene = abrechnungen.filter((a) => a.status === "OFFEN");
    if (offene.length === 0) return;
    if (!confirm(`${offene.length} offene Abrechnungen als 'Abgerechnet' markieren?`)) return;
    setActionLoading(true);
    for (const a of offene) {
      await fetch(`/api/personal/abrechnungen/${a.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aktion: "abrechnen" }),
      });
    }
    setActionLoading(false);
    loadData();
  }

  async function handleAuszahlen(id: number) {
    setActionLoading(true);
    setError("");
    const res = await fetch(`/api/personal/abrechnungen/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aktion: "auszahlen" }),
    });
    setActionLoading(false);
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Fehler");
    } else {
      loadData();
    }
  }

  const gesamt = abrechnungen.reduce((sum, a) => sum + a.netto, 0);
  const offen = abrechnungen.filter((a) => a.status === "OFFEN").length;
  const abgerechnet = abrechnungen.filter((a) => a.status === "ABGERECHNET").length;
  const ausgezahlt = abrechnungen.filter((a) => a.status === "AUSGEZAHLT").length;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Gehaltsabrechnungen</h1>
        <Link href="/personal/abrechnungen/neu" className="bg-green-700 text-white px-4 py-2 rounded-lg hover:bg-green-800 text-sm font-medium">
          + Neue Abrechnung
        </Link>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={monat}
          onChange={(e) => setMonat(parseInt(e.target.value, 10))}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          {MONATE.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select
          value={jahr}
          onChange={(e) => setJahr(parseInt(e.target.value, 10))}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          {getJahreListeNum().map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          <option value="alle">Alle Status</option>
          <option value="OFFEN">Offen</option>
          <option value="ABGERECHNET">Abgerechnet</option>
          <option value="AUSGEZAHLT">Ausgezahlt</option>
        </select>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="bg-white border rounded-lg p-3 text-center">
          <div className="text-xs text-gray-500">Gesamt</div>
          <div className="text-lg font-bold">{gesamt.toFixed(2)} €</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
          <div className="text-xs text-amber-600">Offen</div>
          <div className={`text-lg font-bold ${offen > 0 ? "text-amber-700" : "text-gray-400"}`}>{offen}</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
          <div className="text-xs text-blue-600">Abgerechnet</div>
          <div className="text-lg font-bold text-blue-700">{abgerechnet}</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
          <div className="text-xs text-green-600">Ausgezahlt</div>
          <div className="text-lg font-bold text-green-700">{ausgezahlt}</div>
        </div>
      </div>

      {/* Aktionen */}
      {offen > 0 && (
        <div className="flex gap-3 mb-4">
          <button
            onClick={handleBulkAbrechnen}
            disabled={actionLoading}
            className="text-sm border px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Alle {offen} offenen → Abgerechnet
          </button>
          {abgerechnet > 0 && (
            <Link href={`/personal/ueberweisungsliste?monat=${monat}&jahr=${jahr}`} className="text-sm border px-3 py-1.5 rounded-lg hover:bg-blue-50 text-blue-700">
              Überweisungsliste ({abgerechnet})
            </Link>
          )}
        </div>
      )}

      {error && <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700 mb-4">{error}</div>}

      {loading ? (
        <div className="p-8 text-center text-gray-500">Lade…</div>
      ) : abrechnungen.length === 0 ? (
        <div className="bg-white border rounded-lg p-8 text-center text-gray-400">
          Keine Abrechnungen für {MONATE[monat - 1]} {jahr}.{" "}
          <Link href="/personal/abrechnungen/neu" className="text-green-700 hover:underline">Abrechnung erstellen →</Link>
        </div>
      ) : (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase">
                <th className="px-4 py-2 text-left">Mitarbeiter</th>
                <th className="px-4 py-2 text-left hidden sm:table-cell">Typ</th>
                {statusFilter !== "OFFEN" && statusFilter !== "ABGERECHNET" && (
                  <th className="px-4 py-2 text-right hidden md:table-cell">Stunden</th>
                )}
                <th className="px-4 py-2 text-right">Brutto</th>
                <th className="px-4 py-2 text-right">Netto</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {abrechnungen.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <Link href={`/personal/${a.mitarbeiter.id}?tab=abrechnung`} className="font-medium hover:text-green-700">
                      {a.mitarbeiter.vorname} {a.mitarbeiter.nachname}
                    </Link>
                  </td>
                  <td className="px-4 py-2 hidden sm:table-cell text-xs text-gray-500">
                    {TYP_LABEL[a.mitarbeiter.typ] ?? a.mitarbeiter.typ}
                  </td>
                  {statusFilter !== "OFFEN" && statusFilter !== "ABGERECHNET" && (
                    <td className="px-4 py-2 text-right hidden md:table-cell text-gray-400 text-xs">
                      {a.stundenGesamt != null ? `${a.stundenGesamt.toFixed(1)} h` : "—"}
                    </td>
                  )}
                  <td className="px-4 py-2 text-right text-gray-600">{a.brutto.toFixed(2)} €</td>
                  <td className="px-4 py-2 text-right font-medium">{a.netto.toFixed(2)} €</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[a.status] ?? "bg-gray-100"}`}>
                      {a.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      {a.status === "ABGERECHNET" && (
                        <button
                          onClick={() => handleAuszahlen(a.id)}
                          disabled={actionLoading}
                          className="text-xs text-green-700 hover:underline disabled:opacity-50"
                        >
                          Auszahlen
                        </button>
                      )}
                      <Link href={`/personal/abrechnungen/${a.id}/druck`} target="_blank" className="text-xs text-gray-500 hover:underline">
                        Druck
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-medium">
                <td colSpan={3} className="px-4 py-2 text-xs text-gray-500">Gesamt</td>
                <td className="px-4 py-2 text-right text-sm">{abrechnungen.reduce((s, a) => s + a.brutto, 0).toFixed(2)} €</td>
                <td className="px-4 py-2 text-right text-sm">{gesamt.toFixed(2)} €</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
