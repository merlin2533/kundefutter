"use client";

import { useState } from "react";

const BUNDESLAENDER = [
  "Bundesweit (Basiswerte)",
  "Bayern",
  "Baden-Württemberg",
  "Berlin",
  "Brandenburg",
  "Bremen",
  "Hamburg",
  "Hessen",
  "Mecklenburg-Vorpommern",
  "Niedersachsen",
  "Nordrhein-Westfalen",
  "Rheinland-Pfalz",
  "Saarland",
  "Sachsen",
  "Sachsen-Anhalt",
  "Schleswig-Holstein",
  "Thüringen",
];

// Next sperrfrist calculation: returns { tage, label } for the nearest upcoming sperrfrist start
function naechsteSperrfrist(now: Date): { tage: number; label: string } | null {
  // Sperrfrist starts (month=1-based, day)
  const starts = [
    { month: 10, day: 1, label: "01.10. (Grünland-Stickstoff)" },
    { month: 11, day: 1, label: "01.11. (Ackerland-Stickstoff)" },
    { month: 12, day: 1, label: "01.12. (Festmist / Phosphat)" },
  ];
  const year = now.getFullYear();
  let nearest: { tage: number; label: string } | null = null;
  for (const s of starts) {
    let candidate = new Date(year, s.month - 1, s.day);
    if (candidate <= now) candidate = new Date(year + 1, s.month - 1, s.day);
    const tage = Math.ceil((candidate.getTime() - now.getTime()) / 86400000);
    if (!nearest || tage < nearest.tage) nearest = { tage, label: s.label };
  }
  return nearest;
}

