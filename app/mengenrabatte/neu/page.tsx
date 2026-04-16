"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SearchableSelect from "@/components/SearchableSelect";

interface Artikel {
  id: number;
  name: string;
  artikelnummer: string;
  kategorie: string;
}

interface Kunde {
  id: number;
  name: string;
  firma?: string;
}

const ARTIKEL_KATEGORIEN = ["Futter", "Duenger", "Saatgut", "Analysen", "Beratung"];

export default function NeuerMengenrabattPage() {
  const router = useRouter();

  const [artikel, setArtikel] = useState<Artikel[]>([]);
  const [kunden, setKunden] = useState<Kunde[]>([]);

  const [formMode, setFormMode] = useState<"artikel" | "kategorie">("artikel");
  const [formArtikelId, setFormArtikelId] = useState("");
  const [formKategorie, setFormKategorie] = useState(ARTIKEL_KATEGORIEN[0]);
  const [formKundeId, setFormKundeId] = useState("");
  const [formVonMenge, setFormVonMenge] = useState("");
  const [formRabattProzent, setFormRabattProzent] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    fetch("/api/artikel?aktiv=true")
      .then((r) => r.json())
      .then((d) => setArtikel(Array.isArray(d) ? d : []));
    fetch("/api/kunden")
      .then((r) => r.json())
      .then((d) => setKunden(Array.isArray(d) ? d : []));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    if (!formVonMenge || !formRabattProzent) {
      setFormError("Bitte Ab-Menge und Rabatt % angeben.");
      return;
    }
    if (formMode === "artikel" && !formArtikelId) {
      setFormError("Bitte einen Artikel wählen.");
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        vonMenge: Number(formVonMenge),
        rabattProzent: Number(formRabattProzent),
      };
      if (formKundeId) body.kundeId = Number(formKundeId);
      if (formMode === "artikel") {
        body.artikelId = Number(formArtikelId);
      } else {
        body.kategorie = formKategorie;
      }

      const res = await fetch("/api/mengenrabatte", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Fehler beim Speichern");
      }
      router.push("/mengenrabatte");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto">
      <Link
        href="/mengenrabatte"
        className="text-sm text-green-700 hover:text-green-900 mb-4 inline-block"
      >
        &larr; Zurück zu Mengenrabatte
      </Link>

      <h1 className="text-2xl font-bold mb-6">Neuen Mengenrabatt anlegen</h1>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4"
      >
        {formError && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {formError}
          </div>
        )}

        {/* Mode selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Gilt für
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setFormMode("artikel")}
              className={`flex-1 py-2 text-sm rounded-lg border transition-colors font-medium ${
                formMode === "artikel"
                  ? "bg-green-700 text-white border-green-700"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
            >
              Bestimmten Artikel
            </button>
            <button
              type="button"
              onClick={() => setFormMode("kategorie")}
              className={`flex-1 py-2 text-sm rounded-lg border transition-colors font-medium ${
                formMode === "kategorie"
                  ? "bg-green-700 text-white border-green-700"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
            >
              Artikelkategorie
            </button>
          </div>
        </div>

        {/* Artikel or Kategorie */}
        {formMode === "artikel" ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Artikel <span className="text-red-500">*</span>
            </label>
            <SearchableSelect
              options={artikel.map((a) => ({
                value: a.id,
                label: a.name,
                sub: `${a.artikelnummer} · ${a.kategorie}`,
              }))}
              value={formArtikelId}
              onChange={setFormArtikelId}
              placeholder="— Artikel wählen —"
              required
            />
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Kategorie <span className="text-red-500">*</span>
            </label>
            <select
              value={formKategorie}
              onChange={(e) => setFormKategorie(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
            >
              {ARTIKEL_KATEGORIEN.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Kunde */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Kunde{" "}
            <span className="text-gray-400 text-xs font-normal">
              (leer = gilt für alle Kunden)
            </span>
          </label>
          <SearchableSelect
            options={kunden.map((k) => ({
              value: k.id,
              label: k.firma ? `${k.firma} – ${k.name}` : k.name,
            }))}
            value={formKundeId}
            onChange={setFormKundeId}
            placeholder="— Alle Kunden —"
            allowClear
            clearLabel="— Alle Kunden —"
          />
        </div>

        {/* Von Menge + Rabatt */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ab Menge <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formVonMenge}
              onChange={(e) => setFormVonMenge(e.target.value)}
              placeholder="z.B. 100"
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rabatt % <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={formRabattProzent}
              onChange={(e) => setFormRabattProzent(e.target.value)}
              placeholder="z.B. 5"
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Link
            href="/mengenrabatte"
            className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Abbrechen
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-sm bg-green-800 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-60"
          >
            {saving ? "Speichern…" : "Rabatt anlegen"}
          </button>
        </div>
      </form>
    </div>
  );
}
