"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

interface Anlieferung {
  id: number;
  nummer: string;
  datum: string;
  kunde: { id: number; name: string; firma?: string | null };
  artikel: { id: number; name: string; einheit: string };
  menge: number;
  einheit: string;
  feuchte?: number | null;
  qualitaet?: string | null;
  preisProEinheit?: number | null;
  gesamtBetrag?: number | null;
  notiz?: string | null;
  gutschrift?: { id: number; nummer: string; status: string } | null;
}

function euro(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function datumStr(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE");
}

function AnlieferungenInner() {
  const searchParams = useSearchParams();
  const [anlieferungen, setAnlieferungen] = useState<Anlieferung[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const today = new Date().toISOString().slice(0, 10);
  const firstOfYear = `${new Date().getFullYear()}-01-01`;
  const [von, setVon] = useState(searchParams.get("von") ?? firstOfYear);
  const [bis, setBis] = useState(searchParams.get("bis") ?? today);
  const [suchtext, setSuchtext] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (von) params.set("von", von);
      if (bis) params.set("bis", bis);
      const res = await fetch(`/api/anlieferungen?${params}`);
      if (!res.ok) throw new Error("Fehler beim Laden");
      const data = await res.json();
      setAnlieferungen(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [von, bis]); // eslint-disable-line react-hooks/exhaustive-deps

  const gefiltert = anlieferungen.filter((a) => {
    if (!suchtext) return true;
    const s = suchtext.toLowerCase();
    return (
      a.nummer.toLowerCase().includes(s) ||
      a.kunde.name.toLowerCase().includes(s) ||
      (a.kunde.firma?.toLowerCase().includes(s) ?? false) ||
      a.artikel.name.toLowerCase().includes(s)
    );
  });

  const gesamtMenge = gefiltert.reduce((s, a) => s + a.menge, 0);
  const gesamtBetrag = gefiltert.reduce((s, a) => s + (a.gesamtBetrag ?? 0), 0);

  async function gutschriftErstellen(id: number) {
    if (!confirm("Gutschrift für diese Anlieferung erstellen?")) return;
    try {
      const res = await fetch(`/api/anlieferungen/${id}/gutschrift`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? "Fehler beim Erstellen der Gutschrift");
        return;
      }
      await load();
    } catch {
      alert("Netzwerkfehler");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Erzeugerabrechnung</h1>
          <p className="text-sm text-gray-500 mt-0.5">Anlieferungen von Kunden erfassen und abrechnen</p>
        </div>
        <Link
          href="/anlieferungen/neu"
          className="px-4 py-2 bg-green-700 hover:bg-green-800 text-white rounded-lg text-sm font-medium transition-colors"
        >
          + Neue Anlieferung
        </Link>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-5 flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">Von</label>
          <input type="date" value={von} onChange={(e) => setVon(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-700" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">Bis</label>
          <input type="date" value={bis} onChange={(e) => setBis(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-700" />
        </div>
        <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
          <label className="text-xs text-gray-500">Suche</label>
          <input type="text" value={suchtext} onChange={(e) => setSuchtext(e.target.value)}
            placeholder="Kunde, Artikel, Nummer…"
            className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-700" />
        </div>
      </div>

      {/* Summary */}
      {!loading && gefiltert.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="text-xs text-gray-500 mb-1">Anlieferungen</div>
            <div className="text-xl font-bold text-gray-900">{gefiltert.length}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="text-xs text-gray-500 mb-1">Gesamtmenge</div>
            <div className="text-xl font-bold text-gray-900">
              {gesamtMenge.toLocaleString("de-DE", { maximumFractionDigits: 2 })} t
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="text-xs text-gray-500 mb-1">Gesamtbetrag</div>
            <div className="text-xl font-bold text-green-700">{euro(gesamtBetrag)}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="text-xs text-gray-500 mb-1">Mit Gutschrift</div>
            <div className="text-xl font-bold text-gray-900">{gefiltert.filter((a) => a.gutschrift).length}</div>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
      )}

      {loading ? (
        <div className="text-sm text-gray-400 py-8 text-center">Lade…</div>
      ) : gefiltert.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center text-gray-400">
          Keine Anlieferungen im gewählten Zeitraum.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Nr.</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Datum</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Kunde</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Artikel</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Menge</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Feuchte</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Preis/t</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Betrag</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Gutschrift</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {gefiltert.map((a) => (
                <tr key={a.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{a.nummer}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{datumStr(a.datum)}</td>
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/kunden/${a.kunde.id}`} className="hover:text-green-700 hover:underline">
                      {a.kunde.firma ?? a.kunde.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{a.artikel.name}</td>
                  <td className="px-4 py-3 text-right font-mono">
                    {a.menge.toLocaleString("de-DE", { maximumFractionDigits: 3 })} {a.einheit}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500 hidden sm:table-cell">
                    {a.feuchte != null ? `${a.feuchte} %` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono hidden sm:table-cell">
                    {euro(a.preisProEinheit)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold">
                    {euro(a.gesamtBetrag)}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {a.gutschrift ? (
                      <Link href={`/gutschriften/${a.gutschrift.id}`} className="text-green-700 hover:underline text-xs font-mono">
                        {a.gutschrift.nummer}
                      </Link>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {!a.gutschrift && a.preisProEinheit && (
                        <button
                          onClick={() => gutschriftErstellen(a.id)}
                          className="text-xs px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded font-medium transition-colors whitespace-nowrap"
                        >
                          Gutschrift
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 border-t-2 border-gray-200">
              <tr>
                <td colSpan={4} className="px-4 py-3 font-semibold text-gray-700 hidden md:table-cell">
                  Gesamt ({gefiltert.length})
                </td>
                <td colSpan={2} className="px-4 py-3 font-semibold text-gray-700 md:hidden">
                  Gesamt ({gefiltert.length})
                </td>
                <td className="px-4 py-3 text-right font-mono font-semibold">
                  {gesamtMenge.toLocaleString("de-DE", { maximumFractionDigits: 3 })} t
                </td>
                <td colSpan={2} className="hidden sm:table-cell" />
                <td className="px-4 py-3 text-right font-mono font-semibold text-green-700">{euro(gesamtBetrag)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

export default function AnlieferungenPage() {
  return (
    <Suspense fallback={<div className="text-sm text-gray-400 py-8 text-center">Lade…</div>}>
      <AnlieferungenInner />
    </Suspense>
  );
}
