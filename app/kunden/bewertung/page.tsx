"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { KpiCard } from "@/components/Card";
import { formatEuro } from "@/lib/utils";

interface BewertungDetail {
  umsatz: number;
  umsatzWert: number;
  haeufigkeit: number;
  haeufigkeitWert: number;
  zahlungsmoral: number;
  flaeche: number;
  flaecheWert: number;
  afig: number;
  afigWert: number;
}

interface KundeBewertung {
  kundeId: number;
  kundeName: string;
  firma: string | null;
  score: number;
  details: BewertungDetail;
}

function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 70
      ? "bg-green-500"
      : score >= 40
      ? "bg-yellow-400"
      : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 bg-gray-200 rounded-full h-2 flex-shrink-0">
        <div
          className={`${color} h-2 rounded-full transition-all`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-sm font-semibold tabular-nums w-6 text-right">{score}</span>
    </div>
  );
}

function Punkte({ pts }: { pts: number }) {
  return (
    <span className="text-sm text-gray-600 tabular-nums">
      {pts}
      <span className="text-xs text-gray-400">/20</span>
    </span>
  );
}

export default function KundenbewertungPage() {
  const [daten, setDaten] = useState<KundeBewertung[]>([]);
  const [loading, setLoading] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/kunden/bewertung")
      .then((r) => {
        if (!r.ok) throw new Error("Fehler beim Laden");
        return r.json();
      })
      .then((d) => {
        setDaten(d);
        setLoading(false);
      })
      .catch((e) => {
        setFehler(e.message);
        setLoading(false);
      });
  }, []);

  const avgScore =
    daten.length > 0
      ? Math.round(daten.reduce((s, k) => s + k.score, 0) / daten.length)
      : 0;
  const topKunde = daten[0] ?? null;
  const nachbesserung = daten.filter((k) => k.score < 30).length;

  return (
    <main className="max-w-screen-xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Kundenbewertung / Lead-Score</h1>
        <p className="text-sm text-gray-500 mt-1">
          Score 0–100, basierend auf Umsatz, Bestellhäufigkeit, Zahlungsmoral, Fläche und AFIG-Betrag (je max. 20 Punkte).
        </p>
      </div>

      {loading && (
        <div className="text-center py-12 text-gray-500">Wird berechnet…</div>
      )}

      {fehler && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3">
          {fehler}
        </div>
      )}

      {!loading && !fehler && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
            <KpiCard
              label="Durchschnittlicher Score"
              value={avgScore}
              color="green"
              sub={`von ${daten.length} aktiven Kunden`}
            />
            <KpiCard
              label="Bester Kunde"
              value={topKunde ? `${topKunde.kundeName} (${topKunde.score})` : "–"}
              color="blue"
              sub={topKunde?.firma ?? undefined}
            />
            <KpiCard
              label="Nachbesserungsbedarf"
              value={nachbesserung}
              color={nachbesserung > 0 ? "red" : "green"}
              sub="Kunden mit Score < 30"
            />
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wide">
                    <th className="px-4 py-3 w-10">#</th>
                    <th className="px-4 py-3">Kunde</th>
                    <th className="px-4 py-3">Score</th>
                    <th className="px-4 py-3 hidden sm:table-cell">Umsatz</th>
                    <th className="px-4 py-3 hidden sm:table-cell">Häufigk.</th>
                    <th className="px-4 py-3 hidden md:table-cell">Zahlung</th>
                    <th className="px-4 py-3 hidden md:table-cell">Fläche</th>
                    <th className="px-4 py-3 hidden lg:table-cell">AFIG</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {daten.map((k, idx) => (
                    <tr key={k.kundeId} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-400 text-xs tabular-nums">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/kunden/${k.kundeId}`}
                          className="font-medium text-green-700 hover:underline"
                        >
                          {k.kundeName}
                        </Link>
                        {k.firma && (
                          <div className="text-xs text-gray-400">{k.firma}</div>
                        )}
                        {/* Mobile: show details under name */}
                        <div className="sm:hidden mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
                          <span>Umsatz: {k.details.umsatz}/20</span>
                          <span>Häufigk.: {k.details.haeufigkeit}/20</span>
                          <span>Zahlung: {k.details.zahlungsmoral}/20</span>
                          <span>Fläche: {k.details.flaeche}/20</span>
                          <span>AFIG: {k.details.afig}/20</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <ScoreBar score={k.score} />
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <Punkte pts={k.details.umsatz} />
                        <div className="text-xs text-gray-400">
                          {formatEuro(k.details.umsatzWert)}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <Punkte pts={k.details.haeufigkeit} />
                        <div className="text-xs text-gray-400">
                          {k.details.haeufigkeitWert} Lief.
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <Punkte pts={k.details.zahlungsmoral} />
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <Punkte pts={k.details.flaeche} />
                        {k.details.flaecheWert > 0 && (
                          <div className="text-xs text-gray-400">
                            {k.details.flaecheWert} ha
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <Punkte pts={k.details.afig} />
                        {k.details.afigWert > 0 && (
                          <div className="text-xs text-gray-400">
                            {formatEuro(k.details.afigWert)}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {daten.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                        Keine aktiven Kunden gefunden.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
