"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";

const TYPEN = [
  { value: "besuch",  label: "Besuch",  icon: "🏠" },
  { value: "anruf",   label: "Anruf",   icon: "📞" },
  { value: "email",   label: "E-Mail",  icon: "✉️" },
  { value: "notiz",   label: "Notiz",   icon: "📝" },
  { value: "aufgabe", label: "Aufgabe", icon: "✅" },
];

export default function NeueAktivitaetPage() {
  const params = useParams();
  const router = useRouter();
  const kundeId = params.id as string;

  const now = new Date();
  const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  const [typ, setTyp] = useState("besuch");
  const [betreff, setBetreff] = useState("");
  const [inhalt, setInhalt] = useState("");
  const [datum, setDatum] = useState(localNow);
  const [faelligAm, setFaelligAm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!betreff.trim()) { setError("Bitte Betreff eingeben."); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/kunden/aktivitaeten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kundeId: Number(kundeId),
          typ,
          betreff: betreff.trim(),
          inhalt: inhalt.trim() || null,
          datum,
          faelligAm: faelligAm || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Fehler beim Speichern");
        return;
      }
      router.push(`/kunden/${kundeId}?tab=CRM`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto">
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="text-sm text-gray-500 hover:text-gray-700 mb-3 flex items-center gap-1"
        >
          ← Zurück
        </button>
        <h1 className="text-2xl font-bold">Neue Aktivität erfassen</h1>
        <p className="text-sm text-gray-500 mt-0.5">Besuch, Anruf, Notiz oder Aufgabe zum Kunden dokumentieren.</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
        )}

        {/* Typ */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Typ</label>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {TYPEN.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTyp(t.value)}
                className={`flex flex-col items-center gap-1 py-3 rounded-lg border text-sm transition-colors ${
                  typ === t.value
                    ? "bg-green-700 text-white border-green-700"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                }`}
              >
                <span className="text-lg">{t.icon}</span>
                <span className="text-xs">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Datum */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Datum & Uhrzeit</label>
          <input
            type="datetime-local"
            value={datum}
            onChange={(e) => setDatum(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
          />
        </div>

        {/* Betreff */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Betreff / Titel <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={betreff}
            onChange={(e) => setBetreff(e.target.value)}
            required
            placeholder="z.B. Hofbesuch wegen Herbstbestellung 2026"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
          />
        </div>

        {/* Inhalt */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notizen / Details</label>
          <textarea
            rows={5}
            value={inhalt}
            onChange={(e) => setInhalt(e.target.value)}
            placeholder="Gesprächsinhalt, Ergebnisse, Vereinbarungen, nächste Schritte…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 resize-none"
          />
        </div>

        {/* Fällig am (nur Aufgaben) */}
        {typ === "aufgabe" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fällig am</label>
            <input
              type="date"
              value={faelligAm}
              onChange={(e) => setFaelligAm(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 py-2.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Abbrechen
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 py-2.5 text-sm bg-green-700 hover:bg-green-800 text-white rounded-lg font-medium transition-colors disabled:opacity-60"
          >
            {saving ? "Speichere…" : "Aktivität speichern"}
          </button>
        </div>
      </form>
    </div>
  );
}
