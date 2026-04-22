"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type Provider = "smtp" | "resend";

type Values = {
  "email.provider": Provider;
  "smtp.host": string;
  "smtp.port": string;
  "smtp.secure": string;
  "smtp.user": string;
  "smtp.password": string;
  "smtp.from": string;
  "resend.api_key": string;
  "resend.from": string;
};

const DEFAULTS: Values = {
  "email.provider": "smtp",
  "smtp.host": "",
  "smtp.port": "587",
  "smtp.secure": "false",
  "smtp.user": "",
  "smtp.password": "",
  "smtp.from": "",
  "resend.api_key": "",
  "resend.from": "",
};

const ALL_KEYS = Object.keys(DEFAULTS) as (keyof Values)[];

export default function EmailEinstellungenPage() {
  const [values, setValues] = useState<Values>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState("");
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [smtpPasswordVisible, setSmtpPasswordVisible] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/einstellungen?prefix=email.").then((r) => r.json()),
      fetch("/api/einstellungen?prefix=smtp.").then((r) => r.json()),
      fetch("/api/einstellungen?prefix=resend.").then((r) => r.json()),
    ])
      .then(([e, s, r]: [Record<string, string>, Record<string, string>, Record<string, string>]) => {
        const d = { ...e, ...s, ...r };
        setValues({
          "email.provider": d["email.provider"] === "resend" ? "resend" : "smtp",
          "smtp.host": d["smtp.host"] ?? "",
          "smtp.port": d["smtp.port"] ?? "587",
          "smtp.secure": d["smtp.secure"] ?? "false",
          "smtp.user": d["smtp.user"] ?? "",
          "smtp.password": d["smtp.password"] ?? "",
          "smtp.from": d["smtp.from"] ?? "",
          "resend.api_key": d["resend.api_key"] ?? "",
          "resend.from": d["resend.from"] ?? "",
        });
      })
      .finally(() => setLoading(false));
  }, []);

  async function saveAll(): Promise<boolean> {
    try {
      await Promise.all(
        ALL_KEYS.map((key) =>
          fetch("/api/einstellungen", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key, value: values[key] }),
          }),
        ),
      );
      return true;
    } catch {
      return false;
    }
  }

  async function save() {
    setSaving(true);
    setMsg("");
    const ok = await saveAll();
    setMsg(ok ? "Gespeichert." : "Fehler beim Speichern.");
    setSaving(false);
  }

  async function testConnection() {
    setTesting(true);
    setTestMsg("");
    const saved = await saveAll();
    if (!saved) {
      setTestMsg("✗ Fehler beim Speichern der Einstellungen vor dem Test");
      setTesting(false);
      return;
    }
    try {
      const res = await fetch("/api/einstellungen/email-test", { method: "POST" });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      setTestMsg(data.ok ? "✓ Verbindung erfolgreich" : `✗ Fehler: ${data.error ?? "Unbekannt"}`);
    } catch {
      setTestMsg("✗ Verbindung fehlgeschlagen");
    } finally {
      setTesting(false);
    }
  }

  const provider = values["email.provider"];

  if (loading) return <div className="p-6 text-sm text-gray-500">Lade…</div>;

  return (
    <div className="max-w-xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/einstellungen" className="text-sm text-green-700 hover:underline">
          ← Einstellungen
        </Link>
      </div>
      <h1 className="text-xl font-bold mb-6">E-Mail-Versand</h1>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Versand-Anbieter</label>
        <div className="grid grid-cols-2 gap-2">
          {(["smtp", "resend"] as Provider[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setValues((v) => ({ ...v, "email.provider": p }))}
              className={`px-4 py-3 rounded-lg border text-sm font-medium transition ${
                provider === p
                  ? "border-green-700 bg-green-50 text-green-800"
                  : "border-gray-300 hover:bg-gray-50 text-gray-700"
              }`}
            >
              {p === "smtp" ? "SMTP (Nodemailer)" : "Resend"}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {provider === "resend"
            ? "Transaktionale E-Mails über resend.com. Absender-Domain muss in Resend verifiziert sein."
            : "Direkter Versand über einen SMTP-Server (z. B. Strato, Gmail, eigener Mailserver)."}
        </p>
      </div>

      {provider === "smtp" ? (
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">SMTP-Host</label>
            <input
              type="text"
              value={values["smtp.host"]}
              placeholder="mail.example.com"
              onChange={(e) => setValues((v) => ({ ...v, "smtp.host": e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">SMTP-Port</label>
            <input
              type="number"
              value={values["smtp.port"]}
              placeholder="587"
              onChange={(e) => setValues((v) => ({ ...v, "smtp.port": e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={values["smtp.secure"] === "true"}
              onChange={(e) => setValues((v) => ({ ...v, "smtp.secure": e.target.checked ? "true" : "false" }))}
              className="w-4 h-4 accent-green-700"
            />
            <span className="text-sm font-medium text-gray-700">TLS/SSL (Port 465)</span>
          </label>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Benutzername</label>
            <input
              type="text"
              value={values["smtp.user"]}
              placeholder="user@example.com"
              onChange={(e) => setValues((v) => ({ ...v, "smtp.user": e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Passwort</label>
            <div className="relative">
              <input
                type={smtpPasswordVisible ? "text" : "password"}
                value={values["smtp.password"]}
                onChange={(e) => setValues((v) => ({ ...v, "smtp.password": e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <button
                type="button"
                onClick={() => setSmtpPasswordVisible((s) => !s)}
                aria-label={smtpPasswordVisible ? "Passwort verbergen" : "Passwort anzeigen"}
                className="absolute inset-y-0 right-0 px-3 text-sm text-gray-600 hover:text-green-700"
              >
                {smtpPasswordVisible ? "🙈" : "👁️"}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Absender-Adresse</label>
            <input
              type="email"
              value={values["smtp.from"]}
              placeholder="buchhaltung@example.com"
              onChange={(e) => setValues((v) => ({ ...v, "smtp.from": e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Resend API-Key</label>
            <div className="relative">
              <input
                type={apiKeyVisible ? "text" : "password"}
                value={values["resend.api_key"]}
                placeholder="re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                onChange={(e) => setValues((v) => ({ ...v, "resend.api_key": e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-12 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <button
                type="button"
                onClick={() => setApiKeyVisible((s) => !s)}
                aria-label={apiKeyVisible ? "API-Key verbergen" : "API-Key anzeigen"}
                className="absolute inset-y-0 right-0 px-3 text-sm text-gray-600 hover:text-green-700"
              >
                {apiKeyVisible ? "🙈" : "👁️"}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Zu finden unter resend.com → API Keys. Mindestens <code>sending_access</code> für Produkt-Mails.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Absender-Adresse</label>
            <input
              type="email"
              value={values["resend.from"]}
              placeholder="rechnungen@ihre-domain.de"
              onChange={(e) => setValues((v) => ({ ...v, "resend.from": e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Die Domain dieser Adresse muss in Resend als verifizierte Domain eingetragen sein
              (SPF/DKIM-DNS-Einträge). Ansonsten wird der Versand von Resend abgelehnt.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-center">
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 bg-green-700 hover:bg-green-800 text-white rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {saving ? "Speichern…" : "Speichern"}
        </button>
        <button
          onClick={testConnection}
          disabled={testing}
          className="px-4 py-2 border border-gray-300 hover:bg-gray-50 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {testing ? "Teste…" : "Verbindung testen"}
        </button>
        {msg && <span className="text-sm text-green-700">{msg}</span>}
        {testMsg && (
          <span className={`text-sm ${testMsg.startsWith("✓") ? "text-green-700" : "text-red-600"}`}>
            {testMsg}
          </span>
        )}
      </div>

      <div className="mt-6 p-4 bg-gray-50 rounded-lg text-sm text-gray-600 space-y-2">
        <p className="font-medium">Hinweis</p>
        <p>
          Die E-Mail-Funktion sendet Rechnungen (PDF + ZUGFeRD XML) direkt an Kunden.
        </p>
        {provider === "smtp" ? (
          <p>
            Verwende Port 587 mit STARTTLS oder Port 465 mit TLS/SSL (Haken setzen).
            Das Passwort wird in der Datenbank gespeichert.
          </p>
        ) : (
          <p>
            Resend liefert bessere Zustellraten, ein Dashboard mit Bounce-/Open-Tracking und saubere
            DKIM/SPF-Signierung. Voraussetzung: verifizierte Domain unter resend.com →
            Domains. Der API-Key wird in der Datenbank gespeichert.
          </p>
        )}
      </div>
    </div>
  );
}
