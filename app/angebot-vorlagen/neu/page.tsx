"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SearchableSelect from "@/components/SearchableSelect";

interface ArtikelOption {
  id: number;
  name: string;
  einheit: string;
  standardpreis: number;
  kategorie: string | null;
}

interface PositionDraft {
  key: number; // local key for React list
  artikelId: string;
  menge: string;
  preis: string; // 0 = aktueller Standardpreis
  rabatt: string;
  einheit: string;
  notiz: string;
}

let _keyCounter = 0;
function nextKey() {
  return ++_keyCounter;
}

function emptyPosition(): PositionDraft {
  return {
    key: nextKey(),
    artikelId: "",
    menge: "1",
    preis: "0",
    rabatt: "0",
    einheit: "kg",
    notiz: "",
  };
}

export default function AngebotVorlageNeuPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [beschreibung, setBeschreibung] = useState("");
  const [notiz, setNotiz] = useState("");
  const [positionen, setPositionen] = useState<PositionDraft[]>([emptyPosition()]);
  const [artikel, setArtikel] = useState<ArtikelOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/artikel?limit=500")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => { if (Array.isArray(d)) setArtikel(d); })
      .catch(() => {});
  }, []);

  const artikelOptions = artikel.map((a) => ({
    value: String(a.id),
    label: a.name,
    sub: [a.kategorie, a.einheit].filter(Boolean).join(" · "),
  }));

  function updatePos(key: number, field: keyof PositionDraft, value: string) {
    setPositionen((prev) =>
      prev.map((p) => {
        if (p.key !== key) return p;
        const updated = { ...p, [field]: value };
        // If article changes, auto-fill einheit
        if (field === "artikelId") {
          const art = artikel.find((a) => String(a.id) === value);
          if (art) {
            updated.einheit = art.einheit;
          }
        }
        return updated;
      })
    );
  }

  function removePos(key: number) {
    setPositionen((prev) => prev.filter((p) => p.key !== key));
  }

  function addPos() {
    setPositionen((prev) => [...prev, emptyPosition()]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Name ist erforderlich."); return; }

    const validPositionen = positionen.filter((p) => p.artikelId);
    const posData = validPositionen.map((p) => ({
      artikelId: Number(p.artikelId),
      menge: parseFloat(p.menge.replace(",", ".")) || 1,
      preis: parseFloat(p.preis.replace(",", ".")) || 0,
      rabatt: parseFloat(p.rabatt.replace(",", ".")) || 0,
      einheit: p.einheit.trim() || "kg",
      notiz: p.notiz.trim() || null,
    }));

    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/angebot-vorlagen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          beschreibung: beschreibung.trim() || null,
          notiz: notiz.trim() || null,
          positionen: posData,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error ?? "Fehler beim Speichern");
      }
      router.push("/angebot-vorlagen");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <Link
        href="/angebot-vorlagen"
        className="text-sm text-green-700 hover:text-green-900 hover:underline mb-4 inline-block"
      >
        ← Zurück zu Vorlagen
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Neue Angebots-Vorlage</h1>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Stammdaten */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Vorlage-Daten</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="z.B. Frühjahrspaket Mais"
                required
                className="w-full sm:w-96 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
              <input
                type="text"
                value={beschreibung}
                onChange={(e) => setBeschreibung(e.target.value)}
                placeholder="Kurze Beschreibung (optional)"
                className="w-full sm:w-96 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notiz</label>
              <textarea
                value={notiz}
                onChange={(e) => setNotiz(e.target.value)}
                rows={2}
                placeholder="Interne Notiz oder Zahlungsbedingungen…"
                className="w-full sm:w-96 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700 resize-none"
              />
            </div>
          </div>
        </div>

        {/* Positionen */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-800">Positionen</h2>
            <span className="text-xs text-gray-500">Preis 0 = aktueller Standardpreis wird verwendet</span>
          </div>

          <div className="space-y-3">
            {positionen.map((pos, idx) => {
              const art = artikel.find((a) => String(a.id) === pos.artikelId);
              return (
                <div key={pos.key} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Position {idx + 1}
                    </span>
                    {positionen.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removePos(pos.key)}
                        className="text-red-400 hover:text-red-600 text-xs"
                        title="Position entfernen"
                      >
                        ✕ Entfernen
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-3 items-end">
                    <div className="flex-1 min-w-48">
                      <label className="block text-xs text-gray-500 mb-1">Artikel</label>
                      <SearchableSelect
                        options={artikelOptions}
                        value={pos.artikelId}
                        onChange={(v) => updatePos(pos.key, "artikelId", v)}
                        placeholder="Artikel wählen…"
                      />
                      {art && (
                        <div className="mt-0.5 text-xs text-gray-400">
                          Standardpreis: {art.standardpreis.toLocaleString("de-DE", { minimumFractionDigits: 2 })} € / {art.einheit}
                        </div>
                      )}
                    </div>
                    <div className="w-24">
                      <label className="block text-xs text-gray-500 mb-1">Menge</label>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={pos.menge}
                        onChange={(e) => updatePos(pos.key, "menge", e.target.value)}
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-700"
                      />
                    </div>
                    <div className="w-28">
                      <label className="block text-xs text-gray-500 mb-1">Einheit</label>
                      <input
                        type="text"
                        value={pos.einheit}
                        onChange={(e) => updatePos(pos.key, "einheit", e.target.value)}
                        placeholder="kg"
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-700"
                      />
                    </div>
                    <div className="w-28">
                      <label className="block text-xs text-gray-500 mb-1">Preis (€)</label>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={pos.preis}
                        onChange={(e) => updatePos(pos.key, "preis", e.target.value)}
                        placeholder="0 = Standard"
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-700"
                      />
                    </div>
                    <div className="w-24">
                      <label className="block text-xs text-gray-500 mb-1">Rabatt %</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        value={pos.rabatt}
                        onChange={(e) => updatePos(pos.key, "rabatt", e.target.value)}
                        placeholder="0"
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-700"
                      />
                    </div>
                    <div className="flex-1 min-w-32">
                      <label className="block text-xs text-gray-500 mb-1">Notiz (opt.)</label>
                      <input
                        type="text"
                        value={pos.notiz}
                        onChange={(e) => updatePos(pos.key, "notiz", e.target.value)}
                        placeholder="z.B. Sorte / Auftragsnr."
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-700"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={addPos}
            className="mt-3 text-sm text-green-700 hover:text-green-900 font-medium flex items-center gap-1"
          >
            <span className="text-lg leading-none">+</span> Position hinzufügen
          </button>
        </div>

        {/* Actions */}
        <div className="flex gap-3 flex-wrap">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 bg-green-700 hover:bg-green-800 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
          >
            {saving ? "Speichern…" : "Vorlage speichern"}
          </button>
          <Link
            href="/angebot-vorlagen"
            className="px-5 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Abbrechen
          </Link>
        </div>
      </form>
    </div>
  );
}
