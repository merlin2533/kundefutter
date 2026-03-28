"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MargeBadge } from "@/components/Badge";
import { formatEuro } from "@/lib/utils";
import SearchableSelect from "@/components/SearchableSelect";

interface Kunde {
  id: number;
  name: string;
  firma?: string;
}

interface Artikel {
  id: number;
  name: string;
  einheit: string;
  standardpreis: number;
  einkaufspreis?: number;
}

interface NewPosition {
  artikelId: number | "";
  menge: number;
  verkaufspreis: number;
  einkaufspreis: number;
  chargeNr: string;
}

const today = new Date().toISOString().split("T")[0];

const emptyPosition = (): NewPosition => ({
  artikelId: "",
  menge: 1,
  verkaufspreis: 0,
  einkaufspreis: 0,
  chargeNr: "",
});

export default function NeueLieferungPage() {
  const router = useRouter();

  const [kunden, setKunden] = useState<Kunde[]>([]);
  const [artikel, setArtikel] = useState<Artikel[]>([]);
  const [loading, setLoading] = useState(true);

  const [kundeId, setKundeId] = useState<number | "">("");
  const [datum, setDatum] = useState(today);
  const [notiz, setNotiz] = useState("");
  const [positionen, setPositionen] = useState<NewPosition[]>([emptyPosition()]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [kr, ar] = await Promise.all([
          fetch("/api/kunden").then((r) => r.json()),
          fetch("/api/artikel").then((r) => r.json()),
        ]);
        setKunden(Array.isArray(kr) ? kr : []);
        setArtikel(Array.isArray(ar) ? ar : []);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function updatePosition(idx: number, field: keyof NewPosition, value: string | number) {
    const updated = positionen.map((p, i) => {
      if (i !== idx) return p;
      const next = { ...p, [field]: value };
      if (field === "artikelId") {
        const art = artikel.find((a) => a.id === Number(value));
        if (art) {
          next.verkaufspreis = art.standardpreis;
          next.einkaufspreis = art.einkaufspreis ?? 0;
        }
      }
      return next;
    });
    setPositionen(updated);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!kundeId) {
      setError("Bitte einen Kunden ausw\u00e4hlen.");
      return;
    }
    if (positionen.some((p) => !p.artikelId)) {
      setError("Bitte alle Positionen mit einem Artikel belegen.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/lieferungen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kundeId,
          datum,
          notiz: notiz || undefined,
          positionen: positionen.map((p) => ({
            artikelId: p.artikelId,
            menge: Number(p.menge),
            verkaufspreis: Number(p.verkaufspreis),
            einkaufspreis: Number(p.einkaufspreis),
            chargeNr: p.chargeNr || undefined,
          })),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Fehler beim Speichern");
      }
      router.push("/lieferungen");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Speichern.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Neue Lieferung</h1>
        <p className="text-gray-400 text-sm">Lade Daten...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">Neue Lieferung</h1>
        <Link
          href="/lieferungen"
          className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Abbrechen
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {/* Kunde */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Kunde <span className="text-red-500">*</span>
            </label>
            <SearchableSelect
              options={kunden.map((k) => ({
                value: k.id,
                label: k.firma ? `${k.firma} (${k.name})` : k.name,
                sub: k.firma ? k.name : undefined,
              }))}
              value={kundeId}
              onChange={(v) => setKundeId(v ? Number(v) : "")}
              placeholder="Kunde ausw\u00e4hlen..."
              required
            />
          </div>

          {/* Datum */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Datum</label>
            <input
              type="date"
              value={datum}
              onChange={(e) => setDatum(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
            />
          </div>

          {/* Notiz */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notiz</label>
            <textarea
              rows={2}
              value={notiz}
              onChange={(e) => setNotiz(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700 resize-none"
            />
          </div>

          {/* Positionen */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Positionen</label>
              <button
                type="button"
                onClick={() => setPositionen([...positionen, emptyPosition()])}
                className="text-sm text-green-700 hover:text-green-900 font-medium"
              >
                + Position hinzuf&uuml;gen
              </button>
            </div>
            <div className="space-y-3">
              {positionen.map((pos, idx) => {
                const margeEuro = pos.menge * (pos.verkaufspreis - pos.einkaufspreis);
                const margePct =
                  pos.verkaufspreis > 0
                    ? ((pos.verkaufspreis - pos.einkaufspreis) / pos.verkaufspreis) * 100
                    : 0;
                return (
                  <div key={idx} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div className="col-span-2">
                        <label className="block text-xs text-gray-500 mb-1">Artikel</label>
                        <SearchableSelect
                          options={artikel.map((a) => ({
                            value: a.id,
                            label: a.name,
                            sub: a.einheit,
                          }))}
                          value={pos.artikelId}
                          onChange={(v) => updatePosition(idx, "artikelId", v)}
                          placeholder="&mdash; Artikel w&auml;hlen &mdash;"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Menge</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={pos.menge}
                          onChange={(e) =>
                            updatePosition(idx, "menge", parseFloat(e.target.value) || 0)
                          }
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">
                          Verkaufspreis (&euro;)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={pos.verkaufspreis}
                          onChange={(e) =>
                            updatePosition(
                              idx,
                              "verkaufspreis",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">
                          Einkaufspreis (&euro;)
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
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs text-gray-500 mb-1">
                          Chargen-/Losnummer (optional)
                        </label>
                        <input
                          type="text"
                          value={pos.chargeNr}
                          onChange={(e) => updatePosition(idx, "chargeNr", e.target.value)}
                          placeholder="z.B. CH-2024-001"
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
                        />
                      </div>
                      <div className="flex items-end gap-2">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Marge</label>
                          <div className="flex items-center gap-1.5">
                            <MargeBadge pct={margePct} />
                            <span className="text-xs text-gray-500">
                              ({formatEuro(margeEuro)})
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    {positionen.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setPositionen(positionen.filter((_, i) => i !== idx))}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Position entfernen
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Link
              href="/lieferungen"
              className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Abbrechen
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm bg-green-800 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-60"
            >
              {saving ? "Speichern..." : "Lieferung anlegen"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
