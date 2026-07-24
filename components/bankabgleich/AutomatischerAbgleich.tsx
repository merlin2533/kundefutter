"use client";
import { useState } from "react";
import { formatEuro, formatDatum } from "@/lib/utils";
import ZuordnungsVorschlagCard from "./ZuordnungsVorschlagCard";

type Typ = "lieferung" | "sammelrechnung" | "ausgabe" | "eingangsrechnung";

const ZIEL_FELD: Record<Typ, string> = {
  lieferung: "lieferungId",
  sammelrechnung: "sammelrechnungId",
  ausgabe: "ausgabeId",
  eingangsrechnung: "eingangsRechnungId",
};

const TYP_LABEL: Record<Typ, string> = {
  lieferung: "Lieferung",
  sammelrechnung: "Sammelrechnung",
  ausgabe: "Ausgabe",
  eingangsrechnung: "Lieferantenrechnung",
};

interface BankInfo {
  umsatzId: number;
  datum: string;
  betrag: number;
  verwendungszweck: string;
}
interface KandidatInfo {
  typ: Typ;
  id: number;
  bezeichnung: string;
  gegenpartei: string;
  betrag: number;
}
interface AbgleichPaar {
  bank: BankInfo;
  kandidat: KandidatInfo;
  amountDiff: number;
  dayDiff: number;
  textScore: number;
  wirdBezahltAm: string;
  konfidenz?: number; // nur bei KI-Treffern
  begruendung?: string;
}
interface BankOnlyItem extends BankInfo {
  naechsterKandidat: KandidatInfo | null;
  naechsteDiff: number | null;
}
interface CandidateOnlyItem extends KandidatInfo {
  naechsteBankbuchung: BankInfo | null;
  naechsteDiff: number | null;
}
interface AutoMatchResponse {
  matched: AbgleichPaar[];
  deviations: AbgleichPaar[];
  bankOnly: BankOnlyItem[];
  candidateOnly: CandidateOnlyItem[];
  summary: {
    matchedCount: number;
    deviationCount: number;
    aggregatedCount: number;
    bankOnlyCount: number;
    candidateOnlyCount: number;
  };
}

type Tab = "matched" | "deviations" | "bankOnly" | "candidateOnly";

