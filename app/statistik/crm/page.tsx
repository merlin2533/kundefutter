"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatEuro } from "@/lib/utils";
import ZeitraumFilter from "@/components/ZeitraumFilter";
import { downloadCSV } from "@/lib/csv";

interface TypRow {
  typ: string;
  anzahl: number;
}

interface MonatRow {
  monat: string;
  anzahl: number;
}

interface DormantKunde {
  kundeId: number;
  name: string;
  firma: string | null;
  letzteAktivitaet: string | null;
  umsatz12M: number;
}

interface Data {
  nachTyp: TypRow[];
  nachMonat: MonatRow[];
  offeneAufgaben: number;
  dormantKunden: DormantKunde[];
  summe: { anzahl: number };
}

const TYP_LABEL: Record<string, string> = {
  besuch: "Besuch",
  anruf: "Anruf",
  email: "E-Mail",
  notiz: "Notiz",
  aufgabe: "Aufgabe",
};

const TYP_COLOR: Record<string, string> = {
  besuch: "bg-green-600",
  anruf: "bg-blue-500",
  email: "bg-violet-500",
  notiz: "bg-amber-500",
  aufgabe: "bg-rose-500",
};

export default function StatistikCrmPage() {
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
      const res = await fetch(`/api/statistik/crm?${params}`);
      if (!res.ok) { setError("Auswertung konnte nicht geladen werden."); return; }
      setData(await res.json());
    } catch {
      setError("Netzwerkfehler beim Laden.");
    } finally {
      setLoading(false);
    }
  }, [jahr, vonMonat, bisMonat]);

  useEffect(() => { laden(); }, [laden]);

  const nachTyp = Array.isArray(data?.nachTyp) ? data!.nachTyp : [];
  const nachMonat = Array.isArray(data?.nachMonat) ? data!.nachMonat : [];
  const dormantKunden = Array.isArray(data?.dormantKunden) ? data!.dormantKunden : [];
  const maxTypAnzahl = nachTyp.length > 0 ? Math.max(...nachTyp.map((t) => t.anzahl), 1) : 1;
  const maxMonatAnzahl = nachMonat.length > 0 ? Math.max(...nachMonat.map((m) => m.anzahl), 1) : 1;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link href="/statistik" className="hover:text-green-700">Statistik</Link>
          <span>›</span>
          <span className="text-gray-800 font-medium">CRM-Aktivität</span>
        </div>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">CRM-Aktivität</h1>
            <p className="text-sm text-gray-500 mt-1">Aktivitäten nach Typ und Monat im gewählten Zeitraum.</p>
          </div>
          <button
            onClick={() =>
              data &&
              downloadCSV(
                "statistik-crm",
                ["Typ", "Anzahl"],
                nachTyp.map((t) => [TYP_LABEL[t.typ] ?? t.typ, t.anzahl])
              )
            }
            disabled={!data}
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            CSV-Export
          </button>
        </div>
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
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Aktivitäten gesamt</p>
              <p className="text-2xl font-bold mt-1 text-gray-900">{data.summe.anzahl}</p>
              <p className="text-xs text-gray-400 mt-0.5">Im gewählten Zeitraum</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Offene Aufgaben / Wiedervorlagen</p>
              <p className={`text-2xl font-bold mt-1 ${data.offeneAufgaben > 0 ? "text-amber-600" : "text-green-700"}`}>
                {data.offeneAufgaben}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">Nicht erledigt, mit Fälligkeitsdatum</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Inaktive Kunden (&gt; 60 Tage)</p>
              <p className={`text-2xl font-bold mt-1 ${dormantKunden.length > 0 ? "text-red-600" : "text-green-700"}`}>
                {dormantKunden.length}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">Mit Umsatz in letzten 12 Monaten</p>
            </div>
          </div>

          {/* Aktivitäten nach Typ */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Aktivitäten nach Typ</h2>
            {nachTyp.length === 0 ? (
              <p className="text-sm text-gray-400">Keine Aktivitäten im gewählten Zeitraum.</p>
            ) : (
              <div className="space-y-3">
                {nachTyp.map((row) => {
                  const barWidth = maxTypAnzahl > 0 ? Math.round((row.anzahl / maxTypAnzahl) * 100) : 0;
                  return (
                    <div key={row.typ}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700">
                          {TYP_LABEL[row.typ] ?? row.typ}
                        </span>
                        <span className="text-sm font-mono text-gray-900">{row.anzahl}</span>
                      </div>
                      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${TYP_COLOR[row.typ] ?? "bg-gray-400"}`}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Aktivitäten je Monat */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Aktivitäten je Monat</h2>
            {nachMonat.length === 0 ? (
              <p className="text-sm text-gray-400">Keine Aktivitäten im gewählten Zeitraum.</p>
            ) : (
              <div className="space-y-3">
                {nachMonat.map((row) => {
                  const barWidth = maxMonatAnzahl > 0 ? Math.round((row.anzahl / maxMonatAnzahl) * 100) : 0;
                  return (
                    <div key={row.monat}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700">{row.monat}</span>
                        <span className="text-sm font-mono text-gray-900">{row.anzahl}</span>
                      </div>
                      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-green-600"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Inaktive Kunden (Dormant) */}
          {dormantKunden.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-amber-200 bg-amber-50">
                <h2 className="text-sm font-semibold text-amber-800">Inaktive Kunden (&gt; 60 Tage kein Kontakt)</h2>
                <p className="text-xs text-amber-600 mt-0.5">
                  {dormantKunden.length} Kunden mit Umsatz in den letzten 12 Monaten ohne CRM-Aktivität
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Kunde</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Umsatz (12 M)</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Letzter Kontakt</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Aktion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {dormantKunden.map((k) => (
                      <tr key={k.kundeId} className="hover:bg-amber-50">
                        <td className="px-4 py-2.5">
                          <Link href={`/kunden/${k.kundeId}`} className="text-green-700 hover:underline font-medium">
                            {k.firma ? `${k.firma} (${k.name})` : k.name}
                          </Link>
                          <div className="sm:hidden text-xs text-gray-400 mt-0.5">
                            {formatEuro(k.umsatz12M)} Umsatz
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-gray-700 hidden sm:table-cell">
                          {formatEuro(k.umsatz12M)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-500 text-xs hidden md:table-cell">
                          {k.letzteAktivitaet
                            ? new Date(k.letzteAktivitaet).toLocaleDateString("de-DE")
                            : "Kein Eintrag"}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <Link
                            href={`/kunden/${k.kundeId}/aktivitaet`}
                            className="text-xs px-2 py-1 bg-amber-100 text-amber-800 rounded hover:bg-amber-200 transition-colors whitespace-nowrap"
                          >
                            Kontakt erfassen
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
