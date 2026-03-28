"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { LagerBadge } from "@/components/Badge";
import { formatEuro, formatDatum, lagerStatus } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LagerArtikel {
  id: number;
  name: string;
  artikelnummer: string;
  kategorie: string;
  einheit: string;
  aktuellerBestand: number;
  mindestbestand: number;
  lieferanten: Array<{
    bevorzugt: boolean;
    lieferant: { id: number; name: string };
  }>;
}

interface Bewegung {
  id: number;
  datum: string;
  typ: string;
  menge: number;
  bestandNach: number;
  notiz?: string | null;
  artikel: { id: number; name: string; einheit: string };
}

type FilterMode = "alle" | "alarme" | "leer";

const inputCls =
  "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700";

// ─── Component ────────────────────────────────────────────────────────────────

export default function LagerPage() {
  const [tab, setTab] = useState<"bestand" | "bewegungen">("bestand");

  // Bestand
  const [artikel, setArtikel] = useState<LagerArtikel[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterMode>("alle");

  // Korrektur inline
  const [korrekturArtikel, setKorrekturArtikel] = useState<LagerArtikel | null>(null);
  const [korrekturForm, setKorrekturForm] = useState({ neuerBestand: 0, notiz: "" });
  const [savingKorrektur, setSavingKorrektur] = useState(false);
  const [korrekturError, setKorrekturError] = useState("");

  // Bewegungen
  const [bewegungen, setBewegungen] = useState<Bewegung[]>([]);
  const [loadingBew, setLoadingBew] = useState(false);
  const [datumVon, setDatumVon] = useState("");
  const [datumBis, setDatumBis] = useState("");

  const fetchArtikel = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/artikel?limit=500");
    const data = await res.json();
    setArtikel(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchArtikel(); }, [fetchArtikel]);

  useEffect(() => {
    if (tab === "bewegungen") {
      fetchBewegungen();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const fetchBewegungen = useCallback(async () => {
    setLoadingBew(true);
    const params = new URLSearchParams();
    if (datumVon) params.set("von", datumVon);
    if (datumBis) params.set("bis", datumBis);
    const res = await fetch(`/api/lager/bewegungen?${params}`);
    const data = await res.json();
    setBewegungen(data);
    setLoadingBew(false);
  }, [datumVon, datumBis]);

  // ── Derived: counts ───────────────────────────────────────────────────────
  const counts = artikel.reduce(
    (acc, a) => {
      const s = lagerStatus(a.aktuellerBestand, a.mindestbestand);
      acc[s]++;
      return acc;
    },
    { gruen: 0, gelb: 0, rot: 0 }
  );

  const filteredArtikel = artikel.filter((a) => {
    const s = lagerStatus(a.aktuellerBestand, a.mindestbestand);
    if (filter === "alarme") return s === "rot" || s === "gelb";
    if (filter === "leer") return a.aktuellerBestand <= 0;
    return true;
  });

  // ── Korrektur ─────────────────────────────────────────────────────────────
  function openKorrektur(a: LagerArtikel) {
    setKorrekturArtikel(a);
    setKorrekturForm({ neuerBestand: a.aktuellerBestand, notiz: "" });
    setKorrekturError("");
  }

  async function submitKorrektur() {
    if (!korrekturArtikel) return;
    if (!korrekturForm.notiz.trim()) { setKorrekturError("Notiz ist erforderlich."); return; }
    setSavingKorrektur(true);
    setKorrekturError("");
    const res = await fetch("/api/lager/korrektur", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        artikelId: korrekturArtikel.id,
        neuerBestand: Number(korrekturForm.neuerBestand),
        notiz: korrekturForm.notiz,
      }),
    });
    setSavingKorrektur(false);
    if (res.ok) {
      setKorrekturArtikel(null);
      fetchArtikel();
    } else {
      const d = await res.json().catch(() => ({}));
      setKorrekturError(d.error ?? "Fehler beim Speichern.");
    }
  }

  // ─── TypBadge helper ──────────────────────────────────────────────────────
  function TypBadge({ typ }: { typ: string }) {
    const map: Record<string, string> = {
      wareneingang: "bg-green-100 text-green-800 border border-green-200",
      korrektur: "bg-blue-100 text-blue-800 border border-blue-200",
      abgang: "bg-orange-100 text-orange-800 border border-orange-200",
      verkauf: "bg-purple-100 text-purple-800 border border-purple-200",
    };
    const cls = map[typ.toLowerCase()] ?? "bg-gray-100 text-gray-700 border border-gray-200";
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{typ}</span>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">Lager</h1>
        <div className="flex gap-2 flex-wrap">
          <Link
            href="/lager/umbuchungen"
            className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Umbuchungen
          </Link>
          <Link
            href="/lager/wareneingang"
            className="bg-green-800 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            + Wareneingang
          </Link>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {(
          [
            { key: "gruen", label: "OK", color: "bg-green-50 border-green-200 text-green-800" },
            { key: "gelb", label: "Niedrig", color: "bg-yellow-50 border-yellow-200 text-yellow-800" },
            { key: "rot", label: "Leer / Kritisch", color: "bg-red-50 border-red-200 text-red-800" },
          ] as const
        ).map(({ key, label, color }) => (
          <div key={key} className={`rounded-xl border p-4 ${color}`}>
            <p className="text-2xl font-bold">{counts[key]}</p>
            <p className="text-sm font-medium mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6 gap-1">
        {[
          { key: "bestand", label: "Bestand" },
          { key: "bewegungen", label: "Bewegungen" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as typeof tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.key
                ? "border-green-700 text-green-800"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Bestand ─────────────────────────────────────────────────────── */}
      {tab === "bestand" && (
        <div>
          {/* Filter buttons */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {(
              [
                { key: "alle", label: "Alle" },
                { key: "alarme", label: "Nur Alarme" },
                { key: "leer", label: "Nur leer" },
              ] as const
            ).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  filter === key
                    ? "bg-green-800 text-white border-green-800"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
            {loading ? (
              <p className="p-6 text-gray-400 text-sm">Lade Lagerbestand…</p>
            ) : filteredArtikel.length === 0 ? (
              <p className="p-6 text-gray-400 text-sm">Keine Artikel für diesen Filter.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {["Artikel", "Kategorie", "Einheit", "Bestand", "Mindestbestand", "Ampel", "Lieferant", ""].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredArtikel.map((a) => {
                    const status = lagerStatus(a.aktuellerBestand, a.mindestbestand);
                    const bev = a.lieferanten.find((l) => l.bevorzugt) ?? a.lieferanten[0];
                    return (
                      <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-900">{a.name}</td>
                        <td className="px-4 py-3 text-gray-600">
                          {a.kategorie === "Duenger" ? "Dünger" : a.kategorie}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{a.einheit}</td>
                        <td className={`px-4 py-3 font-mono font-medium ${
                          status === "rot" ? "text-red-700" : status === "gelb" ? "text-yellow-700" : "text-gray-900"
                        }`}>
                          {a.aktuellerBestand}
                        </td>
                        <td className="px-4 py-3 font-mono text-gray-500">{a.mindestbestand}</td>
                        <td className="px-4 py-3">
                          <LagerBadge status={status} />
                        </td>
                        <td className="px-4 py-3 text-gray-600">{bev?.lieferant.name ?? "—"}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => openKorrektur(a)}
                            className="text-xs px-2.5 py-1 rounded-lg border border-gray-300 hover:bg-gray-100 text-gray-600 font-medium transition-colors"
                          >
                            Korrektur
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Bewegungen ──────────────────────────────────────────────────── */}
      {tab === "bewegungen" && (
        <div>
          <div className="flex flex-wrap gap-3 mb-4 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Von</label>
              <input
                type="date"
                value={datumVon}
                onChange={(e) => setDatumVon(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Bis</label>
              <input
                type="date"
                value={datumBis}
                onChange={(e) => setDatumBis(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
              />
            </div>
            <button
              onClick={fetchBewegungen}
              className="px-4 py-2 text-sm rounded-lg bg-green-800 hover:bg-green-700 text-white font-medium"
            >
              Laden
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
            {loadingBew ? (
              <p className="p-6 text-gray-400 text-sm">Lade Bewegungen…</p>
            ) : bewegungen.length === 0 ? (
              <p className="p-6 text-gray-400 text-sm">Keine Bewegungen gefunden.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {["Datum", "Artikel", "Typ", "Menge", "Bestand danach", "Notiz"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {bewegungen.map((b) => (
                    <tr key={b.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap">{formatDatum(b.datum)}</td>
                      <td className="px-4 py-3 font-medium">{b.artikel.name}</td>
                      <td className="px-4 py-3">
                        <TypBadge typ={b.typ} />
                      </td>
                      <td className="px-4 py-3 font-mono">
                        {b.menge} {b.artikel.einheit}
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-600">{b.bestandNach}</td>
                      <td className="px-4 py-3 text-gray-500">{b.notiz ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Korrektur Modal (small inline, kept as quick action) ──────────────── */}
      {korrekturArtikel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold mb-1">Bestandskorrektur</h2>
            <p className="text-sm text-gray-500 mb-5">{korrekturArtikel.name}</p>
            <div className="space-y-4">
              {korrekturError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{korrekturError}</p>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Neuer Bestand ({korrekturArtikel.einheit})
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={korrekturForm.neuerBestand}
                  onChange={(e) => setKorrekturForm({ ...korrekturForm, neuerBestand: parseFloat(e.target.value) || 0 })}
                  className={inputCls}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notiz <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Grund der Korrektur…"
                  value={korrekturForm.notiz}
                  onChange={(e) => setKorrekturForm({ ...korrekturForm, notiz: e.target.value })}
                  className={`${inputCls} ${korrekturForm.notiz.trim() === "" ? "border-red-400 focus:ring-red-400" : ""}`}
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setKorrekturArtikel(null)}
                  className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50"
                >
                  Abbrechen
                </button>
                <button
                  onClick={submitKorrektur}
                  disabled={savingKorrektur}
                  className="px-4 py-2 text-sm rounded-lg bg-green-800 hover:bg-green-700 text-white font-medium disabled:opacity-60"
                >
                  {savingKorrektur ? "Speichern…" : "Korrektur speichern"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
