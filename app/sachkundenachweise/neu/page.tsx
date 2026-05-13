"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/Card";
import SearchableSelect from "@/components/SearchableSelect";
import { useToast } from "@/components/ToastProvider";

interface Kunde { id: number; name: string; firma?: string | null; }

function Inner() {
  const router = useRouter();
  const sp = useSearchParams();
  const toast = useToast();

  const [kunden, setKunden] = useState<Kunde[]>([]);
  const [form, setForm] = useState({
    kundeId: sp.get("kundeId") ?? "",
    typ: "PSM-Sachkunde",
    nummer: "",
    ausstellung: "",
    gueltigBis: "",
    ausgestelltVon: "",
    notiz: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/kunden?limit=2000").then(r => r.json()).then(d => setKunden(Array.isArray(d) ? d : (d?.kunden ?? [])));
  }, []);

  async function speichern(e: React.FormEvent) {
    e.preventDefault();
    if (!form.kundeId) { toast.error("Kunde wählen"); return; }
    setSaving(true);
    const res = await fetch("/api/sachkundenachweise", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, kundeId: parseInt(form.kundeId, 10) }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Nachweis gespeichert");
      router.push("/sachkundenachweise");
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? "Fehler");
    }
  }

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm(s => ({ ...s, [k]: v }));
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">📜 Neuer Sachkundenachweis</h1>
      <form onSubmit={speichern}>
        <Card>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1">Kunde *</label>
              <SearchableSelect
                options={kunden.map(k => ({ value: String(k.id), label: k.firma ? `${k.firma} (${k.name})` : k.name }))}
                value={form.kundeId}
                onChange={v => set("kundeId", v)}
                placeholder="Kunde wählen…"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Typ *</label>
              <select required value={form.typ} onChange={e => set("typ", e.target.value)} className="w-full border rounded px-3 py-2">
                <option value="PSM-Sachkunde">PSM-Sachkunde (§9 PflSchG)</option>
                <option value="Spritzgeraetekontrolle">Spritzgerätekontrolle</option>
                <option value="Duengerschulung">Düngerschulung (§4 DüV)</option>
                <option value="Sprengstoff-Sachkunde">Sprengstoff-Sachkunde (EU 2019/1148)</option>
                <option value="Mais-Beize-Sachkunde">Mais-Beize-Sachkunde</option>
                <option value="Wildlebensmittel-Schulung">Wildlebensmittel-Schulung</option>
                <option value="Sonstige">Sonstige</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nummer</label>
              <input type="text" value={form.nummer} onChange={e => set("nummer", e.target.value)} className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Ausstellungsdatum</label>
              <input type="date" value={form.ausstellung} onChange={e => set("ausstellung", e.target.value)} className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Gültig bis</label>
              <input type="date" value={form.gueltigBis} onChange={e => set("gueltigBis", e.target.value)} className="w-full border rounded px-3 py-2" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1">Ausgestellt von</label>
              <input type="text" value={form.ausgestelltVon} onChange={e => set("ausgestelltVon", e.target.value)} className="w-full border rounded px-3 py-2" placeholder="z.B. Landwirtschaftskammer NRW" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1">Notiz</label>
              <textarea value={form.notiz} onChange={e => set("notiz", e.target.value)} rows={3} className="w-full border rounded px-3 py-2" />
            </div>
          </div>
        </Card>
        <div className="flex gap-3 justify-end mt-4">
          <button type="button" onClick={() => router.back()} className="border px-4 py-2 rounded hover:bg-gray-50">Abbrechen</button>
          <button type="submit" disabled={saving} className="bg-green-700 text-white px-6 py-2 rounded hover:bg-green-800 disabled:opacity-50">
            {saving ? "Speichere…" : "Speichern"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={<div className="p-6">Lade…</div>}><Inner /></Suspense>;
}
