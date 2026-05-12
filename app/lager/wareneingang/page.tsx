"use client";
import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import SearchableSelect from "@/components/SearchableSelect";
import BarcodeScanner from "@/components/BarcodeScanner";
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
  chargeNr: string;
};

const inputCls =
  "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700";

function WareneingangInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const artikelIdParam = searchParams.get("artikelId");
  const lieferantIdParam = searchParams.get("lieferantId");

  const [lieferantenList, setLieferantenList] = useState<Lieferant[]>([]);
  const [artikelList, setArtikelList] = useState<Artikel[]>([]);

  const [lieferantId, setLieferantId] = useState(lieferantIdParam ?? "");
  const [datum, setDatum] = useState(new Date().toISOString().slice(0, 10));
  const [notiz, setNotiz] = useState("");
  const [positionen, setPositionen] = useState<WEPosition[]>([
    { artikelId: artikelIdParam ?? "", menge: 0, einkaufspreis: 0, chargeNr: "" },
  ]);
  const [vorbefuelltHinweis, setVorbefuelltHinweis] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [scannerForIdx, setScannerForIdx] = useState<number | null>(null);
  const [scanToast, setScanToast] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const [liefRes, artRes] = await Promise.all([
        fetch("/api/lieferanten").then((r) => r.ok ? r.json() : []),
        fetch("/api/artikel?limit=500").then((r) => r.ok ? r.json() : []),
      ]);
      setLieferantenList(Array.isArray(liefRes) ? liefRes : []);
      const artikelData: Artikel[] = Array.isArray(artRes) ? artRes : [];
      setArtikelList(artikelData);

      if (artikelIdParam || lieferantIdParam) {
        const art = artikelData.find((a) => String(a.id) === artikelIdParam);
        const lief = Array.isArray(liefRes) ? (liefRes as Lieferant[]).find((l) => String(l.id) === lieferantIdParam) : null;
        const parts: string[] = [];
        if (art) parts.push(`Artikel: ${art.name}`);
        if (lief) parts.push(`Lieferant: ${lief.name}`);
        if (parts.length > 0) setVorbefuelltHinweis(parts.join(" · "));
      }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addPosition() {
    setPositionen([...positionen, { artikelId: "", menge: 0, einkaufspreis: 0, chargeNr: "" }]);
  }

  function removePosition(idx: number) {
    setPositionen(positionen.filter((_, i) => i !== idx));
  }

  function updatePosition(idx: number, field: keyof WEPosition, value: string | number) {
    setPositionen(
      positionen.map((p, i) => (i === idx ? { ...p, [field]: value } : p))
    );
  }

  async function handleBarcodeScan(code: string) {
    const idx = scannerForIdx;
    setScannerForIdx(null);
    if (idx === null) return;

    // Search by artikelnummer or name
    try {
      const res = await fetch(`/api/artikel?search=${encodeURIComponent(code)}&limit=5`);
      if (!res.ok) throw new Error("Fehler");
      const data = await res.json();
      const list: Artikel[] = Array.isArray(data) ? data : [];
      if (list.length === 0) {
        setScanToast(`Artikel mit Code "${code}" nicht gefunden.`);
        setTimeout(() => setScanToast(null), 4000);
        return;
      }
      const found = list[0];
      updatePosition(idx, "artikelId", String(found.id));
      // Also refresh artikelList to include if not already there
      setArtikelList((prev) => {
        if (prev.find((a) => a.id === found.id)) return prev;
        return [...prev, found];
      });
      setScanToast(`Artikel gefunden: ${found.name}`);
      setTimeout(() => setScanToast(null), 3000);
    } catch {
      setScanToast("Fehler bei der Artikel-Suche.");
      setTimeout(() => setScanToast(null), 4000);
    }
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
            chargeNr: p.chargeNr.trim() || undefined,
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
      {scannerForIdx !== null && (
        <BarcodeScanner
          onScan={handleBarcodeScan}
          onClose={() => setScannerForIdx(null)}
        />
      )}
      {scanToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-lg shadow-xl">
          {scanToast}
        </div>
      )}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">Neuer Wareneingang</h1>
        <Link
          href="/lager"
          className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 font-medium"
        >
          Abbrechen
        </Link>
      </div>

      {vorbefuelltHinweis && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
          <span className="font-semibold">Vorlage:</span> {vorbefuelltHinweis} — Bitte Menge und Preis eintragen.
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-300 shadow-sm p-4 sm:p-6 space-y-6">
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
                <div className="w-full sm:flex-1 sm:min-w-[160px]">
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Artikel
                  </label>
                  <div className="flex gap-2 items-center">
                    <div className="flex-1">
                      <SearchableSelect
                        options={artikelList.map((a) => ({ value: a.id, label: a.name }))}
                        value={pos.artikelId}
                        onChange={(v) => updatePosition(idx, "artikelId", v)}
                        placeholder="-- Artikel wählen --"
                        required
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setScannerForIdx(idx)}
                      title="Barcode / EAN scannen"
                      className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-600 hover:text-green-700 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 9V6a1 1 0 011-1h3M3 15v3a1 1 0 001 1h3m11-4v3a1 1 0 01-1 1h-3m4-13h-3a1 1 0 00-1 1v3M6 9h.01M10 9h.01M14 9h.01M6 12h.01M10 12h.01M14 12h.01M6 15h.01M10 15h.01M14 15h.01" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="w-full sm:w-28">
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
                <div className="w-full sm:w-36">
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
                <div className="w-full sm:w-36">
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Chargennummer
                  </label>
                  <input
                    type="text"
                    value={pos.chargeNr}
                    onChange={(e) => updatePosition(idx, "chargeNr", e.target.value)}
                    placeholder="Optional"
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
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
          <Link
            href="/lager"
            className="w-full sm:w-auto text-center px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 font-medium"
          >
            Abbrechen
          </Link>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full sm:w-auto px-4 py-2 text-sm rounded-lg bg-green-800 hover:bg-green-700 text-white font-medium disabled:opacity-60"
          >
            {saving ? "Speichern..." : "Wareneingang buchen"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function WareneingangPage() {
  return (
    <Suspense fallback={<div><h1 className="text-2xl font-bold mb-6">Neuer Wareneingang</h1><p className="text-gray-400 text-sm">Lade…</p></div>}>
      <WareneingangInner />
    </Suspense>
  );
}
