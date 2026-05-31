"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const TYPEN = [
  { value: "festgehalt", label: "Festgehalt (monatl. Brutto)" },
  { value: "minijob", label: "Minijob (Monatspauschale)" },
  { value: "stundenbasis", label: "Stundenbasis (Stundenlohn)" },
];

export default function NeuerMitarbeiterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    vorname: "",
    nachname: "",
    typ: "festgehalt",
    eintrittsdatum: new Date().toISOString().split("T")[0],
    austrittsdatum: "",
    email: "",
    telefon: "",
    iban: "",
    bic: "",
    kontoinhaber: "",
    grundgehalt: "",
    minijobPauschale: "",
    stundenlohn: "",
    wochenstunden: "",
    urlaubstageProJahr: "24",
    kostenstelle: "",
    notiz: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const payload: Record<string, unknown> = {
      vorname: form.vorname.trim(),
      nachname: form.nachname.trim(),
      typ: form.typ,
      eintrittsdatum: form.eintrittsdatum,
      austrittsdatum: form.austrittsdatum || null,
      email: form.email || null,
      telefon: form.telefon || null,
      iban: form.iban || null,
      bic: form.bic || null,
      kontoinhaber: form.kontoinhaber || null,
      urlaubstageProJahr: parseInt(form.urlaubstageProJahr, 10) || 0,
      kostenstelle: form.kostenstelle || null,
      notiz: form.notiz || null,
    };

    if (form.typ === "festgehalt" && form.grundgehalt) payload.grundgehalt = parseFloat(form.grundgehalt);
    if (form.typ === "minijob" && form.minijobPauschale) payload.minijobPauschale = parseFloat(form.minijobPauschale);
    if (form.typ === "stundenbasis") {
      if (form.stundenlohn) payload.stundenlohn = parseFloat(form.stundenlohn);
      if (form.wochenstunden) payload.wochenstunden = parseFloat(form.wochenstunden);
    }
    if (form.wochenstunden && form.typ !== "stundenbasis") payload.wochenstunden = parseFloat(form.wochenstunden);

    try {
      const res = await fetch("/api/personal/mitarbeiter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Fehler beim Speichern");
        return;
      }
      const data = await res.json();
      router.push(`/personal/${data.id}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/personal" className="text-gray-400 hover:text-gray-600 text-sm">← Mitarbeiter</Link>
        <h1 className="text-2xl font-bold">Neuer Mitarbeiter</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border rounded-lg divide-y">

        {/* Stammdaten */}
        <div className="p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">Stammdaten</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vorname *</label>
              <input
                required
                value={form.vorname}
                onChange={(e) => set("vorname", e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nachname *</label>
              <input
                required
                value={form.nachname}
                onChange={(e) => set("nachname", e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Beschäftigungstyp *</label>
            <select
              required
              value={form.typ}
              onChange={(e) => set("typ", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none"
            >
              {TYPEN.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Eintrittsdatum *</label>
              <input
                type="date"
                required
                value={form.eintrittsdatum}
                onChange={(e) => set("eintrittsdatum", e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Austrittsdatum</label>
              <input
                type="date"
                value={form.austrittsdatum}
                onChange={(e) => set("austrittsdatum", e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Urlaubstage/Jahr</label>
              <input
                type="number"
                min="0"
                max="365"
                value={form.urlaubstageProJahr}
                onChange={(e) => set("urlaubstageProJahr", e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kostenstelle</label>
              <input
                value={form.kostenstelle}
                onChange={(e) => set("kostenstelle", e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Vergütung */}
        <div className="p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">Vergütung</h2>

          {form.typ === "festgehalt" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Grundgehalt brutto (€/Monat)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.grundgehalt}
                onChange={(e) => set("grundgehalt", e.target.value)}
                placeholder="z.B. 2500.00"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none"
              />
            </div>
          )}

          {form.typ === "minijob" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Monatliche Pauschale (€)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="556"
                value={form.minijobPauschale}
                onChange={(e) => set("minijobPauschale", e.target.value)}
                placeholder="max. 556,00 €"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none"
              />
            </div>
          )}

          {form.typ === "stundenbasis" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stundenlohn brutto (€/h)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.stundenlohn}
                  onChange={(e) => set("stundenlohn", e.target.value)}
                  placeholder="z.B. 15.00"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Wochenstunden (Soll)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="60"
                  value={form.wochenstunden}
                  onChange={(e) => set("wochenstunden", e.target.value)}
                  placeholder="z.B. 40"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>
            </div>
          )}

        </div>

        {/* Kontakt */}
        <div className="p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">Kontakt</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-Mail</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
              <input
                value={form.telefon}
                onChange={(e) => set("telefon", e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Bankverbindung */}
        <div className="p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">Bankverbindung</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">IBAN</label>
            <input
              value={form.iban}
              onChange={(e) => set("iban", e.target.value.toUpperCase())}
              placeholder="DE00 0000 0000 0000 0000 00"
              className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">BIC</label>
              <input
                value={form.bic}
                onChange={(e) => set("bic", e.target.value.toUpperCase())}
                className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kontoinhaber (falls abweichend)</label>
              <input
                value={form.kontoinhaber}
                onChange={(e) => set("kontoinhaber", e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Notiz */}
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notiz</label>
            <textarea
              rows={2}
              value={form.notiz}
              onChange={(e) => set("notiz", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
            />
          </div>
        </div>

        {/* Aktionen */}
        <div className="p-6 flex justify-end gap-3">
          {error && <p className="text-red-600 text-sm flex-1">{error}</p>}
          <Link href="/personal" className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">
            Abbrechen
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-800 disabled:opacity-50"
          >
            {saving ? "Speichern…" : "Speichern"}
          </button>
        </div>
      </form>
    </div>
  );
}
