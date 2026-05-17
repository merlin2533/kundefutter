"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  albrechtBewertung,
  ALBRECHT_DISCLAIMER,
  BewertungErgebnis,
  BodenanalyseAlbrechtData,
} from "@/lib/albrecht";

interface Kunde { id: number; name: string; firma?: string | null; }
interface Schlag { id: number; name: string; flaeche: number; fruchtart?: string | null; }

interface Empfehlung {
  mittel: string;
  menge: string;
  einheit: string;
  prioritaet: string;
}

const STATUS_FARBE: Record<string, string> = {
  ok: "text-green-600",
  niedrig: "text-amber-500",
  hoch: "text-amber-500",
  kritisch: "text-red-600",
};

function StatusDot({ status }: { status: string }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full mr-1 ${
      status === "ok" ? "bg-green-500" : status === "kritisch" ? "bg-red-500" : "bg-amber-400"
    }`} />
  );
}

function LiveBewertung({ data }: { data: BodenanalyseAlbrechtData }) {
  const bew = albrechtBewertung(data);
  const kationBew = bew.filter((b) =>
    ["caSaettigung", "mgSaettigung", "kSaettigung", "naSaettigung", "hSaettigung", "caMgRatio"].includes(b.parameter)
  );
  const spurBew = bew.filter((b) =>
    !["caSaettigung", "mgSaettigung", "kSaettigung", "naSaettigung", "hSaettigung", "caMgRatio"].includes(b.parameter)
  );

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
      <p className="text-sm font-semibold text-blue-800 mb-3">Live-Bewertung (Albrecht)</p>
      <div className="space-y-1">
        {kationBew.map((b) => (
          <div key={b.parameter} className="flex items-start gap-2 text-xs">
            <StatusDot status={b.status} />
            <span className="font-medium text-gray-700 w-28 shrink-0">{b.label}</span>
            <span className={`font-bold ${STATUS_FARBE[b.status]}`}>
              {b.ist !== null ? `${b.ist} ${b.einheit}` : "—"}
            </span>
            {b.ist !== null && b.status !== "ok" && (
              <span className="text-gray-500 leading-snug">{b.hinweis}</span>
            )}
          </div>
        ))}
        {spurBew.length > 0 && (
          <>
            <p className="text-xs font-semibold text-gray-500 mt-2 pt-2 border-t border-blue-200">Spurenelemente</p>
            {spurBew.map((b) => (
              <div key={b.parameter} className="flex items-start gap-2 text-xs">
                <StatusDot status={b.status} />
                <span className="font-medium text-gray-700 w-28 shrink-0">{b.label}</span>
                <span className={`font-bold ${STATUS_FARBE[b.status]}`}>
                  {b.ist !== null ? `${b.ist} ${b.einheit}` : "—"}
                </span>
                {b.ist !== null && b.status !== "ok" && (
                  <span className="text-gray-500 leading-snug">{b.hinweis}</span>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500";

function NumInput({
  label, value, onChange, einheit, placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  einheit?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}{einheit && <span className="text-gray-400 ml-1">({einheit})</span>}
      </label>
      <input
        type="number"
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? ""}
        className={inputCls}
      />
    </div>
  );
}

function NeueAnalyseFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preKundeId = searchParams.get("kundeId");

  const [kunden, setKunden] = useState<Kunde[]>([]);
  const [schlaegte, setSchlaegte] = useState<Schlag[]>([]);
  const [kundeId, setKundeId] = useState(preKundeId ?? "");
  const [schlagId, setSchlagId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Inline Schlag creation
  const [showNewSchlag, setShowNewSchlag] = useState(false);
  const [newSchlagName, setNewSchlagName] = useState("");
  const [newSchlagFlaeche, setNewSchlagFlaeche] = useState("");
  const [newSchlagFruchtart, setNewSchlagFruchtart] = useState("");
  const [savingSchlag, setSavingSchlag] = useState(false);
  const [schlagError, setSchlagError] = useState("");

  // Basisdaten
  const [datum, setDatum] = useState(() => new Date().toISOString().split("T")[0]);
  const [probenId, setProbenId] = useState("");
  const [kultur, setKultur] = useState("");
  const [tiefe, setTiefe] = useState("");
  const [bodenart, setBodenart] = useState("");
  const [phH2O, setPhH2O] = useState("");
  const [phKCl, setPhKCl] = useState("");
  const [kak, setKak] = useState("");
  const [humus, setHumus] = useState("");
  const [nGesamt, setNGesamt] = useState("");
  const [cn, setCn] = useState("");
  const [nNachlieferung, setNNachlieferung] = useState("");
  const [caCo3, setCaCo3] = useState("");
  const [leitfaehigkeit, setLeitfaehigkeit] = useState("");

  // Kationen-Sättigung
  const [caSaettigung, setCaSaettigung] = useState("");
  const [mgSaettigung, setMgSaettigung] = useState("");
  const [kSaettigung, setKSaettigung] = useState("");
  const [naSaettigung, setNaSaettigung] = useState("");
  const [hSaettigung, setHSaettigung] = useState("");
  const [variabelSaett, setVariabelSaett] = useState("");

  // Kationen-Vorräte
  const [caVorrat, setCaVorrat] = useState("");
  const [mgVorrat, setMgVorrat] = useState("");
  const [kVorrat, setKVorrat] = useState("");
  const [naVorrat, setNaVorrat] = useState("");

  // Anionen + Phosphor
  const [schwefel, setSchwefel] = useState("");
  const [p2o5Verfuegbar, setP2o5Verfuegbar] = useState("");
  const [p2o5Vorrat, setP2o5Vorrat] = useState("");

  // Spurenelemente
  const [bor, setBor] = useState("");
  const [eisen, setEisen] = useState("");
  const [mangan, setMangan] = useState("");
  const [kupfer, setKupfer] = useState("");
  const [zink, setZink] = useState("");
  const [chlorid, setChlorid] = useState("");
  const [silizium, setSilizium] = useState("");
  const [kobalt, setKobalt] = useState("");
  const [molybdaen, setMolybdaen] = useState("");
  const [selen, setSelen] = useState("");

  // Notiz
  const [notiz, setNotiz] = useState("");

  // Empfehlungen
  const [empfehlungen, setEmpfehlungen] = useState<Empfehlung[]>([]);

  useEffect(() => {
    fetch("/api/kunden?limit=500&aktiv=true")
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setKunden(Array.isArray(d?.kunden) ? d.kunden : Array.isArray(d) ? d : []));
  }, []);

  useEffect(() => {
    if (!kundeId) { setSchlaegte([]); return; }
    fetch(`/api/kunden/${kundeId}/schlaegte`)
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setSchlaegte(Array.isArray(d) ? d : []))
      .catch(() => setSchlaegte([]));
  }, [kundeId]);

  // Live-Bewertung Daten
  const liveDaten: BodenanalyseAlbrechtData = {
    caSaettigung: caSaettigung !== "" ? parseFloat(caSaettigung) : null,
    mgSaettigung: mgSaettigung !== "" ? parseFloat(mgSaettigung) : null,
    kSaettigung: kSaettigung !== "" ? parseFloat(kSaettigung) : null,
    naSaettigung: naSaettigung !== "" ? parseFloat(naSaettigung) : null,
    hSaettigung: hSaettigung !== "" ? parseFloat(hSaettigung) : null,
    bor: bor !== "" ? parseFloat(bor) : null,
    eisen: eisen !== "" ? parseFloat(eisen) : null,
    mangan: mangan !== "" ? parseFloat(mangan) : null,
    kupfer: kupfer !== "" ? parseFloat(kupfer) : null,
    zink: zink !== "" ? parseFloat(zink) : null,
    chlorid: chlorid !== "" ? parseFloat(chlorid) : null,
    silizium: silizium !== "" ? parseFloat(silizium) : null,
    kobalt: kobalt !== "" ? parseFloat(kobalt) : null,
    molybdaen: molybdaen !== "" ? parseFloat(molybdaen) : null,
    selen: selen !== "" ? parseFloat(selen) : null,
  };

  const addEmpfehlung = () =>
    setEmpfehlungen((prev) => [...prev, { mittel: "", menge: "", einheit: "kg/ha", prioritaet: "mittel" }]);

  const updateEmpfehlung = (i: number, field: keyof Empfehlung, val: string) =>
    setEmpfehlungen((prev) => prev.map((e, idx) => (idx === i ? { ...e, [field]: val } : e)));

  const removeEmpfehlung = (i: number) =>
    setEmpfehlungen((prev) => prev.filter((_, idx) => idx !== i));

  const saveNewSchlag = async () => {
    setSchlagError("");
    if (!newSchlagName.trim()) { setSchlagError("Name ist erforderlich"); return; }
    const flaecheNum = parseFloat(newSchlagFlaeche);
    if (isNaN(flaecheNum) || flaecheNum <= 0) { setSchlagError("Gültige Fläche (ha) eingeben"); return; }
    setSavingSchlag(true);
    try {
      const res = await fetch(`/api/kunden/${kundeId}/schlaegte`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newSchlagName.trim(), flaeche: flaecheNum, fruchtart: newSchlagFruchtart || null }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setSchlagError(d?.error ?? "Speichern fehlgeschlagen");
        return;
      }
      const created: Schlag = await res.json();
      setSchlaegte((prev) => [...prev, created]);
      setSchlagId(String(created.id));
      setShowNewSchlag(false);
      setNewSchlagName("");
      setNewSchlagFlaeche("");
      setNewSchlagFruchtart("");
    } catch {
      setSchlagError("Netzwerkfehler");
    } finally {
      setSavingSchlag(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!schlagId) { setError("Bitte Schlag auswählen"); return; }

    setSaving(true);
    try {
      const res = await fetch("/api/bodenanalyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schlagId: parseInt(schlagId, 10),
          datum,
          probenId: probenId || null,
          kultur: kultur || null,
          tiefe: tiefe || null,
          bodenart: bodenart || null,
          phH2O: phH2O || null,
          phKCl: phKCl || null,
          kak: kak || null,
          humus: humus || null,
          nGesamt: nGesamt || null,
          cn: cn || null,
          nNachlieferung: nNachlieferung || null,
          caCo3: caCo3 || null,
          leitfaehigkeit: leitfaehigkeit || null,
          caSaettigung: caSaettigung || null,
          mgSaettigung: mgSaettigung || null,
          kSaettigung: kSaettigung || null,
          naSaettigung: naSaettigung || null,
          hSaettigung: hSaettigung || null,
          variabelSaett: variabelSaett || null,
          caVorrat: caVorrat || null,
          mgVorrat: mgVorrat || null,
          kVorrat: kVorrat || null,
          naVorrat: naVorrat || null,
          schwefel: schwefel || null,
          p2o5Verfuegbar: p2o5Verfuegbar || null,
          p2o5Vorrat: p2o5Vorrat || null,
          bor: bor || null,
          eisen: eisen || null,
          mangan: mangan || null,
          kupfer: kupfer || null,
          zink: zink || null,
          chlorid: chlorid || null,
          silizium: silizium || null,
          kobalt: kobalt || null,
          molybdaen: molybdaen || null,
          selen: selen || null,
          empfehlungen: empfehlungen.filter((e) => e.mittel.trim()),
          notiz: notiz || null,
        }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d?.error ?? "Speichern fehlgeschlagen");
        return;
      }

      router.push("/bodenanalyse");
    } catch {
      setError("Netzwerkfehler");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Link href="/bodenanalyse" className="text-sm text-gray-500 hover:text-gray-700">Albrecht-Analysen</Link>
        <span className="text-gray-400">/</span>
        <span className="text-sm text-gray-700">Neue Analyse</span>
      </div>
      <h1 className="text-xl font-bold text-gray-900 mb-4">Neue Albrecht-Bodenanalyse</h1>

      {/* Disclaimer */}
      <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
        <p className="text-xs font-semibold text-amber-800 mb-0.5">⚠ Hinweis</p>
        <p className="text-xs text-amber-700 leading-relaxed">{ALBRECHT_DISCLAIMER}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* 1. Schlag */}
        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Schlag auswählen</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Kunde *</label>
              <select
                className={inputCls}
                value={kundeId}
                onChange={(e) => { setKundeId(e.target.value); setSchlagId(""); }}
                required
              >
                <option value="">Kunde wählen…</option>
                {kunden.map((k) => (
                  <option key={k.id} value={k.id}>{k.name}{k.firma ? ` (${k.firma})` : ""}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Schlag *</label>
              <div className="flex gap-2">
                <select
                  className={inputCls}
                  value={schlagId}
                  onChange={(e) => setSchlagId(e.target.value)}
                  required
                  disabled={!kundeId || schlaegte.length === 0}
                >
                  <option value="">{kundeId && schlaegte.length === 0 ? "Kein Schlag vorhanden" : "Schlag wählen…"}</option>
                  {schlaegte.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.flaeche} ha){s.fruchtart ? ` — ${s.fruchtart}` : ""}</option>
                  ))}
                </select>
                {kundeId && (
                  <button
                    type="button"
                    title="Neuen Schlag anlegen"
                    onClick={() => { setShowNewSchlag((v) => !v); setSchlagError(""); }}
                    className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg border border-green-300 bg-green-50 hover:bg-green-100 text-green-700 text-lg font-bold transition-colors"
                  >
                    {showNewSchlag ? "×" : "+"}
                  </button>
                )}
              </div>

              {showNewSchlag && (
                <div className="mt-3 p-4 bg-green-50 border border-green-200 rounded-lg space-y-3">
                  <p className="text-xs font-semibold text-green-800">Neuen Schlag anlegen</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
                      <input
                        type="text"
                        className={inputCls}
                        value={newSchlagName}
                        onChange={(e) => setNewSchlagName(e.target.value)}
                        placeholder="z.B. Nordfeld"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Fläche (ha) *</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        className={inputCls}
                        value={newSchlagFlaeche}
                        onChange={(e) => setNewSchlagFlaeche(e.target.value)}
                        placeholder="z.B. 4.5"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Fruchtart</label>
                      <input
                        type="text"
                        className={inputCls}
                        value={newSchlagFruchtart}
                        onChange={(e) => setNewSchlagFruchtart(e.target.value)}
                        placeholder="z.B. Winterweizen"
                      />
                    </div>
                  </div>
                  {schlagError && <p className="text-xs text-red-600">{schlagError}</p>}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={saveNewSchlag}
                      disabled={savingSchlag}
                      className="px-4 py-1.5 bg-green-700 hover:bg-green-800 disabled:opacity-60 text-white text-xs font-medium rounded-lg transition-colors"
                    >
                      {savingSchlag ? "Speichern…" : "Schlag anlegen"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowNewSchlag(false); setSchlagError(""); }}
                      className="px-4 py-1.5 text-xs text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Abbrechen
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* 2. Basisdaten */}
        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Basisdaten</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Datum *</label>
              <input type="date" className={inputCls} value={datum} onChange={(e) => setDatum(e.target.value)} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Proben-ID / Labor-Nr.</label>
              <input type="text" className={inputCls} value={probenId} onChange={(e) => setProbenId(e.target.value)} placeholder="z.B. 26CB2353" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Kultur (Zielkultur)</label>
              <input type="text" className={inputCls} value={kultur} onChange={(e) => setKultur(e.target.value)} placeholder="z.B. KLG - TRI" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Bodenart</label>
              <input type="text" className={inputCls} value={bodenart} onChange={(e) => setBodenart(e.target.value)} placeholder="z.B. sandiger Lehm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Probentiefe</label>
              <input type="text" className={inputCls} value={tiefe} onChange={(e) => setTiefe(e.target.value)} placeholder="z.B. 0–25 cm" />
            </div>
            <NumInput label="pH (H₂O)" value={phH2O} onChange={setPhH2O} />
            <NumInput label="pH (KCl)" value={phKCl} onChange={setPhKCl} />
            <NumInput label="KAK / TEC" value={kak} onChange={setKak} einheit="mmol/100g" />
            <NumInput label="Humusgehalt" value={humus} onChange={setHumus} einheit="%" />
            <NumInput label="Gesamt-N" value={nGesamt} onChange={setNGesamt} einheit="%" />
            <NumInput label="C/N-Verhältnis" value={cn} onChange={setCn} />
            <NumInput label="N-Nachlieferung" value={nNachlieferung} onChange={setNNachlieferung} einheit="kg/ha" />
            <NumInput label="CaCO₃" value={caCo3} onChange={setCaCo3} einheit="%" />
            <NumInput label="Leitfähigkeit" value={leitfaehigkeit} onChange={setLeitfaehigkeit} einheit="mS/cm" />
          </div>
        </section>

        {/* 3. Kationen-Sättigung — with live preview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <section className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-1">Kationen-Sättigung</h2>
            <p className="text-xs text-gray-400 mb-4">SOLL: Ca 60–80 %, Mg 10–20 %, K 2–7,5 %, Na 0,5–3 %, H &lt; 15 %</p>
            <div className="grid grid-cols-2 gap-4">
              <NumInput label="Ca-Sättigung" value={caSaettigung} onChange={setCaSaettigung} einheit="%" />
              <NumInput label="Mg-Sättigung" value={mgSaettigung} onChange={setMgSaettigung} einheit="%" />
              <NumInput label="K-Sättigung" value={kSaettigung} onChange={setKSaettigung} einheit="%" />
              <NumInput label="Na-Sättigung" value={naSaettigung} onChange={setNaSaettigung} einheit="%" />
              <NumInput label="H-Sättigung" value={hSaettigung} onChange={setHSaettigung} einheit="%" />
              <NumInput label="Variabel-Sättigung" value={variabelSaett} onChange={setVariabelSaett} einheit="%" />
            </div>
          </section>

          {/* Live Bewertung */}
          <LiveBewertung data={liveDaten} />
        </div>

        {/* 4. Kationen-Vorräte */}
        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Kationen-Vorräte</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <NumInput label="Ca-Vorrat" value={caVorrat} onChange={setCaVorrat} einheit="kg/ha" />
            <NumInput label="Mg-Vorrat" value={mgVorrat} onChange={setMgVorrat} einheit="kg/ha" />
            <NumInput label="K-Vorrat" value={kVorrat} onChange={setKVorrat} einheit="kg/ha" />
            <NumInput label="Na-Vorrat" value={naVorrat} onChange={setNaVorrat} einheit="kg/ha" />
          </div>
        </section>

        {/* 5. Anionen + Phosphor */}
        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Anionen & Phosphor</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <NumInput label="Schwefel" value={schwefel} onChange={setSchwefel} einheit="ppm" />
            <NumInput label="P₂O₅ verfügbar" value={p2o5Verfuegbar} onChange={setP2o5Verfuegbar} einheit="kg/ha" />
            <NumInput label="P₂O₅ Vorrat" value={p2o5Vorrat} onChange={setP2o5Vorrat} einheit="kg/ha" />
          </div>
        </section>

        {/* 6. Spurenelemente */}
        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-1">Spurenelemente</h2>
          <p className="text-xs text-gray-400 mb-4">Alle Werte in ppm</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            <NumInput label="Bor (SOLL 0,8–2,0)" value={bor} onChange={setBor} einheit="ppm" />
            <NumInput label="Eisen (SOLL ≥200)" value={eisen} onChange={setEisen} einheit="ppm" />
            <NumInput label="Mangan (SOLL 50–250)" value={mangan} onChange={setMangan} einheit="ppm" />
            <NumInput label="Kupfer (SOLL 2–10)" value={kupfer} onChange={setKupfer} einheit="ppm" />
            <NumInput label="Zink (SOLL 6–20)" value={zink} onChange={setZink} einheit="ppm" />
            <NumInput label="Chlorid (SOLL 25–250)" value={chlorid} onChange={setChlorid} einheit="ppm" />
            <NumInput label="Silizium (SOLL 30–60)" value={silizium} onChange={setSilizium} einheit="ppm" />
            <NumInput label="Kobalt (SOLL 0,35–2)" value={kobalt} onChange={setKobalt} einheit="ppm" />
            <NumInput label="Molybdän (SOLL 0,05–0,1)" value={molybdaen} onChange={setMolybdaen} einheit="ppm" />
            <NumInput label="Selen (SOLL 0,03–0,1)" value={selen} onChange={setSelen} einheit="ppm" />
          </div>
        </section>

        {/* 7. Empfehlungen */}
        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">Empfehlungen aus Bericht</h2>
            <button
              type="button"
              onClick={addEmpfehlung}
              className="text-xs px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 rounded-lg transition-colors"
            >
              + Zeile hinzufügen
            </button>
          </div>
          {empfehlungen.length === 0 && (
            <p className="text-xs text-gray-400">Noch keine Empfehlungen. Klicken Sie auf &quot;+ Zeile hinzufügen&quot; um Empfehlungen aus dem PDF-Bericht zu erfassen.</p>
          )}
          <div className="space-y-2">
            {empfehlungen.map((emp, i) => (
              <div key={i} className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Mittel</label>
                  <input type="text" className={inputCls} value={emp.mittel} onChange={(e) => updateEmpfehlung(i, "mittel", e.target.value)} placeholder="z.B. Kalkung" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Menge</label>
                  <input type="text" className={inputCls} value={emp.menge} onChange={(e) => updateEmpfehlung(i, "menge", e.target.value)} placeholder="z.B. 2,5" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Einheit</label>
                  <input type="text" className={inputCls} value={emp.einheit} onChange={(e) => updateEmpfehlung(i, "einheit", e.target.value)} placeholder="kg/ha" />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">Priorität</label>
                    <select className={inputCls} value={emp.prioritaet} onChange={(e) => updateEmpfehlung(i, "prioritaet", e.target.value)}>
                      <option value="hoch">Hoch</option>
                      <option value="mittel">Mittel</option>
                      <option value="niedrig">Niedrig</option>
                    </select>
                  </div>
                  <button type="button" onClick={() => removeEmpfehlung(i)} className="mt-5 text-red-500 hover:text-red-700 text-xs px-2">✕</button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Notiz */}
        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Notiz</h2>
          <textarea
            className={`${inputCls} h-24 resize-none`}
            value={notiz}
            onChange={(e) => setNotiz(e.target.value)}
            placeholder="Ergänzende Notizen zur Analyse…"
          />
        </section>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</p>}

        <div className="flex gap-3 flex-wrap">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-green-700 hover:bg-green-800 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors w-full sm:w-auto"
          >
            {saving ? "Speichern…" : "Analyse speichern"}
          </button>
          <Link
            href="/bodenanalyse"
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors w-full sm:w-auto text-center"
          >
            Abbrechen
          </Link>
        </div>
      </form>
    </div>
  );
}

export default function NeueAlbrechtAnalysePage() {
  return (
    <Suspense fallback={<p className="text-sm text-gray-400">Lade…</p>}>
      <NeueAnalyseFormInner />
    </Suspense>
  );
}
