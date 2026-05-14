"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

const DEFAULT_ARTIKEL = { prefix: "ART-", laenge: 5, naechste: 1 };

export default function NummernkreisePage() {
  // Artikelnummer
  const [prefix, setPrefix] = useState(DEFAULT_ARTIKEL.prefix);
  const [laenge, setLaenge] = useState(DEFAULT_ARTIKEL.laenge);
  const [naechste, setNaechste] = useState(DEFAULT_ARTIKEL.naechste);

  // Angebote / Vorbestellungen
  const [angebotPrefix, setAngebotPrefix] = useState("AN");
  const [vorbestellungPrefix, setVorbestellungPrefix] = useState("VB");
  const [letzteAngebotsnummer, setLetzteAngebotsnummer] = useState<string>("");
  const [letzteVorbestellnummer, setLetzteVorbestellnummer] = useState<string>("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const lade = (prefix: string): Promise<Record<string, string>> =>
      fetch(`/api/einstellungen?prefix=${prefix}`).then((r) => (r.ok ? r.json() : {}));
    Promise.all([
      lade("artikel.nummernkreis"),
      lade("system.nummernkreis."),
      lade("letzte_"),
    ])
      .then(([artikelData, systemData, letzteData]) => {
        const raw = artikelData["artikel.nummernkreis"];
        if (raw) {
          try {
            const nk = JSON.parse(raw);
            if (nk.prefix !== undefined) setPrefix(nk.prefix);
            if (nk.laenge !== undefined) setLaenge(Number(nk.laenge));
            if (nk.naechste !== undefined) setNaechste(Number(nk.naechste));
          } catch { /* defaults */ }
        }
        if (systemData["system.nummernkreis.angebot_prefix"])
          setAngebotPrefix(systemData["system.nummernkreis.angebot_prefix"]);
        if (systemData["system.nummernkreis.vorbestellung_prefix"])
          setVorbestellungPrefix(systemData["system.nummernkreis.vorbestellung_prefix"]);
        if (letzteData["letzte_angebotsnummer"])
          setLetzteAngebotsnummer(letzteData["letzte_angebotsnummer"]);
        if (letzteData["letzte_vorbestellnummer"])
          setLetzteVorbestellnummer(letzteData["letzte_vorbestellnummer"]);
      })
      .catch(() => setError("Fehler beim Laden der Einstellungen."))
      .finally(() => setLoading(false));
  }, []);

  const jahr = new Date().getFullYear();
  const artikelPreview = `${prefix}${String(naechste).padStart(laenge, "0")}`;
  const angebotPreview = `${(angebotPrefix || "AN").trim()}-${jahr}-0001`;
  const vorbestellungPreview = `${(vorbestellungPrefix || "VB").trim()}-${jahr}-0001`;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await Promise.all([
        fetch("/api/einstellungen", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key: "artikel.nummernkreis",
            value: JSON.stringify({ prefix, laenge, naechste }),
          }),
        }),
        fetch("/api/einstellungen", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key: "system.nummernkreis.angebot_prefix",
            value: (angebotPrefix || "AN").trim(),
          }),
        }),
        fetch("/api/einstellungen", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key: "system.nummernkreis.vorbestellung_prefix",
            value: (vorbestellungPrefix || "VB").trim(),
          }),
        }),
      ]);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Fehler beim Speichern.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/einstellungen" className="hover:text-green-700">Einstellungen</Link>
        <span>›</span>
        <span className="text-gray-800 font-medium">Nummernkreise</span>
      </div>

      <h1 className="text-2xl font-bold mb-2">Nummernkreise</h1>
      <p className="text-sm text-gray-500 mb-6">
        Präfixe und Zähler für automatisch vergebene Nummern. Angebots- und
        Vorbestellnummern enthalten zusätzlich das Jahr und einen jährlich
        zurückgesetzten Zähler.
      </p>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">Lade…</p>
      ) : (
        <form onSubmit={save} className="space-y-5">
          {/* Artikelnummer */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
              <h2 className="text-sm font-semibold text-gray-700">Artikelnummer</h2>
              <p className="text-xs text-gray-400 mt-0.5">Fortlaufender Zähler ohne Jahresbezug.</p>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Präfix</label>
                <input
                  type="text"
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value)}
                  placeholder="z.B. ART-"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
                />
              </div>
              <div className="flex gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stellenanzahl</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={laenge}
                    onChange={(e) => setLaenge(Math.max(1, Math.min(10, parseInt(e.target.value) || 5)))}
                    className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nächste Nummer</label>
                  <input
                    type="number"
                    min={1}
                    value={naechste}
                    onChange={(e) => setNaechste(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
                  />
                </div>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5">
                <p className="text-xs text-gray-500 mb-0.5">Vorschau nächste Artikelnummer</p>
                <p className="text-lg font-mono font-bold text-green-800">{artikelPreview}</p>
              </div>
            </div>
          </div>

          {/* Angebotsnummer */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
              <h2 className="text-sm font-semibold text-gray-700">Angebotsnummer</h2>
              <p className="text-xs text-gray-400 mt-0.5">Format: Präfix-Jahr-0001 (Zähler beginnt jedes Jahr neu).</p>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Präfix</label>
                <input
                  type="text"
                  value={angebotPrefix}
                  onChange={(e) => setAngebotPrefix(e.target.value)}
                  placeholder="z.B. AN"
                  className="w-40 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
                />
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5">
                <p className="text-xs text-gray-500 mb-0.5">
                  {letzteAngebotsnummer ? "Zuletzt vergeben" : "Vorschau erste Nummer"}
                </p>
                <p className="text-lg font-mono font-bold text-green-800">
                  {letzteAngebotsnummer || angebotPreview}
                </p>
              </div>
            </div>
          </div>

          {/* Vorbestellnummer */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
              <h2 className="text-sm font-semibold text-gray-700">Vorbestellnummer</h2>
              <p className="text-xs text-gray-400 mt-0.5">Format: Präfix-Jahr-0001 (Frühbezug / Saisonbestellungen).</p>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Präfix</label>
                <input
                  type="text"
                  value={vorbestellungPrefix}
                  onChange={(e) => setVorbestellungPrefix(e.target.value)}
                  placeholder="z.B. VB"
                  className="w-40 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
                />
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5">
                <p className="text-xs text-gray-500 mb-0.5">
                  {letzteVorbestellnummer ? "Letzter Zählerstand" : "Vorschau erste Nummer"}
                </p>
                <p className="text-lg font-mono font-bold text-green-800">
                  {letzteVorbestellnummer
                    ? `${(vorbestellungPrefix || "VB").trim()}-${jahr}-${String(parseInt(letzteVorbestellnummer, 10) || 0).padStart(4, "0")}`
                    : vorbestellungPreview}
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 text-sm bg-green-700 hover:bg-green-800 text-white rounded-lg font-medium transition-colors disabled:opacity-60 min-w-[140px]"
            >
              {saving ? "Speichern…" : saved ? "✓ Gespeichert" : "Alle speichern"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
