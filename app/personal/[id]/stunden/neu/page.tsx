"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { sollStundenFuerDatum } from "@/lib/utils";

const ARTEN = [
  { value: "arbeit", label: "Arbeit" },
  { value: "urlaub", label: "Urlaub" },
  { value: "krank", label: "Krank" },
  { value: "feiertag", label: "Feiertag" },
];

type Params = { params: Promise<{ id: string }> };

export default function StundenNeuPage({ params }: Params) {
  const router = useRouter();
  const [mitarbeiterId, setMitarbeiterId] = useState<string | null>(null);
  const [maName, setMaName] = useState("");
  const [bevorzugteArbeitszeiten, setBevorzugteArbeitszeiten] = useState<string | null>(null);
  const [wochenstunden, setWochenstunden] = useState<number | null>(null);
  const [datum, setDatum] = useState(new Date().toISOString().split("T")[0]);
  const [manuelleStunden, setManuelleStunden] = useState("8");
  const [stundenAuto, setStundenAuto] = useState(true);
  const [art, setArt] = useState("arbeit");
  const [notiz, setNotiz] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    params.then((p) => {
      setMitarbeiterId(p.id);
      fetch(`/api/personal/mitarbeiter/${p.id}`)
        .then((r) => r.ok ? r.json() : null)
        .then((d) => {
          if (!d) return;
          setMaName(`${d.vorname} ${d.nachname}`);
          setBevorzugteArbeitszeiten(d.bevorzugteArbeitszeiten ?? null);
          setWochenstunden(d.wochenstunden ?? null);
        });
    });
  }, [params]);

  // Vorbelegung aus den bevorzugten Arbeitszeiten (Stammdaten) — als abgeleiteter Wert
  // während des Renderns berechnet (nicht per Effect synchronisiert), solange der Nutzer
  // die Stunden noch nicht selbst überschrieben hat (analog vkAuto-Muster in lieferungen/neu).
  const stunden = stundenAuto && (bevorzugteArbeitszeiten !== null || wochenstunden !== null)
    ? String(sollStundenFuerDatum(datum, bevorzugteArbeitszeiten, wochenstunden))
    : manuelleStunden;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!mitarbeiterId) return;
    setSaving(true);
    setError("");

    const res = await fetch("/api/personal/arbeitsstunden", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mitarbeiterId: parseInt(mitarbeiterId, 10),
        datum,
        stunden: parseFloat(stunden),
        art,
        notiz: notiz || null,
      }),
    });

    setSaving(false);
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Fehler beim Speichern");
      return;
    }
    router.push(`/personal/${mitarbeiterId}?tab=stunden`);
  }

  if (!mitarbeiterId) return null;

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/personal/${mitarbeiterId}?tab=stunden`} className="text-gray-400 hover:text-gray-600 text-sm">
          ← {maName || "Mitarbeiter"}
        </Link>
        <h1 className="text-xl font-bold">Stunden erfassen</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border rounded-lg p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Datum *</label>
          <input
            type="date"
            required
            value={datum}
            onChange={(e) => setDatum(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Stunden *</label>
            {stundenAuto && bevorzugteArbeitszeiten && (
              <p className="text-xs text-green-700 -mt-0.5 mb-1">Vorschlag aus bevorzugten Arbeitszeiten</p>
            )}
            <input
              type="number"
              required
              step="0.5"
              min="0.5"
              max="24"
              value={stunden}
              onChange={(e) => { setManuelleStunden(e.target.value); setStundenAuto(false); }}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Art</label>
            <select
              value={art}
              onChange={(e) => setArt(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none"
            >
              {ARTEN.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notiz</label>
          <input
            value={notiz}
            onChange={(e) => setNotiz(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none"
          />
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <Link href={`/personal/${mitarbeiterId}?tab=stunden`} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">
            Abbrechen
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-800 disabled:opacity-50"
          >
            {saving ? "Speichern…" : "Speichern"}
          </button>
        </div>
      </form>
    </div>
  );
}
