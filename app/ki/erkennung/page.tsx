"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/Card";

interface RouterResult {
  typ: string;
  confidence: number;
  begruendung?: string | null;
  hinweis?: string | null;
  redirectUrl: string;
  maskeName: string;
}

const TYP_LABEL: Record<string, string> = {
  lieferschein: "📦 Lieferschein",
  rechnung: "🧾 Rechnung",
  bodenprobe: "🧪 Bodenprobe",
  sachkundenachweis: "📜 Sachkundenachweis",
  visitenkarte: "📇 Visitenkarte",
  sortenversuch: "🌾 Sortenversuch",
  agrarantrag: "🗺️ Agrarantrag / Flächenliste",
  ausgabenbeleg: "💰 Ausgabenbeleg",
  unbekannt: "❓ Unbekannt",
};

export default function ErkennungPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RouterResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function analysiere(f: File) {
    setLoading(true); setError(null); setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/ki/router", { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error ?? "Erkennung fehlgeschlagen");
        return;
      }
      const json = await res.json() as RouterResult;
      setResult(json);
    } catch {
      setError("Netzwerkfehler bei KI-Analyse");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">🤖 KI-Belegerkennung</h1>
      <p className="text-sm text-gray-500 mb-6">
        Lade ein beliebiges Geschäftsdokument hoch — die KI erkennt automatisch, ob es ein Lieferschein,
        eine Rechnung, eine Bodenprobe, ein Sachkundenachweis, eine Visitenkarte, ein Sortenversuch,
        ein Agrarantrag oder ein Ausgabenbeleg ist, und führt dich zur passenden Maske.
      </p>

      <Card>
        <div className="flex items-start gap-3 mb-4">
          <span className="text-3xl">📥</span>
          <div>
            <h2 className="font-semibold">Dokument hochladen</h2>
            <p className="text-sm text-gray-500 mt-0.5">PDF, Foto oder Screenshot — max. 30 MB.</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <label className={`cursor-pointer inline-flex items-center gap-2 text-white text-sm px-4 py-2 rounded ${loading ? "bg-gray-400" : "bg-green-700 hover:bg-green-800"}`}>
            {file ? file.name : "Datei wählen…"}
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              disabled={loading}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setFile(f);
                await analysiere(f);
                if (inputRef.current) inputRef.current.value = "";
              }}
            />
          </label>
          {file && !loading && (
            <button type="button" onClick={() => { setFile(null); setResult(null); setError(null); }}
              className="text-xs text-gray-500 hover:text-red-600 hover:underline">Entfernen</button>
          )}
          {loading && <span className="text-sm text-gray-500">KI analysiert…</span>}
        </div>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded p-3 text-red-700 text-sm">{error}</div>
        )}

        {result && (
          <div className="mt-4 space-y-3">
            <div className="border rounded p-4 bg-gradient-to-r from-green-50 to-emerald-50">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xl font-bold">{TYP_LABEL[result.typ] ?? result.typ}</div>
                <div className="text-xs text-gray-600">
                  Konfidenz: <span className="font-semibold">{Math.round(result.confidence * 100)}%</span>
                </div>
              </div>
              {result.begruendung && (
                <p className="text-sm text-gray-700">{result.begruendung}</p>
              )}
              {result.hinweis && (
                <p className="text-xs text-gray-500 mt-1">ℹ {result.hinweis}</p>
              )}
            </div>

            {result.redirectUrl && result.typ !== "unbekannt" ? (
              <button
                onClick={() => router.push(result.redirectUrl)}
                className="w-full bg-green-700 text-white px-5 py-3 rounded hover:bg-green-800 font-medium"
              >
                → Weiter zu „{result.maskeName}"
              </button>
            ) : (
              <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3">
                Konnte den Belegtyp nicht eindeutig bestimmen — bitte manuell in der passenden Maske erfassen.
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
