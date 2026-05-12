"use client";
import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SearchableSelect from "@/components/SearchableSelect";

interface Lieferant {
  id: number;
  name: string;
  firma: string | null;
}

function EingangsrechnungNeuInner() {
  const router = useRouter();
  const [lieferanten, setLieferanten] = useState<Lieferant[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const today = new Date().toISOString().slice(0, 10);

  const [lieferantId, setLieferantId] = useState("");
  const [nummer, setNummer] = useState("");
  const [datum, setDatum] = useState(today);
  const [faelligAm, setFaelligAm] = useState("");
  const [betrag, setBetrag] = useState("");
  const [mwst, setMwst] = useState("19");
  const [notiz, setNotiz] = useState("");

  useEffect(() => {
    fetch("/api/lieferanten?limit=500")
      .then((r) => r.json())
      .then((d) => setLieferanten(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  const lieferantenOptions = lieferanten.map((l) => ({
    value: l.id,
    label: l.firma ?? l.name,
    sub: l.firma ? l.name : undefined,
  }));

  const bruttoValue = betrag && mwst
    ? (parseFloat(betrag) * (1 + parseFloat(mwst) / 100)).toLocaleString("de-DE", { style: "currency", currency: "EUR" })
    : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!lieferantId) { setError("Bitte einen Lieferanten wählen."); return; }
    if (!nummer.trim()) { setError("Rechnungsnummer ist erforderlich."); return; }
    if (!betrag || parseFloat(betrag) < 0) { setError("Betrag ist erforderlich."); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/eingangsrechnungen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lieferantId: parseInt(lieferantId, 10),
          nummer: nummer.trim(),
          datum,
          faelligAm: faelligAm || null,
          betrag: parseFloat(betrag),
          mwst: parseFloat(mwst),
          notiz: notiz.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Fehler beim Speichern");
      router.push(`/eingangsrechnungen/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 sm:py-8">
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/eingangsrechnungen" className="hover:text-green-700">Eingangsrechnungen</Link>
        <span>›</span>
        <span className="text-gray-900 font-medium">Neue Eingangsrechnung</span>
      </nav>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Neue Eingangsrechnung erfassen</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 space-y-4">
        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Lieferant <span className="text-red-500">*</span>
          </label>
          <SearchableSelect
            options={lieferantenOptions}
            value={lieferantId}
            onChange={setLieferantId}
            placeholder="Lieferant wählen…"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Rechnungsnummer <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={nummer}
            onChange={(e) => setNummer(e.target.value)}
            required
            placeholder="z.B. RE-2025-12345"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rechnungsdatum</label>
            <input
              type="date"
              value={datum}
              onChange={(e) => setDatum(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fällig am</label>
            <input
              type="date"
              value={faelligAm}
              onChange={(e) => setFaelligAm(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Betrag (netto) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={betrag}
              onChange={(e) => setBetrag(e.target.value)}
              required
              placeholder="0,00"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
            />
            {bruttoValue && (
              <p className="text-xs text-gray-500 mt-1">Brutto: {bruttoValue}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">MwSt. %</label>
            <select
              value={mwst}
              onChange={(e) => setMwst(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
            >
              <option value="0">0%</option>
              <option value="7">7%</option>
              <option value="19">19%</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notiz (optional)</label>
          <textarea
            value={notiz}
            onChange={(e) => setNotiz(e.target.value)}
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 resize-none"
          />
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end pt-2">
          <Link
            href="/eingangsrechnungen"
            className="w-full sm:w-auto text-center px-5 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors"
          >
            Abbrechen
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto px-5 py-2 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Speichere…" : "Eingangsrechnung speichern"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function EingangsrechnungNeuPage() {
  return (
    <Suspense fallback={<div className="text-center py-16 text-gray-400">Lade…</div>}>
      <EingangsrechnungNeuInner />
    </Suspense>
  );
}
