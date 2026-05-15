"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/Card";
import SearchableSelect from "@/components/SearchableSelect";
import { useToast } from "@/components/ToastProvider";

interface Schlag { id: number; name: string; kundeId: number; flaeche: number; fruchtart?: string | null; vorfrucht?: string | null; }
interface Kunde { id: number; name: string; firma?: string | null; }

function NeuInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const toast = useToast();

  const [kunden, setKunden] = useState<Kunde[]>([]);
  const [schlaegte, setSchlaegte] = useState<Schlag[]>([]);
  const [schlaegteGeladen, setSchlaegteGeladen] = useState(false);
  const [kundeId, setKundeId] = useState<string>(sp.get("kundeId") ?? "");
  const [schlagId, setSchlagId] = useState<string>(sp.get("schlagId") ?? "");

  // Inline-Schlag-Anlage
  const [zeigSchlagForm, setZeigSchlagForm] = useState(false);
  const [neuerSchlag, setNeuerSchlag] = useState({ name: "", flaeche: "", fruchtart: "", vorfrucht: "" });
  const [schlagSpeichern, setSchlagSpeichern] = useState(false);
  const [fruchtarten, setFruchtarten] = useState<string[]>([]);

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

  // KI-PDF-Upload state
  const [kiFile, setKiFile] = useState<File | null>(null);
  const [kiLoading, setKiLoading] = useState(false);
  const [kiResult, setKiResult] = useState<{ felderGefuellt: number; hinweis?: string | null } | null>(null);
  const [kiError, setKiError] = useState<string | null>(null);
  const [belegPfad, setBelegPfad] = useState<string | null>(null);
  const [belegName, setBelegName] = useState<string | null>(null);
  const kiFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/kunden?limit=2000")
      .then(r => r.json())
      .then(d => setKunden(Array.isArray(d) ? d : (d?.kunden ?? [])));
    fetch("/api/einstellungen?prefix=system.fruchtarten")
      .then(r => r.ok ? r.json() : {})
      .then(d => {
        const raw = (d as Record<string, string>)["system.fruchtarten"];
        if (raw) { try { const parsed = JSON.parse(raw); if (Array.isArray(parsed)) setFruchtarten(parsed); } catch { /* ignore */ } }
      });
  }, []);

  useEffect(() => {
    if (!kundeId) {
      setSchlaegte([]);
      setSchlaegteGeladen(false);
      return;
    }
    setSchlaegteGeladen(false);
    fetch(`/api/kunden/${kundeId}/schlaegte`)
      .then(r => r.ok ? r.json() : [])
      .then(d => {
        const liste = Array.isArray(d) ? d : [];
        setSchlaegte(liste);
        setSchlaegteGeladen(true);
        if (liste.length === 0) setZeigSchlagForm(true);
      });
  }, [kundeId]);

  async function schlagAnlegen() {
    if (!kundeId) return;
    if (!neuerSchlag.name.trim()) { toast.error("Schlagname erforderlich"); return; }
    if (!neuerSchlag.flaeche || isNaN(parseFloat(neuerSchlag.flaeche))) { toast.error("Fläche (ha) erforderlich"); return; }
    setSchlagSpeichern(true);
    const res = await fetch(`/api/kunden/${kundeId}/schlaegte`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: neuerSchlag.name.trim(),
        flaeche: parseFloat(neuerSchlag.flaeche),
        fruchtart: neuerSchlag.fruchtart || null,
        vorfrucht: neuerSchlag.vorfrucht || null,
      }),
    });
    setSchlagSpeichern(false);
    if (!res.ok) { toast.error("Schlag konnte nicht angelegt werden"); return; }
    const neu: Schlag = await res.json();
    setSchlaegte(prev => [...prev, neu]);
    setSchlagId(String(neu.id));
    setZeigSchlagForm(false);
    setNeuerSchlag({ name: "", flaeche: "", fruchtart: "", vorfrucht: "" });
    toast.success(`Schlag „${neu.name}" angelegt`);
  }

  async function kiAnalysieren(file: File) {
    setKiLoading(true);
    setKiError(null);
    setKiResult(null);

    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/ki/bodenprobe", { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setKiError((err as { error?: string }).error ?? "KI-Analyse fehlgeschlagen");
        return;
      }
      const json = await res.json() as {
        data: Record<string, unknown>;
        belegPfad?: string;
        belegName?: string;
        tokens?: number;
      };

      // Save beleg info
      if (json.belegPfad) setBelegPfad(json.belegPfad);
      if (json.belegName) setBelegName(json.belegName);

      const d = json.data ?? {};
      let gefuellt = 0;

      function fill<K extends keyof typeof form>(k: K, v: unknown) {
        if (v != null && v !== "") {
          set(k, String(v));
          gefuellt++;
        }
      }

      fill("probenNr", d.probenNr);
      fill("labor", d.labor);
      fill("tiefe", d.tiefe);
      fill("datum", d.datum);
      fill("pH", d.pH);
      fill("phosphor", d.phosphor);
      fill("kalium", d.kalium);
      fill("magnesium", d.magnesium);
      fill("bor", d.bor);
      fill("humus", d.humus);
      fill("nMin", d.nMin);
      fill("cn", d.cn);
      fill("bodenart", d.bodenart);
      fill("klasse", d.klasse);

      // Schlag-Matching: wenn schlagName erkannt und Kunde gewählt
      const erkannterSchlagName = typeof d.schlagName === "string" ? d.schlagName : null;
      if (erkannterSchlagName && kundeId && schlaegte.length > 0) {
        const match = schlaegte.find(s =>
          s.name.toLowerCase().includes(erkannterSchlagName.toLowerCase()) ||
          erkannterSchlagName.toLowerCase().includes(s.name.toLowerCase())
        );
        if (match) {
          setSchlagId(String(match.id));
          gefuellt++;
        } else {
          setKiError(`Schlag "${erkannterSchlagName}" nicht gefunden — bitte manuell auswählen oder anlegen.`);
        }
      }

      setKiResult({
        felderGefuellt: gefuellt,
        hinweis: typeof d.hinweis === "string" ? d.hinweis : null,
      });
    } catch {
      setKiError("Netzwerkfehler bei KI-Analyse");
    } finally {
      setKiLoading(false);
    }
  }

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
      body: JSON.stringify({
        schlagId: parseInt(schlagId, 10),
        ...form,
        belegPfad: belegPfad ?? undefined,
        belegName: belegName ?? undefined,
      }),
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

  const keinSchlagVorhanden = !!kundeId && schlaegteGeladen && schlaegte.length === 0;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">🧪 Neue Bodenprobe</h1>
      <form onSubmit={speichern} className="space-y-4">
        {/* KI-Erkennung */}
        <Card>
          <div className="flex items-start gap-3 mb-3">
            <span className="text-2xl">🤖</span>
            <div>
              <h2 className="font-semibold">KI-Erkennung aus PDF oder Bild</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Lade einen Laborbericht hoch — die Felder werden automatisch ausgefüllt.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            <label className="cursor-pointer inline-flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white text-sm px-4 py-2 rounded transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              {kiFile ? kiFile.name : "PDF / Bild hochladen"}
              <input
                ref={kiFileInputRef}
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setKiFile(f);
                  setKiResult(null);
                  setKiError(null);
                  await kiAnalysieren(f);
                  // Reset input so same file can be re-selected
                  if (kiFileInputRef.current) kiFileInputRef.current.value = "";
                }}
              />
            </label>

            {kiFile && !kiLoading && (
              <button
                type="button"
                onClick={() => { setKiFile(null); setKiResult(null); setKiError(null); setBelegPfad(null); setBelegName(null); }}
                className="text-xs text-gray-500 hover:text-red-600 hover:underline"
              >
                Entfernen
              </button>
            )}

            {kiLoading && (
              <span className="text-sm text-gray-500 flex items-center gap-2">
                <svg className="w-4 h-4 animate-spin text-green-700" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                KI analysiert…
              </span>
            )}
          </div>

          {kiResult && (
            <div className="mt-3 bg-green-50 border border-green-200 rounded p-3 flex flex-wrap gap-2 items-start">
              <span className="text-green-800 text-sm font-medium">
                ✓ {kiResult.felderGefuellt} {kiResult.felderGefuellt === 1 ? "Feld" : "Felder"} automatisch ausgefüllt
              </span>
              {kiResult.hinweis && (
                <span className="text-green-700 text-xs mt-0.5 w-full">ℹ {kiResult.hinweis}</span>
              )}
            </div>
          )}

          {kiError && (
            <div className="mt-3 bg-red-50 border border-red-200 rounded p-3 text-red-700 text-sm">
              {kiError}
            </div>
          )}

          {belegPfad && (
            <div className="mt-2 text-xs text-gray-400 flex items-center gap-1">
              <svg className="w-3.5 h-3.5 text-red-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
              </svg>
              PDF gespeichert: {belegName}
            </div>
          )}
        </Card>

        <Card>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Kunde *</label>
              <SearchableSelect
                options={kunden.map(k => ({ value: String(k.id), label: k.firma ? `${k.firma} (${k.name})` : k.name }))}
                value={kundeId}
                onChange={v => { setKundeId(v); setSchlagId(""); setZeigSchlagForm(false); }}
                placeholder="Kunde wählen…"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Schlag *
                {kundeId && (
                  <button
                    type="button"
                    onClick={() => setZeigSchlagForm(v => !v)}
                    className="ml-2 text-xs text-green-700 hover:underline font-normal"
                  >
                    + Schlag anlegen
                  </button>
                )}
              </label>
              <SearchableSelect
                options={schlaegte.map(s => ({ value: String(s.id), label: s.name }))}
                value={schlagId}
                onChange={setSchlagId}
                placeholder={!kundeId ? "Erst Kunde wählen" : schlaegte.length === 0 ? "Kein Schlag — bitte anlegen" : "Schlag wählen…"}
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

          {/* Hinweis: kein Schlag vorhanden */}
          {keinSchlagVorhanden && !zeigSchlagForm && (
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded p-3 flex items-center gap-3">
              <span className="text-amber-700 text-sm">Dieser Kunde hat noch keine Schläge.</span>
              <button
                type="button"
                onClick={() => setZeigSchlagForm(true)}
                className="bg-green-700 text-white text-sm px-3 py-1 rounded hover:bg-green-800"
              >
                Schlag jetzt anlegen
              </button>
            </div>
          )}

          {/* Inline-Schlag-Formular */}
          {zeigSchlagForm && (
            <div className="mt-3 border border-green-200 bg-green-50 rounded p-4">
              <h3 className="text-sm font-semibold text-green-800 mb-3">Neuen Schlag anlegen</h3>
              <div className="grid sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Schlagname *</label>
                  <input
                    type="text"
                    value={neuerSchlag.name}
                    onChange={e => setNeuerSchlag(s => ({ ...s, name: e.target.value }))}
                    placeholder="z. B. Nordfeld"
                    className="w-full border rounded px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Fläche (ha) *</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={neuerSchlag.flaeche}
                    onChange={e => setNeuerSchlag(s => ({ ...s, flaeche: e.target.value }))}
                    placeholder="z. B. 12.5"
                    className="w-full border rounded px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Fruchtart</label>
                  <input
                    type="text"
                    list="schlag-fruchtart-list"
                    value={neuerSchlag.fruchtart}
                    onChange={e => setNeuerSchlag(s => ({ ...s, fruchtart: e.target.value }))}
                    placeholder="optional"
                    className="w-full border rounded px-2 py-1.5 text-sm"
                  />
                  <datalist id="schlag-fruchtart-list">
                    {fruchtarten.map(f => <option key={f} value={f} />)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Vorfrucht</label>
                  <input
                    type="text"
                    value={neuerSchlag.vorfrucht}
                    onChange={e => setNeuerSchlag(s => ({ ...s, vorfrucht: e.target.value }))}
                    placeholder="optional"
                    className="w-full border rounded px-2 py-1.5 text-sm"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  onClick={schlagAnlegen}
                  disabled={schlagSpeichern}
                  className="bg-green-700 text-white text-sm px-4 py-1.5 rounded hover:bg-green-800 disabled:opacity-50"
                >
                  {schlagSpeichern ? "Speichere…" : "Schlag anlegen & auswählen"}
                </button>
                <button
                  type="button"
                  onClick={() => setZeigSchlagForm(false)}
                  className="text-sm px-4 py-1.5 rounded border hover:bg-gray-50"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          )}
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
