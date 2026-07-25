"use client";

import { useState } from "react";
import * as Sentry from "@sentry/nextjs";

export interface NeuKundeErgebnis {
  id: number;
  name: string;
  firma: string | null;
  ort: string | null;
}

interface NeuKundeForm {
  name: string;
  firma: string;
  telefon: string;
  strasse: string;
  plz: string;
  ort: string;
}

export default function NeuKundeInline({
  kiName,
  kiFirma,
  kiOrt,
  onCreated,
  onCancel,
}: {
  kiName: string;
  kiFirma?: string;
  kiOrt?: string;
  onCreated: (kunde: NeuKundeErgebnis) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<NeuKundeForm>({
    name: kiName,
    firma: kiFirma ?? "",
    telefon: "",
    strasse: "",
    plz: "",
    ort: kiOrt ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    setError("");
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        firma: form.firma.trim() || undefined,
        strasse: form.strasse.trim() || undefined,
        plz: form.plz.trim() || undefined,
        ort: form.ort.trim() || undefined,
      };
      if (form.telefon.trim()) {
        body.kontakte = [{ typ: "telefon", wert: form.telefon.trim() }];
      }

      const res = await fetch("/api/kunden", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Anlegen fehlgeschlagen");
      }
      const neuKunde = await res.json();
      onCreated({
        id: neuKunde.id,
        name: neuKunde.name,
        firma: neuKunde.firma ?? null,
        ort: neuKunde.ort ?? null,
      });
    } catch (err: unknown) {
      Sentry.captureException(err);
      setError(err instanceof Error ? err.message : "Fehler");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-2 p-4 rounded-lg border border-blue-200 bg-blue-50 space-y-3">
      <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Neuen Kunden anlegen</p>

      {error && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Firma</label>
          <input
            value={form.firma}
            onChange={(e) => setForm((f) => ({ ...f, firma: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Telefon</label>
          <input
            value={form.telefon}
            onChange={(e) => setForm((f) => ({ ...f, telefon: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Straße</label>
          <input
            value={form.strasse}
            onChange={(e) => setForm((f) => ({ ...f, strasse: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">PLZ</label>
          <input
            value={form.plz}
            onChange={(e) => setForm((f) => ({ ...f, plz: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Ort</label>
          <input
            value={form.ort}
            onChange={(e) => setForm((f) => ({ ...f, ort: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
        >
          Abbrechen
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !form.name.trim()}
          className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
        >
          {saving && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
          Anlegen &amp; zuordnen
        </button>
      </div>
    </div>
  );
}
