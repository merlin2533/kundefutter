"use client";
import { useEffect, useState } from "react";

interface BilanzEintrag {
  kundeId: number;
  kundeName: string;
  flaeche: number | null;
  n_kg: number;
  p_kg: number;
  k_kg: number;
  n_kgPerHa: number | null;
  grenzwertUeberschritten: boolean;
}

export default function DuevBilanzPage() {
  const currentYear = new Date().getFullYear();
  const [jahr, setJahr] = useState(currentYear);
  const [daten, setDaten] = useState<BilanzEintrag[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/duev/bilanz?jahr=${jahr}`)
      .then((r) => (r.ok ? r.json() : { daten: [] }))
      .then((d) => {
        setDaten(Array.isArray(d.daten) ? d.daten : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [jahr]);

  const ueberschritten = daten.filter((e) => e.grenzwertUeberschritten).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nährstoffbilanz (DüV §8)</h1>
          <p className="text-sm text-gray-500 mt-0.5">Stickstoff-Ausbringung je Kunde, Grenzwert 170 kg N/ha/Jahr</p>
        </div>
        <select
          value={jahr}
          onChange={(e) => setJahr(parseInt(e.target.value, 10))}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
        >
          {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {ueberschritten > 0 && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800 flex items-start gap-2">
          <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <strong>{ueberschritten} {ueberschritten === 1 ? "Kunde überschreitet" : "Kunden überschreiten"}</strong> den
            Grenzwert von 170 kg N/ha/Jahr gemäß DüV §8. Bitte prüfen Sie die Ausbringungsmenge.
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Lade…</div>
      ) : daten.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <p className="text-lg font-semibold text-gray-600 mb-1">Keine Daten</p>
          <p className="text-sm text-gray-400 text-center max-w-xs">
            Für {jahr} wurden keine Dünger-Lieferungen mit Inhaltsstoffangaben gefunden.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Kunde</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Fläche (ha)</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">N (kg)</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600 hidden sm:table-cell">P (kg)</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600 hidden sm:table-cell">K (kg)</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">N/ha</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {daten.map((e) => (
                <tr key={e.kundeId} className={`hover:bg-gray-50 ${e.grenzwertUeberschritten ? "bg-red-50" : ""}`}>
                  <td className="px-4 py-3 font-medium text-gray-900">{e.kundeName}</td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {e.flaeche != null ? e.flaeche.toLocaleString("de-DE") : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700">
                    {e.n_kg.toLocaleString("de-DE", { maximumFractionDigits: 1 })}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700 hidden sm:table-cell">
                    {e.p_kg.toLocaleString("de-DE", { maximumFractionDigits: 1 })}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700 hidden sm:table-cell">
                    {e.k_kg.toLocaleString("de-DE", { maximumFractionDigits: 1 })}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {e.n_kgPerHa != null ? (
                      <span className={e.grenzwertUeberschritten ? "text-red-600 font-bold" : "text-gray-700"}>
                        {e.n_kgPerHa.toLocaleString("de-DE", { maximumFractionDigits: 1 })}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {e.grenzwertUeberschritten ? (
                      <span className="inline-block text-xs font-medium px-2 py-1 rounded-full bg-red-100 text-red-700 border border-red-200">
                        ⚠ Grenzwert überschritten
                      </span>
                    ) : (
                      <span className="inline-block text-xs font-medium px-2 py-1 rounded-full bg-green-50 text-green-700 border border-green-200">
                        OK
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-700">
        <strong>Rechtlicher Hinweis:</strong> Gemäß Düngeverordnung §8 darf die Stickstoffausbringung
        im Betriebsdurchschnitt 170 kg N/ha/Jahr nicht überschreiten. Die Berechnung basiert auf
        den Inhaltsstoffangaben der gelieferten Düngemittel-Artikel.
      </div>
    </div>
  );
}
