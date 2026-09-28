"use client";
import { useState, useCallback, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { formatDatum, formatEuro } from "@/lib/utils";
import * as Sentry from "@sentry/nextjs";

interface UstVoranmeldung {
  zeitraum: { von: string; bis: string };
  einnahmen: {
    steuerpflichtig19: number;
    steuer19: number;
    steuerpflichtig7: number;
    steuer7: number;
    steuerfrei: number;
  };
  vorsteuer: { satz19: number; satz7: number };
  zahllast: number;
  kennzahlen: {
    KZ81: number;
    KZ86: number;
    KZ66: number;
    KZ97: number;
    KZ66_gesamt: number;
    KZ26_vorsteuer: number;
    KZ83_zahllast: number;
  };
}

// Lokales Datum ohne den toISOString()-Umweg über UTC bauen — sonst kippt das Ergebnis in der
// deutschen Sommerzeit (UTC+2) auf den Vortag zurück (siehe AGENTS.md-Bugtabelle, u.a. bereits
// für /ausgaben behoben). app/exporte/page.tsx hat denselben, hier bewusst nicht mitbehobenen
// Fehler bei der Datumsvorbelegung — dort außerhalb des Scopes dieser Änderung.
function heutigesDatum(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function ersterDesMonats(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-01`;
}
const today = heutigesDatum();
const firstOfMonth = ersterDesMonats();

export default function UstVorschauPage() {
  return (
    <Suspense fallback={<p className="text-gray-400 mt-8 text-sm">Lade…</p>}>
      <UstVorschauInner />
    </Suspense>
  );
}

function UstVorschauInner() {
  const searchParams = useSearchParams();
  const [von, setVon] = useState(searchParams.get("von") || firstOfMonth);
  const [bis, setBis] = useState(searchParams.get("bis") || today);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<UstVoranmeldung | null>(null);

  const laden = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ von, bis });
      const res = await fetch(`/api/exporte/ust-voranmeldung?${params}`);
      if (!res.ok) throw new Error("Laden fehlgeschlagen");
      const json = await res.json();
      setData(json);
    } catch (err) {
      Sentry.captureException(err);
      setError("Kennzahlen konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [von, bis]);

  // Direktaufruf mit von/bis in der URL (Link von /exporte) lädt sofort
  useEffect(() => {
    if (searchParams.get("von") || searchParams.get("bis")) {
      laden();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-3xl">
      <div className="print:hidden flex items-center gap-2 text-sm text-gray-500 mb-4">
        <Link href="/exporte" className="hover:text-green-700">
          Exporte
        </Link>
        <span>›</span>
        <span className="text-gray-800 font-medium">USt-Voranmeldung</span>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">USt-Voranmeldungshilfe</h1>
        <p className="text-sm text-gray-500">
          Druckbare Zusammenfassung der aus den erfassten Belegen berechneten Umsätze und
          Vorsteuer für den gewählten Zeitraum — als Arbeitsgrundlage/Beleg für den
          Steuerberater. Kein Ersatz für die eigentliche ELSTER-Meldung und keine steuerliche
          Prüfung; die genaue Zuordnung zu den ELSTER-Kennzahlen des jeweiligen Formularjahres
          obliegt dem Steuerberater.
        </p>
      </div>

      <div className="print:hidden bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
        <div className="flex gap-3 flex-wrap items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Von</label>
            <input
              type="date"
              value={von}
              onChange={(e) => setVon(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Bis</label>
            <input
              type="date"
              value={bis}
              onChange={(e) => setBis(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
            />
          </div>
          <button
            onClick={laden}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium bg-green-800 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-60"
          >
            {loading ? "Lade…" : "Kennzahlen anzeigen"}
          </button>
          {data && (
            <button
              onClick={() => window.print()}
              className="px-4 py-2 text-sm font-medium bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
            >
              Drucken
            </button>
          )}
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>

      {data && (
        <>
          <p className="text-sm text-gray-500 mb-3">
            Zeitraum {formatDatum(data.zeitraum.von)}–{formatDatum(data.zeitraum.bis)}
          </p>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h2 className="text-sm font-semibold text-gray-900">Umsätze</h2>
            </div>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="px-4 py-2 w-24 font-mono text-gray-500">KZ 81</td>
                  <td className="px-4 py-2">Steuerpflichtige Umsätze zu 19 % (Bemessungsgrundlage)</td>
                  <td className="px-4 py-2 text-right font-medium">{formatEuro(data.einnahmen.steuerpflichtig19)}</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 w-24 font-mono text-gray-400">—</td>
                  <td className="px-4 py-2">davon Umsatzsteuer 19 % (von ELSTER automatisch berechnet)</td>
                  <td className="px-4 py-2 text-right font-medium">{formatEuro(data.einnahmen.steuer19)}</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 w-24 font-mono text-gray-500">KZ 86</td>
                  <td className="px-4 py-2">Steuerpflichtige Umsätze zu 7 % (Bemessungsgrundlage)</td>
                  <td className="px-4 py-2 text-right font-medium">{formatEuro(data.einnahmen.steuerpflichtig7)}</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 w-24 font-mono text-gray-400">—</td>
                  <td className="px-4 py-2">davon Umsatzsteuer 7 % (von ELSTER automatisch berechnet)</td>
                  <td className="px-4 py-2 text-right font-medium">{formatEuro(data.einnahmen.steuer7)}</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 w-24 font-mono text-gray-400">—</td>
                  <td className="px-4 py-2 text-gray-500">Steuerfreie/nicht steuerbare Umsätze</td>
                  <td className="px-4 py-2 text-right text-gray-500">{formatEuro(data.einnahmen.steuerfrei)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h2 className="text-sm font-semibold text-gray-900">Vorsteuer</h2>
            </div>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="px-4 py-2 w-24 font-mono text-gray-400">—</td>
                  <td className="px-4 py-2">Abziehbare Vorsteuer 19 % (Ausgaben, Erzeugerabrechnungen)</td>
                  <td className="px-4 py-2 text-right font-medium">{formatEuro(data.vorsteuer.satz19)}</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 w-24 font-mono text-gray-400">—</td>
                  <td className="px-4 py-2">Abziehbare Vorsteuer 7 % (Ausgaben, Erzeugerabrechnungen)</td>
                  <td className="px-4 py-2 text-right font-medium">{formatEuro(data.vorsteuer.satz7)}</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 w-24 font-mono text-gray-400">—</td>
                  <td className="px-4 py-2 font-medium">Abziehbare Vorsteuerbeträge gesamt</td>
                  <td className="px-4 py-2 text-right font-medium">{formatEuro(data.kennzahlen.KZ26_vorsteuer)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h2 className="text-sm font-semibold text-gray-900">Ergebnis</h2>
            </div>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="px-4 py-2 w-24 font-mono text-gray-400">—</td>
                  <td className="px-4 py-2">Umsatzsteuer gesamt</td>
                  <td className="px-4 py-2 text-right font-medium">{formatEuro(data.kennzahlen.KZ66_gesamt)}</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 w-24 font-mono text-gray-400">—</td>
                  <td className="px-4 py-2">./. Abziehbare Vorsteuer</td>
                  <td className="px-4 py-2 text-right font-medium">{formatEuro(data.kennzahlen.KZ26_vorsteuer)}</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="px-4 py-2 w-24 font-mono text-gray-700">KZ 83</td>
                  <td className="px-4 py-2 font-semibold">
                    {data.zahllast >= 0 ? "Zahllast" : "Vorsteuerüberhang (Erstattung)"}
                  </td>
                  <td className={`px-4 py-2 text-right font-bold ${data.zahllast >= 0 ? "text-gray-900" : "text-green-700"}`}>
                    {formatEuro(Math.abs(data.zahllast))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="text-xs text-gray-400 mt-4">
            Hinweiswert-Charakter: automatisch aus den in AGRI-Office erfassten Belegen berechnet,
            keine rechtsverbindliche Steuerberatung. Die genaue Zuordnung zu den amtlichen
            ELSTER-Kennzahlen des jeweils gültigen Formularjahres ist hier bewusst nur für die
            eindeutig belegbaren Kennzahlen (KZ 81, KZ 86, KZ 83) ausgewiesen; die übrigen Zeilen
            sind unbeschriftet und müssen vom Steuerberater den passenden Kennzahlen zugeordnet
            werden. Lieferantenrechnungen (EingangsRechnung) sind NICHT in der Vorsteuer
            enthalten — nur bereits im Ausgabenbuch erfasste Belege und Erzeugerabrechnungen. Für
            pauschalierende Landwirte nach §24 UStG ist die Vorsteuer-Berechnung nicht abgebildet.
            Vor der Abgabe unbedingt gegen die eigenen Aufzeichnungen prüfen.
          </p>
        </>
      )}
    </div>
  );
}
