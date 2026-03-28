"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { KpiCard } from "@/components/Card";

interface KundeABC {
  kundeId: number;
  name: string;
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

function fmt(n: number) {
  return n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

function fmtPct(n: number) {
  return n.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " %";
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

  if (loading) return <div className="p-8 text-gray-500">Lade Daten…</div>;
  if (error || !data) return <div className="p-8 text-red-600">{error ?? "Unbekannter Fehler"}</div>;

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-6 print:px-0 print:py-0">
      <div className="flex items-center justify-between mb-6 print:mb-3">
        <h1 className="text-2xl font-bold text-gray-800">ABC-Kundenanalyse (letzte 12 Monate)</h1>
        <button
          onClick={() => window.print()}
          className="print:hidden px-4 py-2 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 transition-colors"
        >
          Drucken
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 print:grid-cols-4 print:gap-2 print:mb-3">
        <KpiCard
          label="A-Kunden"
          value={data.aKunden.anzahl}
          sub={`${fmtPct(data.aKunden.anteil)} vom Umsatz`}
          color="green"
        />
        <KpiCard
          label="B-Kunden"
          value={data.bKunden.anzahl}
          sub={`${fmtPct(data.bKunden.anteil)} vom Umsatz`}
          color="yellow"
        />
        <KpiCard
          label="C-Kunden"
          value={data.cKunden.anzahl}
          sub={`${fmtPct(data.cKunden.anteil)} vom Umsatz`}
          color="blue"
        />
        <KpiCard
          label="Gesamtumsatz"
          value={fmt(data.gesamt)}
          sub={`${data.kunden.length} Kunden gesamt`}
          color="green"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left font-semibold text-gray-600 w-12">Rang</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600 w-16">Klasse</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Kundenname</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Umsatz</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Anteil %</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Kumuliert %</th>
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
                </td>
                <td className="px-4 py-2.5 text-right font-mono">{fmt(k.umsatz)}</td>
                <td className="px-4 py-2.5 text-right">{fmtPct(k.anteil)}</td>
                <td className="px-4 py-2.5 text-right text-gray-500">{fmtPct(k.kumuliert)}</td>
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
