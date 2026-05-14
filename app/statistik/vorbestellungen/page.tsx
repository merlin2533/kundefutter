"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatEuro, formatPercent } from "@/lib/utils";
import ZeitraumFilter from "@/components/ZeitraumFilter";

interface StatusRow {
  status: string;
  anzahl: number;
  wert: number;
}

interface SaisonRow {
  saison: string;
  anzahl: number;
  wert: number;
}

interface Data {
  nachStatus: StatusRow[];
  nachSaison: SaisonRow[];
  umwandlungsquote: number;
  summe: { anzahl: number; wert: number };
}

const STATUS_LABELS: Record<string, string> = {
  OFFEN: "Offen",
  BESTAETIGT: "Bestätigt",
  UMGEWANDELT: "Umgewandelt",
  STORNIERT: "Storniert",
};

const STATUS_COLORS: Record<string, string> = {
  OFFEN: "bg-amber-100 text-amber-800",
  BESTAETIGT: "bg-blue-100 text-blue-800",
  UMGEWANDELT: "bg-green-100 text-green-800",
  STORNIERT: "bg-red-100 text-red-800",
};

export default function StatistikVorbestellungenPage() {
  const now = new Date();
  const [jahr, setJahr] = useState(String(now.getFullYear()));
  const [vonMonat, setVonMonat] = useState("01");
  const [bisMonat, setBisMonat] = useState(String(now.getMonth() + 1).padStart(2, "0"));
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const laden = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        von: `${jahr}-${vonMonat}`,
        bis: `${jahr}-${bisMonat}`,
      });
      const res = await fetch(`/api/statistik/vorbestellungen?${params}`);
      if (!res.ok) { setError("Auswertung konnte nicht geladen werden."); return; }
      setData(await res.json());
    } catch {
      setError("Netzwerkfehler beim Laden.");
    } finally {
      setLoading(false);
    }
  }, [jahr, vonMonat, bisMonat]);

  useEffect(() => { laden(); }, [laden]);

  const nachStatus = Array.isArray(data?.nachStatus) ? data!.nachStatus : [];
  const nachSaison = Array.isArray(data?.nachSaison) ? data!.nachSaison : [];

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link href="/statistik" className="hover:text-green-700">Statistik</Link>
          <span>›</span>
          <span className="text-gray-800 font-medium">Vorbestellungen</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Vorbestellungen / Frühbezug</h1>
        <p className="text-sm text-gray-500 mt-1">Auswertung der Saison-Vorbestellungen nach Status und Saison.</p>
      </div>

      <ZeitraumFilter
        jahr={jahr} setJahr={setJahr}
        vonMonat={vonMonat} setVonMonat={setVonMonat}
        bisMonat={bisMonat} setBisMonat={setBisMonat}
        showQuickButtons
        loading={loading}
      />

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
      )}

      {data && (
        <>
          {/* KPI-Karten */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Vorbestellungen</p>
              <p className="text-2xl font-bold mt-1 text-gray-900">{data.summe.anzahl}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Gesamtwert</p>
              <p className="text-2xl font-bold mt-1 text-green-700">{formatEuro(data.summe.wert)}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Umwandlungsquote</p>
              <p className="text-2xl font-bold mt-1 text-gray-900">{formatPercent(data.umwandlungsquote)}</p>
              <p className="text-xs text-gray-400 mt-0.5">Umgewandelt / (alle ohne Storno)</p>
            </div>
          </div>

          {/* Aufschlüsselung nach Status */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-700">Nach Status</h2>
            </div>
            {nachStatus.length === 0 ? (
              <p className="p-6 text-sm text-gray-400">Keine Vorbestellungen im gewählten Zeitraum.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Anzahl</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Wert</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {nachStatus.map((r) => (
                      <tr key={r.status} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[r.status] ?? "bg-gray-100 text-gray-700"}`}>
                            {STATUS_LABELS[r.status] ?? r.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono">{r.anzahl}</td>
                        <td className="px-4 py-2.5 text-right font-mono">{formatEuro(r.wert)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Aufschlüsselung nach Saison */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-700">Nach Saison</h2>
            </div>
            {nachSaison.length === 0 ? (
              <p className="p-6 text-sm text-gray-400">Keine Saisondaten verfügbar.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Saison</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Anzahl</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Wert</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {nachSaison.map((r) => (
                      <tr key={r.saison} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium text-gray-800">{r.saison}</td>
                        <td className="px-4 py-2.5 text-right font-mono">{r.anzahl}</td>
                        <td className="px-4 py-2.5 text-right font-mono">{formatEuro(r.wert)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
