"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface KundeReklamation {
  id: number;
  nummer: string;
  datum: string;
  betreff: string;
  status: string;
  prioritaet: string;
  kategorie: string;
}

const REKO_STATUS_BADGE: Record<string, string> = {
  OFFEN: "bg-yellow-100 text-yellow-800",
  IN_BEARBEITUNG: "bg-blue-100 text-blue-800",
  GELOEST: "bg-green-100 text-green-800",
  GESCHLOSSEN: "bg-gray-100 text-gray-700",
};
const REKO_STATUS_LABEL: Record<string, string> = {
  OFFEN: "Offen",
  IN_BEARBEITUNG: "In Bearbeitung",
  GELOEST: "Gelöst",
  GESCHLOSSEN: "Geschlossen",
};

export default function ReklamationenTab({ kundeId }: { kundeId: number }) {
  const [liste, setListe] = useState<KundeReklamation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/reklamationen?kundeId=${kundeId}`)
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setListe(Array.isArray(d) ? d : []))
      .catch(() => setListe([]))
      .finally(() => setLoading(false));
  }, [kundeId]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-900">Reklamationen</h2>
        <Link
          href={`/reklamationen/neu?kundeId=${kundeId}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 transition-colors"
        >
          + Neue Reklamation
        </Link>
      </div>

      {loading ? (
        <div className="text-sm text-gray-400">Lade…</div>
      ) : liste.length === 0 ? (
        <div className="text-sm text-gray-400 py-4">Keine Reklamationen vorhanden.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left px-3 py-2 font-medium text-gray-600">Datum</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">Nummer</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">Betreff</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600 hidden sm:table-cell">Priorität</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">Status</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {liste.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">
                    {new Date(r.datum).toLocaleDateString("de-DE")}
                  </td>
                  <td className="px-3 py-2.5">
                    <Link href={`/reklamationen/${r.id}`} className="font-mono text-xs text-green-700 hover:underline">
                      {r.nummer}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 max-w-[200px] truncate">{r.betreff}</td>
                  <td className="px-3 py-2.5 hidden sm:table-cell capitalize text-gray-600 text-xs">{r.prioritaet}</td>
                  <td className="px-3 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${REKO_STATUS_BADGE[r.status] ?? "bg-gray-100 text-gray-700"}`}>
                      {REKO_STATUS_LABEL[r.status] ?? r.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <Link href={`/reklamationen/${r.id}`} className="text-xs text-green-700 hover:underline">
                      Öffnen
                    </Link>
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
