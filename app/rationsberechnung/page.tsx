"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, KpiCard } from "@/components/Card";
import SearchableSelect from "@/components/SearchableSelect";
import { useToast } from "@/components/ToastProvider";

// ─── Typen (Spiegel der Lib-Typen) ───────────────────────────────────────────
type TierartKey = "Rind" | "Schwein" | "Geflugel" | "Pferd" | "Schaf" | "Ziege";

interface Futterwert {
  name: string;
  gruppe: string;
  tmGehalt: number;
  me?: number; nel?: number; rohprotein?: number; nxp?: number; dp?: number;
  rohfaser?: number; andfom?: number; lysin?: number; methionin?: number;
  ca?: number; p?: number; mg?: number; na?: number;
}
interface Meta {
  tierarten: { key: TierartKey; label: string; leistungLabel?: string }[];
  nutzungsarten: Record<string, string[]>;
  futterwerte: Futterwert[];
}
interface Kunde { id: number; name: string; firma?: string | null; }
interface Tier {
  id: number; name: string; tierart: TierartKey; nutzungsart: string;
  anzahl: number; gewicht?: number | null; leistung?: number | null;
}
interface ArtikelOpt { id: number; name: string; }

interface PositionForm {
  typ: "standard" | "artikel" | "manuell";
  futter: string;        // Name (standard) oder Anzeigename (manuell)
  futterId: string;      // standard: Name; sonst leer
  artikelId: string;
  fmKg: string;
  tmGehalt: string;
  stufe: "" | "GF" | "AF" | "LF";
  // manuelle Nährwerte je kg TM
  werte: Record<string, string>;
}

interface Ergebnis {
  tierart: string; nutzungsart: string; modus: string;
  tmAufnahme: number;
  summe: Record<string, number>;
  bedarf: Record<string, number>;
  bilanz: Record<string, number>;
  deckung: Record<string, number>;
  caPVerhaeltnis: number | null;
  rohfaserAnteil: number | null;
  andfomAnteil: number | null;
  rnb: number | null;
  aminosaeuren: { naehrstoff: string; aufnahme: number | null; bedarf: number | null; deckung: number | null; status: string }[];
  positionen: { futter: string; stufe?: string; fmKg: number; tmKg: number; anteil: number; beitrag: Record<string, number> }[];
  rechenweg: { schritt: string; wert: number; einheit: string }[];
  hinweise: string[];
  stufen?: { stufe: string; label: string; tmKg: number; summe: Record<string, number> }[];
  gespeichert?: { id: number };
}

const NUTRIENT_ORDER = ["nel", "me", "rohprotein", "nxp", "dp", "rohfaser", "andfom", "lysin", "methionin", "ca", "p", "mg", "na"];
const NUTRIENT_LABELS: Record<string, string> = {
  nel: "Energie NEL", me: "Energie ME", rohprotein: "Rohprotein XP", nxp: "nutzb. Rohprotein nXP",
  dp: "verd. Rohprotein DP", rohfaser: "Rohfaser XF", andfom: "aNDFom", lysin: "Lysin",
  methionin: "Methionin", ca: "Calcium", p: "Phosphor", mg: "Magnesium", na: "Natrium",
};
const NUTRIENT_UNITS: Record<string, string> = {
  nel: "MJ", me: "MJ", rohprotein: "g", nxp: "g", dp: "g", rohfaser: "g",
  andfom: "g", lysin: "g", methionin: "g", ca: "g", p: "g", mg: "g", na: "g",
};
const MANUELL_FELDER = ["me", "nel", "rohprotein", "nxp", "dp", "rohfaser", "andfom", "lysin", "methionin", "ca", "p", "mg", "na"];

function leerePosition(): PositionForm {
  return { typ: "standard", futter: "", futterId: "", artikelId: "", fmKg: "", tmGehalt: "", stufe: "", werte: {} };
}

