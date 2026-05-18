"use client";

import { useState, useEffect, FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

interface KundeOption {
  id: number;
  name: string;
  firma: string | null;
}

interface Schlag {
  id: number;
  name: string;
  flaeche: number | null;
  fruchtart: string | null;
}

const STATUS_OPTIONEN = [
  { value: "geplant", label: "Geplant" },
  { value: "ausgesaet", label: "Ausgesät" },
  { value: "geerntet", label: "Geerntet" },
  { value: "abgebrochen", label: "Abgebrochen" },
];

const FRUCHTARTEN_STANDARD = [
  "Winterweizen", "Sommerweizen", "Wintergerste", "Sommergerste", "Winterraps",
  "Silomais", "Körnermais", "Zuckerrüben", "Kartoffeln", "Sonnenblumen",
  "Sojabohnen", "Winterroggen", "Triticale", "Hafer", "Erbsen", "Ackerbohnen",
  "Senf", "Phacelia", "Grünland", "Brache",
];

function NeuAnbauplanContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const presetKundeId = searchParams.get("kundeId");
  const presetSchlagId = searchParams.get("schlagId");

  const [kundeId, setKundeId] = useState(presetKundeId ?? "");
  const [schlagId, setSchlagId] = useState(presetSchlagId ?? "");
  const [jahr, setJahr] = useState(String(new Date().getFullYear()));
  const [fruchtart, setFruchtart] = useState("");
  const [sorte, setSorte] = useState("");
  const [aussaatDatum, setAussaatDatum] = useState("");
  const [ernteDatum, setErnteDatum] = useState("");
  const [status, setStatus] = useState("geplant");
  const [notiz, setNotiz] = useState("");

  const [kunden, setKunden] = useState<KundeOption[]>([]);
  const [kundeSearch, setKundeSearch] = useState("");
  const [selectedKunde, setSelectedKunde] = useState<KundeOption | null>(null);
  const [schlaegte, setSchlaegte] = useState<Schlag[]>([]);
  const [fruchtarten, setFruchtarten] = useState<string[]>(FRUCHTARTEN_STANDARD);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Lade Kundeninfo wenn presetKundeId
  useEffect(() => {
    if (presetKundeId) {
      fetch(`/api/kunden/${presetKundeId}`)
        .then((r) => r.ok ? r.json() : null)
        .then((d) => {
          if (d) {
            setSelectedKunde({ id: d.id, name: d.name, firma: d.firma });
            setKundeSearch(d.firma ?? d.name);
          }
        });
    }
  }, [presetKundeId]);

  // Schlaegte laden
  useEffect(() => {
    if (!kundeId) { setSchlaegte([]); return; }
    fetch(`/api/kunden/${kundeId}/schlaegte`)
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setSchlaegte(Array.isArray(d) ? d : []));
  }, [kundeId]);

  // Fruchtarten aus Einstellungen
  useEffect(() => {
    fetch("/api/einstellungen?prefix=system.fruchtarten")
      .then((r) => r.ok ? r.json() : {})
      .then((d: Record<string, string>) => {
        if (d["system.fruchtarten"]) {
          try {
            const parsed = JSON.parse(d["system.fruchtarten"]);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setFruchtarten(parsed);
            }
          } catch { /* ignore */ }
        }
      });
  }, []);

  // Kunden-Suche
  useEffect(() => {
    if (kundeSearch.length < 2) { setKunden([]); return; }
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/kunden?search=${encodeURIComponent(kundeSearch)}&limit=10`);
      if (!res.ok) return;
      const d = await res.json();
      setKunden(Array.isArray(d) ? d : (d.kunden ?? []));
    }, 200);
    return () => clearTimeout(timer);
  }, [kundeSearch]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!kundeId) { setError("Bitte Kunde auswählen"); return; }
    if (!schlagId) { setError("Bitte Schlag auswählen"); return; }
    if (!fruchtart.trim()) { setError("Fruchtart erforderlich"); return; }
    if (!jahr || isNaN(parseInt(jahr, 10))) { setError("Gültiges Jahr erforderlich"); return; }

    setSaving(true);
    try {
      const res = await fetch("/api/anbauplanung", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kundeId: parseInt(kundeId, 10),
          schlagId: parseInt(schlagId, 10),
          jahr: parseInt(jahr, 10),
          fruchtart: fruchtart.trim(),
          sorte: sorte.trim() || null,
          aussaatDatum: aussaatDatum || null,
          ernteDatum: ernteDatum || null,
          status,
          notiz: notiz.trim() || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Fehler beim Speichern");
        return;
      }
      router.push("/anbauplanung");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/anbauplanung" className="text-sm text-gray-500 hover:text-gray-700">
          ← Anbauplanung
        </Link>
        <h1 className="text-xl font-bold">Neuer Anbauplan</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">

        {/* Kunde */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Kunde <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={kundeSearch}
              onChange={(e) => {
                setKundeSearch(e.target.value);
                setSelectedKunde(null);
                setKundeId("");
                setSchlagId("");
              }}
              placeholder="Kundensuche…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            {kunden.length > 0 && !kundeId && (
              <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10 mt-1 max-h-40 overflow-y-auto">
                {kunden.map((k) => (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => {
                      setKundeId(String(k.id));
                      setSelectedKunde(k);
                      setKundeSearch(k.firma ?? k.name);
                      setKunden([]);
                      setSchlagId("");
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-green-50 border-b border-gray-50 last:border-0"
                  >
                    {k.firma ?? k.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Schlag */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Schlag <span className="text-red-500">*</span>
          </label>
          {schlaegte.length === 0 ? (
            <p className="text-sm text-gray-400">
              {kundeId ? "Keine Schläge vorhanden." : "Erst Kunde auswählen."}
            </p>
          ) : (
            <select
              value={schlagId}
              onChange={(e) => setSchlagId(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
            >
              <option value="">Bitte wählen…</option>
              {schlaegte.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.name}{s.flaeche ? ` (${s.flaeche} ha)` : ""}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Jahr */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Jahr <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            value={jahr}
            onChange={(e) => setJahr(e.target.value)}
            min="1990"
            max="2100"
            required
            className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {/* Fruchtart */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Fruchtart <span className="text-red-500">*</span>
          </label>
          <input
            list="fruchtarten-list"
            value={fruchtart}
            onChange={(e) => setFruchtart(e.target.value)}
            required
            placeholder="z.B. Winterweizen"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <datalist id="fruchtarten-list">
            {fruchtarten.map((f) => <option key={f} value={f} />)}
          </datalist>
        </div>

        {/* Sorte */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Sorte</label>
          <input
            type="text"
            value={sorte}
            onChange={(e) => setSorte(e.target.value)}
            placeholder="z.B. Benchmark, Amaretto"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {/* Datum-Felder */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Aussaatdatum</label>
            <input
              type="date"
              value={aussaatDatum}
              onChange={(e) => setAussaatDatum(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Erntedatum (geplant)</label>
            <input
              type="date"
              value={ernteDatum}
              onChange={(e) => setErnteDatum(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
          >
            {STATUS_OPTIONEN.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Notiz */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notiz</label>
          <textarea
            value={notiz}
            onChange={(e) => setNotiz(e.target.value)}
            rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
          />
        </div>

        {error && (
          <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-green-700 hover:bg-green-800 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? "Speichern…" : "Speichern"}
          </button>
          <Link
            href="/anbauplanung"
            className="px-6 py-2.5 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            Abbrechen
          </Link>
        </div>
      </form>
    </div>
  );
}

export default function NeuAnbauplanPage() {
  return (
    <Suspense fallback={<p className="text-gray-400 text-sm mt-8">Lade…</p>}>
      <NeuAnbauplanContent />
    </Suspense>
  );
}
