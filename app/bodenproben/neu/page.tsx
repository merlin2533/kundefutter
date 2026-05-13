"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/Card";
import SearchableSelect from "@/components/SearchableSelect";
import { useToast } from "@/components/ToastProvider";

interface Schlag { id: number; name: string; kundeId: number; }
interface Kunde { id: number; name: string; firma?: string | null; }

function NeuInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const toast = useToast();

  const [kunden, setKunden] = useState<Kunde[]>([]);
  const [schlaegte, setSchlaegte] = useState<Schlag[]>([]);
  const [kundeId, setKundeId] = useState<string>(sp.get("kundeId") ?? "");
  const [schlagId, setSchlagId] = useState<string>(sp.get("schlagId") ?? "");
  const [form, setForm] = useState({
    datum: new Date().toISOString().slice(0, 10),
    probenNr: "",
    labor: "",
    tiefe: "0-30 cm",
    pH: "",
    phosphor: "",
    kalium: "",
    magnesium: "",
    bor: "",
    humus: "",
    nMin: "",
    cn: "",
    bodenart: "",
    klasse: "",
    notiz: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/kunden?limit=2000")
      .then(r => r.json())
      .then(d => setKunden(Array.isArray(d) ? d : (d?.kunden ?? [])));
  }, []);

  useEffect(() => {
    if (!kundeId) {
      setSchlaegte([]);
      return;
    }
    fetch(`/api/kunden/${kundeId}/schlaegte`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setSchlaegte(Array.isArray(d) ? d : []));
  }, [kundeId]);

  async function speichern(e: React.FormEvent) {
    e.preventDefault();
    if (!schlagId) {
      toast.error("Bitte einen Schlag wählen");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/bodenproben", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schlagId: parseInt(schlagId, 10), ...form }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Bodenprobe gespeichert");
      router.push("/bodenproben");
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? "Speichern fehlgeschlagen");
    }
  }

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm(s => ({ ...s, [k]: v }));
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">🧪 Neue Bodenprobe</h1>
      <form onSubmit={speichern} className="space-y-4">
        <Card>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Kunde *</label>
              <SearchableSelect
                options={kunden.map(k => ({ value: String(k.id), label: k.firma ? `${k.firma} (${k.name})` : k.name }))}
                value={kundeId}
                onChange={v => { setKundeId(v); setSchlagId(""); }}
                placeholder="Kunde wählen…"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Schlag *</label>
              <SearchableSelect
                options={schlaegte.map(s => ({ value: String(s.id), label: s.name }))}
                value={schlagId}
                onChange={setSchlagId}
                placeholder={kundeId ? "Schlag wählen…" : "Erst Kunde wählen"}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Probedatum *</label>
              <input type="date" required value={form.datum} onChange={e => set("datum", e.target.value)} className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Proben-Nr.</label>
              <input type="text" value={form.probenNr} onChange={e => set("probenNr", e.target.value)} className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Labor</label>
              <input type="text" list="labor-list" value={form.labor} onChange={e => set("labor", e.target.value)} className="w-full border rounded px-3 py-2" />
              <datalist id="labor-list">
                <option value="LUFA NRW" />
                <option value="LUFA Nord-West" />
                <option value="Eurofins Agro" />
                <option value="LKS Lichtenwalde" />
                <option value="AGROLAB" />
              </datalist>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tiefe</label>
              <input type="text" list="tiefe-list" value={form.tiefe} onChange={e => set("tiefe", e.target.value)} className="w-full border rounded px-3 py-2" />
              <datalist id="tiefe-list">
                <option value="0-30 cm" />
                <option value="30-60 cm" />
                <option value="60-90 cm" />
              </datalist>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="font-semibold mb-3">Analysewerte</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <Num label="pH-Wert" k="pH" form={form} set={set} />
            <Num label="P₂O₅ (mg/100g)" k="phosphor" form={form} set={set} />
            <Num label="K₂O (mg/100g)" k="kalium" form={form} set={set} />
            <Num label="Mg (mg/100g)" k="magnesium" form={form} set={set} />
            <Num label="Bor (mg/kg)" k="bor" form={form} set={set} />
            <Num label="Humus (%)" k="humus" form={form} set={set} />
            <Num label="N-Min (kg/ha)" k="nMin" form={form} set={set} />
            <Num label="C/N-Verhältnis" k="cn" form={form} set={set} />
            <div>
              <label className="block text-sm font-medium mb-1">Bodenart</label>
              <input type="text" list="bodenart-list" value={form.bodenart} onChange={e => set("bodenart", e.target.value)} className="w-full border rounded px-3 py-2" />
              <datalist id="bodenart-list">
                <option value="S" />
                <option value="lS" />
                <option value="sL" />
                <option value="L" />
                <option value="T" />
              </datalist>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Versorgungsklasse</label>
              <select value={form.klasse} onChange={e => set("klasse", e.target.value)} className="w-full border rounded px-3 py-2">
                <option value="">– keine –</option>
                <option value="A">A (sehr niedrig)</option>
                <option value="B">B (niedrig)</option>
                <option value="C">C (anzustreben)</option>
                <option value="D">D (hoch)</option>
                <option value="E">E (sehr hoch)</option>
              </select>
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium mb-1">Notiz</label>
            <textarea value={form.notiz} onChange={e => set("notiz", e.target.value)} rows={3} className="w-full border rounded px-3 py-2" />
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

function Num({ label, k, form, set }: { label: string; k: keyof Form; form: Form; set: (k: keyof Form, v: string) => void }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input type="number" step="0.01" value={form[k]} onChange={e => set(k, e.target.value)} className="w-full border rounded px-3 py-2" />
    </div>
  );
}

type Form = {
  datum: string; probenNr: string; labor: string; tiefe: string;
  pH: string; phosphor: string; kalium: string; magnesium: string;
  bor: string; humus: string; nMin: string; cn: string;
  bodenart: string; klasse: string; notiz: string;
};

export default function NeuPage() {
  return (
    <Suspense fallback={<div className="p-6">Lade…</div>}>
      <NeuInner />
    </Suspense>
  );
}
