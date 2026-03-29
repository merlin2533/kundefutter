"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { KpiCard } from "@/components/Card";
import { formatEuro, formatPercent } from "@/lib/utils";

interface KundeABC {
  id: number;
  kundeId: number;
  name: string;
  firma: string | null;
  umsatz: number;
  anteil: number;
  klasse: "A" | "B" | "C";
  kumuliert: number;
}

interface GruppeInfo {
  anzahl: number;
  umsatz: number;
  anteil: number;
}

interface ABCData {
  kunden: KundeABC[];
  gesamt: number;
  aKunden: GruppeInfo;
  bKunden: GruppeInfo;
  cKunden: GruppeInfo;
}


function KlasseBadge({ klasse }: { klasse: "A" | "B" | "C" }) {
  const styles = {
    A: "bg-green-100 text-green-800 border border-green-300",
    B: "bg-yellow-100 text-yellow-800 border border-yellow-300",
    C: "bg-gray-100 text-gray-700 border border-gray-300",
  };
  return (
    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold ${styles[klasse]}`}>
      {klasse}
    </span>
  );
}

function rowBg(klasse: "A" | "B" | "C") {
  if (klasse === "A") return "bg-green-50";
  if (klasse === "B") return "bg-yellow-50";
  return "bg-white";
}

function downloadCSV(kunden: KundeABC[]) {
  const header = ["Rang", "Klasse", "Kundenname", "Firma/Betrieb", "Umsatz (EUR)", "Anteil (%)", "Kumuliert (%)"];
  const rows = kunden.map((k, i) => [
    String(i + 1),
    k.klasse,
    `"${k.name.replace(/"/g, '""')}"`,
    k.firma ? `"${k.firma.replace(/"/g, '""')}"` : "",
    k.umsatz.toFixed(2).replace(".", ","),
    k.anteil.toFixed(2).replace(".", ","),
    k.kumuliert.toFixed(2).replace(".", ","),
  ]);
  const csv = [header.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `abc-analyse-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// CSS bar chart: render bars for A/B/C groups
function ABCBarChart({ data }: { data: ABCData }) {
  const groups = [
    { label: "A-Kunden", anteil: data.aKunden.anteil, anzahl: data.aKunden.anzahl, color: "bg-green-500" },
    { label: "B-Kunden", anteil: data.bKunden.anteil, anzahl: data.bKunden.anzahl, color: "bg-yellow-400" },
    { label: "C-Kunden", anteil: data.cKunden.anteil, anzahl: data.cKunden.anzahl, color: "bg-gray-400" },
  ];
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6 print:hidden">
      <h2 className="text-sm font-semibold text-gray-600 mb-3">Umsatzverteilung nach Klasse</h2>
      <div className="space-y-3">
        {groups.map((g) => (
          <div key={g.label} className="flex items-center gap-3">
            <span className="text-xs font-medium text-gray-600 w-20">{g.label}</span>
            <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
              <div
                className={`h-5 rounded-full ${g.color} flex items-center justify-end pr-2 transition-all`}
                style={{ width: `${Math.max(2, g.anteil)}%` }}
              >
                <span className="text-xs text-white font-semibold">{formatPercent(g.anteil)}</span>
              </div>
            </div>
            <span className="text-xs text-gray-500 w-16 text-right">{g.anzahl} Kunden</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ABCPage() {
  const [data, setData] = useState<ABCData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/analyse/abc")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => { setError("Fehler beim Laden der Daten"); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div className="p-8 flex items-center gap-3 text-gray-500">
        <svg className="animate-spin h-5 w-5 text-green-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Lade Daten…
      </div>
    );
  }
  if (error || !data) return <div className="p-8 text-red-600">{error ?? "Unbekannter Fehler"}</div>;

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-6 print:px-0 print:py-0">
      <div className="flex items-center justify-between mb-6 print:mb-3">
        <h1 className="text-2xl font-bold text-gray-800">ABC-Kundenanalyse (letzte 12 Monate)</h1>
        <div className="flex items-center gap-2 print:hidden">
          <button
            onClick={() => downloadCSV(data.kunden)}
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            CSV-Export
          </button>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 transition-colors"
          >
            Drucken
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 print:grid-cols-4 print:gap-2 print:mb-3">
        <KpiCard
          label="A-Kunden"
          value={`${data.aKunden.anzahl} (${formatPercent(data.aKunden.anteil)} Umsatz)`}
          sub={formatEuro(data.aKunden.umsatz)}
          color="green"
        />
        <KpiCard
          label="B-Kunden"
          value={`${data.bKunden.anzahl} (${formatPercent(data.bKunden.anteil)} Umsatz)`}
          sub={formatEuro(data.bKunden.umsatz)}
          color="yellow"
        />
        <KpiCard
          label="C-Kunden"
          value={`${data.cKunden.anzahl} (${formatPercent(data.cKunden.anteil)} Umsatz)`}
          sub={formatEuro(data.cKunden.umsatz)}
          color="blue"
        />
        <KpiCard
          label="Gesamtumsatz"
          value={formatEuro(data.gesamt)}
          sub={`${data.kunden.length} Kunden gesamt`}
          color="green"
        />
      </div>

      {/* Bar chart */}
      <ABCBarChart data={data} />

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left font-semibold text-gray-600 w-12">Rang</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600 w-16">Klasse</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Kundenname</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600 hidden lg:table-cell">Firma/Betrieb</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Umsatz</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600 hidden sm:table-cell">Anteil %</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600 hidden md:table-cell">Kumuliert %</th>
            </tr>
          </thead>
          <tbody>
            {data.kunden.map((k, i) => (
              <tr key={k.kundeId} className={`border-b border-gray-100 ${rowBg(k.klasse)}`}>
                <td className="px-4 py-2.5 text-gray-500 font-medium">{i + 1}</td>
                <td className="px-4 py-2.5">
                  <KlasseBadge klasse={k.klasse} />
                </td>
                <td className="px-4 py-2.5">
                  <Link
                    href={`/kunden/${k.kundeId}`}
                    className="text-green-700 hover:text-green-900 hover:underline font-medium print:text-gray-800 print:no-underline"
                  >
                    {k.name}
                  </Link>
                  {k.firma && (
                    <div className="lg:hidden text-xs text-gray-400 mt-0.5">{k.firma}</div>
                  )}
                  <div className="sm:hidden text-xs text-gray-400 mt-0.5">
                    {formatPercent(k.anteil)} — kum. {formatPercent(k.kumuliert)}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-gray-500 hidden lg:table-cell">{k.firma ?? "—"}</td>
                <td className="px-4 py-2.5 text-right font-mono">{formatEuro(k.umsatz)}</td>
                <td className="px-4 py-2.5 text-right hidden sm:table-cell">{formatPercent(k.anteil)}</td>
                <td className="px-4 py-2.5 text-right text-gray-500 hidden md:table-cell">{formatPercent(k.kumuliert)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <style jsx global>{`
        @media print {
          nav, header, button { display: none !important; }
          body { font-size: 12px; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}
