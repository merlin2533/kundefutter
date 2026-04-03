"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const KATEGORIEN = [
  "Wareneinkauf",
  "Betriebsbedarf",
  "Fahrtkosten",
  "Bürobedarf",
  "Telefon/Internet",
  "Versicherung",
  "Miete",
  "Sonstige",
];

interface Lieferant { id: number; name: string }

type Ctx = { params: Promise<{ id: string }> };

export default function AusgabeDetailPage({ params }: Ctx) {
  const router = useRouter();
  const [id, setId] = useState<number | null>(null);
  const [lieferanten, setLieferanten] = useState<Lieferant[]>([]);
  const [saving, setSaving] = useState(false);
  const [fehler, setFehler] = useState("");
  const [laden, setLaden] = useState(true);

  const [datum, setDatum] = useState("");
  const [belegNr, setBelegNr] = useState("");
  const [beschreibung, setBeschreibung] = useState("");
  const [betragNetto, setBetragNetto] = useState("");
  const [mwstSatz, setMwstSatz] = useState("19");
  const [kategorie, setKategorie] = useState("Sonstige");
  const [lieferantId, setLieferantId] = useState("");
  const [bezahltAm, setBezahltAm] = useState("");
  const [notiz, setNotiz] = useState("");

  useEffect(() => {
    params.then(p => {
      const numId = parseInt(p.id, 10);
      setId(numId);
      fetch(`/api/ausgaben/${numId}`).then(r => r.json()).then(a => {
        setDatum(a.datum?.slice(0, 10) ?? "");
        setBelegNr(a.belegNr ?? "");
        setBeschreibung(a.beschreibung ?? "");
        setBetragNetto(String(a.betragNetto ?? ""));
        setMwstSatz(String(a.mwstSatz ?? 19));
        setKategorie(a.kategorie ?? "Sonstige");
        setLieferantId(a.lieferantId ? String(a.lieferantId) : "");
        setBezahltAm(a.bezahltAm?.slice(0, 10) ?? "");
        setNotiz(a.notiz ?? "");
        setLaden(false);
      });
    });
    fetch("/api/lieferanten").then(r => r.json()).then(setLieferanten);
  }, []);

  const netto = parseFloat(betragNetto) || 0;
  const mwstBetrag = netto * (parseFloat(mwstSatz) / 100);
  const brutto = netto + mwstBetrag;

  async function speichern(e: React.FormEvent) {
    e.preventDefault();
    if (!beschreibung.trim() || !betragNetto) {
      setFehler("Bitte Beschreibung und Betrag ausfüllen.");
      return;
    }
    setSaving(true);
    setFehler("");
    const res = await fetch(`/api/ausgaben/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        datum,
        belegNr: belegNr || null,
        beschreibung,
        betragNetto: netto,
        mwstSatz: parseFloat(mwstSatz),
        kategorie,
        lieferantId: lieferantId || null,
        bezahltAm: bezahltAm || null,
        notiz: notiz || null,
      }),
    });
    setSaving(false);
    if (res.ok) {
      router.push("/ausgaben");
    } else {
      const data = await res.json();
      setFehler(data.error ?? "Fehler beim Speichern");
    }
  }

  if (laden) return <div className="p-8 text-center text-gray-400">Lade…</div>;

  return (
    <div className="p-6 max-w-xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/ausgaben" className="text-gray-500 hover:text-gray-800">← Zurück</Link>
        <h1 className="text-2xl font-bold">Ausgabe bearbeiten</h1>
      </div>

      <form onSubmit={speichern} className="bg-white border rounded p-5 space-y-4">
        {fehler && <div className="bg-red-50 text-red-700 px-3 py-2 rounded text-sm">{fehler}</div>}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Datum</label>
            <input type="date" value={datum} onChange={e => setDatum(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Beleg-Nr.</label>
            <input type="text" value={belegNr} onChange={e => setBelegNr(e.target.value)}
              placeholder="z.B. RE-2026-1234"
              className="w-full border rounded px-3 py-2 text-sm" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Beschreibung *</label>
          <input type="text" value={beschreibung} onChange={e => setBeschreibung(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm" required />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Kategorie</label>
          <select value={kategorie} onChange={e => setKategorie(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm">
            {KATEGORIEN.map(k => <option key={k}>{k}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Lieferant (optional)</label>
          <select value={lieferantId} onChange={e => setLieferantId(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm">
            <option value="">— kein Lieferant —</option>
            {lieferanten.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Betrag netto (€) *</label>
            <input type="number" step="0.01" min="0" value={betragNetto}
              onChange={e => setBetragNetto(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">MwSt-Satz</label>
            <select value={mwstSatz} onChange={e => setMwstSatz(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm">
              <option value="19">19 %</option>
              <option value="7">7 %</option>
              <option value="0">0 % (steuerfrei)</option>
            </select>
          </div>
        </div>

        {netto > 0 && (
          <div className="bg-gray-50 border rounded p-3 text-sm grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-xs text-gray-500">Netto</div>
              <div className="font-medium">{netto.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">MwSt {mwstSatz}%</div>
              <div className="font-medium text-amber-600">{mwstBetrag.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Brutto</div>
              <div className="font-bold text-blue-700">{brutto.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</div>
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">Bezahlt am</label>
          <input type="date" value={bezahltAm} onChange={e => setBezahltAm(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Notiz</label>
          <textarea value={notiz} onChange={e => setNotiz(e.target.value)} rows={2}
            className="w-full border rounded px-3 py-2 text-sm" />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving}
            className="bg-blue-600 text-white px-5 py-2 rounded hover:bg-blue-700 text-sm disabled:opacity-50 w-full sm:w-auto">
            {saving ? "Speichern…" : "Speichern"}
          </button>
          <Link href="/ausgaben"
            className="px-5 py-2 rounded border text-sm hover:bg-gray-50 w-full sm:w-auto text-center">
            Abbrechen
          </Link>
        </div>
      </form>
    </div>
  );
}
