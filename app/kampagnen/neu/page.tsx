"use client";
import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SearchableSelect from "@/components/SearchableSelect";

interface Artikel {
  id: number;
  name: string;
  artikelnummer: string | null;
  einheit: string;
  standardpreis: number;
}

interface KampagneArtikel {
  artikelId: string;
  sonderpreis: string;
}

function KampagneNeuInner() {
  const router = useRouter();
  const [artikel, setArtikel] = useState<Artikel[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const today = new Date().toISOString().slice(0, 10);

  const [name, setName] = useState("");
  const [beschreibung, setBeschreibung] = useState("");
  const [von, setVon] = useState(today);
  const [bis, setBis] = useState("");
  const [rabattProzent, setRabattProzent] = useState("");
  const [kampagneArtikel, setKampagneArtikel] = useState<KampagneArtikel[]>([]);

  useEffect(() => {
    fetch("/api/artikel?limit=500")
      .then((r) => r.json())
      .then((d) => setArtikel(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  const artikelOptions = artikel.map((a) => ({
    value: a.id,
    label: a.name,
    sub: [a.artikelnummer, a.einheit].filter(Boolean).join(" · "),
  }));

  function addArtikel() {
    setKampagneArtikel((prev) => [...prev, { artikelId: "", sonderpreis: "" }]);
  }

  function removeArtikel(index: number) {
    setKampagneArtikel((prev) => prev.filter((_, i) => i !== index));
  }

  function updateArtikel(index: number, field: keyof KampagneArtikel, value: string) {
    setKampagneArtikel((prev) => {
      const updated = [...prev];
      if (field === "artikelId") {
        const art = artikel.find((a) => String(a.id) === value);
        updated[index] = {
          ...updated[index],
          artikelId: value,
          sonderpreis: art ? String(art.standardpreis) : updated[index].sonderpreis,
        };
      } else {
        updated[index] = { ...updated[index], [field]: value };
      }
      return updated;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Name ist erforderlich."); return; }
    if (!von || !bis) { setError("Gültigkeitszeitraum erforderlich."); return; }
    setSaving(true);
    setError("");
    try {
      const validArtikel = kampagneArtikel.filter((a) => a.artikelId);
      const res = await fetch("/api/kampagnen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          beschreibung: beschreibung.trim() || null,
          von,
          bis,
          rabattProzent: rabattProzent ? parseFloat(rabattProzent) : null,
          artikel: validArtikel.map((a) => ({
            artikelId: parseInt(a.artikelId, 10),
            sonderpreis: a.sonderpreis ? parseFloat(a.sonderpreis) : null,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Fehler beim Speichern");
      router.push(`/kampagnen/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8">
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/kampagnen" className="hover:text-green-700">Kampagnen</Link>
        <span>›</span>
        <span className="text-gray-900 font-medium">Neue Kampagne</span>
      </nav>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Neue Kampagne erstellen</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-900">Kampagnendaten</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="z.B. Frühjahrsangebot 2025"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung (optional)</label>
            <textarea
              value={beschreibung}
              onChange={(e) => setBeschreibung(e.target.value)}
              rows={2}
              placeholder="Kurze Beschreibung der Kampagne…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Von <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={von}
                onChange={(e) => setVon(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bis <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={bis}
                onChange={(e) => setBis(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rabatt % (optional)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={rabattProzent}
                onChange={(e) => setRabattProzent(e.target.value)}
                placeholder="z.B. 5"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>
          </div>
        </div>

        {/* Artikel */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Artikel (optional)</h2>
            <button
              type="button"
              onClick={addArtikel}
              className="text-xs px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 rounded-lg transition-colors"
            >
              + Artikel hinzufügen
            </button>
          </div>

          {kampagneArtikel.length === 0 ? (
            <p className="text-sm text-gray-400">Keine Artikel zugeordnet — der Rabatt gilt dann allgemein.</p>
          ) : (
            <div className="space-y-3">
              {kampagneArtikel.map((a, i) => (
                <div key={i} className="flex items-end gap-3 border border-gray-200 rounded-lg p-3">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Artikel</label>
                    <SearchableSelect
                      options={artikelOptions}
                      value={a.artikelId}
                      onChange={(v) => updateArtikel(i, "artikelId", v)}
                      placeholder="Artikel wählen…"
                    />
                  </div>
                  <div className="w-32">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Sonderpreis (€)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={a.sonderpreis}
                      onChange={(e) => updateArtikel(i, "sonderpreis", e.target.value)}
                      placeholder="optional"
                      className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeArtikel(i)}
                    className="text-xs text-red-500 hover:text-red-700 pb-1.5"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
          <Link
            href="/kampagnen"
            className="w-full sm:w-auto text-center px-5 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors"
          >
            Abbrechen
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto px-5 py-2 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Speichere…" : "Kampagne speichern"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function KampagneNeuPage() {
  return (
    <Suspense fallback={<div className="text-center py-16 text-gray-400">Lade…</div>}>
      <KampagneNeuInner />
    </Suspense>
  );
}
