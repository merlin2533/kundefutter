"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, KpiCard } from "@/components/Card";
import SearchableSelect from "@/components/SearchableSelect";
import { useToast } from "@/components/ToastProvider";
import { formatDatum } from "@/lib/utils";

interface Schlag { id: number; name: string; kundeId: number; fruchtart?: string | null; vorfrucht?: string | null; flaeche: number; }
interface Kunde { id: number; name: string; firma?: string | null; }
interface Bodenprobe {
  id: number; schlagId: number; datum: string; pH?: number | null;
  phosphor?: number | null; kalium?: number | null; magnesium?: number | null;
  nMin?: number | null; klasse?: string | null;
}
interface Bedarfseintrag {
  id: number; jahr: number; fruchtart: string; ertragsZiel: number;
  nBedarf: number; pBedarf: number; kBedarf: number; mgBedarf?: number | null;
  berechnetAm: string; bodenprobe?: Bodenprobe | null;
}
interface BerechnungsErgebnis {
  fruchtart: string; ertragsZiel: number; nBedarf: number; pBedarf: number;
  kBedarf: number; mgBedarf: number; hinweise: string[];
  rechenweg: { nBasis: number; nErtragsKorrektur: number; nMinAbzug: number; nVorfruchtAbzug: number; nOrgDungAbzug: number; nZwischenfruchtAbzug: number; pBasis: number; pKorrektur: number; kBasis: number; kKorrektur: number; mgBasis: number; mgKorrektur: number; };
}

