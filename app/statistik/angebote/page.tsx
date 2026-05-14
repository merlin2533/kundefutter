"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatEuro, formatPercent } from "@/lib/utils";
import ZeitraumFilter from "@/components/ZeitraumFilter";
import { downloadCSV } from "@/lib/csv";

interface StatusRow {
  status: string;
  anzahl: number;
  wert: number;
}

interface Data {
  nachStatus: StatusRow[];
  annahmequote: number;
  summe: {
    anzahl: number;
    gesamtwert: number;
    angenommenWert: number;
    durchschnittswert: number;
  };
}

const STATUS_LABEL: Record<string, string> = {
  OFFEN: "Offen",
  ANGENOMMEN: "Angenommen",
  ABGELEHNT: "Abgelehnt",
  ABGELAUFEN: "Abgelaufen",
};

const STATUS_COLOR: Record<string, string> = {
  OFFEN: "bg-blue-500",
  ANGENOMMEN: "bg-green-600",
  ABGELEHNT: "bg-red-500",
  ABGELAUFEN: "bg-gray-400",
};

export default function StatistikAngebotePage() {
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
      const res = await fetch(`/api/statistik/angebote?${params}`);
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
  const maxWert = nachStatus.length > 0 ? Math.max(...nachStatus.map((s) => s.wert), 1) : 1;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link href="/statistik" className="hover:text-green-700">Statistik</Link>
          <span>›</span>
          <span className="text-gray-800 font-medium">Angebote</span>
        </div>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Angebots-Conversion</h1>
            <p className="text-sm text-gray-500 mt-1">Angebotswert und Annahmequote im gewählten Zeitraum.</p>
          </div>
          <button
            onClick={() =>
              data &&
              downloadCSV(
                "statistik-angebote",
                ["Status", "Anzahl", "Wert (EUR)"],
                nachStatus.map((s) => [
                  STATUS_LABEL[s.status] ?? s.status,
                  s.anzahl,
                  s.wert,
                ])
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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Angebote gesamt</p>
              <p className="text-2xl font-bold mt-1 text-gray-900">{data.summe.anzahl}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Annahmequote</p>
              <p className={`text-2xl font-bold mt-1 ${data.annahmequote >= 50 ? "text-green-700" : "text-amber-600"}`}>
                {formatPercent(data.annahmequote)}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">Angenommen / (Angenommen + Abgelehnt)</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Ø Angebotswert</p>
              <p className="text-2xl font-bold mt-1 text-gray-900">{formatEuro(data.summe.durchschnittswert)}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Angenommener Wert</p>
              <p className="text-2xl font-bold mt-1 text-green-700">{formatEuro(data.summe.angenommenWert)}</p>
              <p className="text-xs text-gray-400 mt-0.5">Gesamt: {formatEuro(data.summe.gesamtwert)}</p>
            </div>
          </div>

          {/* Status-Aufschlüsselung */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Status-Aufschlüsselung</h2>
            {nachStatus.length === 0 ? (
              <p className="text-sm text-gray-400">Keine Angebote im gewählten Zeitraum.</p>
            ) : (
              <div className="space-y-4">
                {nachStatus.map((row) => {
                  const barWidth = maxWert > 0 ? Math.round((row.wert / maxWert) * 100) : 0;
                  return (
                    <div key={row.status}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700">
                          {STATUS_LABEL[row.status] ?? row.status}
                          <span className="ml-2 text-xs text-gray-400">({row.anzahl} Angebote)</span>
                        </span>
                        <span className="text-sm font-mono text-gray-900">{formatEuro(row.wert)}</span>
                      </div>
                      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${STATUS_COLOR[row.status] ?? "bg-gray-400"}`}
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
