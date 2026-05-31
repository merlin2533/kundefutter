"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";

type Provider = "smtp" | "resend";

type Values = {
  "email.provider": Provider;
  "email.from": string;
  "email.reply_to": string;
  "email.info": string;
  "email.bcc": string;
  "email.digest": string;
  "cron.digest.besuchstermine": string;
  "cron.digest.aufgaben": string;
  "cron.digest.mahnwesen": string;
  "cron.digest.sachkunde": string;
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
  "email.from": "",
  "email.reply_to": "",
  "email.info": "",
  "email.bcc": "",
  "email.digest": "",
  "cron.digest.besuchstermine": "0",
  "cron.digest.aufgaben": "0",
  "cron.digest.mahnwesen": "0",
  "cron.digest.sachkunde": "0",
  "smtp.host": "",
  "smtp.port": "587",
  "smtp.secure": "false",
  "smtp.user": "",
  "smtp.password": "",
  "smtp.from": "",
  "resend.api_key": "",
  "resend.from": "",
};

// Sensitive fields: only save when the user has actually entered a new value
const SENSITIVE_KEYS = new Set<keyof Values>(["smtp.password", "resend.api_key"]);

export default function EmailEinstellungenPage() {
  const [values, setValues] = useState<Values>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState("");
  const [testEmailTo, setTestEmailTo] = useState("");
  const [sendingTestMail, setSendingTestMail] = useState(false);
  const [testMailResult, setTestMailResult] = useState("");
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [smtpPasswordVisible, setSmtpPasswordVisible] = useState(false);
  // Track which sensitive fields were modified by the user in this session
  const touchedSensitive = useRef<Set<keyof Values>>(new Set());
  // Ob bereits ein Secret hinterlegt ist (der Wert selbst wird nie ins Formular geladen)
  const [hasSmtpPassword, setHasSmtpPassword] = useState(false);
  const [hasResendKey, setHasResendKey] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/einstellungen?prefix=email.").then((r) => r.json()),
      fetch("/api/einstellungen?prefix=smtp.").then((r) => r.json()),
      fetch("/api/einstellungen?prefix=resend.").then((r) => r.json()),
      fetch("/api/einstellungen?prefix=cron.digest.").then((r) => r.json()),
    ])
      .then(([e, s, r, c]: [Record<string, string>, Record<string, string>, Record<string, string>, Record<string, string>]) => {
        const d = { ...e, ...s, ...r, ...c };
        setValues({
          "email.provider": d["email.provider"] === "resend" ? "resend" : "smtp",
          "email.from": d["email.from"] ?? "",
          "email.reply_to": d["email.reply_to"] ?? "",
          "email.info": d["email.info"] ?? "",
          "email.bcc": d["email.bcc"] ?? "",
          "email.digest": d["email.digest"] ?? "",
          "cron.digest.besuchstermine": d["cron.digest.besuchstermine"] ?? "0",
          "cron.digest.aufgaben": d["cron.digest.aufgaben"] ?? "0",
          "cron.digest.mahnwesen": d["cron.digest.mahnwesen"] ?? "0",
          "cron.digest.sachkunde": d["cron.digest.sachkunde"] ?? "0",
          "smtp.host": d["smtp.host"] ?? "",
          "smtp.port": d["smtp.port"] ?? "587",
          "smtp.secure": d["smtp.secure"] ?? "false",
          "smtp.user": d["smtp.user"] ?? "",
          // Secrets bewusst NICHT ins Formular laden – verhindert, dass der
          // (maskierte) Wert angezeigt und beim Speichern zurückgeschrieben wird.
          "smtp.password": "",
          "smtp.from": d["smtp.from"] ?? "",
          "resend.api_key": "",
          "resend.from": d["resend.from"] ?? "",
        });
        setHasSmtpPassword(Boolean(d["smtp.password"]));
        setHasResendKey(Boolean(d["resend.api_key"]));
      })
      .finally(() => setLoading(false));
  }, []);

  function updateField<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    if (SENSITIVE_KEYS.has(key)) {
      touchedSensitive.current.add(key);
    }
  }

  async function saveAll(): Promise<boolean> {
    try {
      const keys = (Object.keys(DEFAULTS) as (keyof Values)[]).filter((key) => {
        // Skip sensitive fields that were not touched (preserve existing value in DB)
        if (SENSITIVE_KEYS.has(key) && !touchedSensitive.current.has(key)) return false;
        return true;
      });
      await Promise.all(
        keys.map((key) =>
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

  async function sendTestMail() {
    if (!testEmailTo) return;
    setSendingTestMail(true);
    setTestMailResult("");
    const saved = await saveAll();
    if (!saved) {
      setTestMailResult("Fehler beim Speichern der Einstellungen");
      setSendingTestMail(false);
      return;
    }
    try {
      const res = await fetch("/api/einstellungen/email-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testEmailTo }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      setTestMailResult(data.ok ? "Test-Mail gesendet" : `Fehler: ${data.error ?? "Unbekannt"}`);
    } catch {
      setTestMailResult("Versand fehlgeschlagen");
    } finally {
      setSendingTestMail(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    setTestMsg("");
    const saved = await saveAll();
    if (!saved) {
      setTestMsg("Fehler beim Speichern der Einstellungen vor dem Test");
      setTesting(false);
      return;
    }
    try {
      const res = await fetch("/api/einstellungen/email-test", { method: "POST" });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      setTestMsg(data.ok ? "Verbindung erfolgreich" : `Fehler: ${data.error ?? "Unbekannt"}`);
    } catch {
      setTestMsg("Verbindung fehlgeschlagen");
    } finally {
      setTesting(false);
    }
  }

  const provider = values["email.provider"];

  if (loading) return <div className="text-sm text-gray-500">Lade…</div>;

  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/einstellungen" className="text-sm text-green-700 hover:underline">
          ← Einstellungen
        </Link>
      </div>
      <h1 className="text-xl font-bold mb-6">Mail</h1>

      {/* E-Mail-Adressen */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-800">E-Mail-Adressen</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Hauptabsender <span className="text-gray-400 font-normal">(email.from)</span>
          </label>
          <input
            type="email"
            value={values["email.from"]}
            placeholder="info@ihrefirma.de"
            onChange={(e) => updateField("email.from", e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <p className="text-xs text-gray-500 mt-1">Absenderadresse aller ausgehenden Mails (Rechnungen, Angebote, Mahnungen…)</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Antwortadresse <span className="text-gray-400 font-normal">(Reply-To, optional)</span>
          </label>
          <input
            type="email"
            value={values["email.reply_to"]}
            placeholder="buero@ihrefirma.de"
            onChange={(e) => updateField("email.reply_to", e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <p className="text-xs text-gray-500 mt-1">Antworten des Empfängers landen bei dieser Adresse (Reply-To-Header)</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Info-Adresse <span className="text-gray-400 font-normal">(auf Dokumenten)</span>
          </label>
          <input
            type="email"
            value={values["email.info"]}
            placeholder="info@ihrefirma.de"
            onChange={(e) => updateField("email.info", e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <p className="text-xs text-gray-500 mt-1">Wird auf Rechnungen, Angeboten und anderen Dokumenten als Kontaktadresse angezeigt</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            BCC-Kopie <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            type="email"
            value={values["email.bcc"]}
            placeholder="archiv@ihrefirma.de"
            onChange={(e) => updateField("email.bcc", e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <p className="text-xs text-gray-500 mt-1">Alle ausgehenden Mails werden als BCC an diese Adresse kopiert</p>
        </div>
      </div>

      {/* Versand-Provider */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-800 mb-4">Versand-Anbieter</h2>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {(["smtp", "resend"] as Provider[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => updateField("email.provider", p)}
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
        <p className="text-xs text-gray-500">
          {provider === "resend"
            ? "Transaktionale E-Mails über resend.com. Absender-Domain muss in Resend verifiziert sein."
            : "Direkter Versand über einen SMTP-Server (z. B. Strato, Gmail, eigener Mailserver)."}
        </p>
      </div>

      {provider === "smtp" ? (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 mb-6">
          <h2 className="text-sm font-semibold text-gray-800">SMTP-Konfiguration</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">SMTP-Host</label>
            <input
              type="text"
              value={values["smtp.host"]}
              placeholder="mail.example.com"
              onChange={(e) => updateField("smtp.host", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">SMTP-Port</label>
            <input
              type="number"
              value={values["smtp.port"]}
              placeholder="587"
              onChange={(e) => updateField("smtp.port", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={values["smtp.secure"] === "true"}
              onChange={(e) => updateField("smtp.secure", e.target.checked ? "true" : "false")}
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
              onChange={(e) => updateField("smtp.user", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Passwort
              {hasSmtpPassword && !touchedSensitive.current.has("smtp.password") && (
                <span className="ml-2 text-xs font-normal text-amber-600">Gespeichert — leer lassen um beizubehalten</span>
              )}
            </label>
            <div className="relative">
              <input
                type={smtpPasswordVisible ? "text" : "password"}
                name="smtp-password"
                autoComplete="new-password"
                value={values["smtp.password"]}
                placeholder={hasSmtpPassword && !touchedSensitive.current.has("smtp.password") ? "•••••••• (gespeichert)" : ""}
                onChange={(e) => updateField("smtp.password", e.target.value)}
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Absender-Adresse (SMTP From)</label>
            <input
              type="email"
              value={values["smtp.from"]}
              placeholder="buchhaltung@example.com"
              onChange={(e) => updateField("smtp.from", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div className="pt-2 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Port 587 mit STARTTLS oder Port 465 mit TLS/SSL (Haken setzen).
              Das Passwort wird verschlüsselt in der Datenbank gespeichert.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 mb-6">
          <h2 className="text-sm font-semibold text-gray-800">Resend-Konfiguration</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Resend API-Key
              {hasResendKey && !touchedSensitive.current.has("resend.api_key") && (
                <span className="ml-2 text-xs font-normal text-amber-600">Gespeichert — leer lassen um beizubehalten</span>
              )}
            </label>
            <div className="relative">
              <input
                type={apiKeyVisible ? "text" : "password"}
                name="resend-api-key"
                autoComplete="new-password"
                value={values["resend.api_key"]}
                placeholder={hasResendKey && !touchedSensitive.current.has("resend.api_key") ? "•••••••• (gespeichert — leer lassen zum Beibehalten)" : "re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"}
                onChange={(e) => updateField("resend.api_key", e.target.value)}
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Absender-Adresse (Resend From)</label>
            <input
              type="email"
              value={values["resend.from"]}
              placeholder="rechnungen@ihre-domain.de"
              onChange={(e) => updateField("resend.from", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Die Domain dieser Adresse muss in Resend als verifizierte Domain eingetragen sein
              (SPF/DKIM-DNS-Einträge).
            </p>
          </div>
          <div className="pt-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Test-E-Mail senden</label>
            <div className="flex gap-2">
              <input
                type="email"
                value={testEmailTo}
                placeholder="empfaenger@example.com"
                onChange={(e) => setTestEmailTo(e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <button
                type="button"
                onClick={sendTestMail}
                disabled={sendingTestMail || !testEmailTo}
                className="px-3 py-2 border border-gray-300 hover:bg-gray-50 rounded-lg text-sm font-medium disabled:opacity-50 whitespace-nowrap"
              >
                {sendingTestMail ? "Sendet…" : "Test senden"}
              </button>
            </div>
            {testMailResult && (
              <p className={`text-xs mt-1 ${testMailResult.startsWith("Fehler") || testMailResult.includes("fehlgeschlagen") ? "text-red-600" : "text-green-700"}`}>
                {testMailResult}
              </p>
            )}
          </div>
          <div className="pt-2 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Resend liefert bessere Zustellraten, Bounce-/Open-Tracking und saubere DKIM/SPF-Signierung.
              Voraussetzung: verifizierte Domain unter resend.com → Domains.
            </p>
          </div>
        </div>
      )}

      {/* Automatische Digest-Mails */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">Automatische Digest-Mails</h2>
          <p className="text-xs text-gray-500 mt-1">Wird automatisch alle 6 Stunden versendet (über den Cron-Job).</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Empfänger-Adresse</label>
          <input
            type="email"
            value={values["email.digest"]}
            onChange={(e) => updateField("email.digest", e.target.value)}
            placeholder="admin@ihrefirma.de"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <p className="text-xs text-gray-500 mt-1">Leer lassen = kein Digest wird gesendet.</p>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">Enthaltene Bereiche</p>
          {(
            [
              ["cron.digest.besuchstermine", "Besuchstermine heute"],
              ["cron.digest.aufgaben", "Fällige Aufgaben heute"],
              ["cron.digest.mahnwesen", "Überfällige Rechnungen"],
              ["cron.digest.sachkunde", "Ablaufende Sachkundenachweise (90 Tage)"],
            ] as [keyof Values, string][]
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={values[key] === "1"}
                onChange={(e) => updateField(key, e.target.checked ? "1" : "0")}
                className="rounded text-green-600 focus:ring-green-500"
              />
              <span className="text-sm text-gray-700">{label}</span>
            </label>
          ))}
        </div>
      </div>

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
          <span className={`text-sm ${testMsg.startsWith("Fehler") || testMsg.includes("fehlgeschlagen") ? "text-red-600" : "text-green-700"}`}>
            {testMsg}
          </span>
        )}
      </div>
    </div>
  );
}
