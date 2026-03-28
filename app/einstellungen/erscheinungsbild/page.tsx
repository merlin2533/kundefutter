"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";

function FirmenlogoEditor() {
  const [logo, setLogo] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/einstellungen?prefix=system.")
      .then((r) => r.json())
      .then((d) => {
        if (d["system.logo"]) {
          setLogo(d["system.logo"]);
        }
      })
      .catch(() => {});
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      setError("Datei zu groß. Max. 3MB erlaubt.");
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    if (!preview) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/einstellungen", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "system.logo", value: preview }),
      });
      if (!res.ok) throw new Error();
      setLogo(preview);
      setPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Fehler beim Speichern des Logos.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/einstellungen", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "system.logo", value: "" }),
      });
      if (!res.ok) throw new Error();
      setLogo(null);
      setPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Fehler beim Entfernen des Logos.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold mb-1">Firmenlogo</h2>
      <p className="text-sm text-gray-500 mb-4">
        Wird im Header und als Favicon verwendet. Max. 2MB empfohlen (PNG, JPG, SVG, WebP).
      </p>

      {error && (
        <p className="text-xs text-red-600 mb-3">{error}</p>
      )}
      {saved && (
        <p className="text-xs text-green-600 mb-3">&#10003; Gespeichert</p>
      )}

      {(preview ?? logo) && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg inline-block">
          <img
            src={preview ?? logo ?? ""}
            alt="Logo Vorschau"
            className="h-16 w-auto object-contain"
          />
          {preview && (
            <p className="text-xs text-blue-600 mt-1">Vorschau – noch nicht gespeichert</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-center">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-gray-300 file:text-sm file:bg-white file:text-gray-700 file:cursor-pointer hover:file:bg-gray-50"
        />

        {preview && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50 transition-colors"
          >
            {saving ? "Speichern…" : "Speichern"}
          </button>
        )}

        {logo && !preview && (
          <button
            onClick={handleRemove}
            disabled={saving}
            className="px-4 py-1.5 text-sm border border-red-300 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50 transition-colors"
          >
            {saving ? "…" : "Logo entfernen"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function ErscheinungsbildPage() {
  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/einstellungen" className="hover:text-green-700">Einstellungen</Link>
        <span>›</span>
        <span className="text-gray-800 font-medium">Erscheinungsbild</span>
      </div>

      <h1 className="text-2xl font-bold mb-6">Erscheinungsbild</h1>

      <FirmenlogoEditor />
    </div>
  );
}
