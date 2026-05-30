"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, KpiCard } from "@/components/Card";
import SearchableSelect from "@/components/SearchableSelect";
import { useToast } from "@/components/ToastProvider";
import { formatDatum } from "@/lib/utils";

interface Schlag { id: number; name: string; kundeId: number; fruchtart?: string | null; vorfrucht?: string | null; flaeche: number; }
interface Kunde { id: number; name: string; firma?: string | null; }
interface Bodenprobe {
  id: number; schlagId: number; datum: string; pH?: number | null;
  phosphor?: number | null; kalium?: number | null; magnesium?: number | null; bor?: number | null;
  nMin?: number | null;
  klasse?: string | null; // deprecated — Legacy-Sammelklasse
  klasseP?: string | null; klasseK?: string | null; klasseMg?: string | null; klasseBor?: string | null;
}
interface Bedarfseintrag {
  id: number; bezeichnung?: string | null; jahr: number; fruchtart: string; ertragsZiel: number;
  nBedarf: number; pBedarf: number; kBedarf: number; mgBedarf?: number | null;
  berechnetAm: string; bodenprobe?: Bodenprobe | null;
  vorfrucht?: string | null; notiz?: string | null;
  parameter?: string | null; // JSON: { eingaben, rechenweg }
}
interface BerechnungsErgebnis {
  fruchtart: string; ertragsZiel: number; nBedarf: number; pBedarf: number;
  kBedarf: number; mgBedarf: number; hinweise: string[];
  rechenweg: { nBasis: number; nErtragsKorrektur: number; nMinAbzug: number; nVorfruchtAbzug: number; nOrgDungAbzug: number; nZwischenfruchtAbzug: number; pBasis: number; pKorrektur: number; kBasis: number; kKorrektur: number; mgBasis: number; mgKorrektur: number; };
}

