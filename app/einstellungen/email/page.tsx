"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

const FELDER = [
  { key: "smtp.host", label: "SMTP-Host", placeholder: "mail.example.com", type: "text" },
  { key: "smtp.port", label: "SMTP-Port", placeholder: "587", type: "number" },
  { key: "smtp.secure", label: "TLS/SSL (Port 465)", placeholder: "", type: "checkbox" },
  { key: "smtp.user", label: "Benutzername", placeholder: "user@example.com", type: "text" },
  { key: "smtp.password", label: "Passwort", placeholder: "", type: "password" },
  { key: "smtp.from", label: "Absender-Adresse", placeholder: "buchhaltung@example.com", type: "email" },
] as const;

type FeldKey = (typeof FELDER)[number]["key"];

export default function EmailEinstellungenPage() {
  const [values, setValues] = useState<Record<FeldKey, string>>({
    "smtp.host": "",
    "smtp.port": "587",
    "smtp.secure": "false",
    "smtp.user": "",
    "smtp.password": "",
    "smtp.from": "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState("");

  useEffect(() => {
    fetch("/api/einstellungen?prefix=smtp.")
      .then((r) => r.json())
      .then((d: Record<string, string>) => {
        setValues((v) => ({
          ...v,
          "smtp.host": d["smtp.host"] ?? "",
          "smtp.port": d["smtp.port"] ?? "587",
          "smtp.secure": d["smtp.secure"] ?? "false",
          "smtp.user": d["smtp.user"] ?? "",
          "smtp.password": d["smtp.password"] ?? "",
          "smtp.from": d["smtp.from"] ?? "",
        }));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    setMsg("");
    try {
      for (const feld of FELDER) {
        await fetch("/api/einstellungen", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: feld.key, value: values[feld.key] }),
        });
      }
      setMsg("Gespeichert.");
    } catch {
      setMsg("Fehler beim Speichern.");
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    setTestMsg("");
    // Erst speichern, damit der Test die aktuellen Formulardaten aus der DB liest
    try {
      for (const feld of FELDER) {
        await fetch("/api/einstellungen", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: feld.key, value: values[feld.key] }),
        });
      }
    } catch {
      setTestMsg("✗ Fehler beim Speichern der Einstellungen vor dem Test");
      setTesting(false);
      return;
    }
    try {
      const res = await fetch("/api/einstellungen/smtp-test", { method: "POST" });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (data.ok) {
        setTestMsg("✓ Verbindung erfolgreich");
      } else {
        setTestMsg(`✗ Fehler: ${data.error ?? "Unbekannt"}`);
      }
    } catch {
      setTestMsg("✗ Verbindung fehlgeschlagen");
    } finally {
      setTesting(false);
    }
  }

  if (loading) return <div className="p-6 text-sm text-gray-500">Lade…</div>;

  return (
    <div className="max-w-xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/einstellungen" className="text-sm text-green-700 hover:underline">
          ← Einstellungen
        </Link>
      </div>
      <h1 className="text-xl font-bold mb-6">E-Mail / SMTP</h1>

      <div className="space-y-4 mb-6">
        {FELDER.map((feld) => {
          if (feld.type === "checkbox") {
            return (
              <label key={feld.key} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={values[feld.key] === "true"}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [feld.key]: e.target.checked ? "true" : "false" }))
                  }
                  className="w-4 h-4 accent-green-700"
                />
                <span className="text-sm font-medium text-gray-700">{feld.label}</span>
              </label>
            );
          }
          return (
            <div key={feld.key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{feld.label}</label>
              <input
                type={feld.type}
                value={values[feld.key]}
                placeholder={feld.placeholder}
                onChange={(e) => setValues((v) => ({ ...v, [feld.key]: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          );
        })}
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
          <span className={`text-sm ${testMsg.startsWith("✓") ? "text-green-700" : "text-red-600"}`}>
            {testMsg}
          </span>
        )}
      </div>

      <div className="mt-6 p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
        <p className="font-medium mb-1">Hinweis</p>
        <p>
          Die E-Mail-Funktion sendet Rechnungen (PDF + ZUGFeRD XML) direkt an Kunden.
          Verwende Port 587 mit STARTTLS oder Port 465 mit TLS/SSL (Haken setzen).
          Das Passwort wird verschlüsselt in der Datenbank gespeichert.
        </p>
      </div>
    </div>
  );
}
