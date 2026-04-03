"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";

const OPENAI_MODELS = [
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini" },
  { value: "gpt-4.1", label: "GPT-4.1" },
  { value: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
  { value: "gpt-4.1-nano", label: "GPT-4.1 Nano" },
];

const ANTHROPIC_MODELS = [
  { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
  { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
  { value: "claude-opus-4-20250514", label: "Claude Opus 4" },
];

export default function KiEinstellungenPage() {
  const [provider, setProvider] = useState<"openai" | "anthropic">("openai");
  const [modell, setModell] = useState("gpt-4o");
  const [openaiKey, setOpenaiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/einstellungen?prefix=ki.");
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data["ki.provider"]) setProvider(data["ki.provider"] as "openai" | "anthropic");
      if (data["ki.modell"]) setModell(data["ki.modell"]);
      if (data["ki.openai_key"]) setOpenaiKey(data["ki.openai_key"]);
      if (data["ki.anthropic_key"]) setAnthropicKey(data["ki.anthropic_key"]);
    } catch {
      setError("Fehler beim Laden der KI-Einstellungen.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Wenn Provider wechselt, erstes Modell des Providers setzen
  useEffect(() => {
    const models = provider === "openai" ? OPENAI_MODELS : ANTHROPIC_MODELS;
    const currentValid = models.some((m) => m.value === modell);
    if (!currentValid) {
      setModell(models[0].value);
    }
  }, [provider, modell]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const settings: Record<string, string> = {
        "ki.provider": provider,
        "ki.modell": modell,
        "ki.openai_key": openaiKey,
        "ki.anthropic_key": anthropicKey,
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

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/ki/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          modell,
          openaiKey,
          anthropicKey,
        }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch {
      setTestResult({ ok: false, error: "Netzwerkfehler" });
    } finally {
      setTesting(false);
    }
  }

  const currentModels = provider === "openai" ? OPENAI_MODELS : ANTHROPIC_MODELS;

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

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <form onSubmit={handleSave} className="space-y-6">
          {/* API Keys */}
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">API-Keys</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  OpenAI API-Key
                </label>
                <div className="flex gap-2">
                  <input
                    type={showOpenaiKey ? "text" : "password"}
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                    placeholder="sk-..."
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                    className="px-3 py-2 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap"
                  >
                    {showOpenaiKey ? "Verbergen" : "Anzeigen"}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Anthropic API-Key
                </label>
                <div className="flex gap-2">
                  <input
                    type={showAnthropicKey ? "text" : "password"}
                    value={anthropicKey}
                    onChange={(e) => setAnthropicKey(e.target.value)}
                    placeholder="sk-ant-..."
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAnthropicKey(!showAnthropicKey)}
                    className="px-3 py-2 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap"
                  >
                    {showAnthropicKey ? "Verbergen" : "Anzeigen"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Provider-Auswahl */}
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Provider</h2>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="provider"
                  value="openai"
                  checked={provider === "openai"}
                  onChange={() => setProvider("openai")}
                  className="accent-green-600"
                />
                <span className="text-sm font-medium text-gray-700">OpenAI</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="provider"
                  value="anthropic"
                  checked={provider === "anthropic"}
                  onChange={() => setProvider("anthropic")}
                  className="accent-green-600"
                />
                <span className="text-sm font-medium text-gray-700">Anthropic</span>
              </label>
            </div>
          </div>

          {/* Modell-Auswahl */}
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Modell</h2>
            <select
              value={modell}
              onChange={(e) => setModell(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {currentModels.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* Verbindungstest */}
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Verbindungstest</h2>
            <button
              type="button"
              onClick={handleTest}
              disabled={testing}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {testing ? "Teste..." : "Verbindung testen"}
            </button>
            {testResult && (
              <div
                className={`mt-3 text-sm px-3 py-2 rounded-lg border ${
                  testResult.ok
                    ? "bg-green-50 border-green-200 text-green-700"
                    : "bg-red-50 border-red-200 text-red-600"
                }`}
              >
                {testResult.ok
                  ? "Verbindung erfolgreich!"
                  : `Fehler: ${testResult.error || "Unbekannter Fehler"}`}
              </div>
            )}
          </div>

          {/* Speichern */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-60"
            >
              {saving ? "Speichern..." : saved ? "Gespeichert!" : "Speichern"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
