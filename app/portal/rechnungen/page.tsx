"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Rechnung {
  id: number;
  datum: string;
  rechnungNr: string | null;
  rechnungDatum: string | null;
  status: string;
  bezahlt: boolean;
  gesamtBetrag: number;
}

function formatEuro(n: number) {
  return n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

function formatDatum(s: string) {
  return new Date(s).toLocaleDateString("de-DE");
}

export default function PortalRechnungenPage() {
  const [rechnungen, setRechnungen] = useState<Rechnung[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/portal/rechnungen")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setRechnungen(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/portal" className="text-sm text-gray-500 hover:text-gray-700">
          ← Zurück
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Rechnungen</h1>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 text-center mt-8">Lade…</p>
      ) : rechnungen.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-gray-500">Keine Rechnungen vorhanden.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Rechnungs-Nr.</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Datum</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Betrag</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {rechnungen.map((r) => (
                <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {r.rechnungNr ?? `Lieferung #${r.id}`}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {formatDatum(r.rechnungDatum ?? r.datum)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {formatEuro(r.gesamtBetrag)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block text-xs px-2 py-1 rounded-full font-medium ${
                      r.bezahlt
                        ? "bg-green-100 text-green-700"
                        : "bg-amber-100 text-amber-700"
                    }`}>
                      {r.bezahlt ? "Bezahlt" : "Offen"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
