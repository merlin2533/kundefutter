"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import SearchableSelect from "@/components/SearchableSelect";

interface Kunde {
  id: number;
  name: string;
  firma: string | null;
}

// Typen für Web Speech API (nicht überall in tsconfig enthalten)
type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { resultIndex: number; results: { isFinal: boolean; 0: { transcript: string } }[] }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

function getSpeechRecognition(): SpeechRecognitionConstructor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export default function SprachmemoPage() {
  const [kunden, setKunden] = useState<Kunde[]>([]);
  const [kundeId, setKundeId] = useState("");
  const [transkription, setTranskription] = useState("");
  const [aufnahme, setAufnahme] = useState(false);
  const [sprachVerfuegbar, setSprachVerfuegbar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [gespeichert, setGespeichert] = useState(false);
  const [fehler, setFehler] = useState("");

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  useEffect(() => {
    setSprachVerfuegbar(!!getSpeechRecognition());

    // Kunden laden
    fetch("/api/kunden?limit=200&aktiv=true")
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setKunden(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  const kundenOptionen = kunden.map((k) => ({
    value: String(k.id),
    label: k.firma ? `${k.firma} (${k.name})` : k.name,
  }));

  function startAufnahme() {
    const SR = getSpeechRecognition();
    if (!SR) return;

    const recognition = new SR();
    recognition.lang = "de-DE";
    recognition.continuous = true;
    recognition.interimResults = true;

    let finalText = transkription;

    recognition.onresult = (event) => {
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += (finalText ? " " : "") + result[0].transcript.trim();
        } else {
          interimText += result[0].transcript;
        }
      }
      setTranskription(finalText + (interimText ? " " + interimText : ""));
    };

    recognition.onerror = () => {
      setAufnahme(false);
      setFehler("Fehler bei der Spracherkennung. Bitte erneut versuchen.");
    };

    recognition.onend = () => {
      setTranskription(finalText);
      setAufnahme(false);
    };

    recognition.start();
    recognitionRef.current = recognition;
    setAufnahme(true);
    setFehler("");
  }

  function stopAufnahme() {
    recognitionRef.current?.stop();
    setAufnahme(false);
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
        Diktiere eine Notiz und speichere sie direkt als CRM-Aktivität beim Kunden.
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

        {/* Aufnahme-Button */}
        <div className="flex flex-col items-center gap-3">
          {sprachVerfuegbar ? (
            <>
              <button
                type="button"
                onClick={aufnahme ? stopAufnahme : startAufnahme}
                className={`w-24 h-24 rounded-full text-3xl font-bold shadow-md transition-all ${
                  aufnahme
                    ? "bg-red-500 hover:bg-red-600 text-white animate-pulse"
                    : "bg-green-700 hover:bg-green-800 text-white"
                }`}
                title={aufnahme ? "Aufnahme stoppen" : "Aufnahme starten"}
              >
                {aufnahme ? "⏹" : "🎤"}
              </button>
              <p className="text-sm text-gray-500">
                {aufnahme ? (
                  <span className="text-red-600 font-medium">Aufnahme läuft… klicken zum Stoppen</span>
                ) : (
                  "Klicken zum Starten der Spracherkennung"
                )}
              </p>
            </>
          ) : (
            <div className="text-center p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800 font-medium">
                Spracherkennung nicht verfügbar
              </p>
              <p className="text-xs text-yellow-600 mt-1">
                Dein Browser unterstützt keine Web Speech API. Bitte Text manuell eingeben.
              </p>
            </div>
          )}
        </div>

        {/* Transkriptions-Textarea */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Transkription / Notiztext
          </label>
          <textarea
            value={transkription}
            onChange={(e) => setTranskription(e.target.value)}
            rows={6}
            placeholder={
              sprachVerfuegbar
                ? "Hier erscheint der transkribierte Text. Du kannst ihn auch direkt bearbeiten…"
                : "Text hier manuell eingeben…"
            }
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
