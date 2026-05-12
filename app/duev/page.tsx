export default function DuevPage() {
  const MONATE = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

  // Sperrfrist-Markierungen (1-basiert)
  const ackerStickstoff = new Set([11, 12, 1]); // 01.11.–31.01.
  const ackerFestmistKompost = new Set([12, 1]); // 01.12.–31.01.
  const ackerPhosphat = new Set([12, 1]); // 01.12.–14.01. (vereinfacht als Monate)
  const gruenlandStickstoff = new Set([10, 11, 12, 1]); // 01.10.–31.01.
  const gruenlandFestmist = new Set([12, 1]); // 01.12.–31.01.

  function isSperrfrist(month: number, set: Set<number>) {
    return set.has(month);
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        Düngeverordnung — Sperrfristen 2025/2026
      </h1>
      <p className="text-sm text-gray-600 mb-6">
        Die folgenden Sperrfristen gelten nach § 6 Abs. 8 DüV. Bitte prüfen Sie immer die aktuell gültige Fassung.
      </p>

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
        <h2 className="text-base font-semibold text-gray-900">Jahresübersicht — Gesperrte Monate (visuell)</h2>

        {/* Ackerland Stickstoff */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Ackerland — Stickstoff (flüssig)</p>
          <div className="flex gap-1 flex-wrap">
            {MONATE.map((m, i) => {
              const monthNum = i + 1;
              const gesperrt = isSperrfrist(monthNum, ackerStickstoff);
              return (
                <div
                  key={m}
                  className={`flex-1 min-w-[3rem] text-center py-3 rounded-lg text-xs font-medium border ${
                    gesperrt
                      ? "bg-red-100 text-red-700 border-red-300"
                      : "bg-green-50 text-green-700 border-green-200"
                  }`}
                >
                  {m}
                  <div className="text-[10px] mt-0.5">{gesperrt ? "Gesperrt" : "Frei"}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Grünland Stickstoff */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Grünland — Stickstoff (flüssig)</p>
          <div className="flex gap-1 flex-wrap">
            {MONATE.map((m, i) => {
              const monthNum = i + 1;
              const gesperrt = isSperrfrist(monthNum, gruenlandStickstoff);
              return (
                <div
                  key={m}
                  className={`flex-1 min-w-[3rem] text-center py-3 rounded-lg text-xs font-medium border ${
                    gesperrt
                      ? "bg-red-100 text-red-700 border-red-300"
                      : "bg-green-50 text-green-700 border-green-200"
                  }`}
                >
                  {m}
                  <div className="text-[10px] mt-0.5">{gesperrt ? "Gesperrt" : "Frei"}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Festmist / Phosphat */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Ackerland — Festmist / Kompost / Phosphat</p>
          <div className="flex gap-1 flex-wrap">
            {MONATE.map((m, i) => {
              const monthNum = i + 1;
              const gesperrt = isSperrfrist(monthNum, ackerFestmistKompost);
              return (
                <div
                  key={m}
                  className={`flex-1 min-w-[3rem] text-center py-3 rounded-lg text-xs font-medium border ${
                    gesperrt
                      ? "bg-orange-100 text-orange-700 border-orange-300"
                      : "bg-green-50 text-green-700 border-green-200"
                  }`}
                >
                  {m}
                  <div className="text-[10px] mt-0.5">{gesperrt ? "Gesperrt" : "Frei"}</div>
                </div>
              );
            })}
          </div>
        </div>
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
