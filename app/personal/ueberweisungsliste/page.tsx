"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { MONATE_KURZ, getJahreListeNum } from "@/lib/utils";

const MONATE = MONATE_KURZ;

interface UeberweisungsEintrag {
  id: number;
  mitarbeiterId: number;
  vorname: string;
  nachname: string;
  iban: string | null;
  bic: string | null;
  kontoinhaber: string | null;
  netto: number;
  monat: number;
  jahr: number;
  status: string;
}

function UeberweisungslisteInner() {
  const params = useSearchParams();
  const now = new Date();
  const [monat, setMonat] = useState(params.get("monat") ? parseInt(params.get("monat")!, 10) : now.getMonth() + 1);
  const [jahr, setJahr] = useState(params.get("jahr") ? parseInt(params.get("jahr")!, 10) : now.getFullYear());
  const [eintraege, setEintraege] = useState<UeberweisungsEintrag[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  function loadData() {
    setLoading(true);
    fetch(`/api/personal/ueberweisungsliste?monat=${monat}&jahr=${jahr}&format=json`)
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setEintraege(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadData(); }, [monat, jahr]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleCsvDownload() {
    window.open(`/api/personal/ueberweisungsliste?monat=${monat}&jahr=${jahr}&format=csv`, "_blank");
  }

  async function handleBulkAuszahlen() {
    const abgerechnet = eintraege.filter((e) => e.status === "ABGERECHNET");
    if (abgerechnet.length === 0) return;
    if (!confirm(`${abgerechnet.length} Abrechnungen als 'Ausgezahlt' markieren?`)) return;
    setActionLoading(true);
    setError("");
    for (const e of abgerechnet) {
      await fetch(`/api/personal/abrechnungen/${e.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aktion: "auszahlen" }),
      });
    }
    setActionLoading(false);
    loadData();
  }

  const gesamtBetrag = eintraege.reduce((sum, e) => sum + e.netto, 0);
  const ohneIban = eintraege.filter((e) => !e.iban).length;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/personal/abrechnungen" className="text-gray-400 hover:text-gray-600 text-sm">
            ← Abrechnungen
          </Link>
          <h1 className="text-2xl font-bold">Überweisungsliste</h1>
        </div>
        <button
          onClick={handleCsvDownload}
          className="bg-green-700 text-white px-4 py-2 rounded-lg hover:bg-green-800 text-sm font-medium"
        >
          CSV-Export (Excel)
        </button>
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
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white border rounded-lg p-3 text-center">
          <div className="text-xs text-gray-500">Überweisungen</div>
          <div className="text-lg font-bold">{eintraege.length}</div>
        </div>
        <div className="bg-white border rounded-lg p-3 text-center">
          <div className="text-xs text-gray-500">Gesamtbetrag</div>
          <div className="text-lg font-bold text-green-700">{gesamtBetrag.toFixed(2)} €</div>
        </div>
        <div className={`border rounded-lg p-3 text-center ${ohneIban > 0 ? "bg-amber-50 border-amber-200" : "bg-white"}`}>
          <div className={`text-xs ${ohneIban > 0 ? "text-amber-600" : "text-gray-500"}`}>Fehlende IBAN</div>
          <div className={`text-lg font-bold ${ohneIban > 0 ? "text-amber-700" : "text-gray-400"}`}>{ohneIban}</div>
        </div>
      </div>

      {/* Bulk Action */}
      {eintraege.filter((e) => e.status === "ABGERECHNET").length > 0 && (
        <div className="flex gap-3 mb-4">
          <button
            onClick={handleBulkAuszahlen}
            disabled={actionLoading}
            className="text-sm border px-3 py-1.5 rounded-lg hover:bg-green-50 text-green-700 border-green-300 disabled:opacity-50"
          >
            Alle {eintraege.filter((e) => e.status === "ABGERECHNET").length} als ausgezahlt markieren
          </button>
        </div>
      )}

      {error && <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700 mb-4">{error}</div>}

      {loading ? (
        <div className="p-8 text-center text-gray-500">Lade…</div>
      ) : eintraege.length === 0 ? (
        <div className="bg-white border rounded-lg p-8 text-center text-gray-400">
          Keine abgerechneten Einträge für {MONATE[monat - 1]} {jahr}.
        </div>
      ) : (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase">
                <th className="px-4 py-2 text-left">Mitarbeiter</th>
                <th className="px-4 py-2 text-left hidden md:table-cell">IBAN</th>
                <th className="px-4 py-2 text-left hidden lg:table-cell">BIC</th>
                <th className="px-4 py-2 text-right">Betrag</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-right">Aktion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {eintraege.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium">{e.vorname} {e.nachname}</div>
                    {e.kontoinhaber && e.kontoinhaber !== `${e.vorname} ${e.nachname}` && (
                      <div className="text-xs text-gray-400">Inh.: {e.kontoinhaber}</div>
                    )}
                    {/* Mobile: IBAN */}
                    {e.iban && (
                      <div className="md:hidden text-xs text-gray-400 mt-0.5 font-mono">{e.iban}</div>
                    )}
                    {!e.iban && (
                      <div className="text-xs text-amber-600">Keine IBAN hinterlegt</div>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell font-mono text-xs text-gray-600">
                    {e.iban ?? <span className="text-amber-500">—</span>}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-xs text-gray-500">
                    {e.bic ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{e.netto.toFixed(2)} €</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      e.status === "AUSGEZAHLT" ? "bg-green-100 text-green-700" :
                      e.status === "ABGERECHNET" ? "bg-blue-100 text-blue-800" :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      {e.status === "AUSGEZAHLT" ? "Ausgezahlt" : e.status === "ABGERECHNET" ? "Abgerechnet" : e.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/personal/abrechnungen/${e.id}/druck`}
                      target="_blank"
                      className="text-xs text-gray-500 hover:underline"
                    >
                      Gehaltszettel
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-medium">
                <td colSpan={3} className="px-4 py-2 text-xs text-gray-500">Gesamt</td>
                <td className="px-4 py-2 text-right text-sm">{gesamtBetrag.toFixed(2)} €</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {ohneIban > 0 && (
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
          {ohneIban} Mitarbeiter ohne IBAN — Bankdaten unter{" "}
          <Link href="/personal" className="underline">Personal</Link> ergänzen.
        </div>
      )}
    </div>
  );
}

export default function UeberweisungslistePage() {
  return (
    <Suspense>
      <UeberweisungslisteInner />
    </Suspense>
  );
}
