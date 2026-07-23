"use client";
import { useState } from "react";

export default function RechnungLoeschenModal({
  open,
  rechnungNr,
  loading,
  error,
  onClose,
  onConfirm,
}: {
  open: boolean;
  rechnungNr: string;
  loading?: boolean;
  error?: string;
  onClose: () => void;
  onConfirm: (begruendung: string) => void;
}) {
  const [begruendung, setBegruendung] = useState("");

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
        <div className="flex items-start gap-3 mb-4">
          <div className="shrink-0 w-9 h-9 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Rechnung {rechnungNr} endgültig löschen</h2>
            <p className="text-sm text-gray-500 mt-0.5">Nur für Administratoren</p>
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800 mb-4">
          <p className="font-semibold mb-1">Achtung – diese Aktion kann nicht rückgängig gemacht werden!</p>
          <p>
            Die Rechnung wird unwiderruflich aus der Datenbank entfernt (kein Storno). Die
            zugrundeliegende Lieferung, ihre Positionen und Zahlungen bleiben unverändert erhalten –
            es wird ausschließlich die Rechnung {rechnungNr} gelöscht. Beachten Sie die gesetzlichen
            Aufbewahrungspflichten für Rechnungen (GoBD): Nutzen Sie im Zweifel stattdessen die
            Storno-Funktion, die die Rechnungsnummer nachvollziehbar erhält.
          </p>
        </div>

        <label className="block text-sm font-medium text-gray-700 mb-1">
          Begründung <span className="text-red-600">*</span>
        </label>
        <textarea
          value={begruendung}
          onChange={(e) => setBegruendung(e.target.value)}
          rows={3}
          placeholder="Warum soll diese Rechnung gelöscht werden?"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
        />
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

        <div className="flex gap-3 mt-5">
          <button
            onClick={() => onConfirm(begruendung.trim())}
            disabled={loading || !begruendung.trim()}
            className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {loading ? "Lösche…" : "Endgültig löschen"}
          </button>
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 border border-gray-300 text-gray-700 hover:bg-gray-50 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}