function Inner() {
  const sp = useSearchParams();
  const toast = useToast();

  const [kunden, setKunden] = useState<Kunde[]>([]);
  const [schlaegte, setSchlaegte] = useState<Schlag[]>([]);
  const [schlaegteGeladen, setSchlaegteGeladen] = useState(false);
  const [proben, setProben] = useState<Bodenprobe[]>([]);
  const [historie, setHistorie] = useState<Bedarfseintrag[]>([]);
  const [fruchtarten, setFruchtarten] = useState<string[]>([]);

  const [kundeId, setKundeId] = useState(sp.get("kundeId") ?? "");
  const [schlagId, setSchlagId] = useState(sp.get("schlagId") ?? "");

  // Inline-Schlag-Anlage
  const [zeigSchlagForm, setZeigSchlagForm] = useState(false);
  const [neuerSchlag, setNeuerSchlag] = useState({ name: "", flaeche: "", fruchtart: "", vorfrucht: "" });
  const [schlagSpeichern, setSchlagSpeichern] = useState(false);

  const [eingaben, setEingaben] = useState({
    bezeichnung: "",
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
  const [editId, setEditId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/kunden?limit=2000").then(r => r.json()).then(d => setKunden(Array.isArray(d) ? d : (d?.kunden ?? [])));
    fetch("/api/duengebedarf?fruchtarten=1").then(r => r.json()).then(d => setFruchtarten(Array.isArray(d) ? d : []));
  }, []);

  useEffect(() => {
    if (!kundeId) { setSchlaegte([]); setSchlaegteGeladen(false); return; }
    setSchlaegteGeladen(false);
    fetch(`/api/kunden/${kundeId}/schlaegte`)
      .then(r => r.ok ? r.json() : [])
      .then(d => {
        const liste = Array.isArray(d) ? d : [];
        setSchlaegte(liste);
        setSchlaegteGeladen(true);
        // schlagId aus URL vorauswählen falls noch nicht gesetzt
        const urlSchlag = sp.get("schlagId");
        if (urlSchlag && liste.some((s: Schlag) => String(s.id) === urlSchlag)) {
          setSchlagId(urlSchlag);
        }
        // Kein Schlag vorhanden → Formular direkt öffnen
        if (liste.length === 0) setZeigSchlagForm(true);
      });
  }, [kundeId]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (neuerSchlag.fruchtart) setEingaben(e => ({ ...e, fruchtart: neuerSchlag.fruchtart }));
    if (neuerSchlag.vorfrucht) setEingaben(e => ({ ...e, vorfrucht: neuerSchlag.vorfrucht }));
  }

  async function berechnen(speichernFlag = false) {
    if (!schlagId) { toast.error("Schlag wählen oder anlegen"); return; }
    if (!eingaben.fruchtart) { toast.error("Fruchtart wählen"); return; }
    setSpeichern(speichernFlag);
    const payload = {
      schlagId: parseInt(schlagId, 10),
      bezeichnung: eingaben.bezeichnung.trim() || null,
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
    };
    const url = speichernFlag && editId != null ? `/api/duengebedarf?id=${editId}` : "/api/duengebedarf";
    const method = speichernFlag && editId != null ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setSpeichern(false);
    if (res.ok) {
      const data = await res.json();
      setErgebnis(data);
      setBerechnet(true);
      if (speichernFlag) {
        toast.success(editId != null ? "Bedarf aktualisiert" : "Bedarf gespeichert");
        setEditId(null);
        fetch(`/api/duengebedarf?schlagId=${schlagId}`).then(r => r.json()).then(d => setHistorie(Array.isArray(d) ? d : []));
      }
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? "Berechnungsfehler");
    }
  }

  async function loeschenHistorie(id: number) {
    if (!confirm("Diesen Eintrag wirklich löschen?")) return;
    setDeletingId(id);
    const res = await fetch(`/api/duengebedarf?id=${id}`, { method: "DELETE" });
    setDeletingId(null);
    if (res.ok) {
      toast.success("Eintrag gelöscht");
      setHistorie(prev => prev.filter(h => h.id !== id));
      if (editId === id) { setEditId(null); setErgebnis(null); setBerechnet(false); }
    } else {
      toast.error("Löschen fehlgeschlagen");
    }
  }

  function bearbeiten(h: Bedarfseintrag) {
    let params: typeof eingaben = { ...eingaben };
    if (h.parameter) {
      try {
        const parsed = JSON.parse(h.parameter);
        const e = parsed.eingaben ?? {};
        params = {
          bezeichnung: h.bezeichnung ?? "",
          jahr: h.jahr,
          fruchtart: h.fruchtart,
          ertragsZiel: e.ertragsZiel != null ? String(e.ertragsZiel) : "",
          vorfrucht: e.vorfrucht ?? h.vorfrucht ?? "",
          nMin: e.nMin != null ? String(e.nMin) : "",
          organischeDuengungVorjahrN: e.organischeDuengungVorjahrN != null ? String(e.organischeDuengungVorjahrN) : "",
          versorgungsklasseP: e.versorgungsklasseP ?? "",
          versorgungsklasseK: e.versorgungsklasseK ?? "",
          versorgungsklasseMg: e.versorgungsklasseMg ?? "",
          zwischenfruchtAngebaut: !!e.zwischenfruchtAngebaut,
        };
      } catch { /* ignore */ }
    } else {
      params = { ...eingaben, bezeichnung: h.bezeichnung ?? "", jahr: h.jahr, fruchtart: h.fruchtart, vorfrucht: h.vorfrucht ?? "" };
    }
    setEingaben(params);
    setEditId(h.id);
    setErgebnis(null);
    setBerechnet(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function setE<K extends keyof typeof eingaben>(k: K, v: typeof eingaben[K]) {
    setEingaben(e => ({ ...e, [k]: v }));
  }

  const aktuelleProbe = proben[0];
  const schlag = schlaegte.find(s => String(s.id) === schlagId);
  // Schlag-Hinweis: Kunde gewählt, Schlags geladen, aber keine vorhanden
  const keinSchlagVorhanden = !!kundeId && schlaegteGeladen && schlaegte.length === 0;

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
              onChange={v => { setKundeId(v); setSchlagId(""); setErgebnis(null); setZeigSchlagForm(false); }}
              placeholder="Kunde wählen…"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Schlag
              {kundeId && (
                <button
                  onClick={() => setZeigSchlagForm(v => !v)}
                  className="ml-2 text-xs text-green-700 hover:underline font-normal"
                >
                  + Schlag anlegen
                </button>
              )}
            </label>
            <SearchableSelect
              options={schlaegte.map(s => ({ value: String(s.id), label: `${s.name} (${s.flaeche} ha)` }))}
              value={schlagId}
              onChange={v => { setSchlagId(v); setErgebnis(null); }}
              placeholder={!kundeId ? "Erst Kunde wählen" : schlaegte.length === 0 ? "Kein Schlag — bitte anlegen" : "Schlag wählen…"}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Jahr</label>
            <input type="number" value={eingaben.jahr} onChange={e => setE("jahr", parseInt(e.target.value, 10))} className="w-full border rounded px-3 py-2" />
          </div>
        </div>

        {/* Hinweis: kein Schlag vorhanden */}
        {keinSchlagVorhanden && !zeigSchlagForm && (
          <div className="mt-3 bg-amber-50 border border-amber-200 rounded p-3 flex items-center gap-3">
            <span className="text-amber-700 text-sm">Dieser Kunde hat noch keine Schläge.</span>
            <button
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
                  placeholder="z. B. Betrieb gesamt"
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
                  value={neuerSchlag.fruchtart}
                  onChange={e => setNeuerSchlag(s => ({ ...s, fruchtart: e.target.value }))}
                  placeholder="optional"
                  className="w-full border rounded px-2 py-1.5 text-sm"
                />
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
                onClick={schlagAnlegen}
                disabled={schlagSpeichern}
                className="bg-green-700 text-white text-sm px-4 py-1.5 rounded hover:bg-green-800 disabled:opacity-50"
              >
                {schlagSpeichern ? "Speichere…" : "Schlag anlegen & auswählen"}
              </button>
              <button
                onClick={() => setZeigSchlagForm(false)}
                className="text-sm px-4 py-1.5 rounded border hover:bg-gray-50"
              >
                Abbrechen
              </button>
            </div>
          </div>
        )}

        {aktuelleProbe && (
          <div className="mt-3 text-sm text-gray-600 bg-blue-50 rounded p-2">
            Letzte Bodenprobe vom {formatDatum(aktuelleProbe.datum)}:{" "}
            {aktuelleProbe.pH != null && <span className="mr-2">pH {aktuelleProbe.pH}</span>}
            {aktuelleProbe.phosphor != null && <span className="mr-2">P₂O₅ {aktuelleProbe.phosphor}</span>}
            {aktuelleProbe.kalium != null && <span className="mr-2">K₂O {aktuelleProbe.kalium}</span>}
            {aktuelleProbe.nMin != null && <span className="mr-2">N-Min {aktuelleProbe.nMin}</span>}
            {(aktuelleProbe.klasseP ?? aktuelleProbe.klasse) && <span className="mr-2">Klasse P: {aktuelleProbe.klasseP ?? aktuelleProbe.klasse}</span>}
            {(aktuelleProbe.klasseK ?? aktuelleProbe.klasse) && <span className="mr-2">K: {aktuelleProbe.klasseK ?? aktuelleProbe.klasse}</span>}
            {(aktuelleProbe.klasseMg ?? aktuelleProbe.klasse) && <span className="mr-2">Mg: {aktuelleProbe.klasseMg ?? aktuelleProbe.klasse}</span>}
            {aktuelleProbe.klasseBor && <span>Bor: {aktuelleProbe.klasseBor}</span>}
            {" — wird automatisch berücksichtigt"}
          </div>
        )}
      </Card>

      {editId != null && (
        <div className="mb-3 bg-blue-50 border border-blue-200 rounded p-3 flex items-center justify-between gap-3 text-sm text-blue-800">
          <span>Bearbeitungsmodus: Eintrag wird überschrieben wenn du „Änderungen speichern" klickst.</span>
          <button onClick={() => { setEditId(null); setErgebnis(null); setBerechnet(false); }} className="text-blue-700 hover:underline text-xs">Abbrechen</button>
        </div>
      )}
      <Card className="mb-4">
        <h2 className="font-semibold mb-3">Berechnungs-Parameter</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="sm:col-span-3">
            <label className="block text-sm font-medium mb-1">Bezeichnung (optional)</label>
            <input
              type="text"
              value={eingaben.bezeichnung}
              onChange={e => setE("bezeichnung", e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="z. B. Frühjahr 2026 – Winterweizen Schlag Nord"
            />
          </div>
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
            <input type="number" step="0.001" value={eingaben.ertragsZiel} onChange={e => setE("ertragsZiel", e.target.value)} className="w-full border rounded px-3 py-2" placeholder="Standard" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Vorfrucht</label>
            <input type="text" value={eingaben.vorfrucht} onChange={e => setE("vorfrucht", e.target.value)} className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">N-Min (kg/ha)</label>
            <input type="number" step="0.001" value={eingaben.nMin} onChange={e => setE("nMin", e.target.value)} className="w-full border rounded px-3 py-2" placeholder={aktuelleProbe?.nMin?.toString() ?? "aus Bodenprobe"} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Org. N Vorjahr (kg/ha)</label>
            <input type="number" step="0.001" value={eingaben.organischeDuengungVorjahrN} onChange={e => setE("organischeDuengungVorjahrN", e.target.value)} className="w-full border rounded px-3 py-2" />
          </div>
          <div className="flex items-end gap-2">
            <input id="zf" type="checkbox" checked={eingaben.zwischenfruchtAngebaut} onChange={e => setE("zwischenfruchtAngebaut", e.target.checked)} />
            <label htmlFor="zf" className="text-sm">Zwischenfrucht angebaut</label>
          </div>
          <KlassenSelect label="Versorgungsklasse P" value={eingaben.versorgungsklasseP} onChange={v => setE("versorgungsklasseP", v)} />
          <KlassenSelect label="Versorgungsklasse K" value={eingaben.versorgungsklasseK} onChange={v => setE("versorgungsklasseK", v)} />
          <KlassenSelect label="Versorgungsklasse Mg" value={eingaben.versorgungsklasseMg} onChange={v => setE("versorgungsklasseMg", v)} />
        </div>
        <div className="flex gap-3 mt-4 justify-end flex-wrap">
          {editId != null && (
            <button onClick={() => { setEditId(null); setErgebnis(null); setBerechnet(false); }} className="px-4 py-2 rounded border hover:bg-gray-50 text-sm">
              Bearbeitung abbrechen
            </button>
          )}
          <button onClick={() => berechnen(false)} disabled={!schlagId || !eingaben.fruchtart} className="bg-blue-700 text-white px-4 py-2 rounded hover:bg-blue-800 disabled:opacity-40">
            Berechnen
          </button>
          <button onClick={() => berechnen(true)} disabled={speichern || !schlagId || !eingaben.fruchtart} className="bg-green-700 text-white px-4 py-2 rounded hover:bg-green-800 disabled:opacity-40">
            {speichern ? "Speichere…" : editId != null ? "Änderungen speichern" : "Berechnen + Speichern"}
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
            <div className="overflow-x-auto">
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
            </div>
          </details>
        </Card>
      )}

      {historie.length > 0 && (
        <Card>
          <h2 className="font-semibold mb-3">Gespeicherte Berechnungen für diesen Schlag</h2>
          <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="pb-1 pr-4">Jahr</th>
                <th className="pb-1 pr-4">Bezeichnung / Fruchtart</th>
                <th className="pb-1 pr-4">N</th>
                <th className="pb-1 pr-4">P₂O₅</th>
                <th className="pb-1 pr-4">K₂O</th>
                <th className="pb-1 pr-4">MgO</th>
                <th className="pb-1 pr-4">Berechnet am</th>
                <th className="pb-1"></th>
              </tr>
            </thead>
            <tbody>
              {historie.map(h => (
                <tr key={h.id} className={`border-b hover:bg-gray-50 ${editId === h.id ? "bg-blue-50" : ""}`}>
                  <td className="py-1 pr-4">{h.jahr}</td>
                  <td className="py-1 pr-4">
                    {h.bezeichnung
                      ? <><span className="font-medium">{h.bezeichnung}</span><div className="text-xs text-gray-500">{h.fruchtart}</div></>
                      : h.fruchtart
                    }
                    {h.notiz && <div className="text-xs text-gray-400">{h.notiz}</div>}
                  </td>
                  <td className="py-1 pr-4">{Math.round(h.nBedarf)}</td>
                  <td className="py-1 pr-4">{Math.round(h.pBedarf)}</td>
                  <td className="py-1 pr-4">{Math.round(h.kBedarf)}</td>
                  <td className="py-1 pr-4">{h.mgBedarf != null ? Math.round(h.mgBedarf) : "–"}</td>
                  <td className="py-1 pr-4">{formatDatum(h.berechnetAm)}</td>
                  <td className="py-1 text-right whitespace-nowrap">
                    <Link
                      href={`/duengebedarf/${h.id}/druck`}
                      target="_blank"
                      className="text-xs text-gray-500 hover:text-gray-800 mr-3"
                      title="Drucken"
                    >
                      Drucken
                    </Link>
                    <button
                      onClick={() => bearbeiten(h)}
                      className="text-xs text-blue-600 hover:text-blue-800 mr-2"
                      title="Parameter laden und bearbeiten"
                    >
                      Laden
                    </button>
                    <button
                      onClick={() => loeschenHistorie(h.id)}
                      disabled={deletingId === h.id}
                      className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40"
                      title="Löschen"
                    >
                      {deletingId === h.id ? "…" : "Löschen"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
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
