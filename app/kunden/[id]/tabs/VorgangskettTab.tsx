"use client";

import { useEffect, useState } from "react";
import { formatEuro, formatDatum } from "@/lib/utils";
import { Lieferung, statusBadge, lieferungTotal, ANGEBOT_STATUS_LABELS, ANGEBOT_STATUS_FARBEN } from "../_shared";

interface VorgangAngebot {
  id: number;
  nummer: string;
  datum: string;
  status: string;
  gesamtbetrag: number;
}

export default function VorgangskettTab({ kundeId, lieferungen, onRefresh }: { kundeId: number; lieferungen: Lieferung[]; onRefresh?: () => void }) {
  const [angebote, setAngebote] = useState<VorgangAngebot[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [rechnungFrageId, setRechnungFrageId] = useState<number | null>(null);

  const heute = new Date();
  heute.setHours(0, 0, 0, 0);

  useEffect(() => {
    fetch(`/api/angebote?kundeId=${kundeId}`)
      .then((r) => r.json())
      .then((d) => { setAngebote(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [kundeId]);

  function findLinkedLieferungen(angebot: VorgangAngebot): Lieferung[] {
    return lieferungen.filter((l) =>
      l.notiz && (
        l.notiz.includes(`Angebot ${angebot.nummer}`) ||
        l.notiz.includes(`AN-`) && l.notiz.includes(angebot.nummer)
      )
    );
  }

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

  function zahlungsInfo(l: Lieferung): { label: string; cls: string; faelligText: string } {
    if (!l.rechnungNr || l.status !== "geliefert") {
      return { label: "", cls: "", faelligText: "" };
    }
    if (l.bezahltAm) {
      return {
        label: "Bezahlt",
        cls: "bg-green-100 text-green-700",
        faelligText: `am ${formatDatum(l.bezahltAm)}`,
      };
    }
    const tage = l.zahlungsziel ?? 30;
    const basisDatum = l.rechnungDatum ?? l.datum;
    const faellig = new Date(new Date(basisDatum).getTime() + tage * 24 * 60 * 60 * 1000);
    const isUeberfaellig = heute > faellig;
    return {
      label: isUeberfaellig ? "Überfällig" : "Offen",
      cls: isUeberfaellig ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700",
      faelligText: `Fällig: ${formatDatum(faellig.toISOString())}`,
    };
  }

  async function markiereGeliefert(l: Lieferung) {
    setActionLoading(l.id);
    const res = await fetch(`/api/lieferungen/${l.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "geliefert" }),
    });
    setActionLoading(null);
    if (res.ok) {
      onRefresh?.();
      setRechnungFrageId(l.id);
    }
  }

  async function erstelleRechnungNachGeliefert(lieferungId: number) {
    setActionLoading(lieferungId);
    setRechnungFrageId(null);
    await fetch(`/api/lieferungen/${lieferungId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aktion: "rechnung_erstellen" }),
    });
    setActionLoading(null);
    onRefresh?.();
  }

  function LieferungCard({ l }: { l: Lieferung }) {
    const hatRechnung = !!l.rechnungNr;
    const hatBezahlt = !!l.bezahltAm;
    const total = lieferungTotal(l);
    const zInfo = zahlungsInfo(l);
    const posSummary = l.positionen
      .map((p) => `${p.menge} ${p.artikel.einheit} ${p.artikel.name}`)
      .join(" · ");

    const isLoadingCard = actionLoading === l.id;
    return (
      <div className="space-y-2">
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
              {l.status === "geplant" ? (
                <button
                  onClick={() => markiereGeliefert(l)}
                  disabled={isLoadingCard}
                  title="Klicken um als geliefert zu markieren"
                  className="hover:opacity-75 transition-opacity disabled:opacity-40"
                >
                  {statusBadge(l.status)}
                </button>
              ) : statusBadge(l.status)}
              <span className="text-xs text-gray-400">{formatDatum(l.datum)}</span>
              <span className="text-xs font-medium text-gray-700">{formatEuro(total)}</span>
              <a
                href={`/lieferungen/${l.id}/lieferschein`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded px-1.5 py-0.5 whitespace-nowrap"
                title="Lieferschein öffnen"
              >
                📄 Lieferschein
              </a>
            </div>
            {posSummary && (
              <p className="text-xs text-gray-500 mt-0.5 truncate" title={posSummary}>
                {posSummary}
              </p>
            )}
            {l.notiz && (
              <p className="text-xs text-gray-400 mt-0.5 truncate italic">{l.notiz}</p>
            )}
          </div>
        </div>

        {/* Rechnung Step */}
        <div className="ml-3 border-l-2 border-gray-100 pl-5 pt-1">
          <div className="flex items-start gap-3">
            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold flex-shrink-0 ${stepColor(hatBezahlt, hatRechnung && !hatBezahlt)}`}>
              R
            </div>
            <div className="flex-1 min-w-0">
              {hatRechnung ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <a
                    href={`/lieferungen/${l.id}/rechnung`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-medium text-gray-800 hover:text-green-700"
                  >
                    Rechnung {l.rechnungNr}
                  </a>
                  {l.rechnungDatum && (
                    <span className="text-xs text-gray-400">{formatDatum(l.rechnungDatum)}</span>
                  )}
                  {zInfo.label && (
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${zInfo.cls}`}>
                      {zInfo.label}
                    </span>
                  )}
                  {zInfo.faelligText && (
                    <span className="text-xs text-gray-400">{zInfo.faelligText}</span>
                  )}
                </div>
              ) : l.status === "geliefert" ? (
                <button
                  onClick={() => erstelleRechnungNachGeliefert(l.id)}
                  disabled={isLoadingCard}
                  className="text-xs text-green-700 hover:underline disabled:opacity-50"
                >
                  {isLoadingCard ? "…" : "+ Rechnung erstellen"}
                </button>
              ) : (
                <span className="text-xs text-gray-400 italic">Noch keine Rechnung</span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
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

      {rechnungFrageId !== null && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex flex-wrap items-center gap-3">
          <span className="text-sm text-blue-800 font-medium">Lieferung als geliefert markiert. Möchten Sie jetzt eine Rechnung erstellen?</span>
          <button
            onClick={() => erstelleRechnungNachGeliefert(rechnungFrageId)}
            disabled={actionLoading === rechnungFrageId}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium transition-colors disabled:opacity-60"
          >
            {actionLoading === rechnungFrageId ? "…" : "Rechnung erstellen"}
          </button>
          <button
            onClick={() => setRechnungFrageId(null)}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Nein, danke
          </button>
        </div>
      )}

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
                  <div className="ml-3.5 mt-2 border-l-2 border-gray-200 pl-6 space-y-4 pt-2">
                    {linkedLief.map((l) => (
                      <LieferungCard key={l.id} l={l} />
                    ))}
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
          {unlinkedLieferungen.map((l) => (
            <div key={l.id} className="border border-gray-200 rounded-xl p-4 bg-white">
              <LieferungCard l={l} />
            </div>
          ))}
        </div>
      )}

      {/* Legende */}
      <div className="flex gap-4 flex-wrap text-xs text-gray-500 pt-2 border-t border-gray-100">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
          Bezahlt / Abgeschlossen
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-yellow-400 inline-block" />
          Rechnung offen
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-blue-400 inline-block" />
          Geliefert, ohne Rechnung
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-400 inline-block" />
          Storniert
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
