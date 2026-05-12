"use client";
import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import SearchableSelect from "@/components/SearchableSelect";

interface Kunde {
  id: number;
  name: string;
  firma: string | null;
}

interface Schlag {
  id: number;
  name: string;
  flaeche: number | null;
  fruchtart: string | null;
}

const EINHEITEN = ["l/ha", "kg/ha", "ml/ha", "g/ha"];

function PSMNeuInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [kunden, setKunden] = useState<Kunde[]>([]);
  const [schlaegte, setSchlaegte] = useState<Schlag[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const today = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState({
    kundeId: searchParams.get("kundeId") ?? "",
    schlagId: "",
    datum: today,
    mittel: "",
    wirkstoff: "",
    menge: "",
    einheit: "l/ha",
    kultur: "",
    flaeche: "",
    anwendungsgrund: "",
    wartezeit: "",
    notiz: "",
  });

  useEffect(() => {
    fetch("/api/kunden?limit=500")
      .then((r) => r.json())
      .then((d) => setKunden(Array.isArray(d) ? d : (d.kunden ?? [])))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!form.kundeId) { setSchlaegte([]); return; }
    fetch(`/api/kunden/${form.kundeId}/schlaegte`)
      .then((r) => r.json())
      .then((d) => setSchlaegte(Array.isArray(d) ? d : []))
      .catch(() => setSchlaegte([]));
  }, [form.kundeId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.kundeId || !form.mittel.trim() || !form.menge || !form.datum) {
      setError("Bitte alle Pflichtfelder ausfüllen.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const body = {
        kundeId: parseInt(form.kundeId, 10),
        schlagId: form.schlagId ? parseInt(form.schlagId, 10) : null,
        datum: form.datum,
        mittel: form.mittel.trim(),
        wirkstoff: form.wirkstoff.trim() || null,
        menge: parseFloat(form.menge),
        einheit: form.einheit,
        kultur: form.kultur.trim() || null,
        flaeche: form.flaeche ? parseFloat(form.flaeche) : null,
        anwendungsgrund: form.anwendungsgrund.trim() || null,
        wartezeit: form.wartezeit ? parseInt(form.wartezeit, 10) : null,
        notiz: form.notiz.trim() || null,
      };
      const res = await fetch("/api/psm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Fehler beim Speichern.");
        return;
      }
      router.push("/psm");
    } catch {
      setError("Fehler beim Speichern.");
    } finally {
      setSaving(false);
    }
  }

  const kundenOptions = kunden.map((k) => ({
    value: k.id,
    label: k.firma ?? k.name,
    sub: k.firma ? k.name : undefined,
  }));

  const schlagOptions = schlaegte.map((s) => ({
    value: s.id,
    label: s.name,
    sub: s.fruchtart ?? undefined,
  }));

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/psm" className="text-gray-500 hover:text-gray-700 text-sm">← Zurück</Link>
        <h1 className="text-2xl font-bold text-gray-900">Neue PSM-Ausbringung</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Kunde <span className="text-red-500">*</span>
          </label>
          <SearchableSelect
            options={kundenOptions}
            value={form.kundeId}
            onChange={(v) => setForm({ ...form, kundeId: v, schlagId: "" })}
            placeholder="Kunde auswählen…"
            required
          />
        </div>

        {form.kundeId && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Schlag (optional)</label>
            <SearchableSelect
              options={schlagOptions}
              value={form.schlagId}
              onChange={(v) => setForm({ ...form, schlagId: v })}
              placeholder="— Kein Schlag —"
              allowClear
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Datum <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={form.datum}
            onChange={(e) => setForm({ ...form, datum: e.target.value })}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Mittel / Präparatname <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.mittel}
            onChange={(e) => setForm({ ...form, mittel: e.target.value })}
            required
            placeholder="z.B. Roundup PowerFlex"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Wirkstoff (optional)</label>
          <input
            type="text"
            value={form.wirkstoff}
            onChange={(e) => setForm({ ...form, wirkstoff: e.target.value })}
            placeholder="z.B. Glyphosat"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Menge <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={form.menge}
              onChange={(e) => setForm({ ...form, menge: e.target.value })}
              required
              min="0"
              step="0.01"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Einheit</label>
            <select
              value={form.einheit}
              onChange={(e) => setForm({ ...form, einheit: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {EINHEITEN.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kultur (optional)</label>
            <input
              type="text"
              value={form.kultur}
              onChange={(e) => setForm({ ...form, kultur: e.target.value })}
              placeholder="z.B. Winterweizen"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fläche (ha, optional)</label>
            <input
              type="number"
              value={form.flaeche}
              onChange={(e) => setForm({ ...form, flaeche: e.target.value })}
              min="0"
              step="0.01"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Anwendungsgrund (optional)</label>
          <input
            type="text"
            value={form.anwendungsgrund}
            onChange={(e) => setForm({ ...form, anwendungsgrund: e.target.value })}
            placeholder="z.B. Unkrautbekämpfung"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Wartezeit (Tage, optional)</label>
          <input
            type="number"
            value={form.wartezeit}
            onChange={(e) => setForm({ ...form, wartezeit: e.target.value })}
            min="0"
            step="1"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notiz (optional)</label>
          <textarea
            value={form.notiz}
            onChange={(e) => setForm({ ...form, notiz: e.target.value })}
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-800 disabled:opacity-60 transition-colors"
          >
            {saving ? "Speichern…" : "Ausbringung speichern"}
          </button>
          <Link href="/psm" className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors">
            Abbrechen
          </Link>
        </div>
      </form>
    </div>
  );
}

export default function PSMNeuPage() {
  return (
    <Suspense fallback={<div className="container mx-auto px-4 py-8 text-gray-400">Lade…</div>}>
      <PSMNeuInner />
    </Suspense>
  );
}
