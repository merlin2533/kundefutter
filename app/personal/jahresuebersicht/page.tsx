"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { getJahreListeNum, MONATE_KURZ } from "@/lib/utils";

const TYP_LABEL: Record<string, string> = { festgehalt: "Festgehalt", minijob: "Minijob", stundenbasis: "Stundenbasis" };
const STATUS_COLOR: Record<string, string> = {
  AUSGEZAHLT: "text-green-700",
  ABGERECHNET: "text-blue-700",
  OFFEN: "text-amber-600",
};

interface Abrechnung {
  id: number;
  mitarbeiterId: number;
  monat: number;
  brutto: number;
  netto: number;
  status: string;
  mitarbeiter: { id: number; vorname: string; nachname: string; typ: string; kostenstelle: string | null };
}

export default function JahresuebersichtPage() {
  const now = new Date();
  const [jahr, setJahr] = useState(now.getFullYear());
  const [data, setData] = useState<Abrechnung[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/personal/jahresuebersicht?jahr=${jahr}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setData(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, [jahr]);

  // Group by mitarbeiterId, preserve insertion order (sorted by API)
  const maMap = new Map<number, { ma: Abrechnung["mitarbeiter"]; entries: Map<number, Abrechnung> }>();
  for (const entry of data) {
    if (!maMap.has(entry.mitarbeiterId)) {
      maMap.set(entry.mitarbeiterId, { ma: entry.mitarbeiter, entries: new Map() });
    }
    maMap.get(entry.mitarbeiterId)!.entries.set(entry.monat, entry);
  }
  const rows = Array.from(maMap.values()).sort((a, b) =>
    a.ma.nachname.localeCompare(b.ma.nachname, "de")
  );

  const monthSums = Array.from({ length: 12 }, (_, i) =>
    rows.reduce((sum, row) => sum + (row.entries.get(i + 1)?.netto ?? 0), 0)
  );
  const grandTotal = monthSums.reduce((s, v) => s + v, 0);
  const bruttoTotal = data.reduce((s, a) => s + a.brutto, 0);

  function handleCsvExport() {
    const headers = ["Mitarbeiter", "Typ", "Kostenstelle", ...MONATE_KURZ, "Jahressumme (Netto)", "Jahressumme (Brutto)"];
    const dataRows = rows.map(({ ma, entries }) => {
      const nettoSum = Array.from({ length: 12 }, (_, i) => entries.get(i + 1)?.netto ?? 0).reduce((s, v) => s + v, 0);
      const bruttoSum = Array.from({ length: 12 }, (_, i) => entries.get(i + 1)?.brutto ?? 0).reduce((s, v) => s + v, 0);
      return [
        `${ma.vorname} ${ma.nachname}`,
        TYP_LABEL[ma.typ] ?? ma.typ,
        ma.kostenstelle ?? "",
        ...Array.from({ length: 12 }, (_, i) => {
          const e = entries.get(i + 1);
          return e ? e.netto.toFixed(2).replace(".", ",") : "";
        }),
        nettoSum.toFixed(2).replace(".", ","),
        bruttoSum.toFixed(2).replace(".", ","),
      ];
    });
    const sumRow = [
      "Gesamt", "", "",
      ...monthSums.map((s) => (s > 0 ? s.toFixed(2).replace(".", ",") : "")),
      grandTotal.toFixed(2).replace(".", ","),
      bruttoTotal.toFixed(2).replace(".", ","),
    ];
    const csv =
      "\uFEFF" +
      [headers, ...dataRows, sumRow]
        .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
        .join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Personalkosten-${jahr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/personal/abrechnungen" className="text-gray-400 hover:text-gray-600 text-sm">
            ← Abrechnungen
          </Link>
          <h1 className="text-2xl font-bold">Personalkosten-Jahresübersicht</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleCsvExport}
            disabled={rows.length === 0}
            className="bg-green-700 text-white px-4 py-2 rounded-lg hover:bg-green-800 text-sm font-medium disabled:opacity-50"
          >
            CSV-Export
          </button>
          <a
            href={`/api/personal/datev-lohn?von=${jahr}-01-01&bis=${jahr}-12-31`}
            className="bg-blue-700 text-white px-4 py-2 rounded-lg hover:bg-blue-800 text-sm font-medium"
          >
            DATEV-Lohn
          </a>
        </div>
      </div>

      {/* Jahr-Filter */}
      <div className="flex gap-3 mb-4">
        <select
          value={jahr}
          onChange={(e) => setJahr(parseInt(e.target.value, 10))}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          {getJahreListeNum().map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white border rounded-lg p-3 text-center">
          <div className="text-xs text-gray-500">Mitarbeiter</div>
          <div className="text-lg font-bold">{rows.length}</div>
        </div>
        <div className="bg-white border rounded-lg p-3 text-center">
          <div className="text-xs text-gray-500">Jahreskosten Brutto</div>
          <div className="text-lg font-bold text-gray-700">{bruttoTotal.toFixed(2)} €</div>
        </div>
        <div className="bg-white border rounded-lg p-3 text-center">
          <div className="text-xs text-gray-500">Jahreskosten Netto</div>
          <div className="text-lg font-bold text-green-700">{grandTotal.toFixed(2)} €</div>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-500">Lade…</div>
      ) : rows.length === 0 ? (
        <div className="bg-white border rounded-lg p-8 text-center text-gray-400">
          Keine Abrechnungen für {jahr}.
        </div>
      ) : (
        <div className="bg-white border rounded-lg overflow-x-auto">
          <table className="text-sm" style={{ minWidth: "900px" }}>
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase border-b">
                <th className="px-4 py-2 text-left sticky left-0 bg-gray-50 z-10">Mitarbeiter</th>
                {MONATE_KURZ.map((m) => (
                  <th key={m} className="px-2 py-2 text-right whitespace-nowrap w-16">{m}</th>
                ))}
                <th className="px-4 py-2 text-right font-bold whitespace-nowrap">Gesamt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(({ ma, entries }) => {
                const rowSum = Array.from({ length: 12 }, (_, i) => entries.get(i + 1)?.netto ?? 0).reduce(
                  (s, v) => s + v,
                  0
                );
                return (
                  <tr key={ma.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 sticky left-0 bg-white group-hover:bg-gray-50 z-10">
                      <Link
                        href={`/personal/${ma.id}?tab=abrechnung`}
                        className="font-medium hover:text-green-700"
                      >
                        {ma.vorname} {ma.nachname}
                      </Link>
                      <div className="text-xs text-gray-400">
                        {TYP_LABEL[ma.typ] ?? ma.typ}
                        {ma.kostenstelle ? ` · ${ma.kostenstelle}` : ""}
                      </div>
                    </td>
                    {Array.from({ length: 12 }, (_, i) => {
                      const e = entries.get(i + 1);
                      return (
                        <td key={i} className="px-2 py-2 text-right text-xs tabular-nums">
                          {e ? (
                            <Link
                              href={`/personal/abrechnungen/${e.id}/druck`}
                              target="_blank"
                              className={`hover:underline ${STATUS_COLOR[e.status] ?? "text-gray-600"}`}
                              title={`${e.netto.toFixed(2)} € — ${e.status}`}
                            >
                              {e.netto.toFixed(2)}
                            </Link>
                          ) : (
                            <span className="text-gray-200">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-4 py-2 text-right font-semibold text-sm tabular-nums">
                      {rowSum.toFixed(2)} €
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 border-t font-semibold text-xs">
                <td className="px-4 py-2 sticky left-0 bg-gray-50 z-10 text-gray-500">Gesamt</td>
                {monthSums.map((s, i) => (
                  <td key={i} className="px-2 py-2 text-right tabular-nums">
                    {s > 0 ? (
                      <span className="text-gray-700">{s.toFixed(2)}</span>
                    ) : (
                      <span className="text-gray-200">—</span>
                    )}
                  </td>
                ))}
                <td className="px-4 py-2 text-right text-green-700 text-sm tabular-nums">
                  {grandTotal.toFixed(2)} €
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Legende */}
      {rows.length > 0 && (
        <div className="mt-3 flex gap-4 text-xs text-gray-400">
          <span className="text-green-700 font-medium">■</span> Ausgezahlt
          <span className="text-blue-700 font-medium">■</span> Abgerechnet
          <span className="text-amber-600 font-medium">■</span> Offen
          <span className="ml-2 text-gray-300">—</span> Keine Abrechnung
          <span className="ml-4">Beträge in € (Netto) · Klick öffnet Gehaltszettel</span>
        </div>
      )}
    </div>
  );
}
