"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type Values = {
  "email.import.aktiv": string;
  "email.import.source": string;
  "email.import.aktion": string;
  "email.import.webhook_secret": string;
};

const DEFAULTS: Values = {
  "email.import.aktiv": "false",
  "email.import.source": "",
  "email.import.aktion": "wareneingang",
  "email.import.webhook_secret": "",
};

const ALL_KEYS = Object.keys(DEFAULTS) as (keyof Values)[];

const AKTIONEN = [
  { value: "wareneingang", label: "Wareneingang buchen" },
  { value: "lieferung",    label: "Lieferung erstellen" },
  { value: "eingangsrechnung", label: "Eingangsrechnung erfassen" },
  { value: "benachrichtigung", label: "Nur Benachrichtigung senden" },
];

export default function EmailImportPage() {
  const [values, setValues] = useState<Values>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [secretVisible, setSecretVisible] = useState(false);

  useEffect(() => {
    fetch("/api/einstellungen?prefix=email.import.")
      .then((r) => r.json())
      .then((d: Record<string, string>) => {
        setValues({
          "email.import.aktiv":          d["email.import.aktiv"]          ?? DEFAULTS["email.import.aktiv"],
          "email.import.source":         d["email.import.source"]         ?? DEFAULTS["email.import.source"],
          "email.import.aktion":         d["email.import.aktion"]         ?? DEFAULTS["email.import.aktion"],
          "email.import.webhook_secret": d["email.import.webhook_secret"] ?? DEFAULTS["email.import.webhook_secret"],
        });
      })
      .finally(() => setLoading(false));
  }, []);

  async function speichern() {
    setSaving(true);
    setMsg("");
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
      setMsg("Gespeichert.");
    } catch {
      setMsg("Fehler beim Speichern.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6 text-sm text-gray-500">Lade Einstellungen…</div>;

  const aktiv = values["email.import.aktiv"] === "true";

  return (
    <div className="max-w-xl mx-auto p-6">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/einstellungen" className="text-green-700 hover:underline">Einstellungen</Link>
        <span>/</span>
        <span>E-Mail Import</span>
      </div>

      <div className="flex items-start gap-4 mb-6">
        <div className="text-3xl">✉️</div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">E-Mail Import — Einstellungen</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Eingehende E-Mails über Resend empfangen, lokal speichern und per KI verarbeiten.
          </p>
        </div>
      </div>

      <div className="space-y-5">
        <label className="flex items-center gap-3 p-4 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition">
          <input
            type="checkbox"
            checked={aktiv}
            onChange={(e) => setValues((v) => ({ ...v, "email.import.aktiv": e.target.checked ? "true" : "false" }))}
            className="w-5 h-5 accent-green-700"
          />
          <div>
            <span className="font-medium text-gray-800 text-sm">E-Mail Import aktivieren</span>
            <p className="text-xs text-gray-500 mt-0.5">
              Resend leitet eingehende E-Mails per Webhook an dieses System weiter.
            </p>
          </div>
        </label>

        <div className={!aktiv ? "opacity-40 pointer-events-none" : ""}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Source / Import-Adresse
              </label>
              <input
                type="email"
                value={values["email.import.source"]}
                onChange={(e) => setValues((v) => ({ ...v, "email.import.source": e.target.value }))}
                placeholder="import@ihre-domain.de"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                E-Mails an diese Adresse werden automatisch verarbeitet. Die Domain muss in Resend
                als Inbound-Route konfiguriert sein.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Aktion bei Eingang</label>
              <select
                value={values["email.import.aktion"]}
                onChange={(e) => setValues((v) => ({ ...v, "email.import.aktion": e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {AKTIONEN.map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Die KI analysiert Anhänge und Text der E-Mail und legt automatisch den gewählten Datensatz an.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Webhook-Secret</label>
              <div className="relative">
                <input
                  type={secretVisible ? "text" : "password"}
                  value={values["email.import.webhook_secret"]}
                  onChange={(e) => setValues((v) => ({ ...v, "email.import.webhook_secret": e.target.value }))}
                  placeholder="svix_…"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-12 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <button
                  type="button"
                  onClick={() => setSecretVisible((s) => !s)}
                  aria-label={secretVisible ? "Secret verbergen" : "Secret anzeigen"}
                  className="absolute inset-y-0 right-0 px-3 text-sm text-gray-600 hover:text-green-700"
                >
                  {secretVisible ? "🙈" : "👁️"}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Signing-Secret aus den Resend-Webhook-Einstellungen zur Verifikation eingehender Anfragen.
              </p>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
              <p className="font-medium mb-1">Webhook-URL für Resend</p>
              <p className="font-mono text-xs break-all bg-white border border-blue-200 rounded px-2 py-1 mt-1">
                {typeof window !== "undefined" ? window.location.origin : "https://ihre-app.de"}/api/webhooks/email-import
              </p>
              <p className="text-xs mt-2 text-blue-600">
                Diese URL unter resend.com → Webhooks → Inbound eintragen.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 mt-6">
        <button
          onClick={speichern}
          disabled={saving}
          className="px-4 py-2 bg-green-700 hover:bg-green-800 text-white rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {saving ? "Speichern…" : "Speichern"}
        </button>
        {msg && (
          <span className={`text-sm ${msg === "Gespeichert." ? "text-green-700" : "text-red-600"}`}>
            {msg}
          </span>
        )}
      </div>
    </div>
  );
}
