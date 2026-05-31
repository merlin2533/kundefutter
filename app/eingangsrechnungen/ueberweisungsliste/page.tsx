"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface UeberweisungEintrag {
  id: number;
  nummer: string | null;
  datum: string;
  faelligAm: string | null;
  betrag: number;
  mwst: number;
  brutto: number;
  notiz: string | null;
  lieferantId: number;
  lieferantName: string;
  iban: string | null;
  bic: string | null;
  kontoinhaber: string | null;
  ibanFehlt: boolean;
  ueberfaellig: boolean;
}

export default function UeberweisungslistePage() {
  const [data, setData] = useState<UeberweisungEintrag[]>([]);
  const [loading, setLoading] = useState(true);
  const [nurFaellig, setNurFaellig] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bezahlenIds, setBezahlenIds] = useState<Set<number>>(new Set());
  const [bezahlenLoading, setBezahlenLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = nurFaellig ? "?nurFaellig=1" : "";
      const res = await fetch(`/api/eingangsrechnungen/ueberweisungsliste${params}`);
      if (!res.ok) { setLoading(false); return; }
      const d = await res.json();
      setData(Array.isArray(d) ? d : []);
      setSelected(new Set());
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [nurFaellig]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === data.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(data.map((d) => d.id)));
    }
  }

  async function handleBezahlen(ids: number[]) {
    if (ids.length === 0) return;
    if (!confirm(`${ids.length} Rechnung${ids.length > 1 ? "en" : ""} als bezahlt markieren?`)) return;
    setBezahlenLoading(true);
    setBezahlenIds(new Set(ids));
    try {
      await Promise.all(
        ids.map((id) =>
          fetch(`/api/eingangsrechnungen/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ aktion: "bezahlen" }),
          })
        )
      );
      await fetchData();
    } finally {
      setBezahlenLoading(false);
      setBezahlenIds(new Set());
    }
  }

  function exportCsv() {
    const rows = selected.size > 0 ? data.filter((d) => selected.has(d.id)) : data;
    const csvRows = [
      ["Empfänger", "IBAN", "BIC", "Betrag (Brutto)", "Währung", "Verwendungszweck"],
      ...rows.map((r) => [
        r.kontoinhaber ?? r.lieferantName,
        r.iban ?? "",
        r.bic ?? "",
        r.brutto.toFixed(2).replace(".", ","),
        "EUR",
        `Rechnung ${r.nummer ?? r.id} vom ${new Date(r.datum).toLocaleDateString("de-DE")}`,
      ]),
    ];
    const csv = csvRows.map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ueberweisungsliste_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const gesamtBrutto = data.reduce((s, r) => s + r.brutto, 0);
  const selectedBrutto = data.filter((d) => selected.has(d.id)).reduce((s, r) => s + r.brutto, 0);
  const ohneIban = data.filter((d) => d.ibanFehlt).length;

  return (
    <div>
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/eingangsrechnungen" className="hover:text-green-700">Eingangsrechnungen</Link>
        <span>›</span>
        <span className="text-gray-900 font-medium">Zahlungsliste / Überweisungen</span>
      </nav>

      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900">Zahlungsliste — offene Rechnungen</h1>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={exportCsv}
            disabled={data.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            CSV {selected.size > 0 ? `(${selected.size} ausgewählt)` : "exportieren"}
          </button>
          {selected.size > 0 && (
            <button
              onClick={() => handleBezahlen([...selected])}
              disabled={bezahlenLoading}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
            >
              {bezahlenLoading ? "Markiere…" : `${selected.size} als bezahlt markieren`}
            </button>
          )}
        </div>
      </div>

      {/* Filter + Summen */}
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={nurFaellig}
            onChange={(e) => setNurFaellig(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
          />
          Nur fällige / überfällige
        </label>
        {ohneIban > 0 && (
          <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full font-medium">
            ⚠ {ohneIban} Rechnung{ohneIban > 1 ? "en" : ""} ohne IBAN
          </span>
        )}
        <span className="text-sm text-gray-500 ml-auto">
          {selected.size > 0
            ? `Ausgewählt: ${selectedBrutto.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}`
            : `Gesamt offen: ${gesamtBrutto.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}`}
        </span>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <p className="p-6 text-gray-400 text-sm">Lade Zahlungsliste…</p>
        ) : data.length === 0 ? (
          <p className="p-6 text-gray-400 text-sm">Keine offenen Rechnungen.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.size === data.length && data.length > 0}
                      onChange={toggleAll}
                      className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                    />
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Rechnung</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Lieferant</th>
                  <th className="hidden md:table-cell text-left px-4 py-3 font-medium text-gray-600">IBAN</th>
                  <th className="hidden lg:table-cell text-left px-4 py-3 font-medium text-gray-600">BIC</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Brutto</th>
                  <th className="hidden sm:table-cell text-left px-4 py-3 font-medium text-gray-600">Fällig</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Aktion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.map((item) => (
                  <tr
                    key={item.id}
                    className={`hover:bg-gray-50 ${item.ueberfaellig ? "bg-red-50/40" : ""} ${selected.has(item.id) ? "bg-green-50" : ""}`}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(item.id)}
                        onChange={() => toggleSelect(item.id)}
                        className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/eingangsrechnungen/${item.id}`} className="font-mono text-xs text-green-700 hover:underline">
                        {item.nummer ?? `#${item.id}`}
                      </Link>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {new Date(item.datum).toLocaleDateString("de-DE")}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/lieferanten/${item.lieferantId}`} className="hover:underline text-gray-800">
                        {item.lieferantName}
                      </Link>
                      {item.ibanFehlt && (
                        <div className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          Keine IBAN hinterlegt
                        </div>
                      )}
                    </td>
                    <td className="hidden md:table-cell px-4 py-3 font-mono text-xs text-gray-700">
                      {item.iban ? (
                        <span className="tracking-wide">{item.iban.replace(/(.{4})/g, "$1 ").trim()}</span>
                      ) : (
                        <Link href={`/lieferanten/${item.lieferantId}`} className="text-amber-600 hover:underline text-xs">
                          IBAN ergänzen →
                        </Link>
                      )}
                    </td>
                    <td className="hidden lg:table-cell px-4 py-3 font-mono text-xs text-gray-600">
                      {item.bic ?? <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900 whitespace-nowrap">
                      {item.brutto.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
                      <div className="text-xs text-gray-400 font-normal">
                        {item.betrag.toLocaleString("de-DE", { style: "currency", currency: "EUR" })} netto
                      </div>
                    </td>
                    <td className="hidden sm:table-cell px-4 py-3 whitespace-nowrap">
                      {item.faelligAm ? (
                        <span className={item.ueberfaellig ? "text-red-600 font-medium" : "text-gray-700"}>
                          {new Date(item.faelligAm).toLocaleDateString("de-DE")}
                          {item.ueberfaellig && <span className="block text-xs font-normal">überfällig</span>}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleBezahlen([item.id])}
                        disabled={bezahlenLoading && bezahlenIds.has(item.id)}
                        className="px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded transition-colors disabled:opacity-50 whitespace-nowrap"
                      >
                        {bezahlenLoading && bezahlenIds.has(item.id) ? "…" : "Bezahlt"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-sm font-medium text-gray-600">
                    {data.length} Rechnung{data.length !== 1 ? "en" : ""}
                    {selected.size > 0 && ` · ${selected.size} ausgewählt`}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">
                    {(selected.size > 0 ? selectedBrutto : gesamtBrutto).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
