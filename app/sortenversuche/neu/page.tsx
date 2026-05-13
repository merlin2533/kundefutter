"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/Card";
import SearchableSelect from "@/components/SearchableSelect";
import { useToast } from "@/components/ToastProvider";

interface Kunde { id: number; name: string; firma?: string | null; }
interface PositionRow {
  sorte: string; saatstaerke: string; ertragDtHa: string;
  feuchteProzent: string; proteinProzent: string; hektolitergew: string;
  bonitur: string; reife: string;
}

const EMPTY_POS: PositionRow = {
  sorte: "", saatstaerke: "", ertragDtHa: "", feuchteProzent: "",
  proteinProzent: "", hektolitergew: "", bonitur: "", reife: "",
};

export default function NeuPage() {
  const router = useRouter();
  const toast = useToast();
  const [kunden, setKunden] = useState<Kunde[]>([]);
  const [form, setForm] = useState({
    name: "",
    jahr: new Date().getFullYear(),
    kultur: "",
    standort: "",
    kundeId: "",
    flaeche: "",
    startDatum: "",
    endeDatum: "",
    notiz: "",
  });
  const [positionen, setPositionen] = useState<PositionRow[]>([{ ...EMPTY_POS }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/kunden?limit=2000").then(r => r.json()).then(d => setKunden(Array.isArray(d) ? d : (d?.kunden ?? [])));
  }, []);

  function setP(i: number, k: keyof PositionRow, v: string) {
    setPositionen(ps => ps.map((p, idx) => idx === i ? { ...p, [k]: v } : p));
  }

  async function speichern(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.kultur.trim()) {
      toast.error("Name und Kultur erforderlich");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/sortenversuche", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        kundeId: form.kundeId ? parseInt(form.kundeId, 10) : null,
        flaeche: form.flaeche || null,
        positionen: positionen.filter(p => p.sorte.trim()),
      }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Versuch gespeichert");
      router.push("/sortenversuche");
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? "Fehler");
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">🌾 Neuer Sortenversuch</h1>
      <form onSubmit={speichern} className="space-y-4">
        <Card>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1">Name *</label>
              <input required type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full border rounded px-3 py-2" placeholder="z.B. Wintergerste-Versuch 2026 Süd" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Jahr *</label>
              <input required type="number" value={form.jahr} onChange={e => setForm({ ...form, jahr: parseInt(e.target.value, 10) })} className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Kultur *</label>
              <input required type="text" list="kultur-list" value={form.kultur} onChange={e => setForm({ ...form, kultur: e.target.value })} className="w-full border rounded px-3 py-2" />
              <datalist id="kultur-list">
                <option value="Wintergerste" /><option value="Winterweizen" /><option value="Winterroggen" />
                <option value="Sommergerste" /><option value="Hafer" /><option value="Winterraps" />
                <option value="Körnermais" /><option value="Silomais" /><option value="Zuckerrübe" />
                <option value="Kartoffel" /><option value="Sonnenblume" />
              </datalist>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Standort</label>
              <input type="text" value={form.standort} onChange={e => setForm({ ...form, standort: e.target.value })} className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Fläche (ha)</label>
              <input type="number" step="0.01" value={form.flaeche} onChange={e => setForm({ ...form, flaeche: e.target.value })} className="w-full border rounded px-3 py-2" />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-sm font-medium mb-1">Kunde (optional)</label>
              <SearchableSelect
                options={kunden.map(k => ({ value: String(k.id), label: k.firma ? `${k.firma} (${k.name})` : k.name }))}
                value={form.kundeId}
                onChange={v => setForm({ ...form, kundeId: v })}
                placeholder="Kunde wählen…"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Aussaat</label>
              <input type="date" value={form.startDatum} onChange={e => setForm({ ...form, startDatum: e.target.value })} className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Ernte</label>
              <input type="date" value={form.endeDatum} onChange={e => setForm({ ...form, endeDatum: e.target.value })} className="w-full border rounded px-3 py-2" />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-sm font-medium mb-1">Notiz</label>
              <textarea value={form.notiz} onChange={e => setForm({ ...form, notiz: e.target.value })} rows={2} className="w-full border rounded px-3 py-2" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-semibold">Sorten & Ergebnisse</h2>
            <button type="button" onClick={() => setPositionen([...positionen, { ...EMPTY_POS }])} className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">
              + Sorte
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th>Sorte *</th><th>Saatstärke</th><th>Ertrag (dt/ha)</th>
                  <th>Feuchte (%)</th><th>Protein (%)</th><th>hl-Gewicht</th>
                  <th>Bonitur 1-9</th><th>Reife</th><th></th>
                </tr>
              </thead>
              <tbody>
                {positionen.map((p, i) => (
                  <tr key={i} className="border-b">
                    <td className="py-1"><input type="text" value={p.sorte} onChange={e => setP(i, "sorte", e.target.value)} className="border rounded px-2 py-1 w-32" /></td>
                    <td className="py-1"><input type="number" step="0.1" value={p.saatstaerke} onChange={e => setP(i, "saatstaerke", e.target.value)} className="border rounded px-2 py-1 w-20" /></td>
                    <td className="py-1"><input type="number" step="0.1" value={p.ertragDtHa} onChange={e => setP(i, "ertragDtHa", e.target.value)} className="border rounded px-2 py-1 w-20" /></td>
                    <td className="py-1"><input type="number" step="0.1" value={p.feuchteProzent} onChange={e => setP(i, "feuchteProzent", e.target.value)} className="border rounded px-2 py-1 w-16" /></td>
                    <td className="py-1"><input type="number" step="0.1" value={p.proteinProzent} onChange={e => setP(i, "proteinProzent", e.target.value)} className="border rounded px-2 py-1 w-16" /></td>
                    <td className="py-1"><input type="number" step="0.1" value={p.hektolitergew} onChange={e => setP(i, "hektolitergew", e.target.value)} className="border rounded px-2 py-1 w-16" /></td>
                    <td className="py-1"><input type="number" min="1" max="9" value={p.bonitur} onChange={e => setP(i, "bonitur", e.target.value)} className="border rounded px-2 py-1 w-14" /></td>
                    <td className="py-1">
                      <select value={p.reife} onChange={e => setP(i, "reife", e.target.value)} className="border rounded px-2 py-1">
                        <option value="">–</option>
                        <option value="früh">früh</option>
                        <option value="mittel">mittel</option>
                        <option value="spät">spät</option>
                      </select>
                    </td>
                    <td className="py-1">
                      {positionen.length > 1 && (
                        <button type="button" onClick={() => setPositionen(positionen.filter((_, idx) => idx !== i))} className="text-red-600 text-sm">×</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="flex gap-3 justify-end">
          <button type="button" onClick={() => router.back()} className="border px-4 py-2 rounded hover:bg-gray-50">Abbrechen</button>
          <button type="submit" disabled={saving} className="bg-green-700 text-white px-6 py-2 rounded hover:bg-green-800 disabled:opacity-50">
            {saving ? "Speichere…" : "Speichern"}
          </button>
        </div>
      </form>
    </div>
  );
}
