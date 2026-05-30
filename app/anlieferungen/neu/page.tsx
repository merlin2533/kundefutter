"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import SearchableSelect from "@/components/SearchableSelect";

interface Kunde { id: number; name: string; firma?: string | null; }
interface Artikel { id: number; name: string; einheit: string; kategorie: string; }

function NeueAnlieferungInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [kunden, setKunden] = useState<Kunde[]>([]);
  const [artikel, setArtikel] = useState<Artikel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [kundeId, setKundeId] = useState(searchParams.get("kundeId") ?? "");
  const [artikelId, setArtikelId] = useState("");
  const [datum, setDatum] = useState(() => new Date().toISOString().slice(0, 10));
  const [menge, setMenge] = useState("");
  const [einheit, setEinheit] = useState("t");
  const [feuchte, setFeuchte] = useState("");
  const [qualitaet, setQualitaet] = useState("");
  const [preisProEinheit, setPreisProEinheit] = useState("");
  const [notiz, setNotiz] = useState("");

  useEffect(() => {
    fetch("/api/kunden?limit=1000")
      .then((r) => r.json())
      .then((d) => setKunden(Array.isArray(d) ? d : []))
      .catch(() => {});
    fetch("/api/artikel?limit=1000")
      .then((r) => r.json())
      .then((d) => setArtikel(Array.isArray(d) ? d : (d?.artikel ?? [])))
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!kundeId || !artikelId || !menge) {
      setError("Kunde, Artikel und Menge sind Pflichtfelder.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/anlieferungen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kundeId: parseInt(kundeId, 10),
          artikelId: parseInt(artikelId, 10),
          datum,
          menge: parseFloat(menge.replace(",", ".")),
          einheit,
          feuchte: feuchte ? parseFloat(feuchte.replace(",", ".")) : null,
          qualitaet: qualitaet || null,
          preisProEinheit: preisProEinheit ? parseFloat(preisProEinheit.replace(",", ".")) : null,
          notiz: notiz || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Fehler beim Speichern");
        return;
      }
      const data = await res.json();
      setSuccess(`Anlieferung ${data.nummer} gespeichert.`);
      setTimeout(() => router.push("/anlieferungen"), 1200);
    } catch {
      setError("Netzwerkfehler beim Speichern");
    } finally {
      setLoading(false);
    }
  }

  const mengeNum = parseFloat(menge.replace(",", ".")) || 0;
  const preisNum = parseFloat(preisProEinheit.replace(",", ".")) || 0;
  const gesamtBetrag = mengeNum > 0 && preisNum > 0 ? mengeNum * preisNum : null;

  return (
    <div>
      <div className="mb-5 flex items-center gap-2">
        <Link href="/anlieferungen" className="text-green-700 hover:underline text-sm">
          ← Erzeugerabrechnung
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Neue Anlieferung</h1>

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Stammdaten</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Datum *</label>
              <input
                type="date"
                value={datum}
                onChange={(e) => setDatum(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kunde <span className="text-red-500">*</span>
                <a href="/kunden/neu" target="_blank" rel="noopener" className="ml-2 text-xs text-green-700 hover:underline font-normal">+ Neuer Kunde</a>
              </label>
              <SearchableSelect
                options={kunden.map((k) => ({ value: k.id, label: k.firma ? `${k.firma} – ${k.name}` : k.name }))}
                value={kundeId}
                onChange={setKundeId}
                placeholder="Kunde wählen…"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Artikel *</label>
            <SearchableSelect
              options={artikel.map((a) => ({ value: a.id, label: `${a.name} (${a.kategorie})` }))}
              value={artikelId}
              onChange={setArtikelId}
              placeholder="Artikel wählen…"
            />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Lieferdetails</h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Menge *</label>
              <input
                type="text"
                value={menge}
                onChange={(e) => setMenge(e.target.value)}
                placeholder="0,000"
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Einheit</label>
              <select
                value={einheit}
                onChange={(e) => setEinheit(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700 bg-white"
              >
                <option value="t">t</option>
                <option value="kg">kg</option>
                <option value="dt">dt</option>
                <option value="Stück">Stück</option>
                <option value="Liter">Liter</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Feuchte (%)</label>
              <input
                type="text"
                value={feuchte}
                onChange={(e) => setFeuchte(e.target.value)}
                placeholder="z.B. 14,5"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Qualität</label>
              <input
                type="text"
                value={qualitaet}
                onChange={(e) => setQualitaet(e.target.value)}
                placeholder="z.B. A-Qualität, Futtergetreide"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Preis / Einheit (€)</label>
              <input
                type="text"
                value={preisProEinheit}
                onChange={(e) => setPreisProEinheit(e.target.value)}
                placeholder="0,00"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
              />
            </div>
          </div>

          {gesamtBetrag && gesamtBetrag > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-800">
              Berechneter Gesamtbetrag: <strong>{gesamtBetrag.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</strong>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notiz</label>
            <textarea
              value={notiz}
              onChange={(e) => setNotiz(e.target.value)}
              rows={2}
              placeholder="Interne Notiz…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700 resize-none"
            />
          </div>
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
        )}
        {success && (
          <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{success}</div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-green-700 hover:bg-green-800 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
          >
            {loading ? "Speichern…" : "Anlieferung speichern"}
          </button>
          <Link
            href="/anlieferungen"
            className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Abbrechen
          </Link>
        </div>
      </form>
    </div>
  );
}

export default function NeueAnlieferungPage() {
  return (
    <Suspense fallback={<div className="text-sm text-gray-400 py-8 text-center">Lade…</div>}>
      <NeueAnlieferungInner />
    </Suspense>
  );
}
