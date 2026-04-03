"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter } from "next/navigation";
import SearchableSelect from "@/components/SearchableSelect";
import CameraUpload from "@/components/CameraUpload";
import VoiceInput from "@/components/VoiceInput";

interface Kunde {
  id: number;
  name: string;
  firma?: string | null;
  ort?: string | null;
}

interface KiErgebnis {
  kunde: { name: string; firma?: string };
  betreff: string;
  inhalt: string;
  typ: string;
}

type Step = 1 | 2 | 3;

const TYP_OPTIONS = [
  { value: "besuch", label: "Besuch" },
  { value: "anruf", label: "Anruf" },
  { value: "email", label: "E-Mail" },
  { value: "notiz", label: "Notiz" },
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function Stepper({ step }: { step: Step }) {
  const steps = [
    { n: 1, label: "Upload" },
    { n: 2, label: "Analyse & Bearbeitung" },
    { n: 3, label: "Bestätigung" },
  ];
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${
                step === s.n
                  ? "bg-green-600 border-green-600 text-white"
                  : step > s.n
                  ? "bg-green-100 border-green-400 text-green-700"
                  : "bg-white border-gray-300 text-gray-400"
              }`}
            >
              {step > s.n ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                s.n
              )}
            </div>
            <span
              className={`mt-1.5 text-xs font-medium whitespace-nowrap ${
                step === s.n ? "text-green-700" : step > s.n ? "text-green-500" : "text-gray-400"
              }`}
            >
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={`h-0.5 w-12 sm:w-20 mx-1 mb-5 transition-colors ${
                step > s.n ? "bg-green-400" : "bg-gray-200"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function konfidenzBadge(level: "hoch" | "mittel" | "niedrig") {
  if (level === "hoch") return <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700 font-medium">Hohe Konfidenz</span>;
  if (level === "mittel") return <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-700 font-medium">Mittlere Konfidenz</span>;
  return <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 font-medium">Keine Übereinstimmung</span>;
}

type InputMode = "image" | "voice";

function KiCrmWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);

  // Step 1
  const [inputMode, setInputMode] = useState<InputMode>("image");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");

  // Step 2
  const [kunden, setKunden] = useState<Kunde[]>([]);
  const [kundeId, setKundeId] = useState("");
  const [konfidenz, setKonfidenz] = useState<"hoch" | "mittel" | "niedrig">("niedrig");
  const [typ, setTyp] = useState("besuch");
  const [betreff, setBetreff] = useState("");
  const [inhalt, setInhalt] = useState("");
  const [datum, setDatum] = useState(today());
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");

  // Step 3
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Load Kunden on mount
  useEffect(() => {
    fetch("/api/kunden?limit=500")
      .then((r) => r.json())
      .then((data) => {
        const list: Kunde[] = Array.isArray(data) ? data : (data.kunden ?? []);
        setKunden(list);
      })
      .catch(() => {});
  }, []);

  const kundenOptions = kunden.map((k) => ({
    value: String(k.id),
    label: k.name,
    sub: [k.firma, k.ort].filter(Boolean).join(", "),
  }));

  // Voice transcript state
  const [voiceText, setVoiceText] = useState("");

  // Match kunde by name or firma (case-insensitive)
  function matchKunde(kiKunde: { name: string; firma?: string }, kundenList: Kunde[]): { id: string; konfidenz: "hoch" | "mittel" | "niedrig" } {
    const needle = (kiKunde.firma || kiKunde.name).toLowerCase();
    const needleName = kiKunde.name.toLowerCase();

    // Exact match on firma or name
    let match = kundenList.find(
      (k) =>
        (k.firma && k.firma.toLowerCase() === needle) ||
        k.name.toLowerCase() === needleName
    );
    if (match) return { id: String(match.id), konfidenz: "hoch" };

    // Contains match on firma or name (min 3 Zeichen)
    if (needle.length >= 3) {
      match = kundenList.find(
        (k) =>
          (k.firma && (k.firma.toLowerCase().includes(needle) || needle.includes(k.firma.toLowerCase()))) ||
          k.name.toLowerCase().includes(needleName) ||
          needleName.includes(k.name.toLowerCase())
      );
      if (match) return { id: String(match.id), konfidenz: "mittel" };
    }

    return { id: "", konfidenz: "niedrig" };
  }

  // Voice: analyze text via KI
  async function goToStep2Voice() {
    if (!voiceText.trim()) return;
    setStep(2);
    setAnalyzing(true);
    setAnalyzeError("");

    try {
      const res = await fetch("/api/ki/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: voiceText, feature: "crm" }),
      });
      if (!res.ok) throw new Error(`Fehler ${res.status}`);
      const data = await res.json();
      const ergebnis: KiErgebnis = data.ergebnis;

      setBetreff(ergebnis.betreff ?? "");
      setInhalt(ergebnis.inhalt ?? voiceText);
      setTyp(TYP_OPTIONS.find((t) => t.value === ergebnis.typ)?.value ?? "notiz");

      const { id, konfidenz: k } = matchKunde(ergebnis.kunde, kunden);
      setKundeId(id);
      setKonfidenz(k);
    } catch (e: unknown) {
      setAnalyzeError(e instanceof Error ? e.message : "Analyse fehlgeschlagen.");
    } finally {
      setAnalyzing(false);
    }
  }

  // Step 1 -> 2: run KI analysis (image)
  async function goToStep2() {
    if (inputMode === "voice") {
      return goToStep2Voice();
    }
    if (!imageFile || !imagePreview) return;
    setStep(2);
    setAnalyzing(true);
    setAnalyzeError("");

    try {
      const base64 = imagePreview.split(",")[1];
      const res = await fetch("/api/ki/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, feature: "crm" }),
      });
      if (!res.ok) throw new Error(`Fehler ${res.status}`);
      const data = await res.json();
      const ergebnis: KiErgebnis = data.ergebnis;

      // Pre-fill fields
      setBetreff(ergebnis.betreff ?? "");
      setInhalt(ergebnis.inhalt ?? "");
      setTyp(TYP_OPTIONS.find((t) => t.value === ergebnis.typ)?.value ?? "notiz");

      // Kunde matching
      const { id, konfidenz: k } = matchKunde(ergebnis.kunde, kunden);
      setKundeId(id);
      setKonfidenz(k);
    } catch (e: unknown) {
      setAnalyzeError(e instanceof Error ? e.message : "Analyse fehlgeschlagen.");
    } finally {
      setAnalyzing(false);
    }
  }

  // Step 2 -> 3
  function goToStep3() {
    setStep(3);
    setSaveError("");
  }

  // Step 3: save
  async function handleSave() {
    if (!kundeId) return;
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch("/api/kunden/aktivitaeten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kundeId: parseInt(kundeId, 10),
          typ,
          betreff,
          inhalt,
          datum: new Date(datum).toISOString(),
        }),
      });
      if (!res.ok) throw new Error(`Fehler ${res.status}`);
      router.push("/crm");
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
      setSaving(false);
    }
  }

  const selectedKunde = kunden.find((k) => String(k.id) === kundeId);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-2 text-gray-900">KI-CRM Notiz</h1>
      <p className="text-gray-500 text-sm mb-6">Dokument hochladen, KI analysiert und erstellt automatisch eine CRM-Aktivität.</p>

      <Stepper step={step} />

      {/* ---- STEP 1: Upload / Spracheingabe ---- */}
      {step === 1 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
          {/* Mode tabs */}
          <div className="flex gap-1 mb-5 bg-gray-100 rounded-lg p-1">
            <button
              type="button"
              onClick={() => setInputMode("image")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-colors ${
                inputMode === "image"
                  ? "bg-white text-green-700 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Bild / Kamera
            </button>
            <button
              type="button"
              onClick={() => setInputMode("voice")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-colors ${
                inputMode === "voice"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-14 0m7 7v4m-4 0h8M12 1a3 3 0 00-3 3v7a3 3 0 006 0V4a3 3 0 00-3-3z" />
              </svg>
              Spracheingabe
            </button>
          </div>

          {/* Image mode */}
          {inputMode === "image" && (
            <>
              <h2 className="text-lg font-semibold mb-4 text-gray-800">Dokument hochladen</h2>
              <CameraUpload
                onImageSelected={(file, preview) => {
                  setImageFile(file);
                  setImagePreview(preview);
                }}
                imagePreview={imagePreview}
                imageName={imageFile?.name ?? "Dokument"}
                onRemove={() => {
                  setImageFile(null);
                  setImagePreview("");
                }}
              />
              <div className="flex justify-end mt-6">
                <button
                  type="button"
                  onClick={goToStep2}
                  disabled={!imagePreview}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-green-600 text-white font-medium text-sm hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Weiter &rarr;
                </button>
              </div>
            </>
          )}

          {/* Voice mode */}
          {inputMode === "voice" && (
            <>
              <h2 className="text-lg font-semibold mb-4 text-gray-800">Spracheingabe</h2>
              <p className="text-sm text-gray-500 mb-4">
                Sprechen Sie Ihre Notiz ein (max. 2 Minuten). Die KI erkennt Kunde, Typ und Inhalt automatisch.
              </p>

              <VoiceInput
                onTranscript={(text) => setVoiceText(text)}
                maxDurationSec={120}
                placeholder="Aufnahme starten (max. 2 Min.)"
              />

              {voiceText && (
                <div className="mt-4 space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Erkannter Text</label>
                  <textarea
                    value={voiceText}
                    onChange={(e) => setVoiceText(e.target.value)}
                    rows={4}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                  />
                </div>
              )}

              <div className="flex justify-end mt-6">
                <button
                  type="button"
                  onClick={goToStep2}
                  disabled={!voiceText.trim()}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-green-600 text-white font-medium text-sm hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Weiter &rarr;
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ---- STEP 2: Analyse & Bearbeitung ---- */}
      {step === 2 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-800">Analyse &amp; Bearbeitung</h2>

          {analyzing && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="w-12 h-12 border-4 border-green-200 border-t-green-600 rounded-full animate-spin" />
              <p className="text-sm text-gray-500 font-medium">KI analysiert Dokument...</p>
            </div>
          )}

          {analyzeError && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              {analyzeError}
            </div>
          )}

          {!analyzing && (
            <div className="space-y-5">
              {/* Kunde */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kunde
                  {konfidenzBadge(konfidenz)}
                </label>
                <SearchableSelect
                  options={kundenOptions}
                  value={kundeId}
                  onChange={(v) => {
                    setKundeId(v);
                    setKonfidenz(v ? "hoch" : "niedrig");
                  }}
                  placeholder="Kunde suchen und auswählen..."
                />
                {konfidenz === "niedrig" && !kundeId && (
                  <p className="mt-1 text-xs text-red-500">Kein passender Kunde gefunden – bitte manuell auswählen.</p>
                )}
              </div>

              {/* Typ */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Typ</label>
                <select
                  value={typ}
                  onChange={(e) => setTyp(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                >
                  {TYP_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {/* Betreff */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Betreff</label>
                <input
                  type="text"
                  value={betreff}
                  onChange={(e) => setBetreff(e.target.value)}
                  placeholder="Betreff der Aktivität"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                />
              </div>

              {/* Inhalt */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Inhalt</label>
                <textarea
                  value={inhalt}
                  onChange={(e) => setInhalt(e.target.value)}
                  placeholder="Inhalt der Aktivität..."
                  rows={6}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 resize-y min-h-[140px]"
                />
              </div>

              {/* Datum */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Datum</label>
                <input
                  type="date"
                  value={datum}
                  onChange={(e) => setDatum(e.target.value)}
                  className="w-full sm:w-48 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                />
              </div>
            </div>
          )}

          {!analyzing && (
            <div className="flex justify-between mt-6">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-5 py-2.5 rounded-lg bg-gray-100 text-gray-700 font-medium text-sm hover:bg-gray-200 transition-colors"
              >
                &larr; Zurück
              </button>
              <button
                type="button"
                onClick={goToStep3}
                disabled={!kundeId || !betreff}
                className="px-6 py-2.5 rounded-lg bg-green-600 text-white font-medium text-sm hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Weiter &rarr;
              </button>
            </div>
          )}
        </div>
      )}

      {/* ---- STEP 3: Bestätigung ---- */}
      {step === 3 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-800">Bestätigung</h2>

          <div className="rounded-xl border border-gray-200 bg-gray-50 divide-y divide-gray-200 mb-5">
            <div className="px-4 py-3 flex gap-3 text-sm">
              <span className="font-medium text-gray-500 w-20 shrink-0">Kunde</span>
              <span className="text-gray-900 font-semibold">
                {selectedKunde ? selectedKunde.name : "—"}
                {selectedKunde?.firma && (
                  <span className="text-gray-500 font-normal ml-1">({selectedKunde.firma})</span>
                )}
              </span>
            </div>
            <div className="px-4 py-3 flex gap-3 text-sm">
              <span className="font-medium text-gray-500 w-20 shrink-0">Typ</span>
              <span className="text-gray-900 capitalize">{TYP_OPTIONS.find((t) => t.value === typ)?.label ?? typ}</span>
            </div>
            <div className="px-4 py-3 flex gap-3 text-sm">
              <span className="font-medium text-gray-500 w-20 shrink-0">Betreff</span>
              <span className="text-gray-900">{betreff}</span>
            </div>
            <div className="px-4 py-3 flex gap-3 text-sm">
              <span className="font-medium text-gray-500 w-20 shrink-0">Datum</span>
              <span className="text-gray-900">
                {datum
                  ? new Date(datum + "T12:00:00").toLocaleDateString("de-DE", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })
                  : "—"}
              </span>
            </div>
          </div>

          {inhalt && (
            <div className="mb-5">
              <p className="text-xs font-medium text-gray-500 mb-1.5">Inhalt</p>
              <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 whitespace-pre-wrap max-h-48 overflow-y-auto">
                {inhalt}
              </div>
            </div>
          )}

          {saveError && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              {saveError}
            </div>
          )}

          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={saving}
              className="px-5 py-2.5 rounded-lg bg-gray-100 text-gray-700 font-medium text-sm hover:bg-gray-200 disabled:opacity-40 transition-colors"
            >
              &larr; Zurück
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !kundeId}
              className="px-6 py-2.5 rounded-lg bg-green-600 text-white font-medium text-sm hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {saving && (
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" />
              )}
              CRM-Aktivität speichern
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function KiCrmPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse mb-6" />
          <div className="bg-white rounded-xl border border-gray-200 p-6 h-64 animate-pulse" />
        </div>
      }
    >
      <KiCrmWizard />
    </Suspense>
  );
}