async function uebernehmen(paar: { bank: BankInfo; kandidat: KandidatInfo }, alsBezahltMarkieren: boolean, zuordnungsArt: "automatisch" | "ki", kiKonfidenz?: number) {
  const body: Record<string, unknown> = {
    [ZIEL_FELD[paar.kandidat.typ]]: paar.kandidat.id,
    alsBezahltMarkieren,
    zuordnungsArt,
  };
  if (kiKonfidenz != null) body.kiKonfidenz = kiKonfidenz;
  const res = await fetch(`/api/bankabgleich/${paar.bank.umsatzId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Zuordnung fehlgeschlagen");
}

export default function AutomatischerAbgleich({
  von,
  bis,
  onUebernommen,
}: {
  von: string;
  bis: string;
  onUebernommen: () => void;
}) {
  const [toleranzTage, setToleranzTage] = useState(5);
  const [toleranzBetrag, setToleranzBetrag] = useState(0.5);
  const [loading, setLoading] = useState(false);
  const [ergebnis, setErgebnis] = useState<AutoMatchResponse | null>(null);
  const [tab, setTab] = useState<Tab>("matched");
  const [fehler, setFehler] = useState<string | null>(null);

  const [reviewOffen, setReviewOffen] = useState(false);
  const [reviewAuswahl, setReviewAuswahl] = useState<Record<number, { drin: boolean; bezahlt: boolean }>>({});
  const [reviewBusy, setReviewBusy] = useState(false);

  // Schnellübernahme: statt jede Zeile einzeln zu prüfen, alle "sicheren" 100%-Treffer nach
  // kurzer Vorschau (Anzahl + Summe + Beispielzeilen) in einem Schritt übernehmen.
  const [schnellOffen, setSchnellOffen] = useState(false);
  const [schnellBusy, setSchnellBusy] = useState(false);

  const [kiLoading, setKiLoading] = useState(false);

  async function abgleichStarten() {
    setLoading(true);
    setFehler(null);
    try {
      const res = await fetch("/api/bankabgleich/auto-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          von: von || undefined,
          bis: bis || undefined,
          dateToleranceDays: toleranzTage,
          amountTolerance: toleranzBetrag,
        }),
      });
      if (res.ok) {
        setErgebnis(await res.json());
        setTab("matched");
      } else {
        setFehler("Abgleich fehlgeschlagen.");
      }
    } finally {
      setLoading(false);
    }
  }

  function entferneAusListe(umsatzId: number) {
    setErgebnis((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        matched: prev.matched.filter((p) => p.bank.umsatzId !== umsatzId),
        deviations: prev.deviations.filter((p) => p.bank.umsatzId !== umsatzId),
        bankOnly: prev.bankOnly.filter((b) => b.umsatzId !== umsatzId),
      };
    });
  }

  async function einzelUebernehmen(paar: AbgleichPaar, alsBezahltMarkieren: boolean) {
    try {
      await uebernehmen(paar, alsBezahltMarkieren, paar.konfidenz != null ? "ki" : "automatisch", paar.konfidenz);
      entferneAusListe(paar.bank.umsatzId);
      onUebernommen();
    } catch {
      setFehler("Übernehmen fehlgeschlagen.");
    }
  }

  function reviewOeffnen() {
    if (!ergebnis) return;
    const auswahl: Record<number, { drin: boolean; bezahlt: boolean }> = {};
    for (const p of ergebnis.matched) auswahl[p.bank.umsatzId] = { drin: true, bezahlt: true };
    setReviewAuswahl(auswahl);
    setReviewOffen(true);
  }

  async function reviewBestaetigen() {
    if (!ergebnis) return;
    setReviewBusy(true);
    setFehler(null);
    try {
      const zuUebernehmen = ergebnis.matched.filter((p) => reviewAuswahl[p.bank.umsatzId]?.drin);
      for (const p of zuUebernehmen) {
        await uebernehmen(p, reviewAuswahl[p.bank.umsatzId]?.bezahlt ?? true, "automatisch");
        entferneAusListe(p.bank.umsatzId);
      }
      setReviewOffen(false);
      onUebernommen();
    } catch {
      setFehler("Einige Zuordnungen konnten nicht übernommen werden — bitte Liste prüfen.");
    } finally {
      setReviewBusy(false);
    }
  }

  async function schnellUebernehmen() {
    if (!ergebnis) return;
    setSchnellBusy(true);
    setFehler(null);
    try {
      for (const p of ergebnis.matched) {
        await uebernehmen(p, true, "automatisch");
        entferneAusListe(p.bank.umsatzId);
      }
      setSchnellOffen(false);
      onUebernommen();
    } catch {
      setFehler("Einige Zuordnungen konnten nicht übernommen werden — bitte Liste prüfen.");
    } finally {
      setSchnellBusy(false);
    }
  }

  async function kiAbgleichFuerRest() {
    if (!ergebnis || ergebnis.bankOnly.length === 0) return;
    setKiLoading(true);
    setFehler(null);
    try {
      const umsatzIds = ergebnis.bankOnly.slice(0, 50).map((b) => b.umsatzId);
      const res = await fetch("/api/ki/bankabgleich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ umsatzIds }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setFehler(d.error ?? "KI-Abgleich fehlgeschlagen.");
        return;
      }
      const data: { matches: AbgleichPaar[] } = await res.json();
      if (data.matches.length === 0) {
        setFehler("Die KI konnte keine sicheren Zuordnungen für die offenen Bankbuchungen finden.");
        return;
      }
      setErgebnis((prev) => (prev ? { ...prev, deviations: [...prev.deviations, ...data.matches] } : prev));
      setTab("deviations");
    } finally {
      setKiLoading(false);
    }
  }

  const tabs: { key: Tab; label: string; count: number }[] = ergebnis
    ? [
        { key: "matched", label: "Sicher", count: ergebnis.matched.length },
        { key: "deviations", label: "Abweichung", count: ergebnis.deviations.length },
        { key: "bankOnly", label: "Nur Bank", count: ergebnis.bankOnly.length },
        { key: "candidateOnly", label: "Nur Buchung", count: ergebnis.candidateOnly.length },
      ]
    : [];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
      <h2 className="text-sm font-semibold text-gray-800 mb-3">Automatischer Abgleich</h2>

      <div className="flex flex-wrap gap-3 items-end mb-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Datumstoleranz (Tage)</label>
          <input
            type="number"
            min={0}
            value={toleranzTage}
            onChange={(e) => setToleranzTage(parseInt(e.target.value, 10) || 0)}
            className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Betragstoleranz (€)</label>
          <input
            type="number"
            min={0}
            step={0.01}
            value={toleranzBetrag}
            onChange={(e) => setToleranzBetrag(parseFloat(e.target.value) || 0)}
            className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={abgleichStarten}
          disabled={loading}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
        >
          {loading ? "Gleiche ab…" : "Abgleich starten"}
        </button>
      </div>

      {fehler && (
        <div className="mb-3 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">{fehler}</div>
      )}

      {ergebnis && (
        <>
          <div className="flex gap-2 mb-4 flex-wrap">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
                  tab === t.key ? "bg-green-600 text-white border-green-600" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                }`}
              >
                {t.label} ({t.count})
              </button>
            ))}
          </div>

          {tab === "matched" && (
            <div>
              {ergebnis.matched.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  <button
                    onClick={() => setSchnellOffen(true)}
                    className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium"
                  >
                    ✓ 100 % übernehmen ({ergebnis.matched.length})
                  </button>
                  <button
                    onClick={reviewOeffnen}
                    className="px-3 py-1.5 border border-green-700 text-green-700 hover:bg-green-50 rounded-lg text-sm font-medium"
                  >
                    Alle prüfen &amp; übernehmen
                  </button>
                </div>
              )}
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {ergebnis.matched.map((p) => (
                  <div key={p.bank.umsatzId}>
                    <div className="text-xs text-gray-500 mb-1">
                      {formatDatum(p.bank.datum)} · {formatEuro(p.bank.betrag)} · {p.bank.verwendungszweck.slice(0, 40)}
                    </div>
                    <ZuordnungsVorschlagCard
                      typ={p.kandidat.typ}
                      bezeichnung={p.kandidat.bezeichnung}
                      gegenpartei={p.kandidat.gegenpartei}
                      betrag={p.kandidat.betrag}
                      konfidenz="hoch"
                      wirdBezahltAm={p.wirdBezahltAm}
                      amountDiff={p.amountDiff}
                      dayDiff={p.dayDiff}
                      onUebernehmen={(bezahlt) => einzelUebernehmen(p, bezahlt)}
                      compact
                    />
                  </div>
                ))}
              </div>
              {ergebnis.matched.length === 0 && <div className="text-sm text-gray-400">Keine sicheren Treffer.</div>}
            </div>
          )}

          {tab === "deviations" && (
            <div>
              {ergebnis.bankOnly.length > 0 && (
                <button
                  onClick={kiAbgleichFuerRest}
                  disabled={kiLoading}
                  className="mb-3 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
                >
                  {kiLoading ? "KI prüft…" : "🤖 KI-Abgleich für offene Bankbuchungen"}
                </button>
              )}
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {ergebnis.deviations.map((p) => (
                  <div key={`${p.bank.umsatzId}-${p.kandidat.typ}-${p.kandidat.id}`}>
                    <div className="text-xs text-gray-500 mb-1">
                      {formatDatum(p.bank.datum)} · {formatEuro(p.bank.betrag)} · {p.bank.verwendungszweck.slice(0, 40)}
                    </div>
                    <ZuordnungsVorschlagCard
                      typ={p.kandidat.typ}
                      bezeichnung={p.kandidat.bezeichnung}
                      gegenpartei={p.kandidat.gegenpartei}
                      betrag={p.kandidat.betrag}
                      konfidenz={p.textScore >= 0.5 ? "mittel" : "niedrig"}
                      kiKonfidenz={p.konfidenz}
                      kiBegruendung={p.begruendung}
                      wirdBezahltAm={p.wirdBezahltAm}
                      amountDiff={p.amountDiff}
                      dayDiff={p.dayDiff}
                      onUebernehmen={(bezahlt) => einzelUebernehmen(p, bezahlt)}
                      compact
                    />
                  </div>
                ))}
              </div>
              {ergebnis.deviations.length === 0 && <div className="text-sm text-gray-400">Keine Abweichungen.</div>}
            </div>
          )}

          {tab === "bankOnly" && (
            <div className="space-y-2">
              {ergebnis.bankOnly.map((b) => (
                <div key={b.umsatzId} className="border border-gray-200 rounded-lg p-3 text-sm flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-gray-800">
                      {formatDatum(b.datum)} · {formatEuro(b.betrag)}
                    </div>
                    <div className="text-xs text-gray-500">{b.verwendungszweck.slice(0, 80)}</div>
                    {b.naechsterKandidat && (
                      <div className="text-xs text-gray-400 mt-1">
                        Ähnlichster offener Posten: {TYP_LABEL[b.naechsterKandidat.typ]} — {b.naechsterKandidat.gegenpartei} (
                        {formatEuro(b.naechsterKandidat.betrag)})
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {ergebnis.bankOnly.length === 0 && <div className="text-sm text-gray-400">Keine offenen Bankbuchungen ohne Zuordnung.</div>}
            </div>
          )}

          {tab === "candidateOnly" && (
            <div className="space-y-2">
              {ergebnis.candidateOnly.map((c) => (
                <div key={`${c.typ}-${c.id}`} className="border border-gray-200 rounded-lg p-3 text-sm">
                  <div className="font-medium text-gray-800">
                    {TYP_LABEL[c.typ]} — {c.gegenpartei}
                  </div>
                  <div className="text-xs text-gray-500">
                    {c.bezeichnung} · {formatEuro(c.betrag)}
                  </div>
                </div>
              ))}
              {ergebnis.candidateOnly.length === 0 && <div className="text-sm text-gray-400">Keine offenen Buchungen ohne Bankbewegung.</div>}
            </div>
          )}
        </>
      )}

      {reviewOffen && ergebnis && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[85vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Sichere Zuordnungen prüfen &amp; übernehmen</h3>
              <p className="text-xs text-gray-500 mt-1">
                Einzelne Zeilen abwählen oder die Bezahlt-Markierung deaktivieren, bevor du bestätigst.
              </p>
            </div>
            <div className="p-5 space-y-2">
              {ergebnis.matched.map((p) => {
                const auswahl = reviewAuswahl[p.bank.umsatzId] ?? { drin: true, bezahlt: true };
                return (
                  <div key={p.bank.umsatzId} className="flex items-center gap-3 border border-gray-200 rounded-lg p-2.5 text-sm">
                    <input
                      type="checkbox"
                      checked={auswahl.drin}
                      onChange={(e) =>
                        setReviewAuswahl((prev) => ({ ...prev, [p.bank.umsatzId]: { ...auswahl, drin: e.target.checked } }))
                      }
                    />
                    <div className="flex-1">
                      <span className="font-medium">
                        {formatDatum(p.bank.datum)} · {formatEuro(p.bank.betrag)}
                      </span>{" "}
                      → {TYP_LABEL[p.kandidat.typ]} {p.kandidat.gegenpartei} ({p.kandidat.bezeichnung})
                    </div>
                    <label className="flex items-center gap-1 text-xs text-gray-500 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={auswahl.bezahlt}
                        onChange={(e) =>
                          setReviewAuswahl((prev) => ({ ...prev, [p.bank.umsatzId]: { ...auswahl, bezahlt: e.target.checked } }))
                        }
                      />
                      als bezahlt markieren
                    </label>
                  </div>
                );
              })}
            </div>
            <div className="p-5 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={() => setReviewOffen(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Abbrechen
              </button>
              <button
                onClick={reviewBestaetigen}
                disabled={reviewBusy}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
              >
                {reviewBusy ? "Übernehme…" : "Bestätigen"}
              </button>
            </div>
          </div>
        </div>
      )}

      {schnellOffen && ergebnis && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-5 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">100 % Treffer übernehmen</h3>
              <p className="text-xs text-gray-500 mt-1">
                Kurzvorschau — alle sicheren Treffer werden ohne weitere Einzelprüfung als bezahlt übernommen.
              </p>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
                <span className="text-gray-600">{ergebnis.matched.length} Buchungen</span>
                <span className="font-semibold text-gray-900">
                  {formatEuro(ergebnis.matched.reduce((s, p) => s + p.bank.betrag, 0))} gesamt
                </span>
              </div>
              <div className="space-y-1 text-xs text-gray-600 max-h-40 overflow-y-auto">
                {ergebnis.matched.slice(0, 5).map((p) => (
                  <div key={p.bank.umsatzId} className="flex justify-between gap-2">
                    <span className="truncate">
                      {formatDatum(p.bank.datum)} · {p.kandidat.gegenpartei}
                    </span>
                    <span className="whitespace-nowrap">{formatEuro(p.bank.betrag)}</span>
                  </div>
                ))}
                {ergebnis.matched.length > 5 && (
                  <div className="text-gray-400">… und {ergebnis.matched.length - 5} weitere</div>
                )}
              </div>
            </div>
            <div className="p-5 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={() => setSchnellOffen(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Abbrechen
              </button>
              <button
                onClick={schnellUebernehmen}
                disabled={schnellBusy}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
              >
                {schnellBusy ? "Übernehme…" : `Alle ${ergebnis.matched.length} übernehmen`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
