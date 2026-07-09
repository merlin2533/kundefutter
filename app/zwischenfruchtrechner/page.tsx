"use client";
import { useMemo, useRef, useState } from "react";
import {
  ZWISCHENFRUCHT_ARTEN,
  ZwischenfruchtFamilie,
  berechneMischung,
  findZwischenfruchtArt,
} from "@/lib/zwischenfrucht";
import { farbeFuerName, formatPercent, formatZahl } from "@/lib/utils";

const FAMILIEN_REIHENFOLGE: ZwischenfruchtFamilie[] = [
  "Kreuzblütler",
  "Raublattgewächse",
  "Leguminosen",
  "Gräser",
];

type Modus = "sack" | "direkt";

interface Zeile {
  id: number;
  artId: string;
  customName: string;
  tkg: number;
  sackGroesse: number;
  anzahlSaecke: number;
  kgProHaDirekt: number;
}

function neueZeile(id: number, artId: string): Zeile {
  const art = findZwischenfruchtArt(artId);
  return {
    id,
    artId,
    customName: "",
    tkg: art?.tkg ?? 5,
    sackGroesse: 25,
    anzahlSaecke: 1,
    kgProHaDirekt: 10,
  };
}

export default function ZwischenfruchtrechnerPage() {
  const nextId = useRef(3);
  const [flaeche, setFlaeche] = useState(1);
  const [modus, setModus] = useState<Modus>("sack");
  const [zeilen, setZeilen] = useState<Zeile[]>(() => [
    neueZeile(1, ZWISCHENFRUCHT_ARTEN[0].id),
    neueZeile(2, ZWISCHENFRUCHT_ARTEN[5].id),
  ]);

  function addZeile() {
    setZeilen((z) => [...z, neueZeile(nextId.current++, ZWISCHENFRUCHT_ARTEN[0].id)]);
  }

  function removeZeile(id: number) {
    setZeilen((z) => z.filter((r) => r.id !== id));
  }

  function updateZeile(id: number, patch: Partial<Zeile>) {
    setZeilen((z) => z.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function handleArtChange(id: number, artId: string) {
    const art = findZwischenfruchtArt(artId);
    // customName bewusst unangetastet lassen: Wechselt der Nutzer versehentlich weg von
    // "Eigene Art…" und wieder zurück, bleibt der zuvor eingegebene Name erhalten.
    updateZeile(id, { artId, tkg: art ? art.tkg : 5 });
  }

  // Auf 2 Nachkommastellen runden, um Fließkomma-Rauschen (z.B. 1,9999999999999998) aus
  // hin- und hergerechneten Werten fernzuhalten.
  function rund2(n: number): number {
    return Math.round(n * 100) / 100;
  }

  // Wechsel des Eingabemodus: die jeweils andere Darstellung auf den aktuell wirksamen
  // kg/ha-Wert nachziehen, statt stillschweigend auf ungenutzte Default-Werte umzuschalten.
  // Beide Richtungen benötigen eine gültige Fläche (> 0) – ohne sie bleibt der Wert unverändert.
  function handleModusChange(neu: Modus) {
    if (neu === modus) return;
    if (flaeche > 0) {
      setZeilen((zeilenAlt) =>
        zeilenAlt.map((z) => {
          if (neu === "direkt") {
            return { ...z, kgProHaDirekt: rund2((z.sackGroesse * z.anzahlSaecke) / flaeche) };
          }
          // neu === "sack": bestehende Sackgröße beibehalten, Anzahl Säcke daraus ableiten
          const anzahlSaecke = z.sackGroesse > 0 ? rund2((z.kgProHaDirekt * flaeche) / z.sackGroesse) : z.anzahlSaecke;
          return { ...z, anzahlSaecke };
        }),
      );
    }
    setModus(neu);
  }

  const flaecheUngueltig = !(flaeche > 0);

  const eingaben = useMemo(
    () =>
      zeilen.map((z, idx) => {
        const art = findZwischenfruchtArt(z.artId);
        const name =
          z.artId === "custom"
            ? z.customName.trim() || `Eigene Art (Zeile ${idx + 1})`
            : (art?.name ?? `Eigene Art (Zeile ${idx + 1})`);
        const kgGesamt = z.sackGroesse * z.anzahlSaecke;
        const kgProHa = modus === "sack" ? (flaeche > 0 ? kgGesamt / flaeche : 0) : z.kgProHaDirekt;
        return { name, tkg: z.tkg, kgProHa };
      }),
    [zeilen, modus, flaeche],
  );

  const ergebnis = useMemo(() => berechneMischung(eingaben), [eingaben]);

  return (
    <div className="max-w-screen-lg mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Zwischenfrucht-Mischungsrechner</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Gewichts- und Samenanteile einer Zwischenfrucht-Mischung aus der tatsächlichen Aussaatstärke berechnen
        </p>
      </div>

      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800">
        Gängige Mischungsrechner arbeiten andersherum: Man gibt gewünschte Samenanteile vor und erhält die nötige
        Aussaatstärke in kg/ha. Hier ist es umgekehrt – gib ein, wie viele Säcke von welcher Art tatsächlich in die
        Mischung kommen, und der Rechner zeigt, welcher Gewichts- und Samenanteil (Körner/m²) je Partner dabei
        herauskommt.
      </div>

      {/* Fläche + Eingabemodus */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm mb-6 print:hidden">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <label htmlFor="zf-flaeche" className="text-sm text-gray-700">Fläche</label>
            <input
              id="zf-flaeche"
              type="number"
              min={0.01}
              step={0.01}
              value={flaeche}
              onChange={(e) => setFlaeche(Math.max(0, parseFloat(e.target.value) || 0))}
              className={`w-24 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 ${flaecheUngueltig ? "border-red-300" : "border-gray-300"}`}
            />
            <span className="text-sm text-gray-500">ha</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700">Eingabe je Komponente als:</span>
            <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden">
              <button
                type="button"
                onClick={() => handleModusChange("sack")}
                className={`px-3 py-1.5 text-sm transition-colors ${modus === "sack" ? "bg-green-700 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
              >
                Sackgröße × Anzahl
              </button>
              <button
                type="button"
                onClick={() => handleModusChange("direkt")}
                className={`px-3 py-1.5 text-sm transition-colors border-l border-gray-300 ${modus === "direkt" ? "bg-green-700 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
              >
                kg/ha direkt
              </button>
            </div>
          </div>
        </div>
        {flaecheUngueltig && (
          <p className="mt-2 text-xs text-red-600">
            Bitte eine gültige Fläche (&gt; 0 ha) eingeben – sonst kann aus Sackgröße × Anzahl keine Menge je ha
            berechnet werden (auch beim Umschalten zwischen den Eingabearten).
          </p>
        )}
      </div>

      {/* Komponenten */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm mb-6 print:hidden">
        <h2 className="font-semibold text-gray-800 mb-4">Mischungspartner</h2>
        <div className="space-y-3">
          {zeilen.map((z, idx) => {
            const kgGesamt = z.sackGroesse * z.anzahlSaecke;
            const kgProHaEffektiv = modus === "sack" ? (flaeche > 0 ? kgGesamt / flaeche : 0) : z.kgProHaDirekt;
            const zeileUngueltig = !(z.tkg > 0) || !(kgProHaEffektiv > 0);
            return (
            <div key={z.id} className="flex flex-wrap items-end gap-3 pb-3 border-b border-gray-100 last:border-0 last:pb-0">
              <div className="w-56">
                <label htmlFor={`zf-art-${z.id}`} className="block text-xs text-gray-500 mb-1">Art</label>
                {/* Natives select statt SearchableSelect: Gruppierung nach Pflanzenfamilie (optgroup)
                    wird von SearchableSelect aktuell nicht unterstützt. */}
                <select
                  id={`zf-art-${z.id}`}
                  value={z.artId}
                  onChange={(e) => handleArtChange(z.id, e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                >
                  {FAMILIEN_REIHENFOLGE.map((familie) => {
                    const arten = ZWISCHENFRUCHT_ARTEN.filter((a) => a.familie === familie);
                    if (arten.length === 0) return null;
                    return (
                      <optgroup key={familie} label={familie}>
                        {arten.map((a) => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                      </optgroup>
                    );
                  })}
                  <option value="custom">Eigene Art…</option>
                </select>
              </div>

              {z.artId === "custom" && (
                <div className="w-40">
                  <label htmlFor={`zf-name-${z.id}`} className="block text-xs text-gray-500 mb-1">Bezeichnung</label>
                  <input
                    id={`zf-name-${z.id}`}
                    type="text"
                    value={z.customName}
                    onChange={(e) => updateZeile(z.id, { customName: e.target.value })}
                    placeholder={`z. B. Sorghum XY (Zeile ${idx + 1})`}
                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                  />
                </div>
              )}

              <div className="w-24">
                <label htmlFor={`zf-tkg-${z.id}`} className="block text-xs text-gray-500 mb-1">TKG (g)</label>
                <input
                  id={`zf-tkg-${z.id}`}
                  type="number"
                  min={0.1}
                  step={0.1}
                  value={z.tkg}
                  onChange={(e) => updateZeile(z.id, { tkg: Math.max(0, parseFloat(e.target.value) || 0) })}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                />
              </div>

              {modus === "sack" ? (
                <>
                  <div className="w-28">
                    <label htmlFor={`zf-sackgroesse-${z.id}`} className="block text-xs text-gray-500 mb-1">Sackgröße (kg)</label>
                    <input
                      id={`zf-sackgroesse-${z.id}`}
                      type="number"
                      min={0}
                      step={0.5}
                      value={z.sackGroesse}
                      onChange={(e) => updateZeile(z.id, { sackGroesse: Math.max(0, parseFloat(e.target.value) || 0) })}
                      className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                    />
                  </div>
                  <div className="w-24">
                    <label htmlFor={`zf-anzahl-${z.id}`} className="block text-xs text-gray-500 mb-1">Anzahl Säcke</label>
                    <input
                      id={`zf-anzahl-${z.id}`}
                      type="number"
                      min={0}
                      step={0.5}
                      value={z.anzahlSaecke}
                      onChange={(e) => updateZeile(z.id, { anzahlSaecke: Math.max(0, parseFloat(e.target.value) || 0) })}
                      className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                    />
                  </div>
                  <div className="text-xs text-gray-400 pb-2">
                    = {formatZahl(z.sackGroesse * z.anzahlSaecke)} kg gesamt
                  </div>
                </>
              ) : (
                <div className="w-28">
                  <label htmlFor={`zf-kgproha-${z.id}`} className="block text-xs text-gray-500 mb-1">Menge (kg/ha)</label>
                  <input
                    id={`zf-kgproha-${z.id}`}
                    type="number"
                    min={0}
                    step={0.1}
                    value={z.kgProHaDirekt}
                    onChange={(e) => updateZeile(z.id, { kgProHaDirekt: Math.max(0, parseFloat(e.target.value) || 0) })}
                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                  />
                </div>
              )}

              {zeileUngueltig && (
                <div className="text-xs text-amber-600 pb-2">
                  wird nicht berücksichtigt (Menge oder TKG fehlt)
                </div>
              )}

              <button
                type="button"
                onClick={() => removeZeile(z.id)}
                disabled={zeilen.length <= 1}
                title="Zeile entfernen"
                className="mb-1 p-2 text-gray-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={addZeile}
          className="mt-4 text-sm text-green-700 hover:text-green-800 font-medium flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Partner hinzufügen
        </button>
      </div>

      {/* Ergebnis */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm mb-6">
        <h2 className="font-semibold text-gray-800 mb-4">Ergebnis</h2>

        {ergebnis.komponenten.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Bitte mindestens eine Komponente mit Menge und TKG eingeben.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-200 text-left text-gray-500">
                    <th className="py-2 pr-3 font-medium">Art</th>
                    <th className="py-2 pr-3 font-medium text-right">TKG (g)</th>
                    <th className="py-2 pr-3 font-medium text-right">kg/ha</th>
                    <th className="py-2 pr-3 font-medium text-right">Körner/m²</th>
                    <th className="py-2 pr-3 font-medium text-right">Gewichtsanteil</th>
                    <th className="py-2 font-medium text-right">Samenanteil</th>
                  </tr>
                </thead>
                <tbody>
                  {ergebnis.komponenten.map((k, idx) => (
                    <tr key={`${k.name}-${idx}`} className="border-b border-gray-50">
                      <td className="py-2 pr-3">
                        <span className={`inline-block w-2.5 h-2.5 rounded-full mr-2 ${farbeFuerName(k.name)}`} />
                        {k.name}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono">{formatZahl(k.tkg, 1)}</td>
                      <td className="py-2 pr-3 text-right font-mono">{formatZahl(k.kgProHa, 2)}</td>
                      <td className="py-2 pr-3 text-right font-mono">{formatZahl(k.koernerProM2, 0)}</td>
                      <td className="py-2 pr-3 text-right font-mono">{formatPercent(k.gewichtsanteilProzent)}</td>
                      <td className="py-2 text-right font-mono">{formatPercent(k.samenanteilProzent)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 font-semibold text-gray-800">
                    <td className="py-2 pr-3">Summe</td>
                    <td className="py-2 pr-3" />
                    <td className="py-2 pr-3 text-right font-mono">{formatZahl(ergebnis.summeKgProHa, 2)}</td>
                    <td className="py-2 pr-3 text-right font-mono">{formatZahl(ergebnis.summeKoernerProM2, 0)}</td>
                    <td className="py-2 pr-3 text-right font-mono">{formatPercent(100)}</td>
                    <td className="py-2 text-right font-mono">{formatPercent(100)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Anteils-Balken: Gewicht vs. Samenzahl im Vergleich */}
            <div className="mt-5 space-y-2">
              <div>
                <div className="text-xs text-gray-500 mb-1">Gewichtsanteil</div>
                <div className="flex h-5 rounded-lg overflow-hidden border border-gray-200">
                  {ergebnis.komponenten.map((k, idx) => (
                    <div
                      key={`g-${idx}`}
                      className={farbeFuerName(k.name)}
                      style={{ width: `${k.gewichtsanteilProzent}%` }}
                      title={`${k.name}: ${formatPercent(k.gewichtsanteilProzent)}`}
                    />
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Samenanteil (Körner/m²)</div>
                <div className="flex h-5 rounded-lg overflow-hidden border border-gray-200">
                  {ergebnis.komponenten.map((k, idx) => (
                    <div
                      key={`s-${idx}`}
                      className={farbeFuerName(k.name)}
                      style={{ width: `${k.samenanteilProzent}%` }}
                      title={`${k.name}: ${formatPercent(k.samenanteilProzent)}`}
                    />
                  ))}
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Feinsämige Partner (z. B. Phacelia, Leindotter) haben oft einen hohen Samenanteil bei geringem
                Gewichtsanteil – und umgekehrt bei grobkörnigen Partnern (z. B. Ackerbohne, Wicke).
              </p>
            </div>

            <ul className="mt-5 text-xs text-gray-500 list-disc list-inside space-y-0.5">
              {ergebnis.hinweise.map((h, idx) => (
                <li key={idx}>{h}</li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="flex justify-end print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="px-4 py-2 text-sm bg-green-700 hover:bg-green-800 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Als PDF drucken
        </button>
      </div>
    </div>
  );
}
