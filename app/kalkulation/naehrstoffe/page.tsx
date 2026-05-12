"use client";
import { useEffect, useState } from "react";
import SearchableSelect from "@/components/SearchableSelect";

interface Artikel {
  id: number;
  name: string;
  kategorie: string | null;
  inhaltsstoffe?: { name: string; menge: number | null; einheit: string | null }[];
}

interface Probe {
  ts: number;
  xp: number;
  xf: number;
  xl: number;
  xa: number;
  staerke: number;
  zucker: number;
}

interface MischKomponente extends Probe {
  anteil: number; // 0-100
  label: string;
}

const DEFAULT_PROBE: Probe = {
  ts: 88,
  xp: 18,
  xf: 8,
  xl: 4,
  xa: 7,
  staerke: 0,
  zucker: 0,
};

function calcNaehrstoffe(probe: Probe) {
  const { ts, xp, xf, xl, xa, staerke, zucker } = probe;
  // xs = staerke + zucker (lösliche Kohlenhydrate als Summe)
  const xs = staerke + zucker;
  // NEL in MJ/kg TS – vereinfachte DLG-Formel
  const nel =
    0.6 *
    (1 + 0.004 * (ts - 645)) *
    ((2.12 * xp + 2.35 * xl + 1.54 * xs + 0.73 * xf) * ts) /
    1000;
  const me = nel / 0.62;

  // je kg Originalsubstanz (OS) = Inhaltsstoff_TS% × TS% / 100 × 10 → g/kg OS
  const factor = ts / 100;
  return {
    nel: Math.max(0, nel),
    me: Math.max(0, me),
    xpOS: xp * factor * 10,
    xfOS: xf * factor * 10,
    xlOS: xl * factor * 10,
    xaOS: xa * factor * 10,
  };
}

function mixProbes(a: Probe, anteilA: number, b: Probe, anteilB: number): Probe {
  const summe = anteilA + anteilB || 100;
  const wa = anteilA / summe;
  const wb = anteilB / summe;
  return {
    ts: a.ts * wa + b.ts * wb,
    xp: a.xp * wa + b.xp * wb,
    xf: a.xf * wa + b.xf * wb,
    xl: a.xl * wa + b.xl * wb,
    xa: a.xa * wa + b.xa * wb,
    staerke: a.staerke * wa + b.staerke * wb,
    zucker: a.zucker * wa + b.zucker * wb,
  };
}

function RohproteinBewertung({ xp }: { xp: number }) {
  if (xp >= 16) {
    return (
      <span className="inline-flex items-center gap-1 text-sm font-medium text-green-700">
        <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
        Gut (&ge;16 % XP)
      </span>
    );
  } else if (xp >= 12) {
    return (
      <span className="inline-flex items-center gap-1 text-sm font-medium text-yellow-700">
        <span className="w-3 h-3 rounded-full bg-yellow-400 inline-block" />
        Mittel (12–16 % XP)
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-sm font-medium text-red-700">
      <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
      Niedrig (&lt;12 % XP)
    </span>
  );
}

function ErgebnisKarte({
  probe,
  label,
}: {
  probe: Probe;
  label: string;
}) {
  const { nel, me, xpOS, xfOS, xlOS, xaOS } = calcNaehrstoffe(probe);
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <h3 className="font-semibold text-gray-800 mb-3">{label}</h3>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <div className="flex justify-between border-b border-gray-50 pb-1">
          <span className="text-gray-500">NEL</span>
          <span className="font-mono font-semibold">{nel.toFixed(2)} MJ/kg TS</span>
        </div>
        <div className="flex justify-between border-b border-gray-50 pb-1">
          <span className="text-gray-500">ME Rind</span>
          <span className="font-mono font-semibold">{me.toFixed(2)} MJ/kg TS</span>
        </div>
        <div className="flex justify-between border-b border-gray-50 pb-1">
          <span className="text-gray-500">XP je kg OS</span>
          <span className="font-mono">{xpOS.toFixed(1)} g/kg</span>
        </div>
        <div className="flex justify-between border-b border-gray-50 pb-1">
          <span className="text-gray-500">XF je kg OS</span>
          <span className="font-mono">{xfOS.toFixed(1)} g/kg</span>
        </div>
        <div className="flex justify-between border-b border-gray-50 pb-1">
          <span className="text-gray-500">XL je kg OS</span>
          <span className="font-mono">{xlOS.toFixed(1)} g/kg</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">XA je kg OS</span>
          <span className="font-mono">{xaOS.toFixed(1)} g/kg</span>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-gray-100">
        <RohproteinBewertung xp={probe.xp} />
      </div>
    </div>
  );
}

