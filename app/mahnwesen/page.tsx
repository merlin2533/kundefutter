"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { formatEuro, formatDatum } from "@/lib/utils";

interface UeberfaelligeLieferung {
  id: number;
  datum: string;
  rechnungNr?: string | null;
  zahlungsziel: number | null;
  kunde: { id: number; name: string; firma?: string | null };
  positionen: { menge: number; verkaufspreis: number }[];
}

export default function MahnwesenPage() {
  const [lieferungen, setLieferungen] = useState<UeberfaelligeLieferung[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [error, setError] = useState("");

  const heute = new Date();
  heute.setHours(0, 0, 0, 0);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/mahnwesen");
      if (!res.ok) throw new Error("Fehler beim Laden");
      const data = await res.json();
      setLieferungen(data);
    } catch {
      setError("Fehler beim Laden der überfälligen Rechnungen.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function markiereBezahlt(id: number) {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/lieferungen/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bezahltAm: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error("Fehler");
      await load();
    } catch {
      setError("Fehler beim Markieren als bezahlt.");
    } finally {
      setActionLoading(null);
    }
  }

  function faelligSeitTagen(datum: string, zahlungsziel: number | null): number {
    const tage = zahlungsziel ?? 30;
    const faellig = new Date(new Date(datum).getTime() + tage * 24 * 60 * 60 * 1000);
    faellig.setHours(0, 0, 0, 0);
    return Math.floor((heute.getTime() - faellig.getTime()) / (24 * 60 * 60 * 1000));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Mahnwesen</h1>
        <button
          onClick={load}
          className="text-sm text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg px-3 py-1.5 transition-colors"
        >
          Aktualisieren
        </button>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-gray-400 text-sm">Lade überfällige Rechnungen…</p>
      ) : lieferungen.length === 0 ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center text-green-700">
          Keine überfälligen Rechnungen – alles im grünen Bereich!
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Datum", "Kunde", "Rechnungsnr.", "Betrag", "Fällig seit", "Aktion"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lieferungen.map((l) => {
                const betrag = l.positionen.reduce(
                  (s, p) => s + p.menge * p.verkaufspreis,
                  0
                );
                const tage = faelligSeitTagen(l.datum, l.zahlungsziel);
                return (
                  <tr key={l.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">{formatDatum(l.datum)}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/kunden/${l.kunde.id}`}
                        className="text-green-700 hover:underline font-medium"
                      >
                        {l.kunde.firma
                          ? `${l.kunde.firma} (${l.kunde.name})`
                          : l.kunde.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {l.rechnungNr ? (
                        <Link
                          href={`/lieferungen/${l.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          {l.rechnungNr}
                        </Link>
                      ) : (
                        <Link
                          href={`/lieferungen/${l.id}`}
                          className="text-gray-500 hover:underline"
                        >
                          #{l.id}
                        </Link>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono font-medium">{formatEuro(betrag)}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-700">
                        {tage} {tage === 1 ? "Tag" : "Tage"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => markiereBezahlt(l.id)}
                        disabled={actionLoading === l.id}
                        className="px-3 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-60"
                      >
                        {actionLoading === l.id ? "…" : "Als bezahlt markieren"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
