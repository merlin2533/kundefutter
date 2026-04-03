"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const defaultForm = {
  name: "",
  ansprechpartner: "",
  email: "",
  telefon: "",
  strasse: "",
  plz: "",
  ort: "",
  notizen: "",
};

const inputCls =
  "w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600";

export default function NeuerLieferantPage() {
  const router = useRouter();
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Name ist erforderlich.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/lieferanten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          ansprechpartner: form.ansprechpartner || undefined,
          email: form.email || undefined,
          telefon: form.telefon || undefined,
          strasse: form.strasse || undefined,
          plz: form.plz || undefined,
          ort: form.ort || undefined,
          notizen: form.notizen || undefined,
        }),
      });
      if (res.ok) {
        router.push("/lieferanten");
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Fehler beim Speichern.");
      }
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-0">
      <Link
        href="/lieferanten"
        className="text-sm text-green-700 hover:underline inline-block mb-4"
      >
        &larr; Zur&uuml;ck zur Lieferantenliste
      </Link>

      <h1 className="text-2xl font-bold mb-6">Neuen Lieferanten anlegen</h1>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 space-y-4"
      >
        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={inputCls}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Ansprechpartner
          </label>
          <input
            type="text"
            value={form.ansprechpartner}
            onChange={(e) =>
              setForm({ ...form, ansprechpartner: e.target.value })
            }
            className={inputCls}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              E-Mail
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Telefon
            </label>
            <input
              type="tel"
              value={form.telefon}
              onChange={(e) => setForm({ ...form, telefon: e.target.value })}
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Stra&szlig;e
          </label>
          <input
            type="text"
            value={form.strasse}
            onChange={(e) => setForm({ ...form, strasse: e.target.value })}
            className={inputCls}
          />
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              PLZ
            </label>
            <input
              type="text"
              value={form.plz}
              onChange={(e) => setForm({ ...form, plz: e.target.value })}
              className={inputCls}
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ort
            </label>
            <input
              type="text"
              value={form.ort}
              onChange={(e) => setForm({ ...form, ort: e.target.value })}
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notizen
          </label>
          <textarea
            rows={3}
            value={form.notizen}
            onChange={(e) => setForm({ ...form, notizen: e.target.value })}
            className={`${inputCls} resize-none`}
          />
        </div>

        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
          <Link
            href="/lieferanten"
            className="px-4 py-2.5 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 inline-flex items-center justify-center w-full sm:w-auto"
          >
            Abbrechen
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2.5 text-sm rounded-lg bg-green-700 hover:bg-green-600 text-white font-medium disabled:opacity-60 w-full sm:w-auto"
          >
            {saving ? "Speichern\u2026" : "Lieferant anlegen"}
          </button>
        </div>
      </form>
    </div>
  );
}