function Inner() {
  const sp = useSearchParams();
  const router = useRouter();
  const toast = useToast();

  const [kunden, setKunden] = useState<Kunde[]>([]);
  const [schlaegte, setSchlaegte] = useState<Schlag[]>([]);
  const [proben, setProben] = useState<Bodenprobe[]>([]);
  const [historie, setHistorie] = useState<Bedarfseintrag[]>([]);
  const [fruchtarten, setFruchtarten] = useState<string[]>([]);

  const [kundeId, setKundeId] = useState(sp.get("kundeId") ?? "");
  const [schlagId, setSchlagId] = useState(sp.get("schlagId") ?? "");
  const [eingaben, setEingaben] = useState({
    jahr: new Date().getFullYear(),
    fruchtart: "",
    ertragsZiel: "",
    vorfrucht: "",
    nMin: "",
    organischeDuengungVorjahrN: "",
    versorgungsklasseP: "",
    versorgungsklasseK: "",
    versorgungsklasseMg: "",
    zwischenfruchtAngebaut: false,
  });
  const [ergebnis, setErgebnis] = useState<BerechnungsErgebnis | null>(null);
  const [berechnet, setBerechnet] = useState(false);
  const [speichern, setSpeichern] = useState(false);

  useEffect(() => {
    fetch("/api/kunden?limit=2000").then(r => r.json()).then(d => setKunden(Array.isArray(d) ? d : (d?.kunden ?? [])));
    fetch("/api/duengebedarf?fruchtarten=1").then(r => r.json()).then(d => setFruchtarten(Array.isArray(d) ? d : []));
  }, []);

  useEffect(() => {
    if (!kundeId) { setSchlaegte([]); return; }
    fetch(`/api/kunden/${kundeId}/schlaegte`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setSchlaegte(Array.isArray(d) ? d : []));
  }, [kundeId]);

  useEffect(() => {
    if (!schlagId) { setProben([]); setHistorie([]); return; }
    fetch(`/api/bodenproben?schlagId=${schlagId}`).then(r => r.json()).then(d => setProben(Array.isArray(d) ? d : []));
    fetch(`/api/duengebedarf?schlagId=${schlagId}`).then(r => r.json()).then(d => setHistorie(Array.isArray(d) ? d : []));
    const s = schlaegte.find(x => String(x.id) === schlagId);
    if (s) {
      setEingaben(e => ({
        ...e,
        fruchtart: s.fruchtart ?? e.fruchtart,
        vorfrucht: s.vorfrucht ?? e.vorfrucht,
      }));
    }
  }, [schlagId, schlaegte]);

  async function berechnen(speichernFlag = false) {
    if (!schlagId) { toast.error("Schlag wählen"); return; }
    if (!eingaben.fruchtart) { toast.error("Fruchtart wählen"); return; }
    setSpeichern(speichernFlag);
    const res = await fetch("/api/duengebedarf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schlagId: parseInt(schlagId, 10),
        jahr: eingaben.jahr,
        fruchtart: eingaben.fruchtart,
        ertragsZiel: eingaben.ertragsZiel || null,
        vorfrucht: eingaben.vorfrucht || null,
        nMin: eingaben.nMin || null,
        organischeDuengungVorjahrN: eingaben.organischeDuengungVorjahrN || null,
        versorgungsklasseP: eingaben.versorgungsklasseP || null,
        versorgungsklasseK: eingaben.versorgungsklasseK || null,
        versorgungsklasseMg: eingaben.versorgungsklasseMg || null,
        zwischenfruchtAngebaut: eingaben.zwischenfruchtAngebaut,
        speichern: speichernFlag,
      }),
    });
    setSpeichern(false);
    if (res.ok) {
      const data = await res.json();
      setErgebnis(data);
      setBerechnet(true);
      if (speichernFlag) {
        toast.success("Bedarf gespeichert");
        fetch(`/api/duengebedarf?schlagId=${schlagId}`).then(r => r.json()).then(d => setHistorie(Array.isArray(d) ? d : []));
      }
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? "Berechnungsfehler");
    }
  }

  function setE<K extends keyof typeof eingaben>(k: K, v: typeof eingaben[K]) {
    setEingaben(e => ({ ...e, [k]: v }));
  }

  const aktuelleProbe = proben[0];
  const schlag = schlaegte.find(s => String(s.id) === schlagId);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">🧮 Düngebedarfsermittlung (DüV)</h1>

      <Card className="mb-4">
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Kunde</label>
            <SearchableSelect
              options={kunden.map(k => ({ value: String(k.id), label: k.firma ? `${k.firma} (${k.name})` : k.name }))}
              value={kundeId}
              onChange={v => { setKundeId(v); setSchlagId(""); setErgebnis(null); }}
              placeholder="Kunde wählen…"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Schlag</label>
            <SearchableSelect
              options={schlaegte.map(s => ({ value: String(s.id), label: `${s.name} (${s.flaeche} ha)` }))}
              value={schlagId}
              onChange={v => { setSchlagId(v); setErgebnis(null); }}
              placeholder={kundeId ? "Schlag wählen…" : "Erst Kunde"}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Jahr</label>
            <input type="number" value={eingaben.jahr} onChange={e => setE("jahr", parseInt(e.target.value, 10))} className="w-full border rounded px-3 py-2" />
          </div>
        </div>
        {aktuelleProbe && (
          <div className="mt-3 text-sm text-gray-600 bg-blue-50 rounded p-2">
            Letzte Bodenprobe vom {formatDatum(aktuelleProbe.datum)}:{" "}
            {aktuelleProbe.pH != null && <span className="mr-2">pH {aktuelleProbe.pH}</span>}
            {aktuelleProbe.phosphor != null && <span className="mr-2">P₂O₅ {aktuelleProbe.phosphor}</span>}
            {aktuelleProbe.kalium != null && <span className="mr-2">K₂O {aktuelleProbe.kalium}</span>}
            {aktuelleProbe.nMin != null && <span className="mr-2">N-Min {aktuelleProbe.nMin}</span>}
            {aktuelleProbe.klasse && <span>Klasse {aktuelleProbe.klasse}</span>}
            {" — wird automatisch berücksichtigt"}
          </div>
        )}
      </Card>

      <Card className="mb-4">
        <h2 className="font-semibold mb-3">Berechnungs-Parameter</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Fruchtart *</label>
            <SearchableSelect
              options={fruchtarten.map(f => ({ value: f, label: f }))}
              value={eingaben.fruchtart}
              onChange={v => setE("fruchtart", v)}
              placeholder="Fruchtart wählen…"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Ertragsziel (dt/ha)</label>
            <input type="number" step="1" value={eingaben.ertragsZiel} onChange={e => setE("ertragsZiel", e.target.value)} className="w-full border rounded px-3 py-2" placeholder="Standard" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Vorfrucht</label>
            <input type="text" value={eingaben.vorfrucht} onChange={e => setE("vorfrucht", e.target.value)} className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">N-Min (kg/ha)</label>
            <input type="number" step="1" value={eingaben.nMin} onChange={e => setE("nMin", e.target.value)} className="w-full border rounded px-3 py-2" placeholder={aktuelleProbe?.nMin?.toString() ?? "aus Bodenprobe"} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Org. N Vorjahr (kg/ha)</label>
            <input type="number" step="1" value={eingaben.organischeDuengungVorjahrN} onChange={e => setE("organischeDuengungVorjahrN", e.target.value)} className="w-full border rounded px-3 py-2" />
          </div>
          <div className="flex items-end gap-2">
            <input id="zf" type="checkbox" checked={eingaben.zwischenfruchtAngebaut} onChange={e => setE("zwischenfruchtAngebaut", e.target.checked)} />
            <label htmlFor="zf" className="text-sm">Zwischenfrucht angebaut</label>
          </div>
          <KlassenSelect label="Versorgungsklasse P" value={eingaben.versorgungsklasseP} onChange={v => setE("versorgungsklasseP", v)} />
          <KlassenSelect label="Versorgungsklasse K" value={eingaben.versorgungsklasseK} onChange={v => setE("versorgungsklasseK", v)} />
          <KlassenSelect label="Versorgungsklasse Mg" value={eingaben.versorgungsklasseMg} onChange={v => setE("versorgungsklasseMg", v)} />
        </div>
        <div className="flex gap-3 mt-4 justify-end">
          <button onClick={() => berechnen(false)} className="bg-blue-700 text-white px-4 py-2 rounded hover:bg-blue-800">
            Berechnen
          </button>
          <button onClick={() => berechnen(true)} disabled={speichern} className="bg-green-700 text-white px-4 py-2 rounded hover:bg-green-800 disabled:opacity-50">
            {speichern ? "Speichere…" : "Berechnen + Speichern"}
          </button>
        </div>
      </Card>

      {berechnet && ergebnis && (
        <Card className="mb-4">
          <h2 className="font-semibold mb-3">Ergebnis</h2>
          <div className="grid sm:grid-cols-4 gap-3">
            <KpiCard label="N-Bedarf" value={`${ergebnis.nBedarf} kg/ha`} color="green" sub={schlag ? `≈ ${(ergebnis.nBedarf * schlag.flaeche).toFixed(0)} kg gesamt` : undefined} />
            <KpiCard label="P₂O₅-Bedarf" value={`${ergebnis.pBedarf} kg/ha`} color="blue" sub={schlag ? `≈ ${(ergebnis.pBedarf * schlag.flaeche).toFixed(0)} kg gesamt` : undefined} />
            <KpiCard label="K₂O-Bedarf" value={`${ergebnis.kBedarf} kg/ha`} color="yellow" sub={schlag ? `≈ ${(ergebnis.kBedarf * schlag.flaeche).toFixed(0)} kg gesamt` : undefined} />
            <KpiCard label="MgO-Bedarf" value={`${ergebnis.mgBedarf} kg/ha`} color="orange" sub={schlag ? `≈ ${(ergebnis.mgBedarf * schlag.flaeche).toFixed(0)} kg gesamt` : undefined} />
          </div>
          {ergebnis.hinweise.length > 0 && (
            <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded p-3 text-sm">
              <strong>Hinweise:</strong>
              <ul className="list-disc list-inside">
                {ergebnis.hinweise.map((h, i) => <li key={i}>{h}</li>)}
              </ul>
            </div>
          )}
          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-gray-600">Rechenweg anzeigen</summary>
            <table className="mt-2 text-sm">
              <tbody>
                <tr><td className="pr-3">N-Basis</td><td>{ergebnis.rechenweg.nBasis} kg/ha</td></tr>
                <tr><td className="pr-3">+ Ertragskorrektur</td><td>{ergebnis.rechenweg.nErtragsKorrektur} kg/ha</td></tr>
                <tr><td className="pr-3">− N-Min Abzug</td><td>{ergebnis.rechenweg.nMinAbzug} kg/ha</td></tr>
                <tr><td className="pr-3">− Vorfrucht Abzug</td><td>{ergebnis.rechenweg.nVorfruchtAbzug} kg/ha</td></tr>
                <tr><td className="pr-3">− Org. Düngung Abzug</td><td>{ergebnis.rechenweg.nOrgDungAbzug.toFixed(1)} kg/ha</td></tr>
                <tr><td className="pr-3">− Zwischenfrucht Abzug</td><td>{ergebnis.rechenweg.nZwischenfruchtAbzug} kg/ha</td></tr>
                <tr><td className="pr-3">P-Basis × Korrektur</td><td>{ergebnis.rechenweg.pBasis} × {ergebnis.rechenweg.pKorrektur}</td></tr>
                <tr><td className="pr-3">K-Basis × Korrektur</td><td>{ergebnis.rechenweg.kBasis} × {ergebnis.rechenweg.kKorrektur}</td></tr>
              </tbody>
            </table>
          </details>
        </Card>
      )}

      {historie.length > 0 && (
        <Card>
          <h2 className="font-semibold mb-3">Historie für diesen Schlag</h2>
          <table className="min-w-full text-sm">
            <thead><tr className="text-left border-b"><th>Jahr</th><th>Fruchtart</th><th>N</th><th>P₂O₅</th><th>K₂O</th><th>MgO</th><th>Berechnet am</th></tr></thead>
            <tbody>
              {historie.map(h => (
                <tr key={h.id} className="border-b">
                  <td>{h.jahr}</td>
                  <td>{h.fruchtart}</td>
                  <td>{h.nBedarf}</td>
                  <td>{h.pBedarf}</td>
                  <td>{h.kBedarf}</td>
                  <td>{h.mgBedarf ?? "–"}</td>
                  <td>{formatDatum(h.berechnetAm)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function KlassenSelect({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} className="w-full border rounded px-3 py-2">
        <option value="">– aus Bodenprobe –</option>
        <option value="A">A (sehr niedrig)</option>
        <option value="B">B (niedrig)</option>
        <option value="C">C (anzustreben)</option>
        <option value="D">D (hoch)</option>
        <option value="E">E (sehr hoch)</option>
      </select>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6">Lade…</div>}>
      <Inner />
    </Suspense>
  );
}
