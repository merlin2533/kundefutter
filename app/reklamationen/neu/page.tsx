"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import SearchableSelect from "@/components/SearchableSelect";

interface KundeOption {
  id: number;
  name: string;
  firma: string | null;
}

interface LieferungOption {
  id: number;
  datum: string;
  rechnungNr: string | null;
  status: string;
}

function NeuInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [kunden, setKunden] = useState<KundeOption[]>([]);
  const [lieferungen, setLieferungen] = useState<LieferungOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [kundeId, setKundeId] = useState(searchParams.get("kundeId") ?? "");
  const [lieferungId, setLieferungId] = useState(searchParams.get("lieferungId") ?? "");
  const [betreff, setBetreff] = useState("");
  const [beschreibung, setBeschreibung] = useState("");
  const [kategorie, setKategorie] = useState("Qualitaet");
  const [prioritaet, setPrioritaet] = useState("normal");
  const [zugewiesen, setZugewiesen] = useState("");

  useEffect(() => {
    fetch("/api/kunden?limit=500&aktiv=true")
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setKunden(Array.isArray(d) ? d : d.kunden ?? []))
      .catch(() => {});
  }, []);

  const initialLieferungId = searchParams.get("lieferungId") ?? "";
  useEffect(() => {
    if (!kundeId) { setLieferungen([]); setLieferungId(""); return; }
    fetch(`/api/lieferungen?kundeId=${kundeId}&limit=50`)
      .then((r) => r.ok ? r.json() : [])
      .then((d) => {
        const list = Array.isArray(d) ? d : d.lieferungen ?? [];
        setLieferungen(list);
        // Pre-select from URL only on first load; reset if customer changes
        if (initialLieferungId && list.some((l: { id: number }) => String(l.id) === initialLieferungId)) {
          setLieferungId(initialLieferungId);
        }
      })
      .catch(() => setLieferungen([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kundeId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!kundeId || !betreff.trim() || !beschreibung.trim()) {
      setError("Bitte alle Pflichtfelder ausfüllen.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/reklamationen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kundeId: parseInt(kundeId, 10),
          lieferungId: lieferungId ? parseInt(lieferungId, 10) : null,
          betreff: betreff.trim(),
          beschreibung: beschreibung.trim(),
          kategorie,
          prioritaet,
          zugewiesen: zugewiesen.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Fehler beim Speichern.");
        return;
      }
      router.push("/reklamationen");
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setSaving(false);
    }
  }

  const kundenOptions = kunden.map((k) => ({
    value: k.id,
    label: k.firma ?? k.name,
    sub: k.firma ? k.name : undefined,
  }));

  const lieferungOptions = lieferungen.map((l) => ({
    value: l.id,
    label: l.rechnungNr ? `${l.rechnungNr} · ${new Date(l.datum).toLocaleDateString("de-DE")}` : new Date(l.datum).toLocaleDateString("de-DE"),
    sub: l.status,
  }));

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/reklamationen" className="text-gray-500 hover:text-gray-700 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Neue Reklamation</h1>
          <p className="text-sm text-gray-500">Reklamation anlegen</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          {/* Kunde */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Kunde <span className="text-red-500">*</span>
              <a href="/kunden/neu" target="_blank" rel="noopener" className="ml-2 text-xs text-green-700 hover:underline font-normal">+ Neuer Kunde</a>
            </label>
            <SearchableSelect
              options={kundenOptions}
              value={kundeId}
              onChange={setKundeId}
              placeholder="Kunde auswählen…"
              required
            />
          </div>

          {/* Lieferung (optional) */}
          {kundeId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Betroffene Lieferung <span className="text-gray-400 text-xs font-normal">(optional)</span>
              </label>
              {lieferungOptions.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Keine Lieferungen für diesen Kunden.</p>
              ) : (
                <SearchableSelect
                  options={lieferungOptions}
                  value={lieferungId}
                  onChange={setLieferungId}
                  placeholder="Lieferung auswählen…"
                  allowClear
                  clearLabel="Keine Lieferung zuordnen"
                />
              )}
            </div>
          )}

          {/* Betreff */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Betreff <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={betreff}
              onChange={(e) => setBetreff(e.target.value)}
              required
              placeholder="Kurze Beschreibung der Reklamation"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>

          {/* Beschreibung */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Beschreibung <span className="text-red-500">*</span>
            </label>
            <textarea
              value={beschreibung}
              onChange={(e) => setBeschreibung(e.target.value)}
              required
              rows={5}
              placeholder="Detaillierte Beschreibung des Problems…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 resize-y"
            />
          </div>

          {/* Kategorie + Priorität */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kategorie</label>
              <select
                value={kategorie}
                onChange={(e) => setKategorie(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
              >
                <option value="Qualitaet">Qualität</option>
                <option value="Menge">Menge</option>
                <option value="Lieferung">Lieferung</option>
                <option value="Preis">Preis</option>
                <option value="Sonstiges">Sonstiges</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priorität</label>
              <select
                value={prioritaet}
                onChange={(e) => setPrioritaet(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
              >
                <option value="niedrig">Niedrig</option>
                <option value="normal">Normal</option>
                <option value="hoch">Hoch</option>
                <option value="kritisch">Kritisch</option>
              </select>
            </div>
          </div>

          {/* Zugewiesen */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Zugewiesen an <span className="text-gray-400 text-xs font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={zugewiesen}
              onChange={(e) => setZugewiesen(e.target.value)}
              placeholder="Name des Bearbeiters"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 sm:flex-none px-6 py-2.5 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 disabled:opacity-50 transition-colors"
          >
            {saving ? "Speichern…" : "Reklamation anlegen"}
          </button>
          <Link
            href="/reklamationen"
            className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Abbrechen
          </Link>
        </div>
      </form>
    </div>
  );
}

export default function NeueReklamationPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Lade…</div>}>
      <NeuInner />
    </Suspense>
  );
}
