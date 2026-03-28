"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SearchableSelect from "@/components/SearchableSelect";
import { formatEuro } from "@/lib/utils";

interface Lieferant {
  id: number;
  name: string;
}

interface Artikel {
  id: number;
  name: string;
  einheit: string;
}

type WEPosition = {
  artikelId: string;
  menge: number;
  einkaufspreis: number;
};

const inputCls =
  "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700";

export default function WareneingangPage() {
  const router = useRouter();

  const [lieferantenList, setLieferantenList] = useState<Lieferant[]>([]);
  const [artikelList, setArtikelList] = useState<Artikel[]>([]);

  const [lieferantId, setLieferantId] = useState("");
  const [datum, setDatum] = useState(new Date().toISOString().slice(0, 10));
  const [notiz, setNotiz] = useState("");
  const [positionen, setPositionen] = useState<WEPosition[]>([
    { artikelId: "", menge: 0, einkaufspreis: 0 },
  ]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/lieferanten")
      .then((r) => r.json())
      .then(setLieferantenList);
    fetch("/api/artikel?limit=500")
      .then((r) => r.json())
      .then(setArtikelList);
  }, []);

  function addPosition() {
    setPositionen([...positionen, { artikelId: "", menge: 0, einkaufspreis: 0 }]);
  }

  function removePosition(idx: number) {
    setPositionen(positionen.filter((_, i) => i !== idx));
  }

  function updatePosition(idx: number, field: keyof WEPosition, value: string | number) {
    setPositionen(
      positionen.map((p, i) => (i === idx ? { ...p, [field]: value } : p))
    );
  }

  const gesamt = positionen.reduce(
    (sum, p) => sum + p.einkaufspreis * p.menge,
    0
  );

  async function handleSubmit() {
    if (!lieferantId) {
      setError("Bitte einen Lieferanten wählen.");
      return;
    }
    if (positionen.length === 0 || positionen.every((p) => !p.artikelId)) {
      setError("Bitte mindestens eine Position hinzufügen.");
      return;
    }
    const invalidPos = positionen.some((p) => p.artikelId && p.menge <= 0);
    if (invalidPos) {
      setError("Alle Positionen benötigen eine Menge > 0.");
      return;
    }

    setSaving(true);
    setError("");
    const res = await fetch("/api/lager/wareneingaenge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lieferantId: Number(lieferantId),
        datum,
        notiz: notiz || undefined,
        positionen: positionen
          .filter((p) => p.artikelId)
          .map((p) => ({
            artikelId: Number(p.artikelId),
            menge: Number(p.menge),
            einkaufspreis: Number(p.einkaufspreis),
          })),
      }),
    });
    setSaving(false);
    if (res.ok) {
      router.push("/lager");
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Fehler beim Speichern.");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">Neuer Wareneingang</h1>
        <Link
          href="/lager"
          className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 font-medium"
        >
          Abbrechen
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-300 shadow-sm p-6 space-y-6">
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {error}
          </p>
        )}

        {/* Header fields */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Lieferant <span className="text-red-500">*</span>
            </label>
            <SearchableSelect
              options={lieferantenList.map((l) => ({ value: l.id, label: l.name }))}
              value={lieferantId}
              onChange={(v) => setLieferantId(v)}
              placeholder="-- Lieferant wählen --"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Datum</label>
            <input
              type="date"
              value={datum}
              onChange={(e) => setDatum(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notiz</label>
            <input
              type="text"
              value={notiz}
              onChange={(e) => setNotiz(e.target.value)}
              placeholder="Optional"
              className={inputCls}
            />
          </div>
        </div>

        {/* Positionen */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Positionen</h3>
            <button
              onClick={addPosition}
              className="text-sm text-green-700 hover:text-green-900 font-medium"
            >
              + Position hinzufügen
            </button>
          </div>
          <div className="space-y-3">
            {positionen.map((pos, idx) => (
              <div
                key={idx}
                className="flex gap-3 items-end flex-wrap bg-gray-50 rounded-lg p-3"
              >
                <div className="flex-1 min-w-[160px]">
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Artikel
                  </label>
                  <SearchableSelect
                    options={artikelList.map((a) => ({ value: a.id, label: a.name }))}
                    value={pos.artikelId}
                    onChange={(v) => updatePosition(idx, "artikelId", v)}
                    placeholder="-- Artikel wählen --"
                    required
                  />
                </div>
                <div className="w-28">
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Menge
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={pos.menge}
                    onChange={(e) =>
                      updatePosition(idx, "menge", parseFloat(e.target.value) || 0)
                    }
                    className={inputCls}
                  />
                </div>
                <div className="w-36">
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Einkaufspreis (EUR)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={pos.einkaufspreis}
                    onChange={(e) =>
                      updatePosition(
                        idx,
                        "einkaufspreis",
                        parseFloat(e.target.value) || 0
                      )
                    }
                    className={inputCls}
                  />
                </div>
                {positionen.length > 1 && (
                  <button
                    onClick={() => removePosition(idx)}
                    className="text-red-400 hover:text-red-600 text-lg leading-none pb-2"
                    title="Position entfernen"
                  >
                    x
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Gesamt summary */}
        {positionen.some((p) => p.artikelId && p.menge > 0 && p.einkaufspreis > 0) && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800">
            Gesamt:{" "}
            <span className="font-semibold">{formatEuro(gesamt)}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Link
            href="/lager"
            className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 font-medium"
          >
            Abbrechen
          </Link>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 text-sm rounded-lg bg-green-800 hover:bg-green-700 text-white font-medium disabled:opacity-60"
          >
            {saving ? "Speichern..." : "Wareneingang buchen"}
          </button>
        </div>
      </div>
    </div>
  );
}
