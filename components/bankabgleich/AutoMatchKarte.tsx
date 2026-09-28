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
  skontoMatch: boolean;
  gutschriftMatch?: { id: number; nummer: string; betrag: number };
}

export interface WeitereAuswahl {
  typ: "lieferung" | "sammelrechnung";
  id: number;
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
  skontoMatch?: boolean;
  gutschriftMatch?: { id: number; nummer: string; betrag: number };
  onUebernehmen: (
    alsBezahlt: boolean,
    differenzAktion?: "gutschrift" | "forderung",
    weitere?: WeitereAuswahl[]
  ) => void | Promise<void>;
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
  skontoMatch,
  gutschriftMatch,
  onUebernehmen,
  onKandidatWechseln,
}: AutoMatchKarteProps) {
  const [sucheOffen, setSucheOffen] = useState(false);
  const [suchtext, setSuchtext] = useState("");
  const [ergebnisse, setErgebnisse] = useState<Vorschlag[]>([]);
  const [loading, setLoading] = useState(false);
  const [gesucht, setGesucht] = useState(false);
  // Mehrfachauswahl: deckt eine Zahlung MEHRERE Rechnungen desselben Kunden ab (z.B. Verwendungszweck
  // nennt "RE-2026-0548 RE-2026-0549"), lassen sich hier zusätzliche, über die Suche gefundene
  // Rechnungen markieren — beim Übernehmen wird der Hauptkandidat wie bisher zugeordnet, jede
  // zusätzlich ausgewählte Rechnung zieht direkt danach über /api/bankabgleich/[id]/weitere nach
  // (identisches Muster wie die Mehrfachauswahl im Inline-Panel auf /bankabgleich).
  const [zusatzAusgewaehlt, setZusatzAusgewaehlt] = useState<Map<string, Vorschlag>>(new Map());
  // Nur Kunden-Rechnungen (lieferung/sammelrechnung) können mehreren Rechnungen zugeordnet werden —
  // Ausgaben/Lieferantenrechnungen kennen kein "weitere"-Konzept.
  const kandidatUnterstuetztWeitere = kandidat.typ === "lieferung" || kandidat.typ === "sammelrechnung";

  function zusatzToggeln(v: Vorschlag) {
    const key = `${v.typ}:${v.id}`;
    setZusatzAusgewaehlt((prev) => {
      const next = new Map(prev);
      if (next.has(key)) next.delete(key);
      else next.set(key, v);
      return next;
    });
  }

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
        skontoMatch={skontoMatch}
        gutschriftMatch={gutschriftMatch}
        onUebernehmen={(alsBezahlt, differenzAktion) =>
          onUebernehmen(alsBezahlt, differenzAktion, zusatzAusgewaehlt.size > 0 ? [...zusatzAusgewaehlt.values()].map((v) => ({ typ: v.typ as "lieferung" | "sammelrechnung", id: v.id })) : undefined)
        }
        compact
      />
      {zusatzAusgewaehlt.size > 0 && (
        <div className="mt-1.5 px-2 py-1.5 rounded border border-green-200 bg-green-50 text-xs text-green-800">
          + {zusatzAusgewaehlt.size} weitere Rechnung{zusatzAusgewaehlt.size === 1 ? "" : "en"} ausgewählt (
          {formatEuro([...zusatzAusgewaehlt.values()].reduce((s, v) => s + v.betrag, 0))}) — wird beim Übernehmen zusätzlich zugeordnet.
          <ul className="mt-1 space-y-0.5">
            {[...zusatzAusgewaehlt.values()].map((v) => (
              <li key={`${v.typ}-${v.id}`} className="flex items-center justify-between gap-2">
                <span className="truncate">{v.gegenpartei} — {v.bezeichnung} ({formatEuro(v.betrag)})</span>
                <button onClick={() => zusatzToggeln(v)} className="text-green-700 hover:text-red-600 shrink-0">✕</button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <button
        onClick={() => setSucheOffen((v) => !v)}
        className="mt-1 text-xs text-blue-700 hover:underline"
      >
        {sucheOffen ? "Suche schließen" : kandidatUnterstuetztWeitere ? "Andere/weitere Rechnung suchen" : "Andere Rechnung suchen"}
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
          {!loading && ergebnisse.length > 0 && kandidatUnterstuetztWeitere && (
            <p className="mt-1.5 text-xs text-gray-400">
              Häkchen = zusätzlich zur Zahlung zuordnen (deckt eine Überweisung mehrere Rechnungen ab) · Klick auf die Zeile = stattdessen als Hauptkandidat übernehmen
            </p>
          )}
          {!loading && ergebnisse.length > 0 && (
            <ul className="mt-1.5 space-y-1 max-h-40 overflow-y-auto">
              {ergebnisse.map((v) => {
                const key = `${v.typ}:${v.id}`;
                const kannZusaetzlich = kandidatUnterstuetztWeitere && (v.typ === "lieferung" || v.typ === "sammelrechnung");
                return (
                  <li key={key} className="flex items-center gap-1 px-2 py-1 rounded border border-transparent hover:border-blue-200 hover:bg-blue-50">
                    {kannZusaetzlich && (
                      <input
                        type="checkbox"
                        checked={zusatzAusgewaehlt.has(key)}
                        onChange={() => zusatzToggeln(v)}
                        title="Zusätzlich zuordnen (z.B. wenn eine Zahlung mehrere Rechnungen deckt)"
                        className="rounded border-gray-300 shrink-0"
                      />
                    )}
                    <button
                      onClick={() => {
                        onKandidatWechseln(v);
                        setSucheOffen(false);
                        setErgebnisse([]);
                        setSuchtext("");
                        setGesucht(false);
                        setZusatzAusgewaehlt(new Map());
                      }}
                      title="Diese Rechnung stattdessen als Hauptkandidat übernehmen"
                      className="flex-1 min-w-0 text-left text-xs"
                    >
                      <span className="font-medium">{v.gegenpartei}</span> — {v.bezeichnung} ({formatEuro(v.betrag)})
                    </button>
                  </li>
                );
              })}
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
