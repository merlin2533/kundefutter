"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import * as Sentry from "@sentry/nextjs";
import { MODUL_PRESETS } from "@/lib/modul-presets";

interface ModulToggle {
  key: string;
  label: string;
  description: string;
  defaultAktiv: boolean;
}

const MODULE_LIST: ModulToggle[] = [
  { key: "modul.sortenversuche", label: "Sortenversuche", description: "Verwaltung von Feldversuchen und Sortenvergleichen (Ertrag, Feuchte, Protein)", defaultAktiv: true },
  { key: "modul.rationsberechnung", label: "Rationsberechnung (Tier)", description: "Futterrationsberechnung für Rinder, Schweine, Geflügel, Pferde u.a.", defaultAktiv: true },
  { key: "modul.bodenproben", label: "Bodenproben & Düngung", description: "Bodenanalysen, Albrecht-Analyse, Düngebedarfsermittlung (DüV) und Nährstoffbilanz", defaultAktiv: true },
  { key: "modul.psm_ausbringung", label: "PSM-Ausbringung", description: "Pflanzenschutz-Dokumentation und Spritzfenster-Prognose", defaultAktiv: true },
  { key: "modul.erzeugerabrechnung", label: "Erzeugerabrechnung", description: "Erfassung und Abrechnung von Getreide-/Rohstoffanlieferungen", defaultAktiv: true },
  { key: "modul.tourenplanung", label: "Tourenplanung", description: "Routenoptimierung, Tour-Übersicht und Fahrer-Cockpit", defaultAktiv: true },
  { key: "modul.kontrakte", label: "Kontrakte", description: "Rahmenverträge mit Mengenabrufen und Lieferverfolgung", defaultAktiv: true },
  { key: "modul.kampagnen", label: "Kampagnen", description: "Marketing-Kampagnen mit Zielgruppen-Kriterien und Rabatten", defaultAktiv: true },
  { key: "modul.fruehbezug", label: "Frühbezug / Vorbestellungen", description: "Saison-Vorbestellungen mit Frühbezugs-Rabattstaffeln", defaultAktiv: true },
  { key: "modul.marktpreise", label: "Marktpreise (Eurostat)", description: "Agrarpreisindizes und MATIF-Futures aus Eurostat-Daten", defaultAktiv: true },
  { key: "modul.reklamationen", label: "Reklamationen", description: "Beschwerdemanagement mit Prioritäten, Status und Lösungsdokumentation", defaultAktiv: true },
  { key: "modul.personal", label: "Personal & Lohn", description: "Mitarbeiterverwaltung, Arbeitsstunden, Urlaubsanträge und Lohnabrechnung", defaultAktiv: true },
  { key: "modul.agrarantraege", label: "Agraranträge (AFIG)", description: "Import und Auswertung der Agrarförderungs-Daten (agrarzahlungen.de)", defaultAktiv: true },
  { key: "modul.mqtt", label: "MQTT-Automatisierung", description: "IoT-Regeln für automatische Verarbeitung eingehender MQTT-Nachrichten", defaultAktiv: false },
  { key: "modul.nextcloud", label: "Nextcloud", description: "Dokumentensynchronisation für Kunden, Artikel und Buchhaltung in Nextcloud", defaultAktiv: false },
  { key: "modul.eierhandel", label: "Eierhandel", description: "Eier-Sortierprotokoll, Güte-/Gewichtsklassen, KAT-Meldung und Meldepflichten-Tracker", defaultAktiv: false },
];

