"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const FALLBACK_KATEGORIEN = ["Landwirt", "Pferdehof", "Kleintierhalter", "Großhändler", "Sonstige"];

export default function NeuerKundePage() {
  const router = useRouter();
  const [kategorien, setKategorien] = useState<string[]>(FALLBACK_KATEGORIEN);
  const [mitarbeiter, setMitarbeiter] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    firma: "",
    kategorie: "",
    verantwortlicher: "",
    strasse: "",
    plz: "",
    ort: "",
    land: "Deutschland",
    notizen: "",
  });

  useEffect(() => {
    fetch("/api/einstellungen?prefix=system.")
      .then((r) => r.json())
      .then((d) => {
        if (d["system.kundenkategorien"]) {
          try {
            setKategorien(JSON.parse(d["system.kundenkategorien"]));
          } catch {
            /* ignore */
          }
        }
        if (d["system.mitarbeiter"]) {
          try {
            setMitarbeiter(JSON.parse(d["system.mitarbeiter"]));
          } catch {
            /* ignore */
          }
        }
      });
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      const res = await fetch("/api/kunden", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          kategorie: form.kategorie || kategorien[0] || "Sonstige",
          verantwortlicher: form.verantwortlicher || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Fehler beim Speichern");
      }

      const kunde = await res.json();
      router.push("/kunden/" + kunde.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600";

  return (
    <div className="max-w-xl mx-auto py-8 px-4">
      <Link
        href="/kunden"
        className="text-green-700 hover:text-green-900 text-sm mb-4 inline-block"
      >
        &larr; Zur&uuml;ck zur Kundenliste
      </Link>

      <h1 className="text-2xl font-bold mb-6">Neuen Kunden anlegen</h1>

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="name"
            required
            value={form.name}
            onChange={handleChange}
            className={inputClass}
          />
        </div>

        {/* Firma */}
        <div>
          <label className="block text-sm font-medium mb-1">Firma</label>
          <input
            type="text"
            name="firma"
            value={form.firma}
            onChange={handleChange}
            className={inputClass}
          />
        </div>

        {/* Kategorie + Verantwortlicher */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Kategorie</label>
            <select
              name="kategorie"
              value={form.kategorie}
              onChange={handleChange}
              className={inputClass}
            >
              {kategorien.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Verantwortlicher</label>
            <select
              name="verantwortlicher"
              value={form.verantwortlicher}
              onChange={handleChange}
              className={inputClass}
            >
              <option value="">— Kein Verantwortlicher —</option>
              {mitarbeiter.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Straße */}
        <div>
          <label className="block text-sm font-medium mb-1">Stra&szlig;e</label>
          <input
            type="text"
            name="strasse"
            value={form.strasse}
            onChange={handleChange}
            className={inputClass}
          />
        </div>

        {/* PLZ + Ort */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">PLZ</label>
            <input
              type="text"
              name="plz"
              value={form.plz}
              onChange={handleChange}
              className={inputClass}
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium mb-1">Ort</label>
            <input
              type="text"
              name="ort"
              value={form.ort}
              onChange={handleChange}
              className={inputClass}
            />
          </div>
        </div>

        {/* Land */}
        <div>
          <label className="block text-sm font-medium mb-1">Land</label>
          <input
            type="text"
            name="land"
            value={form.land}
            onChange={handleChange}
            className={inputClass}
          />
        </div>

        {/* Notizen */}
        <div>
          <label className="block text-sm font-medium mb-1">Notizen</label>
          <textarea
            name="notizen"
            rows={4}
            value={form.notizen}
            onChange={handleChange}
            className={inputClass}
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={saving}
          className="w-full bg-green-700 hover:bg-green-800 text-white font-medium py-2.5 px-4 rounded-lg disabled:opacity-50 transition-colors"
        >
          {saving ? "Speichern..." : "Kunden anlegen"}
        </button>
      </form>
    </div>
  );
}
