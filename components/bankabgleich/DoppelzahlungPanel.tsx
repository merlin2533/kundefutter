"use client";
import { useState } from "react";
import { formatEuro, formatDatum } from "@/lib/utils";
import * as Sentry from "@sentry/nextjs";

interface DoppelzahlungTreffer {
  zielTyp: "lieferung" | "sammelrechnung";
  zielId: number;
  kundeId: number;
  kundeName: string;
  rechnungNr: string;
  betrag: number;
  rechnungDatum: string | null;
  bezahlt: boolean;
}

interface Props {
  umsatzId: number;
  bankBetrag: number;
  onErledigt: () => void;
}

/**
 * Bankabgleich-Sonderfall: ein Kunde hat dieselbe Rechnung zweimal überwiesen. Die Rechnung
 * selbst taucht als normaler Zuordnungskandidat nicht mehr auf (schon bezahlt) — hier lässt sich
 * die Zahlung stattdessen gezielt der doppelt bezahlten Rechnung zuordnen und in eine Gutschrift
 * des Kunden umwandeln (POST /api/bankabgleich/[id]/doppelzahlung).
 */
export default function DoppelzahlungPanel({ umsatzId, bankBetrag, onErledigt }: Props) {
  const [suchtext, setSuchtext] = useState("");
  const [treffer, setTreffer] = useState<DoppelzahlungTreffer[]>([]);
  const [suchend, setSuchend] = useState(false);
  const [gesucht, setGesucht] = useState(false);
  const [ausgewaehlt, setAusgewaehlt] = useState<DoppelzahlungTreffer | null>(null);
  const [modus, setModus] = useState<"erstatten" | "verrechnen">("erstatten");
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  async function suchen() {
    if (suchtext.trim().length < 2) return;
    setSuchend(true);
    setGesucht(true);
    setFehler(null);
    try {
      const res = await fetch(`/api/bankabgleich/doppelzahlung-suche?q=${encodeURIComponent(suchtext.trim())}`);
      setTreffer(res.ok ? await res.json() : []);
    } catch (err) {
      Sentry.captureException(err);
      setFehler("Fehler bei der Suche");
    } finally {
      setSuchend(false);
    }
  }

  async function anlegen() {
    if (!ausgewaehlt) return;
    if (!confirm(
      modus === "erstatten"
        ? `Gutschrift über ${formatEuro(bankBetrag)} für ${ausgewaehlt.kundeName} erfassen? Sie wird NICHT automatisch verrechnet — die Erstattung erfolgt separat per Überweisung.`
        : `Gutschrift über ${formatEuro(bankBetrag)} für ${ausgewaehlt.kundeName} erfassen? Sie wird automatisch in die nächste Rechnung des Kunden eingerechnet.`
    )) return;
    setBusy(true);
    setFehler(null);
    try {
      const res = await fetch(`/api/bankabgleich/${umsatzId}/doppelzahlung`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kundeId: ausgewaehlt.kundeId,
          zielTyp: ausgewaehlt.zielTyp,
          zielId: ausgewaehlt.zielId,
          modus,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch((err) => { Sentry.captureException(err); return {}; });
        throw new Error((d as { error?: string }).error ?? "Fehler beim Erfassen");
      }
      onErledigt();
    } catch (err) {
      Sentry.captureException(err);
      setFehler(err instanceof Error ? err.message : "Fehler beim Erfassen");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-200">
      <h4 className="text-xs font-semibold text-gray-600 mb-1">Doppelzahlung → Gutschrift erfassen</h4>
      <p className="text-xs text-gray-400 mb-2">
        Kunde hat eine bereits bezahlte Rechnung ein zweites Mal überwiesen — hier die betroffene Rechnung suchen
        (auch bereits bezahlte Rechnungen werden angezeigt).
      </p>

      <div className="flex items-center gap-1.5 mb-2">
        <input
          type="text"
          value={suchtext}
          onChange={(e) => setSuchtext(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && suchen()}
          placeholder="Rechnungsnummer oder Kunde…"
          className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs w-64 focus:outline-none focus:ring-2 focus:ring-green-600"
        />
        <button
          onClick={suchen}
          disabled={suchtext.trim().length < 2 || suchend}
          className="text-xs px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50"
        >
          Suchen
        </button>
      </div>

      {fehler && <p className="text-xs text-red-600 mb-2">{fehler}</p>}

      {suchend ? (
        <p className="text-xs text-gray-400">Suche…</p>
      ) : gesucht && treffer.length === 0 ? (
        <p className="text-xs text-gray-400">Keine Rechnung zu diesem Suchbegriff gefunden.</p>
      ) : treffer.length > 0 ? (
        <ul className="space-y-1 mb-2">
          {treffer.map((t) => {
            const aktiv = ausgewaehlt?.zielTyp === t.zielTyp && ausgewaehlt?.zielId === t.zielId;
            return (
              <li key={`${t.zielTyp}:${t.zielId}`}>
                <button
                  onClick={() => setAusgewaehlt(aktiv ? null : t)}
                  className={`w-full text-left text-xs px-2.5 py-1.5 rounded border ${aktiv ? "border-green-500 ring-1 ring-green-500 bg-green-50" : "border-gray-200 bg-white hover:border-green-400"}`}
                >
                  <span className="font-medium">{t.rechnungNr}</span> — {t.kundeName} · {formatEuro(t.betrag)}
                  {t.rechnungDatum && <> · {formatDatum(t.rechnungDatum)}</>}
                  {t.bezahlt ? (
                    <span className="ml-1.5 text-green-700">✓ bereits bezahlt</span>
                  ) : (
                    <span className="ml-1.5 text-amber-700">noch offen</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {ausgewaehlt && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 mt-2">
          <p className="text-xs text-gray-600 mb-2">
            Gutschrift über <strong>{formatEuro(bankBetrag)}</strong> für <strong>{ausgewaehlt.kundeName}</strong>{" "}
            (Bezug: {ausgewaehlt.rechnungNr})
          </p>
          <div className="flex flex-col gap-1.5 mb-2">
            <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
              <input type="radio" checked={modus === "erstatten"} onChange={() => setModus("erstatten")} />
              Wird per Überweisung an den Kunden zurückerstattet (nicht mit der nächsten Rechnung verrechnet)
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
              <input type="radio" checked={modus === "verrechnen"} onChange={() => setModus("verrechnen")} />
              Wird automatisch mit der nächsten Rechnung des Kunden verrechnet
            </label>
          </div>
          <button
            onClick={anlegen}
            disabled={busy}
            className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium"
          >
            {busy ? "Erfasse…" : "Gutschrift erfassen"}
          </button>
        </div>
      )}
    </div>
  );
}