export default function ModuleEinstellungenPage() {
  const [form, setForm] = useState<Record<string, boolean>>(() => {
    const defaults: Record<string, boolean> = {};
    MODULE_LIST.forEach((m) => { defaults[m.key] = m.defaultAktiv; });
    return defaults;
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [presetApplying, setPresetApplying] = useState<string | null>(null);
  const [presetApplied, setPresetApplied] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/einstellungen?prefix=modul.");
      if (!res.ok) throw new Error();
      const data: Record<string, string> = await res.json();
      setForm((prev) => {
        const updated = { ...prev };
        for (const [key, val] of Object.entries(data)) {
          updated[key] = val !== "false" && val !== "0";
        }
        return updated;
      });
    } catch (err) {
      Sentry.captureException(err);
      setError("Fehler beim Laden der Einstellungen.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await Promise.all(
        MODULE_LIST.map((m) =>
          fetch("/api/einstellungen", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key: m.key, value: form[m.key] ? "true" : "false" }),
          })
        )
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      Sentry.captureException(err);
      setError("Fehler beim Speichern.");
    } finally {
      setSaving(false);
    }
  }

  function toggle(key: string) {
    setForm((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function applyPreset(presetKey: string) {
    const preset = MODUL_PRESETS.find((p) => p.key === presetKey);
    if (!preset) return;
    setPresetApplying(presetKey);
    setError(null);
    try {
      const updated: Record<string, boolean> = { ...form };
      const writes = Object.entries(preset.config).map(([k, v]) => {
        const settingKey = `modul.${k}`;
        updated[settingKey] = !!v;
        return fetch("/api/einstellungen", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: settingKey, value: v ? "true" : "false" }),
        });
      });
      if (preset.artikelkategorien) {
        writes.push(
          fetch("/api/einstellungen", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key: "system.artikelkategorien", value: JSON.stringify(preset.artikelkategorien) }),
          })
        );
      }
      await Promise.all(writes);
      setForm(updated);
      setPresetApplied(presetKey);
      setTimeout(() => setPresetApplied(null), 3000);
    } catch (err) {
      Sentry.captureException(err);
      setError("Fehler beim Anwenden des Presets.");
    } finally {
      setPresetApplying(null);
    }
  }

  if (loading) return <p className="text-gray-400 mt-8 text-sm">Lade Einstellungen…</p>;

  const aktiv = MODULE_LIST.filter((m) => form[m.key]);
  const inaktiv = MODULE_LIST.filter((m) => !form[m.key]);

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/einstellungen" className="hover:text-green-700">Einstellungen</Link>
        <span>›</span>
        <span className="text-gray-800 font-medium">Module</span>
      </div>

      <h1 className="text-2xl font-bold mb-1">Module</h1>
      <p className="text-sm text-gray-500 mb-6">
        Aktiviere oder deaktiviere Funktionsbereiche der Anwendung. Deaktivierte Module werden aus der Navigation ausgeblendet.
        Alle Module sind standardmäßig aktiviert – deaktiviere nur, was für diesen Betrieb nicht relevant ist.
      </p>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
      )}

      <div className="mb-6 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-700">Branchen-Presets</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Setzt mehrere Module (und ggf. Artikelkategorien) auf einen Schlag. Einzel-Toggles bleiben danach weiter frei editierbar.
          </p>
        </div>
        <div className="divide-y divide-gray-100">
          {MODUL_PRESETS.map((preset) => (
            <div key={preset.key} className="flex items-start justify-between gap-4 px-5 py-4">
              <div>
                <p className="text-sm font-medium text-gray-800">{preset.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{preset.beschreibung}</p>
              </div>
              <button
                type="button"
                onClick={() => applyPreset(preset.key)}
                disabled={presetApplying !== null}
                className="shrink-0 px-4 py-2 text-xs font-medium rounded-lg border border-green-600 text-green-700 hover:bg-green-50 transition-colors disabled:opacity-60 min-w-[110px]"
              >
                {presetApplying === preset.key ? "Anwenden…" : presetApplied === preset.key ? "✓ Angewendet" : "Anwenden"}
              </button>
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-700">Aktive Module ({aktiv.length})</h2>
              <p className="text-xs text-gray-400 mt-0.5">Diese Funktionsbereiche sind sichtbar und nutzbar.</p>
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            {aktiv.map((m) => (
              <div key={m.key} className="flex items-start gap-4 px-5 py-4">
                <button
                  type="button"
                  onClick={() => toggle(m.key)}
                  className="mt-0.5 flex-shrink-0 w-10 h-6 rounded-full bg-green-600 relative transition-colors"
                  aria-label={`${m.label} deaktivieren`}
                >
                  <span className="absolute right-1 top-1 w-4 h-4 rounded-full bg-white shadow transition-transform" />
                </button>
                <div>
                  <p className="text-sm font-medium text-gray-800">{m.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{m.description}</p>
                </div>
              </div>
            ))}
            {aktiv.length === 0 && (
              <p className="px-5 py-4 text-sm text-gray-400 italic">Keine Module aktiv.</p>
            )}
          </div>
        </div>

        {inaktiv.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
              <h2 className="text-sm font-semibold text-gray-700">Inaktive Module ({inaktiv.length})</h2>
              <p className="text-xs text-gray-400 mt-0.5">Diese Module sind ausgeblendet und nicht nutzbar.</p>
            </div>
            <div className="divide-y divide-gray-100">
              {inaktiv.map((m) => (
                <div key={m.key} className="flex items-start gap-4 px-5 py-4 bg-gray-50/50">
                  <button
                    type="button"
                    onClick={() => toggle(m.key)}
                    className="mt-0.5 flex-shrink-0 w-10 h-6 rounded-full bg-gray-300 relative transition-colors"
                    aria-label={`${m.label} aktivieren`}
                  >
                    <span className="absolute left-1 top-1 w-4 h-4 rounded-full bg-white shadow transition-transform" />
                  </button>
                  <div>
                    <p className="text-sm font-medium text-gray-500">{m.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{m.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end">
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
        <b>Hinweis:</b> Änderungen werden nach dem nächsten Seitenladen in der Navigation wirksam. Bereits geöffnete Seiten deaktivierter Module bleiben zugänglich bis zum nächsten Neustart.
      </div>
    </div>
  );
}
