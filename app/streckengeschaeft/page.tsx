"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/Badge";
import { formatEuro, formatDatum } from "@/lib/utils";

interface StreckenLieferung {
  id: number;
  datum: string;
  status: string;
  rechnungNr?: string | null;
  istStreckengeschaeft: boolean;
  kunde: { id: number; name: string; firma?: string | null };
  streckenLieferant?: { id: number; name: string } | null;
  positionen: {
    id: number;
    menge: number;
    verkaufspreis: number;
    artikel: { name: string; einheit: string };
  }[];
}

export default function StreckengeschaeftPage() {
  const [lieferungen, setLieferungen] = useState<StreckenLieferung[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    // Fetch with a high limit and filter client-side for istStreckengeschaeft
    fetch("/api/lieferungen?limit=500")
      .then((r) => {
        if (!r.ok) throw new Error(`Serverfehler ${r.status}`);
        return r.json();
      })
      .then((data: StreckenLieferung[]) => {
        const alle = Array.isArray(data) ? data : [];
        setLieferungen(alle.filter((l) => l.istStreckengeschaeft));
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message ?? "Fehler beim Laden");
        setLoading(false);
      });
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">Streckengeschäfte</h1>
        <Link
          href="/lieferungen/neu"
          className="bg-green-800 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors w-full sm:w-auto text-center"
        >
          + Neue Lieferung
        </Link>
      </div>

      <div className="mb-4 bg-purple-50 border border-purple-200 rounded-lg px-4 py-3 text-sm text-purple-800">
        Streckengeschäfte sind Lieferungen, bei denen der Lieferant direkt an den Kunden liefert. Es wird kein Lagerabgang gebucht, die Rechnung wird trotzdem durch Sie ausgestellt.
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto shadow-sm">
        {loading ? (
          <p className="p-6 text-gray-400 text-sm">Lade Streckengeschäfte…</p>
        ) : error ? (
          <p className="p-6 text-red-600 text-sm">⚠ {error}</p>
        ) : lieferungen.length === 0 ? (
          <p className="p-6 text-gray-400 text-sm">
            Noch keine Streckengeschäfte erfasst.{" "}
            <Link href="/lieferungen/neu" className="text-green-700 underline hover:text-green-900">
              Neue Lieferung anlegen
            </Link>{" "}
            und &quot;Streckengeschäft&quot; aktivieren.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Datum</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Kunde</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap hidden sm:table-cell">Direktlieferant</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap hidden md:table-cell">Artikel / Menge</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap hidden lg:table-cell">Umsatz</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap hidden sm:table-cell">Rechnung</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {lieferungen.map((l) => {
                const umsatz = l.positionen.reduce((s, p) => s + p.menge * p.verkaufspreis, 0);
                const lieferantName = l.streckenLieferant
                  ? l.streckenLieferant.name
                  : "—";
                const kundeName = l.kunde.firma
                  ? `${l.kunde.firma} (${l.kunde.name})`
                  : l.kunde.name;
                const artikelZusammenfassung = l.positionen
                  .slice(0, 2)
                  .map((p) => `${p.menge} ${p.artikel.einheit} ${p.artikel.name}`)
                  .join(", ") + (l.positionen.length > 2 ? ` +${l.positionen.length - 2}` : "");

                return (
                  <tr key={l.id} className="border-b last:border-0 hover:bg-purple-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">{formatDatum(l.datum)}</td>
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/kunden/${l.kunde.id}`} className="hover:text-green-700 transition-colors">
                        {kundeName}
                      </Link>
                      <div className="sm:hidden text-xs text-gray-500 mt-0.5">{lieferantName}</div>
                    </td>
                    <td className="hidden sm:table-cell px-4 py-3 text-gray-700">{lieferantName}</td>
                    <td className="hidden md:table-cell px-4 py-3 text-gray-600 max-w-[220px] truncate" title={artikelZusammenfassung}>
                      {artikelZusammenfassung || "—"}
                    </td>
                    <td className="hidden lg:table-cell px-4 py-3 font-mono whitespace-nowrap">{formatEuro(umsatz)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={l.status} />
                    </td>
                    <td className="hidden sm:table-cell px-4 py-3 text-gray-600">
                      {l.rechnungNr ? (
                        <Link
                          href={`/lieferungen/${l.id}/rechnung`}
                          className="text-green-700 hover:text-green-900 font-mono text-xs underline"
                        >
                          {l.rechnungNr}
                        </Link>
                      ) : (
                        <span className="text-gray-400 text-xs">Offen</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/lieferungen/${l.id}`}
                        className="p-1.5 text-green-700 hover:bg-green-50 hover:text-green-900 rounded transition-colors inline-flex items-center"
                        title="Details"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {!loading && !error && lieferungen.length > 0 && (
        <p className="text-xs text-gray-400 mt-3 text-right">
          {lieferungen.length} Streckengeschäft{lieferungen.length !== 1 ? "e" : ""} gesamt
        </p>
      )}
    </div>
  );
}
