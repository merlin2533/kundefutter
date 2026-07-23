"use client";

import Link from "next/link";
import { useEffect, useState, useCallback, useRef } from "react";

// ─── Typen ───────────────────────────────────────────────────────────────────

type KiStatistik = {
  gesamt: {
    requests: number;
    tokensIn: number;
    tokensOut: number;
    kostenCent: number;
    fehler: number;
  };
  proFeature: Record<
    string,
    { requests: number; tokensIn: number; tokensOut: number; kostenCent: number }
  >;
  letzteRequests: {
    id: number;
    zeitpunkt: string;
    provider: string;
    modell: string;
    feature: string;
    tokensIn: number;
    tokensOut: number;
    kostenCent: number;
    erfolgreich: boolean;
    fehler: string | null;
  }[];
};

// ─── Modell-Vorschläge ───────────────────────────────────────────────────────

const LANGUAGE_MODELS = [
  { value: "mistral-large-latest", label: "Mistral Large (empfohlen)" },
  { value: "mistral-medium-3",     label: "Mistral Medium 3" },
  { value: "mistral-small-latest", label: "Mistral Small" },
  { value: "open-mistral-nemo",    label: "Open Mistral Nemo (Open Source)" },
];

const TRANSCRIPTION_MODELS = [
  { value: "voxtral-mini-latest", label: "Voxtral Mini (empfohlen)" },
];

const DEFAULT_MODELLS = {
  language: "mistral-large-latest",
  transcription: "voxtral-mini-latest",
  tts: "",
};

const FEATURE_LABELS: Record<string, string> = {
  wareneingang: "Wareneingang",
  lieferung: "Lieferung",
  crm: "CRM Notiz",
  inhaltsstoffe: "Inhaltsstoffe",
  beleg: "Beleg-OCR",
  bodenprobe: "Bodenprobe",
  sachkundenachweis: "Sachkunde",
  schlaegte: "Schläge",
  sortenversuch: "Sortenversuch",
  visitenkarte: "Visitenkarte",
  mahnungstext: "Mahnung",
  belegtyp: "Beleg-Klassifizierung",
  router: "Dokument-Erkennung",
  sprachmemo: "Sprachmemo (Diktat)",
  tts: "Text zu Sprache",
};

const PROMPT_FEATURES = [
  { key: "wareneingang",       label: "Wareneingang",           desc: "Analyse von Lieferschein-Bildern" },
  { key: "lieferung",          label: "Lieferung",              desc: "Analyse von Bestellungen/Aufträgen" },
  { key: "crm",                label: "CRM Notiz",              desc: "CRM-Aktivitäten aus Text/Bild" },
  { key: "beleg",               label: "Beleg-OCR",              desc: "Eingangsrechnungen / Kassenbelege" },
  { key: "bodenprobe",          label: "Bodenprobe",             desc: "Laborberichte Bodenuntersuchung" },
  { key: "sachkundenachweis",   label: "Sachkunde",              desc: "PSM-/Düngerschulungs-/Spritzgerätekontroll-Zertifikate" },
  { key: "schlaegte",           label: "Schläge",                desc: "Agrarflächen-Antrags-PDFs" },
  { key: "mahnungstext",        label: "Mahnung",                desc: "Mahntexte generieren" },
  { key: "belegtyp",            label: "Beleg-Klassifizierung",  desc: "Dokumenttyp-Erkennung (Erkennung/Router)" },
  { key: "sortenversuch",       label: "Sortenversuch",          desc: "Sortenversuchs-Auswertungen" },
  { key: "visitenkarte",        label: "Visitenkarte",           desc: "Kontaktdaten aus Visitenkarten" },
  { key: "inhaltsstoffe",       label: "Inhaltsstoffe",          desc: "Produktzusammensetzung recherchieren" },
];

// ─── Komponente ──────────────────────────────────────────────────────────────

