"use client";

import { useEffect, useState, Suspense, useRef } from "react";
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

  // KI-Upload
  const [kiFile, setKiFile] = useState<File | null>(null);
  const [kiLoading, setKiLoading] = useState(false);
  const [kiError, setKiError] = useState<string | null>(null);
  const [kiResult, setKiResult] = useState<{ felder: number; hinweis?: string | null } | null>(null);
  const [belegPfad, setBelegPfad] = useState<string | null>(null);
  const [belegName, setBelegName] = useState<string | null>(null);
  const kiInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/kunden?limit=2000").then(r => r.json()).then(d => setKunden(Array.isArray(d) ? d : (d?.kunden ?? [])));
  }, []);

  async function kiAnalysieren(file: File) {
    setKiLoading(true); setKiError(null); setKiResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/ki/sachkundenachweis", { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setKiError(err.error ?? "KI-Analyse fehlgeschlagen");
        return;
      }
      const json = await res.json() as {
        data: Record<string, string | null>;
        belegPfad?: string;
        belegName?: string;
      };
      if (json.belegPfad) setBelegPfad(json.belegPfad);
      if (json.belegName) setBelegName(json.belegName);
      const d = json.data ?? {};
      let n = 0;
      function fill<K extends keyof typeof form>(k: K, v: string | null | undefined) {
        if (v) { setForm(s => ({ ...s, [k]: v })); n++; }
      }
      fill("typ", d.typ);
      fill("nummer", d.nummer);
      fill("ausstellung", d.ausstellung);
      fill("gueltigBis", d.gueltigBis);
      fill("ausgestelltVon", d.ausgestelltVon);
      if (d.inhaberName) {
        setForm(s => ({ ...s, notiz: s.notiz ? `Inhaber laut Beleg: ${d.inhaberName}\n${s.notiz}` : `Inhaber laut Beleg: ${d.inhaberName}` }));
        n++;
      }
      setKiResult({ felder: n, hinweis: d.hinweis });
    } catch {
      setKiError("Netzwerkfehler bei KI-Analyse");
    } finally {
      setKiLoading(false);
    }
  }

  async function speichern(e: React.FormEvent) {
    e.preventDefault();
    if (!form.kundeId) { toast.error("Kunde wählen"); return; }
    setSaving(true);
    const res = await fetch("/api/sachkundenachweise", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, kundeId: parseInt(form.kundeId, 10), belegPfad, belegName }),
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
      <form onSubmit={speichern} className="space-y-4">
        <Card>
          <div className="flex items-start gap-3 mb-3">
            <span className="text-2xl">🤖</span>
            <div>
              <h2 className="font-semibold">KI-Erkennung aus Foto oder PDF</h2>
              <p className="text-sm text-gray-500 mt-0.5">Sachkundenachweis / Zertifikat hochladen — Felder werden automatisch befüllt.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <label className="cursor-pointer inline-flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white text-sm px-4 py-2 rounded">
              {kiFile ? kiFile.name : "Foto / PDF hochladen"}
              <input
                ref={kiInputRef}
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setKiFile(f);
                  await kiAnalysieren(f);
                  if (kiInputRef.current) kiInputRef.current.value = "";
                }}
              />
            </label>
            {kiFile && !kiLoading && (
              <button type="button" onClick={() => { setKiFile(null); setKiResult(null); setKiError(null); setBelegPfad(null); setBelegName(null); }} className="text-xs text-gray-500 hover:text-red-600 hover:underline">Entfernen</button>
            )}
            {kiLoading && <span className="text-sm text-gray-500">KI analysiert…</span>}
          </div>
          {kiResult && (
            <div className="mt-3 bg-green-50 border border-green-200 rounded p-3 text-sm text-green-800">
              ✓ {kiResult.felder} {kiResult.felder === 1 ? "Feld" : "Felder"} automatisch ausgefüllt
              {kiResult.hinweis && <div className="text-xs text-green-700 mt-1">ℹ {kiResult.hinweis}</div>}
            </div>
          )}
          {kiError && <div className="mt-3 bg-red-50 border border-red-200 rounded p-3 text-red-700 text-sm">{kiError}</div>}
          {belegPfad && <div className="mt-2 text-xs text-gray-400">📄 Beleg gespeichert: {belegName}</div>}
        </Card>

        <Card>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1">
                Kunde <span className="text-red-500">*</span>
                <a href="/kunden/neu" target="_blank" rel="noopener" className="ml-2 text-xs text-green-700 hover:underline font-normal">+ Neuer Kunde</a>
              </label>
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

export default function Page() {
  return <Suspense fallback={<div className="p-6">Lade…</div>}><Inner /></Suspense>;
}
