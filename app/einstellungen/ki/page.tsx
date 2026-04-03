"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";

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

const FEATURE_LABELS: Record<string, string> = {
  wareneingang: "Wareneingang",
  lieferung: "Lieferung",
  crm: "CRM Notiz",
};

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
  const [statistik, setStatistik] = useState<KiStatistik | null>(null);
  const [statistikLoading, setStatistikLoading] = useState(true);
  const [statistikError, setStatistikError] = useState<string | null>(null);

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

  useEffect(() => {
    async function fetchStatistik() {
      try {
        const res = await fetch("/api/ki/statistik?tage=30");
        if (!res.ok) throw new Error();
        const data = await res.json();
        setStatistik(data);
      } catch {
        setStatistikError("Statistik konnte nicht geladen werden.");
      } finally {
        setStatistikLoading(false);
      }
    }
    fetchStatistik();
  }, []);

  // Wenn Provider wechselt, erstes Modell des Providers setzen
  useEffect(() => {
    const models = provider === "openai" ? OPENAI_MODELS : ANTHROPIC_MODELS;
    const currentValid = models.some((m) => m.value === modell);
    if (!currentValid) {
      setModell(models[0].value);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

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

      {/* Nutzungsstatistik */}
      <div className="mt-10">
        <h2 className="text-xl font-bold text-gray-800 mb-5">Nutzungsstatistik (letzte 30 Tage)</h2>

        {statistikLoading && (
          <p className="text-sm text-gray-400">Lade Statistik...</p>
        )}

        {statistikError && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {statistikError}
          </div>
        )}

        {statistik && (
          <div className="space-y-8">
            {/* KPI-Karten */}
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
                    currency: "EUR",
                  })}
                </div>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="text-sm text-gray-500">Fehlerrate</div>
                <div className="text-2xl font-bold text-gray-800">
                  {statistik.gesamt.requests > 0
                    ? ((statistik.gesamt.fehler / statistik.gesamt.requests) * 100).toFixed(1)
                    : "0,0"}{" "}
                  %
                </div>
              </div>
            </div>

            {/* Pro-Feature-Tabelle */}
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
                          <td className="px-4 py-2 text-gray-800">
                            {FEATURE_LABELS[feature] ?? feature}
                          </td>
                          <td className="px-4 py-2 text-right text-gray-700">{data.requests}</td>
                          <td className="px-4 py-2 text-right text-gray-700">
                            {(data.tokensIn + data.tokensOut).toLocaleString("de-DE")}
                          </td>
                          <td className="px-4 py-2 text-right text-gray-700">
                            {(data.kostenCent / 100).toLocaleString("de-DE", {
                              style: "currency",
                              currency: "EUR",
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Letzte Requests */}
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
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="px-4 py-2 text-gray-800">
                            {FEATURE_LABELS[req.feature] ?? req.feature}
                          </td>
                          <td className="hidden sm:table-cell px-4 py-2 text-gray-600 capitalize">
                            {req.provider}
                          </td>
                          <td className="hidden sm:table-cell px-4 py-2 text-gray-600">
                            {req.modell}
                          </td>
                          <td className="hidden sm:table-cell px-4 py-2 text-right text-gray-600">
                            {(req.tokensIn + req.tokensOut).toLocaleString("de-DE")}
                          </td>
                          <td className="hidden sm:table-cell px-4 py-2 text-right text-gray-600">
                            {(req.kostenCent / 100).toLocaleString("de-DE", {
                              style: "currency",
                              currency: "EUR",
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
