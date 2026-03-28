"use client";
import { useEffect, useState, useCallback } from "react";
import { formatEuro } from "@/lib/utils";

function exportCsv(gruppen: BestellvorschlagGruppe[], mengenOverride: Record<number, number>) {
  const rows: string[][] = [["Lieferant", "Artikel", "Artikelnummer", "Einheit", "Vorgeschlagene Menge", "Aktueller Bestand", "Mindestbestand"]];
  for (const gruppe of gruppen) {
    for (const pos of gruppe.positionen) {
      const menge = mengenOverride[pos.artikelId] ?? pos.bestellmenge;
      rows.push([
        gruppe.lieferantName,
        pos.artikelName,
        pos.artikelnummer,
        pos.einheit,
        String(menge),
        String(pos.aktuellerBestand),
        String(pos.mindestbestand),
      ]);
    }
  }
  const csv = rows.map((r) => r.join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `bestellvorschlag-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

interface PrognoseRow {
  artikelId: number;
  artikelName: string;
  kategorie: string;
  aktuellerBestand: number;
  einheit: string;
  avgTagesverbrauch: number;
  effektiverTagesverbrauch: number;
  reichweiteTage: number | null;
  bestellvorschlag: boolean;
}

interface BestellvorschlagPosition {
  artikelId: number;
  artikelName: string;
  artikelnummer: string;
  einheit: string;
  bestellmenge: number;
  aktuellerBestand: number;
  mindestbestand: number;
  bevorzugterLieferant: {
    lieferantId: number;
    name: string;
    einkaufspreis: number;
    mindestbestellmenge: number;
  } | null;
}

interface BestellvorschlagGruppe {
  lieferantId: number;
  lieferantName: string;
  positionen: BestellvorschlagPosition[];
  gesamtEinkaufswert: number;
}

export default function PrognosePageWrapper() {
  const [tab, setTab] = useState<"prognose" | "bestellvorschlag">("prognose");
  const [zeitraum, setZeitraum] = useState(30);
  const [zielhorizont, setZielhorizont] = useState(14);
  const [schwellwert, setSchwellwert] = useState(21);
  const [saisonal, setSaisonal] = useState(false);
  const [bestellGruppen, setBestellGruppen] = useState<BestellvorschlagGruppe[]>([]);
  const [bestellMengenOverride, setBestellMengenOverride] = useState<Record<number, number>>({});

  return (
    <div>
      {/* Print header — only visible when printing */}
      <div className="hidden print:block mb-6">
        <h1 className="text-2xl font-bold">Bestellvorschlag — {new Date().toLocaleDateString("de-DE")}</h1>
      </div>

      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap print:hidden">
        <h1 className="text-2xl font-bold">Prognose & Bestellvorschlag</h1>
        {tab === "bestellvorschlag" && (
          <div className="flex gap-2">
            <button
              onClick={() => exportCsv(bestellGruppen, bestellMengenOverride)}
              className="px-4 py-2 text-sm font-medium bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              CSV exportieren
            </button>
            <button
              onClick={() => window.print()}
              className="px-4 py-2 text-sm font-medium bg-green-700 text-white rounded-lg hover:bg-green-800 transition-colors"
            >
              Drucken / Exportieren
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200 print:hidden">
        {(["prognose", "bestellvorschlag"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t
                ? "border-green-800 text-green-800"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "prognose" ? "Prognose" : "Bestellvorschlag"}
          </button>
        ))}
      </div>

      {/* Settings bar */}
      <div className="flex flex-wrap gap-4 mb-6 bg-white border border-gray-200 rounded-xl p-4 shadow-sm print:hidden">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Zeitraum</label>
          <select
            value={zeitraum}
            onChange={(e) => setZeitraum(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
          >
            {[30, 60, 90].map((v) => <option key={v} value={v}>{v} Tage</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Zielhorizont</label>
          <select
            value={zielhorizont}
            onChange={(e) => setZielhorizont(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
          >
            {[14, 21, 30, 60].map((v) => <option key={v} value={v}>{v} Tage</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Schwellwert (Tage)</label>
          <input
            type="number"
            min={1}
            value={schwellwert}
            onChange={(e) => setSchwellwert(Number(e.target.value) || 21)}
            className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm w-20 focus:outline-none focus:ring-2 focus:ring-green-700"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Saisonale Prognose</label>
          <input
            type="checkbox"
            checked={saisonal}
            onChange={(e) => setSaisonal(e.target.checked)}
            className="rounded border-gray-300 text-green-700 focus:ring-green-700"
          />
        </div>
      </div>

      {tab === "prognose" && (
        <PrognoseTab
          zeitraum={zeitraum}
          zielhorizont={zielhorizont}
          schwellwert={schwellwert}
          saisonal={saisonal}
        />
      )}

      {tab === "bestellvorschlag" && (
        <BestellvorschlagTab
          zeitraum={zeitraum}
          zielhorizont={zielhorizont}
          schwellwert={schwellwert}
          saisonal={saisonal}
          onGruppenChange={setBestellGruppen}
          onMengenOverrideChange={setBestellMengenOverride}
        />
      )}
    </div>
  );
}

function reichweiteColor(tage: number | null, schwellwert: number): string {
  if (tage === null) return "text-gray-400";
  if (tage < 7) return "text-red-700 font-semibold";
  if (tage < schwellwert) return "text-yellow-700 font-semibold";
  return "text-green-700";
}

function PrognoseTab({
  zeitraum,
  zielhorizont,
  schwellwert,
  saisonal,
}: {
  zeitraum: number;
  zielhorizont: number;
  schwellwert: number;
  saisonal: boolean;
}) {
  const [rows, setRows] = useState<PrognoseRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        zeitraum: String(zeitraum),
        zielhorizont: String(zielhorizont),
        schwellwert: String(schwellwert),
        saisonal: String(saisonal),
      });
      const res = await fetch(`/api/prognose?${params}`);
      if (!res.ok) throw new Error("Fehler beim Laden der Prognose");
      const data = await res.json();
      // Sort: nulls last, then ascending
      const sorted = (Array.isArray(data) ? data : []).sort((a: PrognoseRow, b: PrognoseRow) => {
        if (a.reichweiteTage === null && b.reichweiteTage === null) return 0;
        if (a.reichweiteTage === null) return 1;
        if (b.reichweiteTage === null) return -1;
        return a.reichweiteTage - b.reichweiteTage;
      });
      setRows(sorted);
    } catch {
      setError("Fehler beim Laden der Prognose.");
    } finally {
      setLoading(false);
    }
  }, [zeitraum, zielhorizont, schwellwert, saisonal]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <p className="text-gray-400 text-sm p-4">Lade Prognose…</p>;
  if (error) return <p className="text-red-600 text-sm p-4">{error}</p>;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
      {rows.length === 0 ? (
        <p className="p-6 text-gray-400 text-sm">Keine Prognosedaten verfügbar.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {["Artikel", "Kategorie", "Bestand", "Ø Tagesverbrauch", "Eff. Tagesverbrauch", "Reichweite", "Bestellen?"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.artikelId} className="border-b last:border-0 hover:bg-green-50 transition-colors">
                <td className="px-4 py-3 font-medium">{row.artikelName}</td>
                <td className="px-4 py-3 text-gray-600">{row.kategorie}</td>
                <td className="px-4 py-3 font-mono">{row.aktuellerBestand} {row.einheit}</td>
                <td className="px-4 py-3 font-mono">
                  {row.avgTagesverbrauch === 0
                    ? <span className="text-gray-400 text-xs">Kein Verbrauch</span>
                    : `${row.avgTagesverbrauch.toFixed(2)} ${row.einheit}/Tag`}
                </td>
                <td className="px-4 py-3 font-mono">
                  {row.effektiverTagesverbrauch === 0
                    ? <span className="text-gray-400 text-xs">Kein Verbrauch</span>
                    : `${row.effektiverTagesverbrauch.toFixed(2)} ${row.einheit}/Tag`}
                </td>
                <td className={`px-4 py-3 font-mono ${reichweiteColor(row.reichweiteTage, schwellwert)}`}>
                  {row.reichweiteTage === null
                    ? <span className="text-gray-400 text-xs">—</span>
                    : `${row.reichweiteTage} Tage`}
                </td>
                <td className="px-4 py-3">
                  {row.bestellvorschlag ? (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700 border border-red-200">
                      Bestellen
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700 border border-green-200">
                      OK
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function BestellvorschlagTab({
  zeitraum,
  zielhorizont,
  schwellwert,
  saisonal,
  onGruppenChange,
  onMengenOverrideChange,
}: {
  zeitraum: number;
  zielhorizont: number;
  schwellwert: number;
  saisonal: boolean;
  onGruppenChange?: (gruppen: BestellvorschlagGruppe[]) => void;
  onMengenOverrideChange?: (override: Record<number, number>) => void;
}) {
  const [gruppen, setGruppen] = useState<BestellvorschlagGruppe[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mengenOverride, setMengenOverride] = useState<Record<number, number>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setMengenOverride({});
    onMengenOverrideChange?.({});
    try {
      const params = new URLSearchParams({
        zeitraum: String(zeitraum),
        zielhorizont: String(zielhorizont),
        schwellwert: String(schwellwert),
        saisonal: String(saisonal),
      });
      const res = await fetch(`/api/prognose/bestellvorschlag?${params}`);
      if (!res.ok) throw new Error("Fehler beim Laden des Bestellvorschlags");
      const data: BestellvorschlagGruppe[] = await res.json();
      const normalized = Array.isArray(data) ? data : [];
      setGruppen(normalized);
      onGruppenChange?.(normalized);
    } catch {
      setError("Fehler beim Laden des Bestellvorschlags.");
    } finally {
      setLoading(false);
    }
  }, [zeitraum, zielhorizont, schwellwert, saisonal, onGruppenChange, onMengenOverrideChange]);

  useEffect(() => { load(); }, [load]);

  function getMenge(artikelId: number, defaultMenge: number) {
    return mengenOverride[artikelId] ?? defaultMenge;
  }

  function setMenge(artikelId: number, value: number) {
    setMengenOverride((prev) => {
      const next = { ...prev, [artikelId]: value };
      onMengenOverrideChange?.(next);
      return next;
    });
  }

  function getEinkaufspreis(p: BestellvorschlagPosition): number {
    return p.bevorzugterLieferant?.einkaufspreis ?? 0;
  }

  function gruppeGesamtwert(gruppe: BestellvorschlagGruppe) {
    return gruppe.positionen.reduce(
      (sum, p) => sum + getMenge(p.artikelId, p.bestellmenge) * getEinkaufspreis(p),
      0
    );
  }

  if (loading) return <p className="text-gray-400 text-sm p-4">Lade Bestellvorschlag…</p>;
  if (error) return <p className="text-red-600 text-sm p-4">{error}</p>;
  if (gruppen.length === 0) return <p className="text-gray-400 text-sm p-4">Keine Bestellvorschläge vorhanden.</p>;

  return (
    <div className="space-y-8">
      {gruppen.map((gruppe) => (
        <div key={gruppe.lieferantId} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Supplier header */}
          <div className="flex items-center justify-between px-5 py-3 bg-green-800 text-white">
            <h2 className="font-semibold text-base">{gruppe.lieferantName}</h2>
            <div className="flex items-center gap-3">
              <span className="text-sm text-green-200">
                Gesamt: {formatEuro(gruppeGesamtwert(gruppe))}
              </span>
              <button
                onClick={() =>
                  window.open(
                    `/api/exporte/bestellvorschlag?lieferantId=${gruppe.lieferantId}`,
                    "_blank"
                  )
                }
                className="px-3 py-1.5 text-xs font-medium bg-white text-green-800 rounded-lg hover:bg-green-50 transition-colors"
              >
                Als PDF exportieren
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {["Artikel", "Art.-Nr.", "Einheit", "Bestellmenge", "Akt. Bestand", "Mindestbestand", "Einkaufspreis", "Gesamtwert"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gruppe.positionen.map((pos) => {
                  const menge = getMenge(pos.artikelId, pos.bestellmenge);
                  return (
                    <tr key={pos.artikelId} className="border-b last:border-0 hover:bg-green-50 transition-colors">
                      <td className="px-4 py-3 font-medium">{pos.artikelName}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs font-mono">{pos.artikelnummer}</td>
                      <td className="px-4 py-3 text-gray-600">{pos.einheit}</td>
                      <td className="px-4 py-3">
                        <span className="print:inline hidden font-mono">{menge}</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={menge}
                          onChange={(e) => setMenge(pos.artikelId, parseFloat(e.target.value) || 0)}
                          className="w-24 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-700 print:hidden"
                        />
                      </td>
                      <td className="px-4 py-3 font-mono">{pos.aktuellerBestand} {pos.einheit}</td>
                      <td className="px-4 py-3 font-mono">{pos.mindestbestand} {pos.einheit}</td>
                      <td className="px-4 py-3 font-mono">{formatEuro(getEinkaufspreis(pos))}</td>
                      <td className="px-4 py-3 font-mono">{formatEuro(menge * getEinkaufspreis(pos))}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                <tr>
                  <td colSpan={7} className="px-4 py-3 font-semibold text-gray-700">Gesamtwert</td>
                  <td className="px-4 py-3 font-mono font-semibold">{formatEuro(gruppeGesamtwert(gruppe))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
