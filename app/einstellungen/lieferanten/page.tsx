"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function LieferantenEinstellungenPage() {
  const [zahlungsziel, setZahlungsziel] = useState("");
  const [skonto, setSkonto] = useState("");
  const [lieferbedingungen, setLieferbedingungen] = useState("");
  const [mwstsaetze, setMwstsaetze] = useState<string[]>([]);
  const [newMwst, setNewMwst] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/einstellungen?prefix=firma.")
      .then((r) => r.json())
      .then((d) => {
        setZahlungsziel(d["firma.zahlungsziel"] ?? "");
        setSkonto(d["firma.skonto"] ?? "");
        setLieferbedingungen(d["firma.lieferbedingungen"] ?? "");
      })
      .catch(() => {});

    fetch("/api/einstellungen?prefix=system.")
      .then((r) => r.json())
      .then((d) => {
        if (d["system.mwstsaetze"]) {
          try {
            setMwstsaetze(JSON.parse(d["system.mwstsaetze"]));
          } catch {
            /* ignore */
          }
        } else {
          setMwstsaetze(["7%", "19%"]);
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  async function saveSetting(key: string, value: string) {
    await fetch("/api/einstellungen", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
  }

  async function handleSave() {
    setSaving(true);
    await Promise.all([
      saveSetting("firma.zahlungsziel", zahlungsziel),
      saveSetting("firma.skonto", skonto),
      saveSetting("firma.lieferbedingungen", lieferbedingungen),
    ]);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  async function saveMwst(list: string[]) {
    await fetch("/api/einstellungen", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "system.mwstsaetze", value: JSON.stringify(list) }),
    });
  }

  function addMwst() {
    const v = newMwst.trim();
    if (!v || mwstsaetze.includes(v)) return;
    const next = [...mwstsaetze, v];
    setMwstsaetze(next);
    setNewMwst("");
    saveMwst(next);
  }

  function removeMwst(item: string) {
    const next = mwstsaetze.filter((i) => i !== item);
    setMwstsaetze(next);
    saveMwst(next);
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/einstellungen" className="hover:text-green-700">
          Einstellungen
        </Link>
        <span>›</span>
        <span className="text-gray-800 font-medium">Lieferanten</span>
      </div>

      <h1 className="text-2xl font-bold mb-6">Lieferanten-Einstellungen</h1>

      <div className="flex flex-col gap-6">
        {/* Zahlungskonditionen */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Standard-Zahlungskonditionen</h2>
          {saved && <p className="text-xs text-green-600 mb-3">✓ Gespeichert</p>}

          <div className="grid gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Standard Zahlungsziel (Tage)
              </label>
              <input
                type="number"
                min={0}
                value={zahlungsziel}
                onChange={(e) => setZahlungsziel(e.target.value)}
                placeholder="z.B. 30"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Standard Skonto (%)
              </label>
              <input
                type="number"
                min={0}
                step={0.1}
                value={skonto}
                onChange={(e) => setSkonto(e.target.value)}
                placeholder="z.B. 2"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bevorzugte Lieferbedingungen
              </label>
              <input
                type="text"
                value={lieferbedingungen}
                onChange={(e) => setLieferbedingungen(e.target.value)}
                placeholder="z.B. Frei Haus, EXW, FCA…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-4 px-5 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50 transition-colors"
          >
            {saving ? "Speichern…" : "Speichern"}
          </button>
        </div>

        {/* MwSt-Sätze */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-1">MwSt-Sätze</h2>
          <p className="text-sm text-gray-500 mb-3">
            Gültige Mehrwertsteuersätze (z.B. 7%, 19%).
          </p>
          {!loaded ? (
            <p className="text-sm text-gray-400">Lade…</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2 mb-3 min-h-[2rem]">
                {mwstsaetze.map((item) => (
                  <span
                    key={item}
                    className="flex items-center gap-1 bg-green-50 text-green-800 border border-green-200 px-3 py-1 rounded-full text-sm"
                  >
                    {item}
                    <button
                      onClick={() => removeMwst(item)}
                      className="ml-1 text-green-600 hover:text-red-600 leading-none text-base"
                    >
                      ×
                    </button>
                  </span>
                ))}
                {mwstsaetze.length === 0 && (
                  <p className="text-sm text-gray-400">Noch keine MwSt-Sätze definiert</p>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMwst}
                  onChange={(e) => setNewMwst(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addMwst())}
                  placeholder="z.B. 10.7%"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <button
                  onClick={addMwst}
                  disabled={!newMwst.trim()}
                  className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50 transition-colors"
                >
                  + Hinzufügen
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
