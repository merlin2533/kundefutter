"use client";

import { useEffect, useState } from "react";

interface AntragDaten {
  id: number;
  haushaltsjahr: number;
  name: string;
  plz: string | null;
  gemeinde: string | null;
  land: string | null;
  egflGesamt: number;
  elerGesamt: number;
  gesamtBetrag: number;
  massnahmen: string | null;
  mutterunternehmen: string | null;
  importiertAm: string;
}

interface AntragMassnahme {
  code: string;
  ziel: string;
  egfl: number;
  eler: number;
}

function formatEurAntrag(n: number) {
  return n.toLocaleString("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
}

export default function AgrarantragTab({ kundeId }: { kundeId: number }) {
  const [antragDaten, setAntragDaten] = useState<AntragDaten[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  // Betrieb/Fläche edit state (stored on Kunde)
  const [betriebsnummer, setBetriebsnummer] = useState("");
  const [flaeche, setFlaeche] = useState("");
  const [savingMeta, setSavingMeta] = useState(false);
  const [metaSaved, setMetaSaved] = useState(false);

  // Load existing kunde fields
  useEffect(() => {
    fetch(`/api/kunden/${kundeId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.betriebsnummer) setBetriebsnummer(d.betriebsnummer);
        if (d.flaeche) setFlaeche(String(d.flaeche));
      });
    loadAntragDaten();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kundeId]);

  function loadAntragDaten() {
    setLoading(true);
    fetch(`/api/agrarantraege?kundeId=${kundeId}`)
      .then((r) => r.json())
      .then((d) => { setAntragDaten(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }

  async function saveMeta() {
    setSavingMeta(true);
    await fetch(`/api/kunden/${kundeId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        betriebsnummer: betriebsnummer.trim() || undefined,
        flaeche: flaeche ? parseFloat(flaeche) : undefined,
      }),
    });
    setSavingMeta(false);
    setMetaSaved(true);
    setTimeout(() => setMetaSaved(false), 2000);
  }

  const totalGesamt = antragDaten.reduce((s, a) => s + a.gesamtBetrag, 0);
  const totalEgfl   = antragDaten.reduce((s, a) => s + a.egflGesamt, 0);
  const totalEler   = antragDaten.reduce((s, a) => s + a.elerGesamt, 0);

  return (
    <div className="space-y-5">
      {/* Betriebsdaten (manuell) */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Betriebsdaten</h3>
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Betriebsnummer</label>
            <input
              type="text"
              value={betriebsnummer}
              onChange={(e) => setBetriebsnummer(e.target.value)}
              placeholder="z.B. DE-NW-12345678"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Fläche (ha)</label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={flaeche}
              onChange={(e) => setFlaeche(e.target.value)}
              placeholder="z.B. 120.5"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={saveMeta}
              disabled={savingMeta}
              className="px-4 py-2 text-sm bg-green-700 hover:bg-green-800 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {savingMeta ? "…" : metaSaved ? "✓ Gespeichert" : "Speichern"}
            </button>
          </div>
        </div>
      </div>

      {/* Verknüpfte AFIG-Daten */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">
          Förderzahlungen (AFIG / agrarzahlungen.de)
        </h3>
        <div className="flex gap-2">
          <button
            onClick={loadAntragDaten}
            className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            ↻ Aktualisieren
          </button>
          <a
            href={`/api/agrarantraege/pdf?kundeId=${kundeId}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 rounded-lg transition-colors font-medium"
          >
            📄 PDF drucken
          </a>
          <a
            href="/agrarantraege"
            className="text-xs px-3 py-1.5 border border-blue-200 text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
          >
            Alle Antragsdaten →
          </a>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Lade…</p>
      ) : antragDaten.length === 0 ? (
        <div className="text-center py-10 text-gray-400 border border-dashed border-gray-200 rounded-xl">
          <p className="text-2xl mb-2">📋</p>
          <p className="text-sm">Noch keine Antragsdaten verknüpft.</p>
          <p className="text-xs mt-1">
            Im Bereich{" "}
            <a href="/agrarantraege" className="text-green-700 hover:underline">Agraranträge</a>
            {" "}CSV importieren und diesen Kunden verknüpfen.
          </p>
        </div>
      ) : (
        <>
          {/* Gesamtübersicht */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">Gesamt (alle Jahre)</p>
              <p className="text-lg font-bold text-green-800">{formatEurAntrag(totalGesamt)}</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">EGFL</p>
              <p className="text-lg font-bold text-blue-800">{formatEurAntrag(totalEgfl)}</p>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">ELER</p>
              <p className="text-lg font-bold text-orange-800">{formatEurAntrag(totalEler)}</p>
            </div>
          </div>

          {/* Pro Jahr */}
          <div className="space-y-3">
            {antragDaten.map((antrag) => {
              let massnahmen: AntragMassnahme[] = [];
              try { if (antrag.massnahmen) massnahmen = JSON.parse(antrag.massnahmen); } catch { /* ignore */ }
              return (
                <div key={antrag.id} className="border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpanded(expanded === antrag.id ? null : antrag.id)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-sm">Haushaltsjahr {antrag.haushaltsjahr}</span>
                      <span className="text-xs text-gray-500">{[antrag.plz, antrag.gemeinde].filter(Boolean).join(" ")}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="font-mono text-green-700 font-semibold">{formatEurAntrag(antrag.gesamtBetrag)}</span>
                      <span className="text-gray-400 text-xs">{massnahmen.length} Maßnahmen</span>
                      <span className="text-gray-400">{expanded === antrag.id ? "▲" : "▼"}</span>
                    </div>
                  </button>
                  {expanded === antrag.id && (
                    <div className="px-4 py-4 space-y-3">
                      <div className="flex gap-4 text-sm">
                        <div><span className="text-gray-500">EGFL:</span> <span className="font-medium">{formatEurAntrag(antrag.egflGesamt)}</span></div>
                        <div><span className="text-gray-500">ELER:</span> <span className="font-medium">{formatEurAntrag(antrag.elerGesamt)}</span></div>
                        {antrag.mutterunternehmen && (
                          <div><span className="text-gray-500">Mutter:</span> <span className="font-medium">{antrag.mutterunternehmen}</span></div>
                        )}
                      </div>
                      {massnahmen.length > 0 && (
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-gray-500 border-b border-gray-200">
                              <th className="text-left pb-1.5 pr-3">Maßnahme-Code</th>
                              <th className="text-left pb-1.5 pr-3">Spezifisches Ziel</th>
                              <th className="text-right pb-1.5 pr-3">EGFL</th>
                              <th className="text-right pb-1.5">ELER</th>
                            </tr>
                          </thead>
                          <tbody>
                            {massnahmen.map((m, i) => (
                              <tr key={i} className="border-b border-gray-100 last:border-0">
                                <td className="py-1.5 pr-3 font-mono font-medium">{m.code}</td>
                                <td className="py-1.5 pr-3 text-gray-600 max-w-[200px] truncate" title={m.ziel}>{m.ziel || "—"}</td>
                                <td className="py-1.5 pr-3 text-right font-mono">{m.egfl > 0 ? formatEurAntrag(m.egfl) : "—"}</td>
                                <td className="py-1.5 text-right font-mono">{m.eler > 0 ? formatEurAntrag(m.eler) : "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                      <p className="text-xs text-gray-400">
                        Importiert: {new Date(antrag.importiertAm).toLocaleDateString("de-DE")}
                        {" · "}Quelle: AFIG agrarzahlungen.de
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
