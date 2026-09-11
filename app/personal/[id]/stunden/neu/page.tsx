"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { sollStundenFuerDatum, bevorzugtesZeitfensterFuerDatum, stundenZwischenUhrzeiten } from "@/lib/utils";

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
  const [manuelleVon, setManuelleVon] = useState("");
  const [manuelleBis, setManuelleBis] = useState("");
  const [zeitAuto, setZeitAuto] = useState(true);
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

  // Vorbelegung des Zeitfensters (Kommen/Gehen) aus den bevorzugten Arbeitszeiten, sofern für
  // diesen Wochentag als Uhrzeit (nicht nur reine Stundenzahl) hinterlegt — nur relevant bei
  // Art "arbeit". Als abgeleiteter Wert berechnet, solange der Nutzer es nicht selbst überschreibt
  // (analog vkAuto-Muster in lieferungen/neu).
  const zeitVorschlag = art === "arbeit" ? bevorzugtesZeitfensterFuerDatum(datum, bevorzugteArbeitszeiten) : null;
  const von = zeitAuto ? (zeitVorschlag?.von ?? "") : manuelleVon;
  const bis = zeitAuto ? (zeitVorschlag?.bis ?? "") : manuelleBis;
  const stundenAusZeit = art === "arbeit" ? stundenZwischenUhrzeiten(von, bis) : null;

  // Tatsächliches Kommen/Gehen (Aufzeichnungspflicht) hat Vorrang: ist ein gültiges Zeitfenster
  // gesetzt, wird die Stundenzahl daraus berechnet und ist nicht mehr manuell editierbar.
  const stunden = stundenAusZeit != null
    ? String(stundenAusZeit)
    : stundenAuto && (bevorzugteArbeitszeiten !== null || wochenstunden !== null)
      ? String(sollStundenFuerDatum(datum, bevorzugteArbeitszeiten, wochenstunden))
      : manuelleStunden;

  function zeitZuruecksetzen() {
    setManuelleVon("");
    setManuelleBis("");
    setZeitAuto(true);
  }

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
        von: art === "arbeit" && von ? von : null,
        bis: art === "arbeit" && bis ? bis : null,
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
        <div className="grid grid-cols-2 gap-4">
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

        {art === "arbeit" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Uhrzeit (Kommen/Gehen)</label>
            {zeitAuto && zeitVorschlag && (
              <p className="text-xs text-green-700 -mt-0.5 mb-1">Vorschlag aus bevorzugten Arbeitszeiten</p>
            )}
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={von}
                onChange={(e) => { setManuelleVon(e.target.value); setManuelleBis(bis); setZeitAuto(false); }}
                className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <span className="text-gray-400 text-xs">bis</span>
              <input
                type="time"
                value={bis}
                onChange={(e) => { setManuelleBis(e.target.value); setManuelleVon(von); setZeitAuto(false); }}
                className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              {(von || bis) && (
                <button type="button" onClick={zeitZuruecksetzen} className="text-xs text-gray-400 hover:text-gray-600">
                  Zurücksetzen
                </button>
              )}
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Stunden *</label>
          {stundenAusZeit != null ? (
            <p className="text-xs text-gray-400 -mt-0.5 mb-1">Automatisch aus Von/Bis berechnet</p>
          ) : (
            stundenAuto && bevorzugteArbeitszeiten && (
              <p className="text-xs text-green-700 -mt-0.5 mb-1">Vorschlag aus bevorzugten Arbeitszeiten</p>
            )
          )}
          <input
            type="number"
            required
            step="0.5"
            min="0.5"
            max="24"
            value={stunden}
            disabled={stundenAusZeit != null}
            onChange={(e) => { setManuelleStunden(e.target.value); setStundenAuto(false); }}
            className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${stundenAusZeit != null ? "bg-gray-50 text-gray-500" : ""}`}
          />
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