function RationsInner() {
  const sp = useSearchParams();
  const toast = useToast();

  const [meta, setMeta] = useState<Meta | null>(null);
  const [kunden, setKunden] = useState<Kunde[]>([]);
  const [artikel, setArtikel] = useState<ArtikelOpt[]>([]);
  const [tiere, setTiere] = useState<Tier[]>([]);
  const [historie, setHistorie] = useState<Record<string, unknown>[]>([]);

  const [modus, setModus] = useState<"simple" | "detail">("simple");
  const [tierart, setTierart] = useState<TierartKey | "">("");
  const [nutzungsart, setNutzungsart] = useState("");
  const [kundeId, setKundeId] = useState(sp.get("kundeId") ?? "");
  const [tierId, setTierId] = useState(sp.get("tierId") ?? "");
  const [gewicht, setGewicht] = useState("");
  const [leistung, setLeistung] = useState("");
  const [fettProzent, setFettProzent] = useState("4.0");
  const [eiweissProzent, setEiweissProzent] = useState("3.4");
  const [bezeichnung, setBezeichnung] = useState("");
  const [notiz, setNotiz] = useState("");
  const [positionen, setPositionen] = useState<PositionForm[]>([leerePosition()]);

  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null);
  const [letzteEingabe, setLetzteEingabe] = useState<Record<string, unknown> | null>(null);
  const [rechnet, setRechnet] = useState(false);

  // ── Stammdaten laden ──────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/rationsberechnung?meta=1").then((r) => r.json()).then(setMeta).catch(() => {});
    fetch("/api/kunden?limit=2000").then((r) => r.json())
      .then((d) => setKunden(Array.isArray(d) ? d : (d?.kunden ?? []))).catch(() => {});
    fetch("/api/artikel?kategorie=Futter&limit=500").then((r) => r.json())
      .then((d) => setArtikel(Array.isArray(d) ? d : (d?.artikel ?? []))).catch(() => {});
  }, []);

  // ── Tiere des gewählten Kunden ────────────────────────────────────────────
  useEffect(() => {
    if (!kundeId) { setTiere([]); return; }
    fetch(`/api/kunden/${kundeId}/tiere`).then((r) => (r.ok ? r.json() : []))
      .then((d) => setTiere(Array.isArray(d) ? d : [])).catch(() => setTiere([]));
  }, [kundeId]);

  // ── Tier-Auswahl füllt die Eingaben vor ───────────────────────────────────
  useEffect(() => {
    if (!tierId) return;
    const t = tiere.find((x) => String(x.id) === tierId);
    if (!t) return;
    setTierart(t.tierart);
    setNutzungsart(t.nutzungsart);
    if (t.gewicht != null) setGewicht(String(t.gewicht));
    if (t.leistung != null) setLeistung(String(t.leistung));
    setBezeichnung(`${t.name} — ${t.nutzungsart}`);
  }, [tierId, tiere]);

  // ── Historie ──────────────────────────────────────────────────────────────
  const ladeHistorie = useCallback(() => {
    let url = "/api/rationsberechnung";
    if (tierId) url += `?kundeTierId=${tierId}`;
    else if (kundeId) url += `?kundeId=${kundeId}`;
    fetch(url).then((r) => (r.ok ? r.json() : []))
      .then((d) => setHistorie(Array.isArray(d) ? d : [])).catch(() => setHistorie([]));
  }, [tierId, kundeId]);
  useEffect(() => { ladeHistorie(); }, [ladeHistorie]);

  const nutzungsOptionen = tierart && meta ? (meta.nutzungsarten[tierart] ?? []) : [];
  const istMilchvieh = tierart === "Rind" && /Milchkuh|Mutterkuh/.test(nutzungsart);

  // ── Position-Helfer ───────────────────────────────────────────────────────
  function setPos(i: number, patch: Partial<PositionForm>) {
    setPositionen((ps) => ps.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }
  function setPosWert(i: number, key: string, val: string) {
    setPositionen((ps) => ps.map((p, idx) => (idx === i ? { ...p, werte: { ...p.werte, [key]: val } } : p)));
  }
  function waehleStandardFutter(i: number, name: string) {
    const fw = meta?.futterwerte.find((f) => f.name === name);
    setPos(i, { futterId: name, futter: name, tmGehalt: fw ? String(fw.tmGehalt) : "" });
  }

  // ── Berechnen ─────────────────────────────────────────────────────────────
  async function berechnen(speichern: boolean) {
    if (!tierart) { toast.error("Bitte Tierart wählen"); return; }
    if (!nutzungsart) { toast.error("Bitte Nutzungsart wählen"); return; }
    const validPos = positionen.filter((p) => Number(p.fmKg) > 0);
    if (validPos.length === 0) { toast.error("Mindestens eine Futterposition mit Menge erfassen"); return; }

    const payloadPositionen = validPos.map((p) => {
      if (p.typ === "standard") {
        return { quelle: "standard", futter: p.futter, futterId: p.futterId, fmKg: Number(p.fmKg), stufe: p.stufe || undefined };
      }
      if (p.typ === "artikel") {
        return {
          quelle: "artikel", artikelId: Number(p.artikelId), fmKg: Number(p.fmKg),
          tmGehalt: p.tmGehalt ? Number(p.tmGehalt) : undefined, stufe: p.stufe || undefined,
        };
      }
      const werte: Record<string, number> = {};
      for (const [k, v] of Object.entries(p.werte)) {
        if (v !== "" && !isNaN(Number(v))) werte[k] = Number(v);
      }
      return {
        quelle: "manuell", futter: p.futter || "Manuelle Position", fmKg: Number(p.fmKg),
        tmGehalt: p.tmGehalt ? Number(p.tmGehalt) : 880, werte, stufe: p.stufe || undefined,
      };
    });

    const body = {
      tierart, nutzungsart, modus,
      gewicht: gewicht || null,
      leistung: leistung || null,
      fettProzent: istMilchvieh ? fettProzent : null,
      eiweissProzent: istMilchvieh ? eiweissProzent : null,
      positionen: payloadPositionen,
      kundeId: kundeId || null,
      kundeTierId: tierId || null,
      bezeichnung: bezeichnung || null,
      notiz: notiz || null,
      speichern,
    };

    setRechnet(true);
    try {
      const res = await fetch("/api/rationsberechnung", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? "Berechnung fehlgeschlagen");
        return;
      }
      const data: Ergebnis = await res.json();
      setErgebnis(data);
      setLetzteEingabe({ ...body });
      if (speichern) {
        toast.success("Berechnung gespeichert");
        ladeHistorie();
      }
    } catch {
      toast.error("Netzwerkfehler");
    } finally {
      setRechnet(false);
    }
  }

  // ── XLS-Download ──────────────────────────────────────────────────────────
  async function exportXls() {
    if (!ergebnis) return;
    try {
      const res = await fetch("/api/rationsberechnung/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ergebnis, eingabe: letzteEingabe, bezeichnung }),
      });
      if (!res.ok) { toast.error("Export fehlgeschlagen"); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Ration_${(bezeichnung || tierart).replace(/[^a-zA-Z0-9]/g, "_")}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Export fehlgeschlagen");
    }
  }

  const energieKey = ergebnis && (ergebnis.bedarf.nel != null ? "nel" : "me");

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">🐄 Rationsberechnung</h1>
          <p className="text-sm text-gray-500">Futterration je Tierart prüfen — Aufnahme, Bedarf, Bilanz, Ca:P, Aminosäuren</p>
        </div>
        <div className="flex rounded-lg border overflow-hidden">
          <button onClick={() => setModus("simple")} className={`px-4 py-2 text-sm ${modus === "simple" ? "bg-green-700 text-white" : "bg-white text-gray-600"}`}>Einfach</button>
          <button onClick={() => setModus("detail")} className={`px-4 py-2 text-sm ${modus === "detail" ? "bg-green-700 text-white" : "bg-white text-gray-600"}`}>Detailliert</button>
        </div>
      </div>

      {/* ── Tier & Eingaben ─────────────────────────────────────────────────── */}
      <Card className="mb-4">
        <h2 className="font-semibold mb-3">Tier & Parameter</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Kunde (optional)</label>
            <SearchableSelect
              options={kunden.map((k) => ({ value: String(k.id), label: k.firma ? `${k.firma} (${k.name})` : k.name }))}
              value={kundeId}
              onChange={(v) => { setKundeId(v); setTierId(""); }}
              placeholder="Frei rechnen oder Kunde wählen…"
              allowClear clearLabel="— frei rechnen —"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Hinterlegtes Tier (optional)</label>
            <SearchableSelect
              options={tiere.map((t) => ({ value: String(t.id), label: `${t.name} (${t.tierart})`, sub: t.nutzungsart }))}
              value={tierId}
              onChange={setTierId}
              placeholder={kundeId ? "Tier wählen…" : "Erst Kunde wählen"}
              allowClear clearLabel="— kein Tier —"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Bezeichnung</label>
            <input value={bezeichnung} onChange={(e) => setBezeichnung(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="z.B. Sommerration Herde 1" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Tierart *</label>
            <select value={tierart} onChange={(e) => { setTierart(e.target.value as TierartKey); setNutzungsart(""); }} className="w-full border rounded px-3 py-2">
              <option value="">— wählen —</option>
              {meta?.tierarten.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Nutzungsart *</label>
            <select value={nutzungsart} onChange={(e) => setNutzungsart(e.target.value)} className="w-full border rounded px-3 py-2" disabled={!tierart}>
              <option value="">— wählen —</option>
              {nutzungsOptionen.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Lebendgewicht (kg)</label>
            <input type="number" step="0.001" value={gewicht} onChange={(e) => setGewicht(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="z.B. 650" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Leistung {tierart && meta?.tierarten.find((t) => t.key === tierart)?.leistungLabel ? `(${meta.tierarten.find((t) => t.key === tierart)!.leistungLabel})` : ""}
            </label>
            <input type="number" step="0.001" value={leistung} onChange={(e) => setLeistung(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="z.B. 28" />
          </div>
          {istMilchvieh && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">Milchfett (%)</label>
                <input type="number" step="0.1" value={fettProzent} onChange={(e) => setFettProzent(e.target.value)} className="w-full border rounded px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Milcheiweiß (%)</label>
                <input type="number" step="0.1" value={eiweissProzent} onChange={(e) => setEiweissProzent(e.target.value)} className="w-full border rounded px-3 py-2" />
              </div>
            </>
          )}
        </div>
      </Card>

      {/* ── Futterpositionen ────────────────────────────────────────────────── */}
      <Card className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Futterpositionen</h2>
          <button onClick={() => setPositionen([...positionen, leerePosition()])} className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">+ Position</button>
        </div>
        <div className="space-y-3">
          {positionen.map((p, i) => (
            <div key={i} className="border rounded p-3 bg-gray-50">
              <div className="grid sm:grid-cols-12 gap-2 items-end">
                <div className="sm:col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">Quelle</label>
                  <select value={p.typ} onChange={(e) => setPos(i, { typ: e.target.value as PositionForm["typ"], futterId: "", artikelId: "", futter: "" })} className="w-full border rounded px-2 py-1.5 text-sm">
                    <option value="standard">Standard-Futter</option>
                    <option value="artikel">Artikel</option>
                    <option value="manuell">Manuell</option>
                  </select>
                </div>
                <div className="sm:col-span-4">
                  <label className="block text-xs text-gray-500 mb-1">Futtermittel</label>
                  {p.typ === "standard" && (
                    <SearchableSelect
                      options={(meta?.futterwerte ?? []).map((f) => ({ value: f.name, label: f.name, sub: f.gruppe }))}
                      value={p.futterId}
                      onChange={(v) => waehleStandardFutter(i, v)}
                      placeholder="Futter aus Tabelle…"
                    />
                  )}
                  {p.typ === "artikel" && (
                    <SearchableSelect
                      options={artikel.map((a) => ({ value: String(a.id), label: a.name }))}
                      value={p.artikelId}
                      onChange={(v) => setPos(i, { artikelId: v, futter: artikel.find((a) => String(a.id) === v)?.name ?? "" })}
                      placeholder="Futter-Artikel…"
                    />
                  )}
                  {p.typ === "manuell" && (
                    <input value={p.futter} onChange={(e) => setPos(i, { futter: e.target.value })} className="w-full border rounded px-2 py-1.5 text-sm" placeholder="Bezeichnung" />
                  )}
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">FM kg/Tag</label>
                  <input type="number" step="0.1" value={p.fmKg} onChange={(e) => setPos(i, { fmKg: e.target.value })} className="w-full border rounded px-2 py-1.5 text-sm" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">TM-Gehalt g/kg</label>
                  <input type="number" step="0.001" value={p.tmGehalt} onChange={(e) => setPos(i, { tmGehalt: e.target.value })} className="w-full border rounded px-2 py-1.5 text-sm" placeholder={p.typ === "standard" ? "auto" : "880"} disabled={p.typ === "standard"} />
                </div>
                <div className="sm:col-span-1">
                  {modus === "detail" && (
                    <>
                      <label className="block text-xs text-gray-500 mb-1">Stufe</label>
                      <select value={p.stufe} onChange={(e) => setPos(i, { stufe: e.target.value as PositionForm["stufe"] })} className="w-full border rounded px-1 py-1.5 text-sm">
                        <option value="">—</option>
                        <option value="GF">GF</option>
                        <option value="AF">AF</option>
                        <option value="LF">LF</option>
                      </select>
                    </>
                  )}
                </div>
                <div className="sm:col-span-1 flex justify-end">
                  {positionen.length > 1 && (
                    <button onClick={() => setPositionen(positionen.filter((_, idx) => idx !== i))} className="text-red-600 text-sm px-2 py-1">✕</button>
                  )}
                </div>
              </div>
              {p.typ === "manuell" && (
                <div className="mt-2 grid grid-cols-3 sm:grid-cols-7 gap-2">
                  {MANUELL_FELDER.map((k) => (
                    <div key={k}>
                      <label className="block text-[10px] text-gray-400">{NUTRIENT_LABELS[k]} /kg TM</label>
                      <input type="number" step="0.1" value={p.werte[k] ?? ""} onChange={(e) => setPosWert(i, k, e.target.value)} className="w-full border rounded px-1.5 py-1 text-xs" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 mt-4 justify-end">
          <button onClick={() => berechnen(false)} disabled={rechnet} className="bg-blue-700 text-white px-4 py-2 rounded hover:bg-blue-800 disabled:opacity-50">
            {rechnet ? "Berechne…" : "Berechnen"}
          </button>
          <button onClick={() => berechnen(true)} disabled={rechnet} className="bg-green-700 text-white px-4 py-2 rounded hover:bg-green-800 disabled:opacity-50">
            Berechnen + Speichern
          </button>
          {ergebnis && (
            <button onClick={exportXls} className="border px-4 py-2 rounded hover:bg-gray-50">⬇ XLS herunterladen</button>
          )}
        </div>
      </Card>

      {/* ── Ergebnis ────────────────────────────────────────────────────────── */}
      {ergebnis && (
        <>
          <div className="grid sm:grid-cols-4 gap-3 mb-4">
            <KpiCard label="TM-Aufnahme" value={`${ergebnis.tmAufnahme} kg`} color="blue" sub={`Bedarf ${ergebnis.bedarf.tmBedarf ?? "–"} kg`} />
            {energieKey && (
              <KpiCard
                label={energieKey === "nel" ? "Energie NEL" : "Energie ME"}
                value={`${ergebnis.bilanz[energieKey] >= 0 ? "+" : ""}${ergebnis.bilanz[energieKey] ?? "–"} MJ`}
                color={ergebnis.bilanz[energieKey] >= 0 ? "green" : "red"}
                sub={`Aufnahme ${ergebnis.summe[energieKey] ?? "–"} / Bedarf ${ergebnis.bedarf[energieKey] ?? "–"}`}
              />
            )}
            <KpiCard
              label="Ca:P-Verhältnis"
              value={ergebnis.caPVerhaeltnis != null ? `${ergebnis.caPVerhaeltnis} : 1` : "–"}
              color="yellow"
            />
            <KpiCard
              label="RNB"
              value={ergebnis.rnb != null ? `${ergebnis.rnb} g` : "n. a."}
              color={ergebnis.rnb == null ? "blue" : ergebnis.rnb < -10 || ergebnis.rnb > 50 ? "red" : "green"}
              sub="ruminale N-Bilanz"
            />
          </div>

          {/* Aminosäuren */}
          <Card className="mb-4">
            <h2 className="font-semibold mb-3">Limitierende Aminosäuren & Magnesium</h2>
            <div className="flex flex-wrap gap-3">
              {ergebnis.aminosaeuren.map((as) => (
                <div key={as.naehrstoff} className={`px-3 py-2 rounded text-sm ${
                  as.status === "ok" ? "bg-green-50 text-green-800" :
                  as.status === "knapp" ? "bg-yellow-50 text-yellow-800" :
                  as.status === "mangel" ? "bg-red-50 text-red-800" : "bg-gray-100 text-gray-500"}`}>
                  <strong>{as.naehrstoff === "lysin" ? "Lysin" : "Methionin"}:</strong>{" "}
                  {as.status === "ohne_bedarf" ? "kein Richtwert" : `${as.deckung ?? 0} % Deckung (${as.aufnahme ?? 0} / ${as.bedarf ?? 0} g)`}
                </div>
              ))}
              <div className={`px-3 py-2 rounded text-sm ${(ergebnis.bilanz.mg ?? 0) >= 0 ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
                <strong>Magnesium:</strong> {ergebnis.bilanz.mg >= 0 ? "+" : ""}{ergebnis.bilanz.mg ?? "–"} g Bilanz
              </div>
              {ergebnis.rohfaserAnteil != null && (
                <div className="px-3 py-2 rounded text-sm bg-gray-100 text-gray-700">
                  <strong>Rohfaser:</strong> {ergebnis.rohfaserAnteil} % der TM
                </div>
              )}
            </div>
          </Card>

          {/* Bilanztabelle */}
          <Card className="mb-4">
            <h2 className="font-semibold mb-3">Nährstoffbilanz</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-1 pr-3">Nährstoff</th>
                    <th className="py-1 pr-3 text-right">Aufnahme</th>
                    <th className="py-1 pr-3 text-right">Bedarf</th>
                    <th className="py-1 pr-3 text-right">Bilanz</th>
                    <th className="py-1 pr-3 text-right">Deckung</th>
                  </tr>
                </thead>
                <tbody>
                  {NUTRIENT_ORDER.filter((k) => ergebnis.bedarf[k] != null || ergebnis.summe[k]).map((k) => {
                    const bil = ergebnis.bilanz[k];
                    return (
                      <tr key={k} className="border-b">
                        <td className="py-1 pr-3">{NUTRIENT_LABELS[k]} ({NUTRIENT_UNITS[k]})</td>
                        <td className="py-1 pr-3 text-right">{ergebnis.summe[k] ?? "–"}</td>
                        <td className="py-1 pr-3 text-right">{ergebnis.bedarf[k] ?? "–"}</td>
                        <td className={`py-1 pr-3 text-right font-medium ${bil == null ? "" : bil >= 0 ? "text-green-700" : "text-red-700"}`}>
                          {bil == null ? "–" : `${bil >= 0 ? "+" : ""}${bil}`}
                        </td>
                        <td className="py-1 pr-3 text-right">{ergebnis.deckung[k] != null ? `${ergebnis.deckung[k]} %` : "–"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Stufen (Detail-Modus) */}
          {ergebnis.stufen && ergebnis.stufen.length > 0 && (
            <Card className="mb-4">
              <h2 className="font-semibold mb-3">Zwischensummen je Futterstufe</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="py-1 pr-3">Stufe</th>
                      <th className="py-1 pr-3 text-right">TM kg</th>
                      {NUTRIENT_ORDER.map((k) => <th key={k} className="py-1 pr-3 text-right">{NUTRIENT_LABELS[k]}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {ergebnis.stufen.map((s) => (
                      <tr key={s.stufe} className="border-b">
                        <td className="py-1 pr-3 font-medium">{s.label}</td>
                        <td className="py-1 pr-3 text-right">{s.tmKg}</td>
                        {NUTRIENT_ORDER.map((k) => <td key={k} className="py-1 pr-3 text-right">{s.summe[k] ?? "–"}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Hinweise */}
          {ergebnis.hinweise.length > 0 && (
            <Card className="mb-4">
              <h2 className="font-semibold mb-2">Hinweise</h2>
              <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                {ergebnis.hinweise.map((h, i) => <li key={i}>{h}</li>)}
              </ul>
            </Card>
          )}

          {/* Rechenweg */}
          <Card className="mb-4">
            <details>
              <summary className="cursor-pointer font-semibold">Rechenweg & Positionen</summary>
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-sm mb-4">
                  <thead><tr className="text-left border-b"><th className="py-1 pr-3">Futter</th><th className="py-1 pr-3 text-right">FM kg</th><th className="py-1 pr-3 text-right">TM kg</th><th className="py-1 pr-3 text-right">Anteil</th></tr></thead>
                  <tbody>
                    {ergebnis.positionen.map((p, i) => (
                      <tr key={i} className="border-b">
                        <td className="py-1 pr-3">{p.futter}{p.stufe ? ` (${p.stufe})` : ""}</td>
                        <td className="py-1 pr-3 text-right">{p.fmKg}</td>
                        <td className="py-1 pr-3 text-right">{p.tmKg}</td>
                        <td className="py-1 pr-3 text-right">{p.anteil} %</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <table className="text-sm">
                  <tbody>
                    {ergebnis.rechenweg.map((r, i) => (
                      <tr key={i}><td className="pr-4 text-gray-600">{r.schritt}</td><td className="font-mono">{r.wert} {r.einheit}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </Card>
        </>
      )}

      {/* ── Historie ────────────────────────────────────────────────────────── */}
      {historie.length > 0 && (
        <Card>
          <h2 className="font-semibold mb-3">Gespeicherte Berechnungen</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead><tr className="text-left border-b"><th className="py-1 pr-3">Bezeichnung</th><th className="py-1 pr-3">Tierart</th><th className="py-1 pr-3">Modus</th><th className="py-1 pr-3">Erstellt</th><th></th></tr></thead>
              <tbody>
                {historie.map((h) => {
                  const hr = h as { id: number; bezeichnung: string; tierart: string; modus: string; erstellt: string };
                  return (
                    <tr key={hr.id} className="border-b">
                      <td className="py-1 pr-3">{hr.bezeichnung}</td>
                      <td className="py-1 pr-3">{hr.tierart}</td>
                      <td className="py-1 pr-3">{hr.modus === "detail" ? "detailliert" : "einfach"}</td>
                      <td className="py-1 pr-3">{new Date(hr.erstellt).toLocaleDateString("de-DE")}</td>
                      <td className="py-1 pr-3 text-right">
                        <a href={`/api/rationsberechnung/export?id=${hr.id}`} className="text-green-700 hover:underline">XLS</a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

export default function RationsberechnungPage() {
  return (
    <Suspense fallback={<div className="p-6">Lade…</div>}>
      <RationsInner />
    </Suspense>
  );
}
