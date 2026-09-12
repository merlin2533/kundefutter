"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import * as Sentry from "@sentry/nextjs";
import {
  BETRIEBSARTEN,
  BETRIEBSART_KEY,
  MODUL_BEREICHE,
  MODUL_LABELS,
  parseBetriebsart,
  type BetriebsartKey,
} from "@/lib/betriebsart";
import { DEFAULT_MODUL_CONFIG, MODUL_KEYS, modulConfigAusMap, modulSettingKey, type ModulConfig, type ModulKey } from "@/lib/modul-keys";

async function speichereEinstellung(key: string, value: string) {
  const res = await fetch("/api/einstellungen", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, value }),
  });
  if (!res.ok) throw new Error(`Einstellung ${key} konnte nicht gespeichert werden`);
}

function Schalter({ an, onClick, label }: { an: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={an}
      className={`flex-shrink-0 w-10 h-6 rounded-full relative transition-colors ${an ? "bg-green-600" : "bg-gray-300"}`}
    >
      <span
        className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${an ? "right-1" : "left-1"}`}
      />
    </button>
  );
}

export default function ModuleEinstellungenPage() {
  const router = useRouter();
  const [form, setForm] = useState<ModulConfig>(DEFAULT_MODUL_CONFIG);
  const [betriebsart, setBetriebsart] = useState<BetriebsartKey>("agrarhandel");
  const [offeneBereiche, setOffeneBereiche] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [artApplying, setArtApplying] = useState<BetriebsartKey | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const [modRes, sysRes] = await Promise.all([
        fetch("/api/einstellungen?prefix=modul."),
        fetch(`/api/einstellungen?prefix=${encodeURIComponent(BETRIEBSART_KEY)}`),
      ]);
      if (!modRes.ok) throw new Error("Module konnten nicht geladen werden");
      setForm(modulConfigAusMap(await modRes.json()));
      if (sysRes.ok) {
        const sys: Record<string, string> = await sysRes.json();
        setBetriebsart(parseBetriebsart(sys[BETRIEBSART_KEY]));
      }
    } catch (err) {
      Sentry.captureException(err);
      setError("Fehler beim Laden der Einstellungen.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await Promise.all(MODUL_KEYS.map((k) => speichereEinstellung(modulSettingKey(k), form[k] ? "true" : "false")));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      // Navigation, Einstellungs-Kacheln, Dashboard und Hilfe lesen die Module aus dem
      // server-gerenderten ModulProvider (app/layout.tsx) — refresh() zieht sie sofort nach,
      // statt den Nutzer auf den nächsten harten Seitenaufruf zu vertrösten.
      router.refresh();
    } catch (err) {
      Sentry.captureException(err);
      setError("Fehler beim Speichern.");
    } finally {
      setSaving(false);
    }
  }

  function toggleModul(key: ModulKey) {
    setForm((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function toggleBereich(module: ModulKey[], zielZustand: boolean) {
    setForm((prev) => {
      const next = { ...prev };
      for (const k of module) next[k] = zielZustand;
      return next;
    });
  }

  function toggleDetails(key: string) {
    setOffeneBereiche((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function waehleBetriebsart(key: BetriebsartKey) {
    const art = BETRIEBSARTEN.find((b) => b.key === key);
    if (!art) return;
    setArtApplying(key);
    setError(null);
    try {
      const naechsteForm = { ...form };
      const writes: Promise<void>[] = [speichereEinstellung(BETRIEBSART_KEY, key)];
      for (const [k, v] of Object.entries(art.config) as [ModulKey, boolean][]) {
        naechsteForm[k] = v;
        writes.push(speichereEinstellung(modulSettingKey(k), v ? "true" : "false"));
      }
      if (art.artikelkategorien) {
        writes.push(speichereEinstellung("system.artikelkategorien", JSON.stringify(art.artikelkategorien)));
      }
      await Promise.all(writes);
      setForm(naechsteForm);
      setBetriebsart(key);
      router.refresh();
    } catch (err) {
      Sentry.captureException(err);
      setError("Fehler beim Anwenden der Betriebsart.");
    } finally {
      setArtApplying(null);
    }
  }

  if (loading) return <p className="text-gray-400 mt-8 text-sm">Lade Einstellungen…</p>;

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/einstellungen" className="hover:text-green-700">Einstellungen</Link>
        <span>›</span>
        <span className="text-gray-800 font-medium">Module</span>
      </div>

      <h1 className="text-2xl font-bold mb-1">Betriebsart & Module</h1>
      <p className="text-sm text-gray-500 mb-6">
        Die Betriebsart legt fest, welche Funktionsbereiche dieser Betrieb überhaupt braucht — sie blendet nicht
        benötigte Menüpunkte, Einstellungen und Dashboard-Kacheln aus und passt den Zuschnitt der Navigation an.
        Darunter lässt sich alles einzeln nachjustieren.
      </p>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
      )}

      {/* ─── Betriebsart ─────────────────────────────────────────────── */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-gray-700 mb-1">Betriebsart</h2>
        <p className="text-xs text-gray-400 mb-3">
          Setzt die passenden Module auf einen Schlag. Die Einzelschalter darunter bleiben danach frei änderbar.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {BETRIEBSARTEN.map((art) => {
            const aktiv = betriebsart === art.key;
            return (
              <button
                key={art.key}
                type="button"
                onClick={() => waehleBetriebsart(art.key)}
                disabled={artApplying !== null}
                className={`text-left p-4 rounded-xl border-2 transition-all disabled:opacity-60 ${
                  aktiv
                    ? "border-green-600 bg-green-50 shadow-sm"
                    : "border-gray-200 bg-white hover:border-green-300 hover:shadow-sm"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl leading-none">{art.icon}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 flex items-center gap-2 flex-wrap">
                      {art.label}
                      {aktiv && (
                        <span className="text-[11px] font-medium text-green-700 bg-green-100 rounded-full px-2 py-0.5">
                          aktiv
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{art.beschreibung}</p>
                    {artApplying === art.key && <p className="text-xs text-green-700 mt-1.5">Wird angewendet…</p>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Bereiche ────────────────────────────────────────────────── */}
      <form onSubmit={handleSave}>
        <h2 className="text-sm font-semibold text-gray-700 mb-1">Funktionsbereiche</h2>
        <p className="text-xs text-gray-400 mb-3">
          Ein Bereich schaltet alle enthaltenen Funktionen gemeinsam. „Details“ öffnet die einzelnen Module,
          falls davon nur ein Teil gebraucht wird.
        </p>

        <div className="space-y-3">
          {MODUL_BEREICHE.map((bereich) => {
            const anzahlAn = bereich.module.filter((k) => form[k]).length;
            const allesAn = anzahlAn === bereich.module.length;
            const teilweise = anzahlAn > 0 && !allesAn;
            const offen = offeneBereiche.has(bereich.key);
            return (
              <div
                key={bereich.key}
                className={`bg-white rounded-xl shadow-sm border overflow-hidden ${
                  anzahlAn > 0 ? "border-gray-200" : "border-gray-200 bg-gray-50/50"
                }`}
              >
                <div className="flex items-start gap-4 px-5 py-4">
                  <Schalter
                    an={anzahlAn > 0}
                    onClick={() => toggleBereich(bereich.module, !allesAn)}
                    label={`${bereich.label} ${allesAn ? "deaktivieren" : "aktivieren"}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium flex items-center gap-2 flex-wrap ${anzahlAn > 0 ? "text-gray-800" : "text-gray-500"}`}>
                      <span>{bereich.icon}</span>
                      {bereich.label}
                      {teilweise && (
                        <span className="text-[11px] font-medium text-amber-700 bg-amber-100 rounded-full px-2 py-0.5">
                          teilweise ({anzahlAn} von {bereich.module.length})
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{bereich.beschreibung}</p>
                    {bereich.module.length > 1 && (
                      <button
                        type="button"
                        onClick={() => toggleDetails(bereich.key)}
                        className="mt-2 text-xs text-green-700 hover:text-green-800 font-medium"
                      >
                        {offen ? "▾ Details ausblenden" : "▸ Details"}
                      </button>
                    )}
                  </div>
                </div>

                {offen && bereich.module.length > 1 && (
                  <div className="border-t border-gray-100 bg-gray-50/60 divide-y divide-gray-100">
                    {bereich.module.map((k) => (
                      <div key={k} className="flex items-start gap-4 px-5 py-3 pl-8">
                        <Schalter
                          an={form[k]}
                          onClick={() => toggleModul(k)}
                          label={`${MODUL_LABELS[k].label} ${form[k] ? "deaktivieren" : "aktivieren"}`}
                        />
                        <div className="min-w-0">
                          <p className={`text-sm ${form[k] ? "text-gray-800" : "text-gray-500"}`}>{MODUL_LABELS[k].label}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{MODUL_LABELS[k].beschreibung}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex justify-end mt-6">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 text-sm bg-green-700 hover:bg-green-800 text-white rounded-lg font-medium transition-colors disabled:opacity-60 min-w-[160px]"
          >
            {saving ? "Speichern…" : saved ? "✓ Gespeichert" : "Änderungen speichern"}
          </button>
        </div>
      </form>

      <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
        <b>Hinweis:</b> Deaktivierte Bereiche verschwinden aus Navigation, Einstellungen, Dashboard und Hilfe; die
        zugehörigen Schnittstellen sind zusätzlich serverseitig gesperrt. Bereits erfasste Daten bleiben erhalten und
        tauchen nach dem Wiedereinschalten unverändert auf.
      </div>
    </div>
  );
}
