"use client";
import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SearchableSelect from "@/components/SearchableSelect";

interface Lieferant {
  id: number;
  name: string;
  firma: string | null;
}

interface Artikel {
  id: number;
  name: string;
  artikelnummer: string | null;
  einheit: string;
  standardpreis: number;
}

interface Position {
  artikelId: string;
  menge: string;
  einheit: string;
  preis: string;
}

function BestellungNeuInner() {
  const router = useRouter();
  const [lieferanten, setLieferanten] = useState<Lieferant[]>([]);
  const [artikel, setArtikel] = useState<Artikel[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const today = new Date().toISOString().slice(0, 10);

  const [lieferantId, setLieferantId] = useState("");
  const [datum, setDatum] = useState(today);
  const [lieferdatum, setLieferdatum] = useState("");
  const [notiz, setNotiz] = useState("");
  const [positionen, setPositionen] = useState<Position[]>([
    { artikelId: "", menge: "", einheit: "kg", preis: "" },
  ]);

  useEffect(() => {
    fetch("/api/lieferanten?limit=500")
      .then((r) => r.json())
      .then((d) => setLieferanten(Array.isArray(d) ? d : []))
      .catch(() => {});
    fetch("/api/artikel?limit=500")
      .then((r) => r.json())
      .then((d) => setArtikel(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  const lieferantenOptions = lieferanten.map((l) => ({
    value: l.id,
    label: l.firma ?? l.name,
    sub: l.firma ? l.name : undefined,
  }));

  const artikelOptions = artikel.map((a) => ({
    value: a.id,
    label: a.name,
    sub: [a.artikelnummer, a.einheit].filter(Boolean).join(" · "),
  }));

  function updatePosition(index: number, field: keyof Position, value: string) {
    setPositionen((prev) => {
      const updated = [...prev];
      if (field === "artikelId") {
        const art = artikel.find((a) => String(a.id) === value);
        updated[index] = {
          ...updated[index],
          artikelId: value,
          einheit: art?.einheit ?? updated[index].einheit,
          preis: art ? String(art.standardpreis) : updated[index].preis,
        };
      } else {
        updated[index] = { ...updated[index], [field]: value };
      }
      return updated;
    });
  }

  function addPosition() {
    setPositionen((prev) => [...prev, { artikelId: "", menge: "", einheit: "kg", preis: "" }]);
  }

  function removePosition(index: number) {
    setPositionen((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!lieferantId) { setError("Bitte einen Lieferanten wählen."); return; }
    const validPos = positionen.filter((p) => p.artikelId && parseFloat(p.menge) > 0);
    if (validPos.length === 0) { setError("Mindestens eine vollständige Position erforderlich."); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/bestellungen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lieferantId: parseInt(lieferantId, 10),
          datum,
          lieferdatum: lieferdatum || null,
          notiz: notiz.trim() || null,
          positionen: validPos.map((p) => ({
            artikelId: parseInt(p.artikelId, 10),
            menge: parseFloat(p.menge),
            einheit: p.einheit,
            preis: p.preis ? parseFloat(p.preis) : null,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Fehler beim Speichern");
      router.push(`/bestellungen/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8">
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/bestellungen" className="hover:text-green-700">Bestellungen</Link>
        <span>›</span>
        <span className="text-gray-900 font-medium">Neue Bestellung</span>
      </nav>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Neue Lieferantenbestellung</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-900">Bestelldaten</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lieferant <span className="text-red-500">*</span>
                <a href="/lieferanten/neu" target="_blank" rel="noopener" className="ml-2 text-xs text-green-700 hover:underline font-normal">+ Lieferant anlegen</a>
              </label>
              <SearchableSelect
                options={lieferantenOptions}
                value={lieferantId}
                onChange={setLieferantId}
                placeholder="Lieferant wählen…"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bestelldatum</label>
              <input
                type="date"
                value={datum}
                onChange={(e) => setDatum(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gewünschtes Lieferdatum</label>
              <input
                type="date"
                value={lieferdatum}
                onChange={(e) => setLieferdatum(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notiz</label>
            <textarea
              value={notiz}
              onChange={(e) => setNotiz(e.target.value)}
              rows={3}
              placeholder="Lieferhinweise, besondere Anforderungen…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 resize-none"
            />
          </div>
        </div>

        {/* Positionen */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-900">Positionen</h2>

          <div className="space-y-3">
            {positionen.map((pos, i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Position {i + 1}</span>
                  {positionen.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePosition(i)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Entfernen
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Artikel <span className="text-red-500">*</span></label>
                    <SearchableSelect
                      options={artikelOptions}
                      value={pos.artikelId}
                      onChange={(v) => updatePosition(i, "artikelId", v)}
                      placeholder="Artikel wählen…"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Menge <span className="text-red-500">*</span></label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={pos.menge}
                        onChange={(e) => updatePosition(i, "menge", e.target.value)}
                        placeholder="0"
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                      />
                      <input
                        type="text"
                        value={pos.einheit}
                        onChange={(e) => updatePosition(i, "einheit", e.target.value)}
                        placeholder="kg"
                        className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">EK-Preis (optional)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={pos.preis}
                      onChange={(e) => updatePosition(i, "preis", e.target.value)}
                      placeholder="0,00"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addPosition}
            className="w-full py-2.5 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-green-400 hover:text-green-700 transition-colors"
          >
            + Position hinzufügen
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
          <Link
            href="/bestellungen"
            className="w-full sm:w-auto text-center px-5 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors"
          >
            Abbrechen
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto px-5 py-2 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Speichere…" : "Bestellung speichern"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function BestellungNeuPage() {
  return (
    <Suspense fallback={<div className="text-center py-16 text-gray-400">Lade…</div>}>
      <BestellungNeuInner />
    </Suspense>
  );
}
