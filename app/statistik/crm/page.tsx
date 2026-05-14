"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
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

interface Data {
  nachTyp: TypRow[];
  nachMonat: MonatRow[];
  offeneAufgaben: number;
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
          <div className="grid grid-cols-2 gap-4">
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
        </>
      )}
    </div>
  );
}