export default function DuevPage() {
  const MONATE = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

  // Sperrfrist-Markierungen (1-basiert)
  const ackerStickstoff = new Set([11, 12, 1]); // 01.11.–31.01.
  const ackerFestmistKompost = new Set([12, 1]); // 01.12.–31.01.
  const ackerPhosphat = new Set([12, 1]); // 01.12.–14.01. (vereinfacht als Monate)
  const gruenlandStickstoff = new Set([10, 11, 12, 1]); // 01.10.–31.01.
  const gruenlandFestmist = new Set([12, 1]); // 01.12.–31.01.

  // Current month (1-based)
  const now = new Date();
  const currentMonth = now.getMonth() + 1;

  const [bundesland, setBundesland] = useState("Bundesweit (Basiswerte)");

  const naechste = naechsteSperrfrist(now);

  function isSperrfrist(month: number, set: Set<number>) {
    return set.has(month);
  }

  function MonatsKalender({ label, sperrSet, color }: { label: string; sperrSet: Set<number>; color: "red" | "orange" }) {
    const gesperrtCls = color === "red"
      ? "bg-red-100 text-red-700 border-red-300"
      : "bg-orange-100 text-orange-700 border-orange-300";
    return (
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">{label}</p>
        <div className="flex gap-1 flex-wrap">
          {MONATE.map((m, i) => {
            const monthNum = i + 1;
            const gesperrt = isSperrfrist(monthNum, sperrSet);
            const isJetzt = monthNum === currentMonth;
            return (
              <div
                key={m}
                className={`flex-1 min-w-[3rem] text-center py-3 rounded-lg text-xs font-medium border transition-all ${
                  gesperrt ? gesperrtCls : "bg-green-50 text-green-700 border-green-200"
                } ${isJetzt ? "ring-2 ring-offset-1 ring-gray-700 font-bold" : ""}`}
              >
                {m}
                <div className="text-[10px] mt-0.5">{gesperrt ? "Gesperrt" : "Frei"}</div>
                {isJetzt && <div className="text-[9px] mt-0.5 text-gray-600">Jetzt</div>}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl print:py-4 print:px-0">
      {/* Header + PDF button */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
        <h1 className="text-2xl font-bold text-gray-900">
          Düngeverordnung — Sperrfristen 2025/2026
        </h1>
        <button
          onClick={() => window.print()}
          className="print:hidden inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Als PDF drucken
        </button>
      </div>
      <p className="text-sm text-gray-600 mb-4">
        Die folgenden Sperrfristen gelten nach § 6 Abs. 8 DüV. Bitte prüfen Sie immer die aktuell gültige Fassung.
      </p>

      {/* Bundesland-Auswahl */}
      <div className="print:hidden bg-white rounded-xl border border-gray-200 p-4 mb-4 flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-gray-700">Bundesland:</label>
        <select
          value={bundesland}
          onChange={(e) => setBundesland(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
        >
          {BUNDESLAENDER.map((bl) => (
            <option key={bl} value={bl}>{bl}</option>
          ))}
        </select>
        {bundesland !== "Bundesweit (Basiswerte)" && (
          <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
            Länderspezifische Abweichungen beachten — diese Angaben zeigen die Bundesbasiswerte.
          </span>
        )}
      </div>

      {/* Nächste Sperrfrist-Warnung */}
      {naechste && naechste.tage <= 60 && (
        <div className="bg-orange-50 border border-orange-300 rounded-xl p-4 mb-6 text-sm text-orange-800 flex items-start gap-2">
          <span className="text-lg leading-none mt-0.5">⚠️</span>
          <div>
            <span className="font-semibold">Nächste Sperrfrist beginnt in {naechste.tage} Tagen</span>
            {" "}({naechste.label})
          </div>
        </div>
      )}
      {naechste && naechste.tage > 60 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-6 text-sm text-blue-700">
          Nächste Sperrfrist beginnt in <span className="font-semibold">{naechste.tage} Tagen</span>{" "}
          ({naechste.label})
        </div>
      )}

      {/* Hinweis */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8 text-sm text-amber-800">
        <p className="font-semibold mb-1">Hinweis</p>
        Diese Angaben sind ohne Gewähr. Für verbindliche Auskünfte wenden Sie sich an Ihr zuständiges Landwirtschaftsamt.
        Bedingte Verlängerungen auf Antrag möglich.
      </div>

      {/* Tabelle */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h2 className="text-base font-semibold text-gray-900">Sperrfristenübersicht</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-40">Nutzung / Düngerart</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Sperrfrist</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Hinweise</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">Ackerland — Stickstoff</td>
                <td className="px-4 py-3 text-red-700 font-medium">01.11. – 31.01.</td>
                <td className="px-4 py-3 text-gray-600">Flüssige organische Düngemittel, Gülle, Jauche, Gärreste</td>
              </tr>
              <tr className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">Ackerland — Festmist, Kompost</td>
                <td className="px-4 py-3 text-red-700 font-medium">01.12. – 31.01.</td>
                <td className="px-4 py-3 text-gray-600">Ausnahme: Festmist von Huf-/Klauentieren und Kompost</td>
              </tr>
              <tr className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">Ackerland — Phosphat</td>
                <td className="px-4 py-3 text-red-700 font-medium">01.12. – 14.01.</td>
                <td className="px-4 py-3 text-gray-600">Phosphathaltige Düngemittel</td>
              </tr>
              <tr className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">Grünland — Stickstoff</td>
                <td className="px-4 py-3 text-red-700 font-medium">01.10. – 31.01.</td>
                <td className="px-4 py-3 text-gray-600">Flüssige organische Düngemittel, Gülle, Jauche, Gärreste</td>
              </tr>
              <tr className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">Grünland — Festmist, Kompost</td>
                <td className="px-4 py-3 text-red-700 font-medium">01.12. – 31.01.</td>
                <td className="px-4 py-3 text-gray-600">Ausnahme: Festmist von Huf-/Klauentieren und Kompost</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Kalenderübersicht */}
      <div className="space-y-6">
        <h2 className="text-base font-semibold text-gray-900">
          Jahresübersicht — Gesperrte Monate (visuell)
          <span className="ml-2 text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
            Aktueller Monat hervorgehoben
          </span>
        </h2>

        <MonatsKalender label="Ackerland — Stickstoff (flüssig)" sperrSet={ackerStickstoff} color="red" />
        <MonatsKalender label="Grünland — Stickstoff (flüssig)" sperrSet={gruenlandStickstoff} color="red" />
        <MonatsKalender label="Ackerland — Festmist / Kompost / Phosphat" sperrSet={ackerFestmistKompost} color="orange" />
      </div>

      {/* Legende */}
      <div className="mt-6 flex gap-4 flex-wrap text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-red-100 border border-red-300 inline-block" />
          <span className="text-gray-600">Sperrfrist Stickstoff (flüssig)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-orange-100 border border-orange-300 inline-block" />
          <span className="text-gray-600">Sperrfrist Festmist / Phosphat</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-green-50 border border-green-200 inline-block" />
          <span className="text-gray-600">Keine Sperrfrist</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-white border-2 border-gray-700 inline-block" />
          <span className="text-gray-600">Aktueller Monat</span>
        </div>
      </div>

      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
        <p className="font-semibold mb-1">Rechtlicher Hinweis</p>
        Diese Angaben sind ohne Gewähr. Maßgeblich ist stets die zum Zeitpunkt der Düngung geltende Fassung der
        Düngeverordnung (DüV) in Verbindung mit den Landesregelungen. Eine Verlängerung der Sperrfristen kann
        durch die zuständige Behörde angeordnet werden. Ausnahmen (z.B. für Festmist von Huf- und Klauentieren)
        sind möglich. Für verbindliche Auskünfte wenden Sie sich an Ihr zuständiges Landwirtschaftsamt.
      </div>
    </div>
  );
}
