"use client";

import { getJahreListe, MONATE_LANG } from "@/lib/utils";

interface ZeitraumFilterProps {
  jahr: string;
  setJahr: (j: string) => void;
  /** "01"–"12" */
  vonMonat: string;
  setVonMonat: (m: string) => void;
  /** "01"–"12" */
  bisMonat: string;
  setBisMonat: (m: string) => void;
  /** Schnellauswahl-Buttons ("Ganzes Jahr", "Letzte 3 Monate") anzeigen */
  showQuickButtons?: boolean;
  /** Ladeindikator anzeigen */
  loading?: boolean;
  /** Zusätzliche, seitenspezifische Filter (z. B. Kategorie, Sortierung) */
  children?: React.ReactNode;
}

const SELECT_CLS =
  "border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500";

/**
 * Einheitlicher Zeitraum-Filter (Jahr + Von/Bis-Monat) für alle Auswertungsseiten.
 * Jahresliste kommt dynamisch aus `getJahreListe()`.
 */
export default function ZeitraumFilter({
  jahr, setJahr, vonMonat, setVonMonat, bisMonat, setBisMonat,
  showQuickButtons, loading, children,
}: ZeitraumFilterProps) {
  const jahre = getJahreListe();

  function ganzesJahr() {
    setVonMonat("01");
    setBisMonat("12");
  }

  function letzte3Monate() {
    const now = new Date();
    setJahr(String(now.getFullYear()));
    const m = now.getMonth() + 1;
    setVonMonat(String(Math.max(1, m - 2)).padStart(2, "0"));
    setBisMonat(String(m).padStart(2, "0"));
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Jahr</label>
          <select value={jahr} onChange={(e) => setJahr(e.target.value)} className={SELECT_CLS}>
            {jahre.map((j) => (
              <option key={j} value={j}>{j}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Von Monat</label>
          <select value={vonMonat} onChange={(e) => setVonMonat(e.target.value)} className={SELECT_CLS}>
            {MONATE_LANG.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Bis Monat</label>
          <select value={bisMonat} onChange={(e) => setBisMonat(e.target.value)} className={SELECT_CLS}>
            {MONATE_LANG.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        {children}

        {showQuickButtons && (
          <div className="flex gap-2 items-end">
            <button
              type="button"
              onClick={ganzesJahr}
              className="text-xs px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Ganzes Jahr
            </button>
            <button
              type="button"
              onClick={letzte3Monate}
              className="text-xs px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Letzte 3 Monate
            </button>
          </div>
        )}

        {loading && <span className="text-sm text-gray-400">Lade…</span>}
      </div>
    </div>
  );
}
