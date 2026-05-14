"use client";

import { useEffect, useState } from "react";
import { formatEuro, formatDatum } from "@/lib/utils";
import { Lieferung, statusBadge, ANGEBOT_STATUS_LABELS, ANGEBOT_STATUS_FARBEN } from "../_shared";

interface VorgangAngebot {
  id: number;
  nummer: string;
  datum: string;
  status: string;
  gesamtbetrag: number;
}

export default function VorgangskettTab({ kundeId, lieferungen }: { kundeId: number; lieferungen: Lieferung[] }) {
  const [angebote, setAngebote] = useState<VorgangAngebot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/angebote?kundeId=${kundeId}`)
      .then((r) => r.json())
      .then((d) => { setAngebote(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [kundeId]);

  // Match Lieferungen zu Angeboten via Notiz-Text
  function findLinkedLieferungen(angebot: VorgangAngebot): Lieferung[] {
    return lieferungen.filter((l) =>
      l.notiz && (
        l.notiz.includes(`Angebot ${angebot.nummer}`) ||
        l.notiz.includes(`AN-`) && l.notiz.includes(angebot.nummer)
      )
    );
  }

  // Lieferungen ohne Angebots-Referenz
  const unlinkedLieferungen = lieferungen.filter((l) =>
    !angebote.some((a) => l.notiz && l.notiz.includes(a.nummer))
  );

  function stepColor(done: boolean, active: boolean) {
    if (done) return "bg-green-500 border-green-500 text-white";
    if (active) return "bg-yellow-400 border-yellow-400 text-white";
    return "bg-gray-200 border-gray-300 text-gray-400";
  }

  function lieferungStepColor(l: Lieferung) {
    if (l.status === "storniert") return "bg-red-400 border-red-400 text-white";
    if (l.bezahltAm) return "bg-green-500 border-green-500 text-white";
    if (l.rechnungNr) return "bg-yellow-400 border-yellow-400 text-white";
    if (l.status === "geliefert") return "bg-blue-400 border-blue-400 text-white";
    return "bg-gray-200 border-gray-300 text-gray-400";
  }

  if (loading) return <p className="text-sm text-gray-400">Lade Vorgangskette…</p>;

  const hasData = angebote.length > 0 || lieferungen.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-900">Vorgangskette</h3>
        <div className="flex gap-2">
          <a href={`/angebote/neu?kundeId=${kundeId}`} className="text-xs px-2.5 py-1.5 bg-green-700 text-white rounded-lg hover:bg-green-800 transition-colors">
            + Angebot
          </a>
          <a href={`/lieferungen/neu?kundeId=${kundeId}`} className="text-xs px-2.5 py-1.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
            + Lieferung
          </a>
        </div>
      </div>

      {!hasData && (
        <div className="text-center py-10 text-gray-400 border border-dashed border-gray-200 rounded-xl">
          <p className="text-2xl mb-2">📋</p>
          <p className="text-sm">Noch keine Vorgänge für diesen Kunden.</p>
        </div>
      )}

      {/* Angebot-basierte Ketten */}
      {angebote.length > 0 && (
        <div className="space-y-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Angebote &amp; zugehörige Lieferungen</p>
          {angebote.map((a) => {
            const linkedLief = findLinkedLieferungen(a);
            const isAngenommen = a.status === "ANGENOMMEN";
            const isAbgelehnt = a.status === "ABGELEHNT" || a.status === "ABGELAUFEN";
            return (
              <div key={a.id} className="border border-gray-200 rounded-xl p-4 bg-white">
                {/* Angebot Step */}
                <div className="flex items-start gap-3">
                  <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${stepColor(isAngenommen, !isAngenommen && !isAbgelehnt)}`}>
                    A
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <a href={`/angebote/${a.id}`} className="text-sm font-semibold text-green-700 hover:underline">
                        {a.nummer}
                      </a>
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${ANGEBOT_STATUS_FARBEN[a.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {ANGEBOT_STATUS_LABELS[a.status] ?? a.status}
                      </span>
                      <span className="text-xs text-gray-400">{formatDatum(a.datum)}</span>
                      <span className="text-xs font-medium text-gray-700">{formatEuro(a.gesamtbetrag)}</span>
                    </div>
                    {a.status === "ANGENOMMEN" && linkedLief.length === 0 && (
                      <a
                        href={`/lieferungen/neu?ausAngebot=${a.id}`}
                        className="mt-1.5 inline-block text-xs text-blue-600 hover:underline"
                      >
                        Als Lieferung übernehmen →
                      </a>
                    )}
                  </div>
                </div>

                {/* Verbindungslinie + Lieferungen */}
                {linkedLief.length > 0 && (
                  <div className="ml-3.5 mt-1 border-l-2 border-gray-200 pl-6 space-y-3 pt-2">
                    {linkedLief.map((l) => {
                      const hatRechnung = !!l.rechnungNr;
                      const hatBezahlt = !!l.bezahltAm;
                      const total = l.positionen.reduce((s, p) => s + p.menge * p.verkaufspreis, 0);
                      return (
                        <div key={l.id}>
                          {/* Lieferung Step */}
                          <div className="flex items-start gap-3">
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${lieferungStepColor(l)}`}>
                              L
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <a href={`/lieferungen/${l.id}`} className="text-sm font-medium text-gray-800 hover:text-green-700">
                                  Lieferung #{l.id}
                                </a>
                                {statusBadge(l.status)}
                                <span className="text-xs text-gray-400">{formatDatum(l.datum)}</span>
                                <span className="text-xs font-medium text-gray-700">{formatEuro(total)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Rechnung Step */}
                          <div className="mt-1 ml-3 border-l-2 border-gray-100 pl-5 space-y-2 pt-2">
                            <div className="flex items-start gap-3">
                              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold flex-shrink-0 ${stepColor(hatBezahlt, hatRechnung && !hatBezahlt)}`}>
                                R
                              </div>
                              <div className="flex-1 min-w-0">
                                {hatRechnung ? (
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <a href={`/lieferungen/${l.id}/rechnung`} target="_blank" className="text-sm font-medium text-gray-800 hover:text-green-700">
                                      Rechnung {l.rechnungNr}
                                    </a>
                                    {l.rechnungDatum && <span className="text-xs text-gray-400">{formatDatum(l.rechnungDatum)}</span>}
                                    {hatBezahlt ? (
                                      <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">Bezahlt</span>
                                    ) : (
                                      <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">Offen</span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-400 italic">Noch keine Rechnung</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Lieferungen ohne Angebots-Referenz */}
      {unlinkedLieferungen.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Direkte Lieferungen (ohne Angebot)</p>
          {unlinkedLieferungen.map((l) => {
            const hatRechnung = !!l.rechnungNr;
            const hatBezahlt = !!l.bezahltAm;
            const total = l.positionen.reduce((s, p) => s + p.menge * p.verkaufspreis, 0);
            return (
              <div key={l.id} className="border border-gray-200 rounded-xl p-4 bg-white">
                {/* Lieferung */}
                <div className="flex items-start gap-3">
                  <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${lieferungStepColor(l)}`}>
                    L
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <a href={`/lieferungen/${l.id}`} className="text-sm font-semibold text-gray-800 hover:text-green-700">
                        Lieferung #{l.id}
                      </a>
                      {statusBadge(l.status)}
                      <span className="text-xs text-gray-400">{formatDatum(l.datum)}</span>
                      <span className="text-xs font-medium text-gray-700">{formatEuro(total)}</span>
                    </div>
                    {l.notiz && <p className="text-xs text-gray-500 mt-0.5 truncate">{l.notiz}</p>}
                  </div>
                </div>

                {/* Rechnung */}
                <div className="mt-2 ml-3.5 border-l-2 border-gray-100 pl-5 pt-1">
                  <div className="flex items-start gap-3">
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold flex-shrink-0 ${stepColor(hatBezahlt, hatRechnung && !hatBezahlt)}`}>
                      R
                    </div>
                    <div className="flex-1">
                      {hatRechnung ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <a href={`/lieferungen/${l.id}/rechnung`} target="_blank" className="text-sm font-medium text-gray-800 hover:text-green-700">
                            {l.rechnungNr}
                          </a>
                          {l.rechnungDatum && <span className="text-xs text-gray-400">{formatDatum(l.rechnungDatum)}</span>}
                          {hatBezahlt ? (
                            <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">Bezahlt</span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">Offen</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Noch keine Rechnung</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Legende */}
      <div className="flex gap-4 flex-wrap text-xs text-gray-500 pt-2 border-t border-gray-100">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
          Abgeschlossen / Bezahlt
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-yellow-400 inline-block" />
          In Bearbeitung
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-gray-200 inline-block" />
          Ausstehend
        </span>
        <span className="flex items-center gap-1.5">
          <span className="font-bold text-gray-600">A</span> = Angebot,
          <span className="font-bold text-gray-600 ml-1">L</span> = Lieferung,
          <span className="font-bold text-gray-600 ml-1">R</span> = Rechnung
        </span>
      </div>
    </div>
  );
}
