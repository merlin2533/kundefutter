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

function NeueAufgabeForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefilledKundeId = searchParams.get("kundeId");

  const [kunden, setKunden] = useState<Kunde[]>([]);
  const [betreff, setBetreff] = useState("");
  const [beschreibung, setBeschreibung] = useState("");
  const [faelligAm, setFaelligAm] = useState("");
  const [prioritaet, setPrioritaet] = useState("normal");
  const [typ, setTyp] = useState("aufgabe");
  const [kundeId, setKundeId] = useState(prefilledKundeId ?? "");
  const [tagsInput, setTagsInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/kunden?limit=500&aktiv=true")
      .then((r) => r.json())
      .then((d) => setKunden(d.data ?? []));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!betreff.trim()) { setError("Betreff ist erforderlich"); return; }
    setSaving(true);
    setError("");

    const tags = tagsInput.trim()
      ? JSON.stringify(tagsInput.split(",").map((t) => t.trim()).filter(Boolean))
      : "[]";

    const res = await fetch("/api/aufgaben", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        betreff: betreff.trim(),
        beschreibung: beschreibung.trim() || null,
        faelligAm: faelligAm || null,
        prioritaet,
        tags,
        typ,
        kundeId: kundeId ? Number(kundeId) : null,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setError(err.error ?? "Fehler beim Speichern");
      setSaving(false);
      return;
    }

    if (prefilledKundeId) {
      router.push(`/kunden/${prefilledKundeId}?tab=Aufgaben`);
    } else {
      router.push("/aufgaben");
    }
  }

  const kundenOptions = kunden.map((k) => ({
    value: String(k.id),
    label: k.firma ? `${k.name} (${k.firma})` : k.name,
  }));

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-0">
      <div className="flex items-center gap-2 mb-6 text-sm text-gray-500">
        <Link href="/aufgaben" className="hover:text-green-700">Aufgaben</Link>
        <span>›</span>
        <span className="text-gray-800 font-medium">Neue Aufgabe</span>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <h1 className="text-xl font-bold mb-6">Neue Aufgabe</h1>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Betreff *</label>
            <input
              type="text"
              value={betreff}
              onChange={(e) => setBetreff(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Kurze Beschreibung der Aufgabe"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Typ</label>
              <select
                value={typ}
                onChange={(e) => setTyp(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="aufgabe">Aufgabe</option>
                <option value="anruf">Anruf</option>
                <option value="besuch">Besuch</option>
                <option value="email">E-Mail</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priorität</label>
              <select
                value={prioritaet}
                onChange={(e) => setPrioritaet(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="niedrig">Niedrig</option>
                <option value="normal">Normal</option>
                <option value="hoch">Hoch</option>
                <option value="kritisch">Kritisch</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fällig am</label>
              <input
                type="date"
                value={faelligAm}
                onChange={(e) => setFaelligAm(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tags (kommagetrennt)</label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="z.B. Saatgut, Dringend"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kunde (optional)</label>
            <SearchableSelect
              options={kundenOptions}
              value={kundeId}
              onChange={setKundeId}
              placeholder="Kunden suchen…"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
            <textarea
              value={beschreibung}
              onChange={(e) => setBeschreibung(e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Details zur Aufgabe…"
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
            <Link
              href="/aufgaben"
              className="w-full sm:w-auto text-center px-6 py-2.5 sm:py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Abbrechen
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 sm:py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {saving ? "Speichern…" : "Aufgabe erstellen"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function NeueAufgabePage() {
  return (
    <Suspense fallback={<p className="p-6 text-gray-400 text-sm">Lade…</p>}>
      <NeueAufgabeForm />
    </Suspense>
  );
}
