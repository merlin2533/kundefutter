"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import SearchableSelect from "@/components/SearchableSelect";

interface Kunde {
  id: number;
  name: string;
  firma?: string;
}

function NeuenBesuchsterminForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefilledKundeId = searchParams.get("kundeId");

  const [kunden, setKunden] = useState<Kunde[]>([]);
  const [kundeId, setKundeId] = useState(prefilledKundeId ?? "");
  const [datum, setDatum] = useState(() => new Date().toISOString().slice(0, 10));
  const [betreff, setBetreff] = useState("");
  const [notiz, setNotiz] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/kunden?limit=500&aktiv=true")
      .then((r) => r.json())
      .then((d) => setKunden(d.data ?? []))
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!kundeId) { setError("Bitte einen Kunden auswählen"); return; }
    if (!betreff.trim()) { setError("Betreff ist erforderlich"); return; }
    if (!datum) { setError("Datum ist erforderlich"); return; }

    setSaving(true);
    setError("");

    const res = await fetch("/api/besuchstermine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kundeId: Number(kundeId),
        datum,
        betreff: betreff.trim(),
        notiz: notiz.trim() || null,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setError(err.error ?? "Fehler beim Speichern");
      setSaving(false);
      return;
    }

    if (prefilledKundeId) {
      router.push(`/kunden/${prefilledKundeId}?tab=CRM`);
    } else {
      router.push("/besuchstermine");
    }
  }

  const kundenOptions = kunden.map((k) => ({
    value: String(k.id),
    label: k.firma ? `${k.name} (${k.firma})` : k.name,
  }));

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm text-gray-500">
        <Link href="/besuchstermine" className="hover:text-green-700">Besuchstermine</Link>
        <span>›</span>
        <span className="text-gray-800 font-medium">Neuer Besuchstermin</span>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h1 className="text-xl font-bold mb-6">Neuen Besuchstermin anlegen</h1>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kunde *</label>
            <SearchableSelect
              options={kundenOptions}
              value={kundeId}
              onChange={setKundeId}
              placeholder="Kunden suchen…"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Datum *</label>
              <input
                type="date"
                value={datum}
                onChange={(e) => setDatum(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Betreff *</label>
              <input
                type="text"
                value={betreff}
                onChange={(e) => setBetreff(e.target.value)}
                placeholder="z.B. Jahresgespräch, Produktvorstellung"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notiz (optional)</label>
            <textarea
              value={notiz}
              onChange={(e) => setNotiz(e.target.value)}
              rows={3}
              placeholder="Gesprächspunkte, Vorbereitungshinweise…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {saving ? "Speichern…" : "Besuchstermin anlegen"}
            </button>
            <Link
              href="/besuchstermine"
              className="w-full sm:w-auto text-center px-6 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Abbrechen
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function NeuenBesuchsterminPage() {
  return (
    <Suspense fallback={<p className="p-6 text-gray-400 text-sm">Lade…</p>}>
      <NeuenBesuchsterminForm />
    </Suspense>
  );
}
