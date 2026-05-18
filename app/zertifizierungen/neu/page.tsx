"use client";

import { useState, useEffect, FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

const TYPEN = ["QS", "GlobalGAP", "Bio/Öko", "Cross-Compliance", "Ernte-Plus", "DLG", "Sonstige"];

interface KundeOption {
  id: number;
  name: string;
  firma: string | null;
}

function NeuZertifizierungContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetKundeId = searchParams.get("kundeId");

  const [kundeId, setKundeId] = useState(presetKundeId ?? "");
  const [kundeSearch, setKundeSearch] = useState("");
  const [kunden, setKunden] = useState<KundeOption[]>([]);
  const [typ, setTyp] = useState("QS");
  const [nummer, setNummer] = useState("");
  const [ausstellerOrg, setAusstellerOrg] = useState("");
  const [ausstellungsdatum, setAusstellungsdatum] = useState("");
  const [ablaufdatum, setAblaufdatum] = useState("");
  const [notiz, setNotiz] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (presetKundeId) {
      fetch(`/api/kunden/${presetKundeId}`)
        .then((r) => r.ok ? r.json() : null)
        .then((d) => {
          if (d) setKundeSearch(d.firma ?? d.name);
        });
    }
  }, [presetKundeId]);

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

    setSaving(true);
    try {
      const res = await fetch("/api/zertifizierungen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kundeId: parseInt(kundeId, 10),
          typ,
          nummer: nummer.trim() || null,
          ausstellerOrg: ausstellerOrg.trim() || null,
          ausstellungsdatum: ausstellungsdatum || null,
          ablaufdatum: ablaufdatum || null,
          notiz: notiz.trim() || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Fehler");
        return;
      }
      const z = await res.json();
      router.push(`/zertifizierungen/${z.id}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/zertifizierungen" className="text-sm text-gray-500 hover:text-gray-700">
          ← Zertifizierungen
        </Link>
        <h1 className="text-xl font-bold">Neue Zertifizierung</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">

        {/* Kunde */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Kunde <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={kundeSearch}
              onChange={(e) => { setKundeSearch(e.target.value); setKundeId(""); }}
              placeholder="Kundensuche…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            {kunden.length > 0 && !kundeId && (
              <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10 mt-1 max-h-40 overflow-y-auto">
                {kunden.map((k) => (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => { setKundeId(String(k.id)); setKundeSearch(k.firma ?? k.name); setKunden([]); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-green-50 border-b border-gray-50 last:border-0"
                  >
                    {k.firma ?? k.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Typ */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Typ <span className="text-red-500">*</span>
          </label>
          <select
            value={typ}
            onChange={(e) => setTyp(e.target.value)}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
          >
            {TYPEN.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* Nummer */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Zertifikatsnummer</label>
          <input
            type="text"
            value={nummer}
            onChange={(e) => setNummer(e.target.value)}
            placeholder="z.B. QS-12345678"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {/* Aussteller */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Ausstellende Organisation</label>
          <input
            type="text"
            value={ausstellerOrg}
            onChange={(e) => setAusstellerOrg(e.target.value)}
            placeholder="z.B. QS GmbH, LUFA, DLG"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {/* Daten */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ausstellungsdatum</label>
            <input
              type="date"
              value={ausstellungsdatum}
              onChange={(e) => setAusstellungsdatum(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ablaufdatum</label>
            <input
              type="date"
              value={ablaufdatum}
              onChange={(e) => setAblaufdatum(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
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
          <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
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
            href="/zertifizierungen"
            className="px-6 py-2.5 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            Abbrechen
          </Link>
        </div>
      </form>
    </div>
  );
}

export default function NeuZertifizierungPage() {
  return (
    <Suspense fallback={<p className="text-gray-400 text-sm mt-8">Lade…</p>}>
      <NeuZertifizierungContent />
    </Suspense>
  );
}
