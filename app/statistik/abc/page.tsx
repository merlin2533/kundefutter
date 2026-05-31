"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { KpiCard } from "@/components/Card";
import { formatEuro, formatPercent } from "@/lib/utils";
import ZeitraumFilter from "@/components/ZeitraumFilter";

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

interface Migration {
  kundeId: number;
  name: string;
  firma: string | null;
  klasseAktuell: "A" | "B" | "C";
  klasseVorperiode: "A" | "B" | "C" | "neu" | "weg";
  umsatzAktuell: number;
  umsatzVorperiode: number;
}

interface ABCData {
  kunden: KundeABC[];
  gesamt: number;
  aKunden: GruppeInfo;
  bKunden: GruppeInfo;
  cKunden: GruppeInfo;
  migrationen: Migration[];
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

type VorperiodeModus = "vorjahr" | "vorquartal" | "keine";

function vpParams(modus: VorperiodeModus, jahr: string, vonMonat: string, bisMonat: string) {
  if (modus === "keine") return "";
  const j = parseInt(jahr, 10);
  const vm = parseInt(vonMonat, 10);
  const bm = parseInt(bisMonat, 10);
  if (modus === "vorjahr") {
    return `&vonVP=${j - 1}-${vonMonat}&bisVP=${j - 1}-${bisMonat}`;
  }
  // Vorquartal: 3 Monate zurück
  const vpBis = new Date(j, bm - 1 - 3 + 1, 0); // letzter Tag 3 Monate zurück
  const vpVon = new Date(j, vm - 1 - 3, 1); // erster Tag 3 Monate zurück
  const pad = (n: number) => String(n).padStart(2, "0");
  return `&vonVP=${vpVon.getFullYear()}-${pad(vpVon.getMonth() + 1)}&bisVP=${vpBis.getFullYear()}-${pad(vpBis.getMonth() + 1)}`;
}

export default function ABCPage() {
  const now = new Date();
  const [jahr, setJahr] = useState(String(now.getFullYear()));
  const [vonMonat, setVonMonat] = useState("01");
  const [bisMonat, setBisMonat] = useState(String(now.getMonth() + 1).padStart(2, "0"));
  const [vorperiode, setVorperiode] = useState<VorperiodeModus>("vorjahr");
  const [data, setData] = useState<ABCData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const laden = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const vp = vpParams(vorperiode, jahr, vonMonat, bisMonat);
      const res = await fetch(`/api/analyse/abc?von=${jahr}-${vonMonat}&bis=${jahr}-${bisMonat}${vp}`);
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      setError("Fehler beim Laden der Daten");
    } finally {
      setLoading(false);
    }
  }, [jahr, vonMonat, bisMonat, vorperiode]);

  useEffect(() => { laden(); }, [laden]);

  return (
    <div className="max-w-screen-xl mx-auto print:px-0 print:py-0 space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1 print:hidden">
          <Link href="/statistik" className="hover:text-green-700">Statistik</Link>
          <span>›</span>
          <span className="text-gray-800 font-medium">ABC-Analyse</span>
        </div>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-gray-800">ABC-Kundenanalyse</h1>
          <div className="flex items-center gap-2 print:hidden">
            <button
              onClick={() => data && downloadCSV(data.kunden)}
              disabled={!data}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
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
      </div>

      <div className="print:hidden">
        <ZeitraumFilter
          jahr={jahr} setJahr={setJahr}
          vonMonat={vonMonat} setVonMonat={setVonMonat}
          bisMonat={bisMonat} setBisMonat={setBisMonat}
          showQuickButtons
          loading={loading}
        >
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Vergleich mit</label>
            <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
              {(["vorjahr", "vorquartal", "keine"] as VorperiodeModus[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setVorperiode(m)}
                  className={`px-3 py-2 font-medium transition-colors border-l first:border-l-0 border-gray-300 ${
                    vorperiode === m ? "bg-green-700 text-white" : "bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {m === "vorjahr" ? "Vorjahr" : m === "vorquartal" ? "Vorquartal" : "Kein Vergleich"}
                </button>
              ))}
            </div>
          </div>
        </ZeitraumFilter>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
      )}
      {!error && !data && (
        <div className="text-sm text-gray-400">Lade Daten…</div>
      )}

      {data && (
      <>
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

      {/* Migrations-Matrix */}
      {Array.isArray(data.migrationen) && data.migrationen.length > 0 && vorperiode !== "keine" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 print:hidden">
          <h2 className="text-base font-semibold text-gray-800 mb-1">Kundenmigration</h2>
          <p className="text-xs text-gray-500 mb-4">Klassenwechsel zwischen aktuellem Zeitraum und {vorperiode === "vorjahr" ? "Vorjahr" : "Vorquartal"}</p>

          {/* Migrations-Matrix 3×3 */}
          {(() => {
            const klassen: ("A" | "B" | "C")[] = ["A", "B", "C"];
            const matrix: Record<string, Record<string, number>> = {};
            for (const f of klassen) {
              matrix[f] = {};
              for (const t of klassen) matrix[f][t] = 0;
            }
            let neuCount = 0, wegCount = 0;
            for (const m of data.migrationen) {
              if (m.klasseVorperiode === "neu") { neuCount++; continue; }
              if (m.klasseVorperiode === "weg") { wegCount++; continue; }
              if (klassen.includes(m.klasseVorperiode as "A"|"B"|"C") && klassen.includes(m.klasseAktuell)) {
                matrix[m.klasseVorperiode as "A"|"B"|"C"][m.klasseAktuell]++;
              }
            }
            return (
              <div className="overflow-x-auto mb-6">
                <table className="text-sm border-collapse">
                  <thead>
                    <tr>
                      <th className="px-3 py-2 text-gray-400 font-normal text-xs">Von → Nach</th>
                      {klassen.map(k => <th key={k} className="px-4 py-2 text-center font-semibold text-gray-700">→ {k}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {klassen.map(from => (
                      <tr key={from}>
                        <td className="px-3 py-2 font-semibold text-gray-700">{from} war</td>
                        {klassen.map(to => {
                          const count = matrix[from][to];
                          const isDiag = from === to;
                          const isAbstieg = (from === "A" && to !== "A") || (from === "B" && to === "C");
                          const isAufstieg = (from === "C" && to !== "C") || (from === "B" && to === "A");
                          return (
                            <td key={to} className={`px-4 py-2 text-center font-mono text-sm rounded ${
                              isDiag ? "bg-gray-50 text-gray-700" :
                              isAbstieg && count > 0 ? "bg-red-50 text-red-700 font-bold" :
                              isAufstieg && count > 0 ? "bg-green-50 text-green-700 font-bold" :
                              "text-gray-500"
                            }`}>
                              {count}
                              {isAbstieg && count > 0 && <span className="ml-1 text-xs">↓</span>}
                              {isAufstieg && count > 0 && <span className="ml-1 text-xs">↑</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(neuCount > 0 || wegCount > 0) && (
                  <p className="text-xs text-gray-400 mt-2">
                    {neuCount > 0 && <span className="mr-3">+ {neuCount} neu</span>}
                    {wegCount > 0 && <span>− {wegCount} weggefallen</span>}
                  </p>
                )}
              </div>
            );
          })()}

          {/* Handlungsempfehlungen: Absteiger */}
          {(() => {
            const absteiger = data.migrationen.filter(m =>
              m.klasseVorperiode !== "neu" && m.klasseVorperiode !== "weg" &&
              (m.klasseVorperiode === "A" || m.klasseVorperiode === "B") &&
              ((m.klasseVorperiode === "A" && m.klasseAktuell !== "A") || (m.klasseVorperiode === "B" && m.klasseAktuell === "C"))
            );
            const aufsteiger = data.migrationen.filter(m =>
              m.klasseVorperiode !== "neu" && m.klasseVorperiode !== "weg" &&
              (m.klasseAktuell === "A" || (m.klasseAktuell === "B" && m.klasseVorperiode === "C"))
            );
            return (
              <div className="grid md:grid-cols-2 gap-4">
                {absteiger.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-red-700 mb-2">⚠ Absteiger ({absteiger.length})</h3>
                    <div className="space-y-2">
                      {absteiger.map(m => (
                        <div key={m.kundeId} className="flex items-center justify-between bg-red-50 rounded-lg px-3 py-2">
                          <div>
                            <Link href={`/kunden/${m.kundeId}`} className="font-medium text-red-800 hover:underline text-sm">
                              {m.name}
                            </Link>
                            <div className="text-xs text-red-600 mt-0.5">
                              {m.klasseVorperiode} → {m.klasseAktuell} · −{formatEuro(m.umsatzVorperiode - m.umsatzAktuell)}
                            </div>
                          </div>
                          <Link href={`/kunden/${m.kundeId}?tab=crm`} className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 whitespace-nowrap">
                            CRM →
                          </Link>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {aufsteiger.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-green-700 mb-2">⬆ Aufsteiger ({aufsteiger.length})</h3>
                    <div className="space-y-2">
                      {aufsteiger.map(m => (
                        <div key={m.kundeId} className="flex items-center justify-between bg-green-50 rounded-lg px-3 py-2">
                          <div>
                            <Link href={`/kunden/${m.kundeId}`} className="font-medium text-green-800 hover:underline text-sm">
                              {m.name}
                            </Link>
                            <div className="text-xs text-green-600 mt-0.5">
                              {m.klasseVorperiode} → {m.klasseAktuell} · +{formatEuro(m.umsatzAktuell - m.umsatzVorperiode)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}
      </>
      )}

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
