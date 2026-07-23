"use client";

import Link from "next/link";
import { useEffect, useState, useCallback, useRef } from "react";
import type { AiProvider, ModelCategory } from "@/lib/ai";

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

type CategoryConfig = {
  provider: AiProvider;
  modells: Record<AiProvider, string>;
};

// ─── Modell-Listen ───────────────────────────────────────────────────────────

const OPENAI_LANGUAGE_MODELS = [
  { value: "gpt-4.1",      label: "GPT-4.1" },
  { value: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
  { value: "gpt-4.1-nano", label: "GPT-4.1 Nano" },
  { value: "gpt-4o",       label: "GPT-4o" },
  { value: "gpt-4o-mini",  label: "GPT-4o Mini" },
  { value: "gpt-5",        label: "GPT-5" },
  { value: "gpt-5-mini",   label: "GPT-5 Mini" },
  { value: "gpt-5-nano",   label: "GPT-5 Nano" },
];

const OPENAI_OCR_MODELS = [
  { value: "gpt-4o",       label: "GPT-4o (empfohlen)" },
  { value: "gpt-4.1",      label: "GPT-4.1" },
  { value: "gpt-5",        label: "GPT-5" },
];

const OPENAI_TTS_MODELS = [
  { value: "tts-1",    label: "TTS-1 (schnell)" },
  { value: "tts-1-hd", label: "TTS-1 HD (hohe Qualität)" },
];

const ANTHROPIC_LANGUAGE_MODELS = [
  { value: "claude-sonnet-4-6",         label: "Claude Sonnet 4.6" },
  { value: "claude-opus-4-8",           label: "Claude Opus 4.8" },
  { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
];

const ANTHROPIC_OCR_MODELS = [
  { value: "claude-sonnet-4-6",         label: "Claude Sonnet 4.6 (empfohlen)" },
  { value: "claude-opus-4-8",           label: "Claude Opus 4.8" },
  { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
];

const MISTRAL_LANGUAGE_MODELS = [
  { value: "mistral-large-latest", label: "Mistral Large (empfohlen)" },
  { value: "mistral-medium-3",     label: "Mistral Medium 3" },
  { value: "mistral-small-latest", label: "Mistral Small" },
  { value: "open-mistral-nemo",    label: "Open Mistral Nemo (Open Source)" },
  { value: "codestral-latest",     label: "Codestral" },
];

const MISTRAL_OCR_MODELS = [
  { value: "pixtral-large-2411", label: "Pixtral Large (empfohlen)" },
  { value: "pixtral-12b-2409",   label: "Pixtral 12B" },
  { value: "mistral-large-latest", label: "Mistral Large (Vision)" },
];

function getModelList(provider: AiProvider, category: ModelCategory) {
  if (provider === "openai") {
    return category === "tts" ? OPENAI_TTS_MODELS
      : category === "ocr" ? OPENAI_OCR_MODELS
      : OPENAI_LANGUAGE_MODELS;
  }
  if (provider === "anthropic") {
    return category === "ocr" ? ANTHROPIC_OCR_MODELS : ANTHROPIC_LANGUAGE_MODELS;
  }
  // mistral
  return category === "ocr" ? MISTRAL_OCR_MODELS : MISTRAL_LANGUAGE_MODELS;
}

const DEFAULT_MODELLS: Record<AiProvider, Record<ModelCategory, string>> = {
  openai:    { language: "gpt-4.1",             ocr: "gpt-4o",             tts: "tts-1" },
  anthropic: { language: "claude-sonnet-4-6",   ocr: "claude-sonnet-4-6",  tts: "" },
  mistral:   { language: "mistral-large-latest", ocr: "pixtral-large-2411", tts: "" },
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
  tts: "Text zu Sprache",
  bankabgleich: "Bankabgleich",
};

const PROMPT_FEATURES = [
  { key: "wareneingang", label: "Wareneingang", desc: "Analyse von Lieferschein-Bildern" },
  { key: "lieferung",    label: "Lieferung",    desc: "Analyse von Bestellungen/Aufträgen" },
  { key: "crm",          label: "CRM Notiz",    desc: "CRM-Aktivitäten aus Text/Bild" },
  { key: "inhaltsstoffe",label: "Inhaltsstoffe",desc: "Produktzusammensetzung recherchieren" },
  { key: "bankabgleich", label: "Bankabgleich",  desc: "Zuordnungsvorschläge für Restfälle nach dem automatischen Abgleich" },
];

const TTS_VOICES = [
  { value: "nova",    label: "Nova (weiblich, warm)" },
  { value: "alloy",   label: "Alloy (neutral)" },
  { value: "echo",    label: "Echo (männlich)" },
  { value: "fable",   label: "Fable (britisch)" },
  { value: "onyx",    label: "Onyx (männlich, tief)" },
  { value: "shimmer", label: "Shimmer (weiblich, sanft)" },
];

// ─── Komponente ──────────────────────────────────────────────────────────────

export default function KiEinstellungenPage() {
  // API-Schlüssel
  const [openaiKey, setOpenaiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [mistralKey, setMistralKey] = useState("");
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [showMistralKey, setShowMistralKey] = useState(false);
  const touchedKeys = useRef<Set<string>>(new Set());

  // Sprachmodell (language)
  const [languageConfig, setLanguageConfig] = useState<CategoryConfig>({
    provider: "openai",
    modells: { openai: "gpt-4.1", anthropic: "claude-sonnet-4-6", mistral: "mistral-large-latest" },
  });

  // OCR / Erkennung
  const [ocrConfig, setOcrConfig] = useState<CategoryConfig>({
    provider: "openai",
    modells: { openai: "gpt-4o", anthropic: "claude-sonnet-4-6", mistral: "pixtral-large-2411" },
  });

  // Text-zu-Sprache (TTS)
  const [ttsConfig, setTtsConfig] = useState<CategoryConfig>({
    provider: "openai",
    modells: { openai: "tts-1", anthropic: "", mistral: "" },
  });
  const [ttsVoice, setTtsVoice] = useState("nova");

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
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; error?: string }>>({});

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

      // API-Schlüssel
      if (data["ki.openai_key"])    setOpenaiKey(data["ki.openai_key"]);
      if (data["ki.anthropic_key"]) setAnthropicKey(data["ki.anthropic_key"]);
      if (data["ki.mistral_key"])   setMistralKey(data["ki.mistral_key"]);

      // Sprachmodell-Kategorie
      const globalProvider = (data["ki.provider"] as AiProvider) || "openai";
      const langProvider = (data["ki.provider_language"] as AiProvider) || globalProvider;
      setLanguageConfig({
        provider: langProvider,
        modells: {
          openai:    data["ki.modell_language_openai"]    || data["ki.modell_openai"]    || DEFAULT_MODELLS.openai.language,
          anthropic: data["ki.modell_language_anthropic"] || data["ki.modell_anthropic"] || DEFAULT_MODELLS.anthropic.language,
          mistral:   data["ki.modell_language_mistral"]   || data["ki.modell_mistral"]   || DEFAULT_MODELLS.mistral.language,
        },
      });

      // OCR-Kategorie
      const ocrProvider = (data["ki.provider_ocr"] as AiProvider) || globalProvider;
      setOcrConfig({
        provider: ocrProvider,
        modells: {
          openai:    data["ki.modell_ocr_openai"]    || data["ki.modell_openai"]    || DEFAULT_MODELLS.openai.ocr,
          anthropic: data["ki.modell_ocr_anthropic"] || data["ki.modell_anthropic"] || DEFAULT_MODELLS.anthropic.ocr,
          mistral:   data["ki.modell_ocr_mistral"]   || data["ki.modell_mistral"]   || DEFAULT_MODELLS.mistral.ocr,
        },
      });

      // TTS-Kategorie
      const ttsProvider = (data["ki.provider_tts"] as AiProvider) || "openai";
      setTtsConfig({
        provider: ttsProvider,
        modells: {
          openai:    data["ki.modell_tts_openai"] || DEFAULT_MODELLS.openai.tts,
          anthropic: "",
          mistral:   "",
        },
      });
      if (data["ki.tts_voice"]) setTtsVoice(data["ki.tts_voice"]);

      // Prompts
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
        // Kategorie-Provider
        "ki.provider":          languageConfig.provider, // Rückwärtskompatibilität: globaler Provider = Sprachmodell-Provider
        "ki.provider_language": languageConfig.provider,
        "ki.provider_ocr":      ocrConfig.provider,
        "ki.provider_tts":      ttsConfig.provider,

        // Sprachmodell-Modelle
        "ki.modell_language_openai":    languageConfig.modells.openai,
        "ki.modell_language_anthropic": languageConfig.modells.anthropic,
        "ki.modell_language_mistral":   languageConfig.modells.mistral,

        // OCR-Modelle
        "ki.modell_ocr_openai":    ocrConfig.modells.openai,
        "ki.modell_ocr_anthropic": ocrConfig.modells.anthropic,
        "ki.modell_ocr_mistral":   ocrConfig.modells.mistral,

        // TTS-Modelle
        "ki.modell_tts_openai": ttsConfig.modells.openai,
        "ki.tts_voice":         ttsVoice,

        // Legacy-Keys für Rückwärtskompatibilität
        "ki.modell_openai":    languageConfig.modells.openai,
        "ki.modell_anthropic": languageConfig.modells.anthropic,
        "ki.modell_mistral":   languageConfig.modells.mistral,
        "ki.modell":           languageConfig.modells[languageConfig.provider],

        // Mistral-Key immer speichern wenn vorhanden
        ...(touchedKeys.current.has("ki.mistral_key") ? { "ki.mistral_key": mistralKey } : {}),
        ...(touchedKeys.current.has("ki.openai_key")    ? { "ki.openai_key":    openaiKey }    : {}),
        ...(touchedKeys.current.has("ki.anthropic_key") ? { "ki.anthropic_key": anthropicKey } : {}),
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

  async function handleTest(testProvider: AiProvider) {
    setTesting(testProvider);
    setTestResults(r => ({ ...r, [testProvider]: undefined as unknown as { ok: boolean } }));
    const modell =
      testProvider === "openai"    ? languageConfig.modells.openai :
      testProvider === "anthropic" ? languageConfig.modells.anthropic :
      languageConfig.modells.mistral;
    try {
      const res = await fetch("/api/ki/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: testProvider, modell, openaiKey, anthropicKey, mistralKey }),
      });
      const data = res.ok ? await res.json() : { ok: false, error: "Serveranfrage fehlgeschlagen" };
      setTestResults(r => ({ ...r, [testProvider]: data }));
    } catch {
      setTestResults(r => ({ ...r, [testProvider]: { ok: false, error: "Netzwerkfehler" } }));
    } finally {
      setTesting(null);
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

  function CategorySection({
    title,
    subtitle,
    category,
    config,
    setConfig,
    disabledProviders = [],
    disabledNote,
  }: {
    title: string;
    subtitle: string;
    category: ModelCategory;
    config: CategoryConfig;
    setConfig: (c: CategoryConfig) => void;
    disabledProviders?: AiProvider[];
    disabledNote?: string;
  }) {
    const models = getModelList(config.provider, category);
    const activeModell = config.modells[config.provider];

    return (
      <div className="border border-gray-200 rounded-xl p-5 space-y-4">
        <div>
          <h3 className="font-semibold text-gray-800">{title}</h3>
          <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
        </div>

        {/* Provider-Auswahl */}
        <div>
          <p className="text-xs font-medium text-gray-600 mb-2">Anbieter</p>
          <div className="flex flex-wrap gap-4">
            {(["openai", "anthropic", "mistral"] as AiProvider[]).map((p) => {
              const isDisabled = disabledProviders.includes(p);
              return (
                <label key={p} className={`flex items-center gap-2 ${isDisabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}>
                  <input
                    type="radio"
                    name={`provider_${category}`}
                    value={p}
                    checked={config.provider === p}
                    disabled={isDisabled}
                    onChange={() => setConfig({ ...config, provider: p })}
                    className="accent-green-600"
                  />
                  <span className="text-sm font-medium text-gray-700 capitalize">
                    {p === "openai" ? "OpenAI" : p === "anthropic" ? "Anthropic" : "Mistral"}
                  </span>
                </label>
              );
            })}
          </div>
          {disabledNote && (
            <p className="text-xs text-gray-400 mt-1">{disabledNote}</p>
          )}
        </div>

        {/* Modell-Auswahl */}
        <div>
          <p className="text-xs font-medium text-gray-600 mb-1">
            Modell ({config.provider === "openai" ? "OpenAI" : config.provider === "anthropic" ? "Anthropic" : "Mistral"})
          </p>
          <input
            list={`modell-list-${category}-${config.provider}`}
            value={activeModell}
            onChange={(e) =>
              setConfig({ ...config, modells: { ...config.modells, [config.provider]: e.target.value } })
            }
            placeholder={DEFAULT_MODELLS[config.provider][category] || "Modell-ID eingeben"}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <datalist id={`modell-list-${category}-${config.provider}`}>
            {models.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </datalist>
          <p className="text-xs text-gray-400 mt-1">
            Vorschläge auswählen oder eigene Modell-ID eintragen.
          </p>
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

      <h1 className="text-2xl font-bold mb-6">KI-Einstellungen</h1>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-8">

        {/* ── API-Schlüssel ─────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">API-Schlüssel</h2>
          <div className="space-y-4">

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">OpenAI API-Key</label>
              <div className="flex gap-2">
                <input
                  type={showOpenaiKey ? "text" : "password"}
                  value={openaiKey}
                  onChange={(e) => { setOpenaiKey(e.target.value); touchedKeys.current.add("ki.openai_key"); }}
                  placeholder="sk-..."
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <button type="button" onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                  className="px-3 py-2 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap">
                  {showOpenaiKey ? "Verbergen" : "Anzeigen"}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Anthropic API-Key</label>
              <div className="flex gap-2">
                <input
                  type={showAnthropicKey ? "text" : "password"}
                  value={anthropicKey}
                  onChange={(e) => { setAnthropicKey(e.target.value); touchedKeys.current.add("ki.anthropic_key"); }}
                  placeholder="sk-ant-..."
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <button type="button" onClick={() => setShowAnthropicKey(!showAnthropicKey)}
                  className="px-3 py-2 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap">
                  {showAnthropicKey ? "Verbergen" : "Anzeigen"}
                </button>
              </div>
            </div>

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
        </div>

        {/* ── Modell-Konfiguration je Aufgabentyp ──────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-1">Modell-Konfiguration</h2>
          <p className="text-sm text-gray-500 mb-5">
            Wähle je Aufgabentyp den gewünschten Anbieter und das Modell. Jeder Aufgabentyp
            kann einen anderen Provider nutzen.
          </p>

          <div className="space-y-5">
            <CategorySection
              title="Sprachmodell / Chat"
              subtitle="Texterkennung, CRM-Notizen, Mahnungen, Inhaltsstoffe, allgemeine Textanalyse"
              category="language"
              config={languageConfig}
              setConfig={setLanguageConfig}
            />

            <CategorySection
              title="Erkennung / OCR"
              subtitle="Bilderkennung, Lieferscheine, Bodenproben, Sachkundenachweise, Visitenkarten — PDF-Analyse"
              category="ocr"
              config={ocrConfig}
              setConfig={setOcrConfig}
            />

            <CategorySection
              title="Text zu Sprache (TTS)"
              subtitle="Sprachausgabe von Texten über OpenAI TTS"
              category="tts"
              config={ttsConfig}
              setConfig={setTtsConfig}
              disabledProviders={["anthropic", "mistral"]}
              disabledNote="Anthropic und Mistral unterstützen aktuell keine Sprachausgabe."
            />

            {/* Stimme für TTS */}
            <div className="border border-gray-200 rounded-xl p-5">
              <div className="mb-3">
                <h3 className="font-semibold text-gray-800">Stimme (TTS)</h3>
                <p className="text-xs text-gray-400 mt-0.5">Stimme für die OpenAI Sprachausgabe</p>
              </div>
              <select
                value={ttsVoice}
                onChange={(e) => setTtsVoice(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {TTS_VOICES.map((v) => (
                  <option key={v.value} value={v.value}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ── Verbindungstest ───────────────────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Verbindungstest</h2>
          <div className="flex flex-wrap gap-3">
            {(["openai", "anthropic", "mistral"] as AiProvider[]).map((p) => {
              const label = p === "openai" ? "OpenAI" : p === "anthropic" ? "Anthropic" : "Mistral";
              const result = testResults[p];
              return (
                <div key={p} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleTest(p)}
                    disabled={testing === p}
                    className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    {testing === p ? "Teste..." : `${label} testen`}
                  </button>
                  {result && (
                    <span className={`text-xs px-2 py-1 rounded-lg border ${
                      result.ok
                        ? "bg-green-50 border-green-200 text-green-700"
                        : "bg-red-50 border-red-200 text-red-600"
                    }`}>
                      {result.ok ? "OK" : result.error || "Fehler"}
                    </span>
                  )}
                </div>
              );
            })}
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
