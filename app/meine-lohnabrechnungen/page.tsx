"use client";
import { useState, useEffect, useCallback } from "react";
import { MONATE_KURZ, formatDatum } from "@/lib/utils";
import * as Sentry from "@sentry/nextjs";

const MONATE = MONATE_KURZ;
const STATUS_LABEL: Record<string, string> = { ABGERECHNET: "Abgerechnet", AUSGEZAHLT: "Ausgezahlt" };
const STATUS_COLOR: Record<string, string> = {
  ABGERECHNET: "bg-blue-100 text-blue-800",
  AUSGEZAHLT: "bg-green-100 text-green-700",
};

interface Abrechnung {
  id: number;
  monat: number;
  jahr: number;
  brutto: number;
  netto: number;
  status: string;
  zahlungsDatum: string | null;
  belegDateiname: string | null;
}

export default function MeineLohnabrechnungenPage() {
  const [abrechnungen, setAbrechnungen] = useState<Abrechnung[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const laden = useCallback(() => {
    fetch("/api/personal/abrechnungen")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => { setAbrechnungen(Array.isArray(d) ? d : []); setLoadError(""); })
      .catch((err) => {
        Sentry.captureException(err);
        setLoadError("Lohnabrechnungen konnten nicht geladen werden.");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { laden(); }, [laden]);

  if (loading) return <div className="p-8 text-center text-gray-500">Lade…</div>;

  if (loadError) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
          {loadError}{" "}
          <button onClick={laden} className="underline font-medium">Erneut versuchen</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-xl font-bold">Meine Lohnabrechnungen</h1>

      {abrechnungen.length === 0 ? (
        <div className="bg-white border rounded-lg p-8 text-center text-gray-400">
          Noch keine abgerechneten Zeiträume vorhanden.
        </div>
      ) : (
        <div className="bg-white border rounded-lg overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase">
                <th className="px-4 py-2 text-left">Zeitraum</th>
                <th className="px-4 py-2 text-right">Netto</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left hidden sm:table-cell">Zahlung</th>
                <th className="px-4 py-2 text-right">PDF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {abrechnungen.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium">{MONATE[a.monat - 1]} {a.jahr}</td>
                  <td className="px-4 py-2 text-right">{a.netto.toFixed(2)} €</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[a.status] ?? "bg-gray-100"}`}>
                      {STATUS_LABEL[a.status] ?? a.status}
                    </span>
                    {a.zahlungsDatum && (
                      <div className="sm:hidden text-xs text-gray-400 mt-0.5">{formatDatum(a.zahlungsDatum)}</div>
                    )}
                  </td>
                  <td className="px-4 py-2 hidden sm:table-cell text-gray-500 text-xs">
                    {a.zahlungsDatum ? formatDatum(a.zahlungsDatum) : "—"}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {a.belegDateiname ? (
                      <a
                        href={`/api/personal/abrechnungen/${a.id}/beleg`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-green-700 hover:underline font-medium"
                      >
                        📄 Ansehen / Drucken
                      </a>
                    ) : (
                      <span className="text-xs text-gray-400">Noch nicht hinterlegt</span>
                    )}
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