export default function KiEinstellungenPage() {
  // API-Schlüssel
  const [mistralKey, setMistralKey] = useState("");
  const [showMistralKey, setShowMistralKey] = useState(false);
  const touchedKeys = useRef<Set<string>>(new Set());

  // Modell-Konfiguration
  const [languageModell, setLanguageModell] = useState(DEFAULT_MODELLS.language);
  const [transcriptionModell, setTranscriptionModell] = useState(DEFAULT_MODELLS.transcription);
  const [ttsModell, setTtsModell] = useState(DEFAULT_MODELLS.tts);
  const [ttsVoice, setTtsVoice] = useState("");

  // Prompt-Verwaltung
  const [prompts, setPrompts] = useState<Record<string, string>>({});
  const [promptsExpanded, setPromptsExpanded] = useState<string | null>(null);
  const [savingPrompt, setSavingPrompt] = useState<string | null>(null);
  const [promptSaved, setPromptSaved] = useState<string | null>(null);

  // UI-Zustand
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null);

  // Statistik
  const [statistik, setStatistik] = useState<KiStatistik | null>(null);
  const [statistikLoading, setStatistikLoading] = useState(true);
  const [statistikError, setStatistikError] = useState<string | null>(null);

  // ─── Einstellungen laden ───────────────────────────────────────────────────

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/einstellungen?prefix=ki.");
      if (!res.ok) throw new Error();
      const data = await res.json();

      if (data["ki.mistral_key"]) setMistralKey(data["ki.mistral_key"]);
      setLanguageModell(data["ki.modell_language"] || DEFAULT_MODELLS.language);
      setTranscriptionModell(data["ki.modell_transcription"] || DEFAULT_MODELLS.transcription);
      setTtsModell(data["ki.modell_tts"] || DEFAULT_MODELLS.tts);
      if (data["ki.tts_voice"]) setTtsVoice(data["ki.tts_voice"]);

      const loadedPrompts: Record<string, string> = {};
      for (const f of PROMPT_FEATURES) {
        const val = data[`ki.prompt.${f.key}`];
        if (val) loadedPrompts[f.key] = val;
      }
      setPrompts(loadedPrompts);
    } catch {
      setError("Fehler beim Laden der KI-Einstellungen.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  useEffect(() => {
    async function fetchStatistik() {
      try {
        const res = await fetch("/api/ki/statistik?tage=30");
        if (!res.ok) throw new Error();
        setStatistik(await res.json());
      } catch {
        setStatistikError("Statistik konnte nicht geladen werden.");
      } finally {
        setStatistikLoading(false);
      }
    }
    fetchStatistik();
  }, []);

  // ─── Speichern ────────────────────────────────────────────────────────────

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const settings: Record<string, string> = {
        "ki.modell_language":      languageModell,
        "ki.modell_transcription": transcriptionModell,
        "ki.modell_tts":           ttsModell,
        "ki.tts_voice":            ttsVoice,
        ...(touchedKeys.current.has("ki.mistral_key") ? { "ki.mistral_key": mistralKey } : {}),
      };

      for (const [key, value] of Object.entries(settings)) {
        const res = await fetch("/api/einstellungen", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, value }),
        });
        if (!res.ok) throw new Error(`Fehler beim Speichern von ${key}`);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Speichern.");
    } finally {
      setSaving(false);
    }
  }

  // ─── Verbindungstest ──────────────────────────────────────────────────────

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/ki/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modell: languageModell, mistralKey }),
      });
      const data = res.ok ? await res.json() : { ok: false, error: "Serveranfrage fehlgeschlagen" };
      setTestResult(data);
    } catch {
      setTestResult({ ok: false, error: "Netzwerkfehler" });
    } finally {
      setTesting(false);
    }
  }

  // ─── Prompt-Verwaltung ────────────────────────────────────────────────────

  async function savePrompt(featureKey: string) {
    setSavingPrompt(featureKey);
    try {
      const res = await fetch("/api/einstellungen", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: `ki.prompt.${featureKey}`, value: prompts[featureKey] ?? "" }),
      });
      if (!res.ok) throw new Error("Speichern fehlgeschlagen");
      setPromptSaved(featureKey);
      setTimeout(() => setPromptSaved(null), 2000);
    } catch {
      setError(`Fehler beim Speichern des ${featureKey}-Prompts.`);
    } finally {
      setSavingPrompt(null);
    }
  }

  async function resetPrompt(featureKey: string) {
    setPrompts(p => { const n = { ...p }; delete n[featureKey]; return n; });
    try {
      const res = await fetch("/api/einstellungen", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: `ki.prompt.${featureKey}`, value: "" }),
      });
      if (!res.ok) throw new Error("Zurücksetzen fehlgeschlagen");
      setPromptSaved(featureKey);
      setTimeout(() => setPromptSaved(null), 2000);
    } catch {
      setError(`Fehler beim Zurücksetzen des ${featureKey}-Prompts.`);
    }
  }

  // ─── Kategorie-Helper ─────────────────────────────────────────────────────

  function ModelField({
    title,
    subtitle,
    value,
    onChange,
    suggestions,
    placeholder,
  }: {
    title: string;
    subtitle: string;
    value: string;
    onChange: (v: string) => void;
    suggestions: { value: string; label: string }[];
    placeholder: string;
  }) {
    const listId = `modell-list-${title.replace(/\s+/g, "-").toLowerCase()}`;
    return (
      <div className="border border-gray-200 rounded-xl p-5 space-y-3">
        <div>
          <h3 className="font-semibold text-gray-800">{title}</h3>
          <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
        </div>
        <div>
          <input
            list={listId}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <datalist id={listId}>
            {suggestions.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </datalist>
          {suggestions.length > 0 && (
            <p className="text-xs text-gray-400 mt-1">Vorschlag auswählen oder eigene Modell-ID eintragen.</p>
          )}
        </div>
      </div>
    );
  }

  if (loading) {
    return <p className="text-gray-400 mt-8 text-sm">Lade KI-Einstellungen...</p>;
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/einstellungen" className="hover:text-green-700">Einstellungen</Link>
        <span>&rsaquo;</span>
        <span className="text-gray-800 font-medium">KI / AI</span>
      </div>

      <h1 className="text-2xl font-bold mb-1">KI-Einstellungen</h1>
      <p className="text-sm text-gray-500 mb-6">
        Alle KI-Funktionen laufen über Mistral AI — ein zentraler Service für Texterkennung,
        Dokument-OCR, Diktieren (Voxtral) und optional Sprachausgabe.
      </p>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-8">

        {/* ── API-Schlüssel ─────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">API-Schlüssel</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mistral API-Key
              <span className="ml-2 text-xs text-gray-400 font-normal">console.mistral.ai</span>
            </label>
            <div className="flex gap-2">
              <input
                type={showMistralKey ? "text" : "password"}
                value={mistralKey}
                onChange={(e) => { setMistralKey(e.target.value); touchedKeys.current.add("ki.mistral_key"); }}
                placeholder="..."
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <button type="button" onClick={() => setShowMistralKey(!showMistralKey)}
                className="px-3 py-2 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap">
                {showMistralKey ? "Verbergen" : "Anzeigen"}
              </button>
            </div>
          </div>
        </div>

        {/* ── Modell-Konfiguration je Aufgabentyp ──────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-1">Modell-Konfiguration</h2>
          <p className="text-sm text-gray-500 mb-5">
            Wähle je Aufgabentyp das gewünschte Mistral-Modell.
          </p>

          <div className="space-y-5">
            <ModelField
              title="Sprachmodell / Chat"
              subtitle="Texterkennung, CRM-Notizen, Mahnungen, Inhaltsstoffe, JSON-Strukturierung nach OCR"
              value={languageModell}
              onChange={setLanguageModell}
              suggestions={LANGUAGE_MODELS}
              placeholder={DEFAULT_MODELLS.language}
            />

            <div className="border border-gray-200 rounded-xl p-5">
              <h3 className="font-semibold text-gray-800">Erkennung / OCR</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Bilderkennung, Lieferscheine, Bodenproben, Sachkundenachweise, Visitenkarten, PDF-Analyse
              </p>
              <p className="text-sm text-gray-600 mt-3 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                Läuft immer über das dedizierte Mistral-OCR-Modell (<code className="font-mono text-xs">mistral-ocr-latest</code>).
                Das Sprachmodell oben strukturiert die extrahierten Daten anschließend als JSON.
              </p>
            </div>

            <ModelField
              title="Diktieren / Transkription"
              subtitle="Spracheingabe → Text (CRM-Notizen, Sprachmemos) via Mistral Voxtral"
              value={transcriptionModell}
              onChange={setTranscriptionModell}
              suggestions={TRANSCRIPTION_MODELS}
              placeholder={DEFAULT_MODELLS.transcription}
            />

            <ModelField
              title="Text zu Sprache (TTS)"
              subtitle="Sprachausgabe von Texten über Mistral"
              value={ttsModell}
              onChange={setTtsModell}
              suggestions={[]}
              placeholder="Modell-ID eingeben (optional — Mistral wählt sonst automatisch)"
            />

            <div className="border border-gray-200 rounded-xl p-5">
              <h3 className="font-semibold text-gray-800">Stimme (TTS)</h3>
              <p className="text-xs text-gray-400 mt-0.5">Stimmen-ID für die Mistral-Sprachausgabe (optional)</p>
              <input
                value={ttsVoice}
                onChange={(e) => setTtsVoice(e.target.value)}
                placeholder="z. B. Stimmen-ID aus der Mistral-Dokumentation — leer = Standardstimme"
                className="mt-3 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>
        </div>

        {/* ── Verbindungstest ───────────────────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Verbindungstest</h2>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleTest}
              disabled={testing}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {testing ? "Teste..." : "Mistral testen"}
            </button>
            {testResult && (
              <span className={`text-xs px-2 py-1 rounded-lg border ${
                testResult.ok
                  ? "bg-green-50 border-green-200 text-green-700"
                  : "bg-red-50 border-red-200 text-red-600"
              }`}>
                {testResult.ok ? "OK" : testResult.error || "Fehler"}
              </span>
            )}
          </div>
        </div>

        {/* ── Speichern ─────────────────────────────────────────────────── */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-60"
          >
            {saving ? "Speichern..." : saved ? "Gespeichert!" : "Speichern"}
          </button>
        </div>
      </form>

      {/* ── Prompt-Verwaltung ─────────────────────────────────────────── */}
      <div className="mt-10">
        <h2 className="text-xl font-bold text-gray-800 mb-2">Prompt-Verwaltung</h2>
        <p className="text-sm text-gray-500 mb-4">
          System-Prompts für KI-Funktionen anpassen. Leere Felder verwenden den Standard-Prompt.
        </p>
        <div className="space-y-3">
          {PROMPT_FEATURES.map((f) => (
            <div key={f.key} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setPromptsExpanded(promptsExpanded === f.key ? null : f.key)}
                className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="text-left">
                  <span className="font-medium text-gray-800">{f.label}</span>
                  <span className="text-xs text-gray-400 ml-2">{f.desc}</span>
                  {prompts[f.key] && (
                    <span className="ml-2 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Angepasst</span>
                  )}
                </div>
                <span className="text-gray-400 text-sm">{promptsExpanded === f.key ? "▲" : "▼"}</span>
              </button>
              {promptsExpanded === f.key && (
                <div className="px-5 pb-4 border-t border-gray-100 pt-3">
                  <textarea
                    rows={8}
                    value={prompts[f.key] ?? ""}
                    onChange={(e) => setPrompts({ ...prompts, [f.key]: e.target.value })}
                    placeholder="Leer = Standard-Prompt wird verwendet"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500 resize-y"
                  />
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => savePrompt(f.key)}
                      disabled={savingPrompt === f.key}
                      className="px-4 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-60"
                    >
                      {savingPrompt === f.key ? "Speichern..." : promptSaved === f.key ? "Gespeichert!" : "Prompt speichern"}
                    </button>
                    <button
                      type="button"
                      onClick={() => resetPrompt(f.key)}
                      className="px-4 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-600"
                    >
                      Zurücksetzen
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Nutzungsstatistik ─────────────────────────────────────────── */}
      <div className="mt-10">
        <h2 className="text-xl font-bold text-gray-800 mb-5">Nutzungsstatistik (letzte 30 Tage)</h2>

        {statistikLoading && <p className="text-sm text-gray-400">Lade Statistik...</p>}
        {statistikError && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {statistikError}
          </div>
        )}

        {statistik && (
          <div className="space-y-8">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="text-sm text-gray-500">Requests gesamt</div>
                <div className="text-2xl font-bold text-gray-800">{statistik.gesamt.requests}</div>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="text-sm text-gray-500">Tokens gesamt</div>
                <div className="text-2xl font-bold text-gray-800">
                  {(statistik.gesamt.tokensIn + statistik.gesamt.tokensOut).toLocaleString("de-DE")}
                </div>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="text-sm text-gray-500">Geschätzte Kosten</div>
                <div className="text-2xl font-bold text-gray-800">
                  {(statistik.gesamt.kostenCent / 100).toLocaleString("de-DE", {
                    style: "currency",
                    currency: "USD",
                    minimumFractionDigits: 2,
                  })}
                </div>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="text-sm text-gray-500">Fehlerrate</div>
                <div className="text-2xl font-bold text-gray-800">
                  {statistik.gesamt.requests > 0
                    ? ((statistik.gesamt.fehler / statistik.gesamt.requests) * 100).toFixed(1)
                    : "0,0"}{" %"}
                </div>
              </div>
            </div>

            {Object.keys(statistik.proFeature).length > 0 && (
              <div>
                <h3 className="text-base font-semibold text-gray-700 mb-3">Nach Feature</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border border-gray-200 rounded-xl overflow-hidden">
                    <thead>
                      <tr className="bg-gray-50 text-left text-gray-600">
                        <th className="px-4 py-2 font-medium">Feature</th>
                        <th className="px-4 py-2 font-medium text-right">Requests</th>
                        <th className="px-4 py-2 font-medium text-right">Tokens</th>
                        <th className="px-4 py-2 font-medium text-right">Kosten</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {Object.entries(statistik.proFeature).map(([feature, data]) => (
                        <tr key={feature} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-gray-800">{FEATURE_LABELS[feature] ?? feature}</td>
                          <td className="px-4 py-2 text-right text-gray-700">{data.requests}</td>
                          <td className="px-4 py-2 text-right text-gray-700">
                            {(data.tokensIn + data.tokensOut).toLocaleString("de-DE")}
                          </td>
                          <td className="px-4 py-2 text-right text-gray-700">
                            {(data.kostenCent / 100).toLocaleString("de-DE", {
                              style: "currency",
                              currency: "USD",
                              minimumFractionDigits: 2,
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {statistik.letzteRequests.length > 0 && (
              <div>
                <h3 className="text-base font-semibold text-gray-700 mb-3">Letzte Anfragen</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border border-gray-200 rounded-xl overflow-hidden">
                    <thead>
                      <tr className="bg-gray-50 text-left text-gray-600">
                        <th className="px-4 py-2 font-medium">Zeitpunkt</th>
                        <th className="px-4 py-2 font-medium">Feature</th>
                        <th className="hidden sm:table-cell px-4 py-2 font-medium">Provider</th>
                        <th className="hidden sm:table-cell px-4 py-2 font-medium">Modell</th>
                        <th className="hidden sm:table-cell px-4 py-2 font-medium text-right">Tokens</th>
                        <th className="hidden sm:table-cell px-4 py-2 font-medium text-right">Kosten</th>
                        <th className="px-4 py-2 font-medium text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {statistik.letzteRequests.slice(0, 20).map((req) => (
                        <tr key={req.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-gray-700 whitespace-nowrap">
                            {new Date(req.zeitpunkt).toLocaleString("de-DE", {
                              day: "2-digit", month: "2-digit", year: "numeric",
                              hour: "2-digit", minute: "2-digit",
                            })}
                          </td>
                          <td className="px-4 py-2 text-gray-800">{FEATURE_LABELS[req.feature] ?? req.feature}</td>
                          <td className="hidden sm:table-cell px-4 py-2 text-gray-600 capitalize">{req.provider}</td>
                          <td className="hidden sm:table-cell px-4 py-2 text-gray-600">{req.modell}</td>
                          <td className="hidden sm:table-cell px-4 py-2 text-right text-gray-600">
                            {(req.tokensIn + req.tokensOut).toLocaleString("de-DE")}
                          </td>
                          <td className="hidden sm:table-cell px-4 py-2 text-right text-gray-600">
                            {(req.kostenCent / 100).toLocaleString("de-DE", {
                              style: "currency",
                              currency: "USD",
                              minimumFractionDigits: 2,
                            })}
                          </td>
                          <td className="px-4 py-2 text-center">
                            {req.erfolgreich ? (
                              <span className="text-green-600 font-bold">&#10003;</span>
                            ) : (
                              <span className="text-red-500 font-bold" title={req.fehler ?? undefined}>&#10007;</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
