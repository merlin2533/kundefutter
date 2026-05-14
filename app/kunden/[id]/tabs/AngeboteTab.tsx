"use client";

import { useEffect, useState } from "react";
import { formatEuro, formatDatum } from "@/lib/utils";
import { ANGEBOT_STATUS_LABELS, ANGEBOT_STATUS_FARBEN } from "../_shared";

interface AngebotListItem {
  id: number;
  nummer: string;
  datum: string;
  gueltigBis: string | null;
  status: string;
  gesamtbetrag: number;
  positionenAnzahl: number;
}

export default function AngeboteTab({ kundeId }: { kundeId: number }) {
  const [angebote, setAngebote] = useState<AngebotListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/angebote?kundeId=${kundeId}`)
      .then((r) => r.json())
      .then((d) => { setAngebote(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [kundeId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-900">Angebote</h3>
        <a
          href={`/angebote/neu?kundeId=${kundeId}`}
          className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-700 text-white text-xs font-medium rounded-lg hover:bg-green-800 transition-colors"
        >
          + Neues Angebot
        </a>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Lade…</p>
      ) : angebote.length === 0 ? (
        <div className="text-center py-10 text-gray-400 border border-dashed border-gray-200 rounded-xl">
          <p className="text-2xl mb-2">📋</p>
          <p className="text-sm">Noch keine Angebote für diesen Kunden.</p>
          <a href={`/angebote/neu?kundeId=${kundeId}`} className="mt-2 inline-block text-green-700 text-sm hover:underline">
            Erstes Angebot erstellen
          </a>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nummer</th>
                <th className="hidden sm:table-cell text-left py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Datum</th>
                <th className="hidden md:table-cell text-left py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Gültig bis</th>
                <th className="hidden md:table-cell text-right py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Pos.</th>
                <th className="text-right py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Betrag</th>
                <th className="text-center py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {angebote.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="py-2 pr-4 font-mono font-medium text-gray-900">
                    {a.nummer}
                    <div className="sm:hidden text-xs text-gray-500 mt-0.5">{formatDatum(a.datum)}</div>
                  </td>
                  <td className="hidden sm:table-cell py-2 pr-4 text-gray-600">{formatDatum(a.datum)}</td>
                  <td className="hidden md:table-cell py-2 pr-4 text-gray-600">
                    {a.gueltigBis ? formatDatum(a.gueltigBis) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="hidden md:table-cell py-2 pr-4 text-right text-gray-600">{a.positionenAnzahl}</td>
                  <td className="py-2 pr-4 text-right font-medium text-gray-900">{formatEuro(a.gesamtbetrag)}</td>
                  <td className="py-2 pr-4 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${ANGEBOT_STATUS_FARBEN[a.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {ANGEBOT_STATUS_LABELS[a.status] ?? a.status}
                    </span>
                  </td>
                  <td className="py-2 text-right">
                    <a href={`/angebote/${a.id}`} className="text-xs text-green-700 hover:underline font-medium">
                      Details →
                    </a>
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
