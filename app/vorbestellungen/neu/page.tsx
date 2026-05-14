"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/Card";
import SearchableSelect from "@/components/SearchableSelect";
import { useToast } from "@/components/ToastProvider";

interface Kunde { id: number; name: string; firma?: string | null; }
interface Artikel { id: number; name: string; einheit: string; standardpreis: number; kategorie: string; }
interface PositionRow { artikelId: string; menge: string; preis: string; einheit: string; reservieren: boolean; }
interface Staffel { id: number; saison: string; kategorie?: string | null; artikelId?: number | null; bestellfrist: string; rabattProzent: number; beschreibung?: string | null; aktiv: boolean; }

const EMPTY_POS: PositionRow = { artikelId: "", menge: "", preis: "", einheit: "kg", reservieren: false };

function aktuelleSaison(): string {
  const m = new Date().getMonth() + 1;
  const jahr = new Date().getFullYear();
  return m <= 6 ? `Frühjahr ${jahr}` : `Herbst ${jahr}`;
}

function Inner() {
  const router = useRouter();
  const sp = useSearchParams();
  const toast = useToast();

  const [kunden, setKunden] = useState<Kunde[]>([]);
  const [artikel, setArtikel] = useState<Artikel[]>([]);
  const [staffeln, setStaffeln] = useState<Staffel[]>([]);
  const [kundeId, setKundeId] = useState(sp.get("kundeId") ?? "");
  const [saison, setSaison] = useState(aktuelleSaison());
  const [bestellfrist, setBestellfrist] = useState("");
  const [lieferdatum, setLieferdatum] = useState("");
  const [rabattProzent, setRabattProzent] = useState("");
  const [notiz, setNotiz] = useState("");
  const [positionen, setPositionen] = useState<PositionRow[]>([{ ...EMPTY_POS }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/kunden?limit=2000").then(r => r.json()).then(d => setKunden(Array.isArray(d) ? d : (d?.kunden ?? [])));
    fetch("/api/artikel?limit=5000").then(r => r.json()).then(d => setArtikel(Array.isArray(d) ? d : (d?.artikel ?? [])));
  }, []);

  useEffect(() => {
    if (!saison) return;
    fetch(`/api/fruehbezugsstaffel?saison=${encodeURIComponent(saison)}&aktiv=1`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setStaffeln(Array.isArray(d) ? d : []));
  }, [saison]);

  // Auto-Vorschlag: höchster passender Rabatt aus aktiven Staffeln
  const heute = new Date();
  const passendeStaffel = staffeln
    .filter(s => new Date(s.bestellfrist) >= heute && !s.artikelId && !s.kategorie)
    .sort((a, b) => b.rabattProzent - a.rabattProzent)[0];

  function setP(i: number, k: keyof PositionRow, v: string | boolean) {
    setPositionen(ps => ps.map((p, idx) => {
      if (idx !== i) return p;
      const updated = { ...p, [k]: v } as PositionRow;
      if (k === "artikelId" && typeof v === "string") {
        const a = artikel.find(x => String(x.id) === v);
        if (a) {
          updated.einheit = a.einheit;
          updated.preis = String(a.standardpreis);
        }
      }
      return updated;
    }));
  }

  async function speichern(e: React.FormEvent) {
    e.preventDefault();
    if (!kundeId) { toast.error("Kunde wählen"); return; }
    const gueltigePos = positionen.filter(p => p.artikelId && p.menge);
    if (gueltigePos.length === 0) { toast.error("Mindestens eine Position"); return; }
    setSaving(true);
    const res = await fetch("/api/vorbestellungen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kundeId: parseInt(kundeId, 10),
        saison,
        bestellfrist: bestellfrist || null,
        lieferdatum: lieferdatum || null,
        rabattProzent: rabattProzent ? Number(rabattProzent) : null,
        notiz,
        positionen: gueltigePos.map(p => ({
          artikelId: parseInt(p.artikelId, 10),
          menge: Number(p.menge),
          preis: p.preis ? Number(p.preis) : null,
          einheit: p.einheit,
          reservieren: p.reservieren,
        })),
      }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Vorbestellung erstellt");
      router.push("/vorbestellungen");
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? "Fehler");
    }
  }

  const summe = positionen.reduce((s, p) => {
    const menge = Number(p.menge) || 0;
    const preis = Number(p.preis) || 0;
    return s + menge * preis;
  }, 0);
  const rabattWert = rabattProzent ? summe * (Number(rabattProzent) / 100) : 0;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">📋 Neue Vorbestellung</h1>
      <form onSubmit={speichern} className="space-y-4">
        <Card>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1">
                Kunde *
                <a href="/kunden/neu" target="_blank" rel="noopener" className="ml-2 text-xs text-green-700 hover:underline font-normal">+ Neuer Kunde</a>
              </label>
              <SearchableSelect
                options={kunden.map(k => ({ value: String(k.id), label: k.firma ? `${k.firma} (${k.name})` : k.name }))}
                value={kundeId}
                onChange={setKundeId}
                placeholder="Kunde wählen…"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Saison *</label>
              <input type="text" list="saison-list" value={saison} onChange={e => setSaison(e.target.value)} className="w-full border rounded px-3 py-2" />
              <datalist id="saison-list">
                <option value={`Frühjahr ${new Date().getFullYear()}`} />
                <option value={`Herbst ${new Date().getFullYear()}`} />
                <option value={`Frühjahr ${new Date().getFullYear() + 1}`} />
                <option value={`Herbst ${new Date().getFullYear() + 1}`} />
              </datalist>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Bestellfrist</label>
              <input type="date" value={bestellfrist} onChange={e => setBestellfrist(e.target.value)} className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Gewünschtes Lieferdatum</label>
              <input type="date" value={lieferdatum} onChange={e => setLieferdatum(e.target.value)} className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Rabatt (%)</label>
              <input type="number" step="0.1" value={rabattProzent} onChange={e => setRabattProzent(e.target.value)} className="w-full border rounded px-3 py-2" placeholder={passendeStaffel ? `Vorschlag: ${passendeStaffel.rabattProzent}%` : "leer = aus Staffel"} />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-sm font-medium mb-1">Notiz</label>
              <textarea value={notiz} onChange={e => setNotiz(e.target.value)} rows={2} className="w-full border rounded px-3 py-2" />
            </div>
          </div>
          {passendeStaffel && !rabattProzent && (
            <div className="mt-3 bg-blue-50 border border-blue-200 rounded p-2 text-sm">
              Frühbezugs-Staffel aktiv: <strong>{passendeStaffel.rabattProzent}%</strong> Rabatt bis {new Date(passendeStaffel.bestellfrist).toLocaleDateString("de-DE")}
              {passendeStaffel.beschreibung && ` — ${passendeStaffel.beschreibung}`}
            </div>
          )}
        </Card>

        <Card>
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-semibold">Positionen</h2>
            <button type="button" onClick={() => setPositionen([...positionen, { ...EMPTY_POS }])} className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">+ Position</button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead><tr className="text-left border-b"><th>Artikel</th><th>Menge</th><th>Einheit</th><th>Preis</th><th>Lager-Res.</th><th></th></tr></thead>
              <tbody>
                {positionen.map((p, i) => (
                  <tr key={i} className="border-b">
                    <td className="py-1 pr-2">
                      <SearchableSelect
                        options={artikel.map(a => ({ value: String(a.id), label: a.name }))}
                        value={p.artikelId}
                        onChange={v => setP(i, "artikelId", v)}
                        placeholder="Artikel…"
                      />
                    </td>
                    <td className="py-1 pr-2"><input type="number" step="0.1" value={p.menge} onChange={e => setP(i, "menge", e.target.value)} className="border rounded px-2 py-1 w-24" /></td>
                    <td className="py-1 pr-2"><input type="text" value={p.einheit} onChange={e => setP(i, "einheit", e.target.value)} className="border rounded px-2 py-1 w-16" /></td>
                    <td className="py-1 pr-2"><input type="number" step="0.01" value={p.preis} onChange={e => setP(i, "preis", e.target.value)} className="border rounded px-2 py-1 w-24" /></td>
                    <td className="py-1 pr-2"><input type="checkbox" checked={p.reservieren} onChange={e => setP(i, "reservieren", e.target.checked)} /></td>
                    <td className="py-1">
                      {positionen.length > 1 && (
                        <button type="button" onClick={() => setPositionen(positionen.filter((_, idx) => idx !== i))} className="text-red-600">×</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t text-right font-semibold">
                  <td colSpan={3}>Summe netto</td>
                  <td>{summe.toFixed(2)} €</td>
                  <td colSpan={2}></td>
                </tr>
                {(rabattProzent || passendeStaffel) && (
                  <tr className="text-right text-green-700">
                    <td colSpan={3}>− Rabatt {rabattProzent || passendeStaffel?.rabattProzent}%</td>
                    <td>−{(rabattWert || summe * ((passendeStaffel?.rabattProzent ?? 0) / 100)).toFixed(2)} €</td>
                    <td colSpan={2}></td>
                  </tr>
                )}
              </tfoot>
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

export default function Page() {
  return <Suspense fallback={<div className="p-6">Lade…</div>}><Inner /></Suspense>;
}
