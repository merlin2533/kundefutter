"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SearchableSelect from "@/components/SearchableSelect";
import AudioRecorder from "@/components/AudioRecorder";
import { fetchAlleSeiten } from "@/lib/kiMatching";

interface Kunde {
  id: number;
  name: string;
  firma: string | null;
}

// Lädt alle aktiven Kunden vollständig durch — ein festes Limit würde bei
// wachsendem Kundenstamm irgendwann wieder Einträge in der Auswahl fehlen
// lassen (siehe fetchAlleSeiten in lib/kiMatching.ts).
async function ladeAlleKunden(): Promise<Kunde[]> {
  return fetchAlleSeiten<Kunde>(async (page) => {
    const res = await fetch(`/api/kunden?aktiv=true&page=${page}&limit=1000`);
    if (!res.ok) return null;
    const json = await res.json();
    return { items: Array.isArray(json.data) ? json.data : [], total: json.total ?? 0 };
  });
}

export default function SprachmemoPage() {
  const [kunden, setKunden] = useState<Kunde[]>([]);
  const [kundeId, setKundeId] = useState("");
  const [transkription, setTranskription] = useState("");
  const [saving, setSaving] = useState(false);
  const [gespeichert, setGespeichert] = useState(false);
  const [fehler, setFehler] = useState("");

  useEffect(() => {
    ladeAlleKunden().then(setKunden).catch(() => {});
  }, []);

  const kundenOptionen = kunden.map((k) => ({
    value: String(k.id),
    label: k.firma ? `${k.firma} (${k.name})` : k.name,
  }));

  function handleTranscript(text: string) {
    setFehler("");
    setTranskription((prev) => (prev ? `${prev} ${text}` : text));
  }

  async function handleSpeichern() {
    if (!kundeId) {
      setFehler("Bitte einen Kunden auswählen.");
      return;
    }
    if (!transkription.trim()) {
      setFehler("Kein Text vorhanden. Bitte Aufnahme starten oder Text eingeben.");
      return;
    }
    setSaving(true);
    setFehler("");
    try {
      const res = await fetch("/api/kunden/aktivitaeten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kundeId: Number(kundeId),
          typ: "notiz",
          betreff: "Sprachmemo",
          inhalt: transkription.trim(),
          datum: new Date().toISOString(),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Fehler beim Speichern.");
      }
      setGespeichert(true);
      setTranskription("");
      setKundeId("");
      setTimeout(() => setGespeichert(false), 3000);
    } catch (err) {
      setFehler(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/ki" className="hover:text-green-700">KI-Funktionen</Link>
        <span>›</span>
        <span className="text-gray-900 font-medium">Sprachmemo → CRM-Notiz</span>
      </nav>

      <h1 className="text-2xl font-bold text-gray-900 mb-2">Sprachmemo → CRM-Notiz</h1>
      <p className="text-sm text-gray-500 mb-6">
        Diktiere eine Notiz (transkribiert via Mistral) und speichere sie direkt als CRM-Aktivität beim Kunden.
      </p>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 space-y-5">
        {/* Kundenauswahl */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Kunde <span className="text-red-500">*</span>
          </label>
          <SearchableSelect
            options={kundenOptionen}
            value={kundeId}
            onChange={setKundeId}
            placeholder="Kunden suchen…"
          />
        </div>

        {/* Aufnahme */}
        <AudioRecorder
          onTranscript={handleTranscript}
          feature="sprachmemo"
          maxDurationSec={180}
          placeholder="Aufnahme starten (max. 3 Min.)"
        />

        {/* Transkriptions-Textarea */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Transkription / Notiztext
          </label>
          <textarea
            value={transkription}
            onChange={(e) => setTranskription(e.target.value)}
            rows={6}
            placeholder="Hier erscheint der transkribierte Text. Du kannst ihn auch direkt bearbeiten oder manuell eingeben…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 resize-y"
          />
          {transkription.trim() && (
            <p className="text-xs text-gray-400 mt-1 text-right">
              {transkription.trim().split(/\s+/).length} Wörter
            </p>
          )}
        </div>

        {/* Fehler / Erfolg */}
        {fehler && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            {fehler}
          </div>
        )}
        {gespeichert && (
          <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3 font-medium">
            Notiz erfolgreich als CRM-Aktivität gespeichert ✓
          </div>
        )}

        {/* Aktionen */}
        <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-between pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={() => { setTranskription(""); setFehler(""); }}
            disabled={!transkription && !fehler}
            className="w-full sm:w-auto px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            Leeren
          </button>
          <button
            type="button"
            onClick={handleSpeichern}
            disabled={saving || !transkription.trim() || !kundeId}
            className="w-full sm:w-auto px-5 py-2 bg-green-700 hover:bg-green-800 text-white text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Speichere…" : "Als CRM-Notiz speichern"}
          </button>
        </div>
      </div>

      {/* Hinweis */}
      <p className="text-xs text-gray-400 mt-4 text-center">
        Die Notiz wird als Aktivität vom Typ &ldquo;Notiz&rdquo; mit dem Betreff &ldquo;Sprachmemo&rdquo; beim Kunden gespeichert.
      </p>
    </div>
  );
}
