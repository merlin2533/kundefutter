"use client";
import { useState } from "react";
import { formatEuro, formatDatum } from "@/lib/utils";

const TYP_LABEL: Record<string, string> = {
  lieferung: "Lieferung",
  sammelrechnung: "Sammelrechnung",
  ausgabe: "Ausgabe",
  eingangsrechnung: "Lieferantenrechnung",
};

function KonfidenzBadge({ k }: { k: "hoch" | "mittel" | "niedrig" }) {
  const cls =
    k === "hoch"
      ? "bg-green-100 text-green-800"
      : k === "mittel"
      ? "bg-yellow-100 text-yellow-800"
      : "bg-gray-100 text-gray-600";
  return (
    <span className={`text-xs px-2 py-0.5 rounded font-medium ${cls}`}>
      {k === "hoch" ? "Hohe Übereinstimmung" : k === "mittel" ? "Mittel" : "Niedrig"}
    </span>
  );
}

export interface ZuordnungsVorschlagCardProps {
  typ: "lieferung" | "sammelrechnung" | "ausgabe" | "eingangsrechnung";
  bezeichnung: string;
  gegenpartei: string;
  betrag: number;
  konfidenz: "hoch" | "mittel" | "niedrig";
  /** Nur bei KI-Vorschlägen gesetzt: 0..1 */
  kiKonfidenz?: number;
  kiBegruendung?: string;
  /** Datum, das bei Annahme als "bezahlt" auf dem Zielobjekt gesetzt würde (ISO). */
  wirdBezahltAm: string;
  onUebernehmen: (alsBezahltMarkieren: boolean) => void | Promise<void>;
  compact?: boolean;
}

/**
 * Gemeinsame Bestätigungskarte für Zuordnungsvorschläge (deterministisch & KI) — im Inline-Panel
 * der Bankabgleich-Tabelle UND im "Automatischer Abgleich"-Bulk-Review verwendet. "Als bezahlt
 * markieren" ist bewusst eine eigene, sichtbare Checkbox statt eines stillen Nebeneffekts des
 * Zuordnens (Default: angehakt; abschaltbar für Teilzahlungen/Anzahlungen).
 */
export default function ZuordnungsVorschlagCard({
  typ,
  bezeichnung,
  gegenpartei,
  betrag,
  konfidenz,
  kiKonfidenz,
  kiBegruendung,
  wirdBezahltAm,
  onUebernehmen,
  compact,
}: ZuordnungsVorschlagCardProps) {
  const [alsBezahlt, setAlsBezahlt] = useState(true);
  const [busy, setBusy] = useState(false);

  async function handleUebernehmen() {
    setBusy(true);
    try {
      await onUebernehmen(alsBezahlt);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg ${compact ? "p-2.5" : "p-3"} hover:border-green-400 transition-colors`}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="text-xs text-gray-500 uppercase tracking-wide flex items-center gap-1">
          {kiKonfidenz != null && <span title="KI-generierter Vorschlag">🤖</span>}
          {TYP_LABEL[typ] ?? typ}
        </span>
        {kiKonfidenz != null ? (
          <span className="text-xs px-2 py-0.5 rounded font-medium bg-purple-100 text-purple-800">
            KI: {Math.round(kiKonfidenz * 100)}%
          </span>
        ) : (
          <KonfidenzBadge k={konfidenz} />
        )}
      </div>
      <div className="font-semibold text-sm text-gray-900">{gegenpartei}</div>
      {bezeichnung && <div className="text-xs text-gray-500 mt-0.5">{bezeichnung}</div>}
      <div className="text-sm font-bold text-gray-800 mt-1">{formatEuro(betrag)}</div>
      {kiBegruendung && <div className="text-xs text-gray-500 mt-1 italic">„{kiBegruendung}&quot;</div>}

      <label className="flex items-center gap-2 mt-2 text-xs text-gray-600 cursor-pointer">
        <input
          type="checkbox"
          checked={alsBezahlt}
          onChange={(e) => setAlsBezahlt(e.target.checked)}
          className="rounded border-gray-300"
        />
        Als bezahlt markieren (Datum: {formatDatum(wirdBezahltAm)})
      </label>

      <button
        onClick={handleUebernehmen}
        disabled={busy}
        className="mt-2 w-full text-xs px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg font-medium"
      >
        {busy ? "Übernehme…" : "Übernehmen"}
      </button>
    </div>
  );
}
