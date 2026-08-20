"use client";
import { useState } from "react";
import { formatEuro, formatDatum } from "@/lib/utils";
import ZuordnungsVorschlagCard from "./ZuordnungsVorschlagCard";
import * as Sentry from "@sentry/nextjs";

type Typ = "lieferung" | "sammelrechnung" | "ausgabe" | "eingangsrechnung";

interface BankInfo {
  umsatzId: number;
  datum: string;
  betrag: number;
  verwendungszweck: string;
  gegenpartei: string;
}
interface KandidatInfo {
  typ: Typ;
  id: number;
  bezeichnung: string;
  gegenpartei: string;
  betrag: number;
}
export interface Vorschlag extends KandidatInfo {
  konfidenz: "hoch" | "mittel" | "niedrig";
  amountDiff: number;
  dayDiff: number;
  textScore: number;
  wirdBezahltAm: string;
}

export interface AutoMatchKarteProps {
  bank: BankInfo;
  kandidat: KandidatInfo;
  amountDiff: number;
  dayDiff: number;
  wirdBezahltAm: string;
  konfidenz: "hoch" | "mittel" | "niedrig";
  kiKonfidenz?: number;
  kiBegruendung?: string;
  onUebernehmen: (alsBezahlt: boolean, differenzAktion?: "gutschrift" | "forderung") => void | Promise<void>;
  onKandidatWechseln: (neu: Vorschlag) => void;
}

/**
 * Eine Karte im "Automatischer Abgleich"-Bulk-Review: zeigt den algorithmisch gewählten
 * Kandidaten (wie bisher), bietet zusätzlich eine Suche nach einer ANDEREN Rechnung an — für
 * den Fall, dass der Buchungstext eine andere Rechnungsnummer nennt als die, die der
 * Algorithmus (z.B. wegen exakter Betragsübereinstimmung) ausgewählt hat. Nutzt dieselbe
 * manuelle Suche wie das Inline-Panel auf /bankabgleich (/api/bankabgleich/vorschlaege?q=).
 */
export default function AutoMatchKarte({
  bank,
  kandidat,
  amountDiff,
  dayDiff,
  wirdBezahltAm,
  konfidenz,
  kiKonfidenz,
  kiBegruendung,
  onUebernehmen,
  onKandidatWechseln,
}: AutoMatchKarteProps) {
  const [sucheOffen, setSucheOffen] = useState(false);
  const [suchtext, setSuchtext] = useState("");
  const [ergebnisse, setErgebnisse] = useState<Vorschlag[]>([]);
  const [loading, setLoading] = useState(false);
  const [gesucht, setGesucht] = useState(false);

  async function suchen() {
    if (suchtext.trim().length < 2) return;
    setLoading(true);
    setGesucht(true);
    try {
      const res = await fetch(`/api/bankabgleich/vorschlaege?umsatzId=${bank.umsatzId}&q=${encodeURIComponent(suchtext.trim())}`);
      if (res.ok) setErgebnisse(await res.json());
      else setErgebnisse([]);
    } catch (err) {
      Sentry.captureException(err);
      setErgebnisse([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="text-xs text-gray-500 mb-1">
        <span className="font-medium text-gray-700">{bank.gegenpartei || "Unbekannter Absender"}</span>
        <span className="mx-1">·</span>
        {formatDatum(bank.datum)} · {formatEuro(bank.betrag)}
        <div className="truncate" title={bank.verwendungszweck}>{bank.verwendungszweck.slice(0, 60)}</div>
      </div>
      <ZuordnungsVorschlagCard
        typ={kandidat.typ}
        bezeichnung={kandidat.bezeichnung}
        gegenpartei={kandidat.gegenpartei}
        betrag={kandidat.betrag}
        konfidenz={konfidenz}
        kiKonfidenz={kiKonfidenz}
        kiBegruendung={kiBegruendung}
        wirdBezahltAm={wirdBezahltAm}
        amountDiff={amountDiff}
        dayDiff={dayDiff}
        signedDiff={bank.betrag - kandidat.betrag}
        bankBetrag={bank.betrag}
        onUebernehmen={onUebernehmen}
        compact
      />
      <button
        onClick={() => setSucheOffen((v) => !v)}
        className="mt-1 text-xs text-blue-700 hover:underline"
      >
        {sucheOffen ? "Suche schließen" : "Andere Rechnung suchen"}
      </button>
      {sucheOffen && (
        <div className="mt-1.5 border border-gray-200 rounded-lg p-2 bg-gray-50">
          <div className="flex gap-1.5">
            <input
              type="text"
              value={suchtext}
              onChange={(e) => setSuchtext(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && suchen()}
              placeholder="Rechnung-Nr., Kunde…"
              className="flex-1 min-w-0 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-green-600"
              autoFocus
            />
            <button
              onClick={suchen}
              disabled={suchtext.trim().length < 2}
              className="text-xs px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 whitespace-nowrap"
            >
              Suchen
            </button>
          </div>
          {loading && <div className="text-xs text-gray-400 mt-1.5">Suche…</div>}
          {!loading && ergebnisse.length > 0 && (
            <ul className="mt-1.5 space-y-1 max-h-40 overflow-y-auto">
              {ergebnisse.map((v) => (
                <li key={`${v.typ}-${v.id}`}>
                  <button
                    onClick={() => {
                      onKandidatWechseln(v);
                      setSucheOffen(false);
                      setErgebnisse([]);
                      setSuchtext("");
                      setGesucht(false);
                    }}
                    className="w-full text-left text-xs px-2 py-1 rounded hover:bg-blue-50 border border-transparent hover:border-blue-200"
                  >
                    <span className="font-medium">{v.gegenpartei}</span> — {v.bezeichnung} ({formatEuro(v.betrag)})
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!loading && gesucht && ergebnisse.length === 0 && (
            <div className="text-xs text-gray-400 mt-1.5">Keine Treffer.</div>
          )}
        </div>
      )}
    </div>
  );
}