function InputRow({
  label,
  unit,
  value,
  onChange,
  optional,
}: {
  label: string;
  unit: string;
  value: number;
  onChange: (v: number) => void;
  optional?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <label className="w-44 text-sm text-gray-700 shrink-0">
        {label}
        {optional && <span className="ml-1 text-xs text-gray-400">(optional)</span>}
      </label>
      <div className="flex items-center gap-1 flex-1">
        <input
          type="number"
          min={0}
          max={100}
          step={0.1}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="w-24 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
        />
        <span className="text-sm text-gray-500">{unit}</span>
      </div>
    </div>
  );
}

export default function NaehrstoffkalkulatorPage() {
  const [artikel, setArtikel] = useState<Artikel[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [probe, setProbe] = useState<Probe>(DEFAULT_PROBE);
  const [mischAnteilA, setMischAnteilA] = useState(50);
  const [mischAnteilB, setMischAnteilB] = useState(50);
  const [probeB, setProbeB] = useState<Probe>(DEFAULT_PROBE);
  const [showMisch, setShowMisch] = useState(false);

  useEffect(() => {
    fetch("/api/artikel?kategorie=Futter&limit=200")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setArtikel(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    const art = artikel.find((a) => String(a.id) === selectedId);
    if (!art?.inhaltsstoffe?.length) return;
    const find = (names: string[]) => {
      for (const n of names) {
        const hit = art.inhaltsstoffe!.find((i) =>
          i.name.toLowerCase().includes(n.toLowerCase())
        );
        if (hit?.menge != null) return hit.menge;
      }
      return undefined;
    };
    setProbe((p) => ({
      ...p,
      xp: find(["Rohprotein", "XP"]) ?? p.xp,
      xf: find(["Rohfaser", "XF"]) ?? p.xf,
      xl: find(["Rohfett", "XL"]) ?? p.xl,
      xa: find(["Rohasche", "XA"]) ?? p.xa,
      staerke: find(["Stärke", "Staerke"]) ?? p.staerke,
      zucker: find(["Zucker"]) ?? p.zucker,
    }));
  }, [selectedId, artikel]);

  const artikelOptionen = artikel.map((a) => ({
    value: String(a.id),
    label: a.name,
    sub: a.kategorie ?? undefined,
  }));

  const gemischt = showMisch
    ? mixProbes(probe, mischAnteilA, probeB, mischAnteilB)
    : null;

  return (
    <div className="max-w-screen-lg mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Nährstoffgehalt-Kalkulator</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Berechnung von NEL, ME und Nährstoffgehalten nach vereinfachten DLG-Formeln
        </p>
      </div>

      {/* Hinweis-Box */}
      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800">
        Alle Berechnungen basieren auf vereinfachten DLG-Formeln. Für exakte Analysen empfehlen wir
        eine akkreditierte Laboranalyse.
      </div>

      {/* Artikel-Auswahl */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm mb-6">
        <h2 className="font-semibold text-gray-800 mb-3">Artikel-Auswahl (Futtermittel)</h2>
        <div className="max-w-sm">
          <SearchableSelect
            options={artikelOptionen}
            value={selectedId}
            onChange={setSelectedId}
            placeholder="Futtermittel suchen…"
            allowClear
            clearLabel="— Kein Artikel —"
          />
          {selectedId && (
            <p className="text-xs text-gray-400 mt-1">
              Vorhandene Inhaltsstoffe wurden übernommen (manuell anpassbar).
            </p>
          )}
        </div>
      </div>

      {/* Probe-Eingabe + Ergebnis nebeneinander */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Eingabe */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h2 className="font-semibold text-gray-800 mb-4">Probe-Analyse (Komponente A)</h2>
          <div className="space-y-3">
            <InputRow
              label="Trockensubstanz (TS)"
              unit="% FM"
              value={probe.ts}
              onChange={(v) => setProbe({ ...probe, ts: v })}
            />
            <InputRow
              label="Rohprotein (XP)"
              unit="% i. d. TS"
              value={probe.xp}
              onChange={(v) => setProbe({ ...probe, xp: v })}
            />
            <InputRow
              label="Rohfaser (XF)"
              unit="% i. d. TS"
              value={probe.xf}
              onChange={(v) => setProbe({ ...probe, xf: v })}
            />
            <InputRow
              label="Rohfett (XL)"
              unit="% i. d. TS"
              value={probe.xl}
              onChange={(v) => setProbe({ ...probe, xl: v })}
            />
            <InputRow
              label="Rohasche (XA)"
              unit="% i. d. TS"
              value={probe.xa}
              onChange={(v) => setProbe({ ...probe, xa: v })}
            />
            <InputRow
              label="Stärke"
              unit="% i. d. TS"
              value={probe.staerke}
              onChange={(v) => setProbe({ ...probe, staerke: v })}
              optional
            />
            <InputRow
              label="Zucker"
              unit="% i. d. TS"
              value={probe.zucker}
              onChange={(v) => setProbe({ ...probe, zucker: v })}
              optional
            />
          </div>
        </div>

        {/* Ergebnis */}
        <ErgebnisKarte probe={probe} label="Berechnungsergebnis (Komponente A)" />
      </div>

      {/* Mischungs-Berechnung */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm mb-6">
        <button
          type="button"
          onClick={() => setShowMisch((v) => !v)}
          className="flex items-center gap-2 text-sm font-semibold text-gray-800 hover:text-green-700 transition-colors"
        >
          <svg
            className={`w-4 h-4 transition-transform ${showMisch ? "rotate-90" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          Mischungs-Berechnung (Komponente B)
        </button>

        {showMisch && (
          <div className="mt-4 space-y-6">
            {/* Mischverhältnis */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-700">Anteil A:</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={mischAnteilA}
                  onChange={(e) => {
                    const v = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                    setMischAnteilA(v);
                    setMischAnteilB(100 - v);
                  }}
                  className="w-20 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                />
                <span className="text-sm text-gray-500">%</span>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-700">Anteil B:</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={mischAnteilB}
                  onChange={(e) => {
                    const v = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                    setMischAnteilB(v);
                    setMischAnteilA(100 - v);
                  }}
                  className="w-20 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                />
                <span className="text-sm text-gray-500">%</span>
              </div>
              <span className="text-sm text-gray-400">= {mischAnteilA + mischAnteilB} %</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Komponente B Eingabe */}
              <div>
                <h3 className="font-medium text-gray-700 mb-3 text-sm">Komponente B – Probe-Analyse</h3>
                <div className="space-y-3">
                  <InputRow
                    label="Trockensubstanz (TS)"
                    unit="% FM"
                    value={probeB.ts}
                    onChange={(v) => setProbeB({ ...probeB, ts: v })}
                  />
                  <InputRow
                    label="Rohprotein (XP)"
                    unit="% i. d. TS"
                    value={probeB.xp}
                    onChange={(v) => setProbeB({ ...probeB, xp: v })}
                  />
                  <InputRow
                    label="Rohfaser (XF)"
                    unit="% i. d. TS"
                    value={probeB.xf}
                    onChange={(v) => setProbeB({ ...probeB, xf: v })}
                  />
                  <InputRow
                    label="Rohfett (XL)"
                    unit="% i. d. TS"
                    value={probeB.xl}
                    onChange={(v) => setProbeB({ ...probeB, xl: v })}
                  />
                  <InputRow
                    label="Rohasche (XA)"
                    unit="% i. d. TS"
                    value={probeB.xa}
                    onChange={(v) => setProbeB({ ...probeB, xa: v })}
                  />
                  <InputRow
                    label="Stärke"
                    unit="% i. d. TS"
                    value={probeB.staerke}
                    onChange={(v) => setProbeB({ ...probeB, staerke: v })}
                    optional
                  />
                  <InputRow
                    label="Zucker"
                    unit="% i. d. TS"
                    value={probeB.zucker}
                    onChange={(v) => setProbeB({ ...probeB, zucker: v })}
                    optional
                  />
                </div>
              </div>

              {/* Misch-Ergebnis */}
              {gemischt && (
                <ErgebnisKarte
                  probe={gemischt}
                  label={`Mischung (${mischAnteilA}% A + ${mischAnteilB}% B)`}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* PDF Drucken */}
      <div className="flex justify-end print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="px-4 py-2 text-sm bg-green-700 hover:bg-green-800 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Als PDF drucken
        </button>
      </div>
    </div>
  );
}
