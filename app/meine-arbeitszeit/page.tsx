"use client";
import { useState, useEffect, useCallback } from "react";
import {
  MONATE_KURZ,
  getJahreListeNum,
  formatDatum,
  sollStundenFuerDatum,
  bevorzugtesZeitfensterFuerDatum,
  stundenZwischenUhrzeiten,
} from "@/lib/utils";
import * as Sentry from "@sentry/nextjs";

const MONATE = MONATE_KURZ;

const ARTEN = [
  { value: "arbeit", label: "Arbeit" },
  { value: "urlaub", label: "Urlaub" },
  { value: "krank", label: "Krank" },
  { value: "feiertag", label: "Feiertag" },
];

const ART_LABEL: Record<string, string> = { arbeit: "Arbeit", urlaub: "Urlaub", krank: "Krank", feiertag: "Feiertag" };
const ART_COLOR: Record<string, string> = {
  arbeit: "bg-green-100 text-green-700",
  urlaub: "bg-blue-100 text-blue-800",
  krank: "bg-red-100 text-red-700",
  feiertag: "bg-gray-100 text-gray-600",
};

interface Mitarbeiter {
  id: number;
  vorname: string;
  nachname: string;
  aktiv: boolean;
  wochenstunden: number | null;
  bevorzugteArbeitszeiten: string | null;
}

interface Arbeitsstunde {
  id: number;
  datum: string;
  stunden: number;
  art: string;
  von: string | null;
  bis: string | null;
  notiz: string | null;
}

export default function MeineArbeitszeitPage() {
  const [ma, setMa] = useState<Mitarbeiter | null>(null);
  const [loadError, setLoadError] = useState("");
  const [stunden, setStunden] = useState<Arbeitsstunde[]>([]);
  const [monat, setMonat] = useState(new Date().getMonth() + 1);
  const [jahr, setJahr] = useState(new Date().getFullYear());

  // Formular
  const [datum, setDatum] = useState(new Date().toISOString().split("T")[0]);
  const [manuelleStunden, setManuelleStunden] = useState("8");
  const [stundenAuto, setStundenAuto] = useState(true);
  const [manuelleVon, setManuelleVon] = useState("");
  const [manuelleBis, setManuelleBis] = useState("");
  const [zeitAuto, setZeitAuto] = useState(true);
  const [art, setArt] = useState("arbeit");
  const [notiz, setNotiz] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const ladeMitarbeiter = useCallback(() => {
    fetch("/api/personal/mitarbeiter/me")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => { setMa(d); setLoadError(""); })
      .catch((err) => {
        Sentry.captureException(err);
        setLoadError("Eigene Mitarbeiterdaten konnten nicht geladen werden.");
      });
  }, []);

  const ladeStunden = useCallback(() => {
    fetch(`/api/personal/arbeitsstunden?monat=${monat}&jahr=${jahr}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => setStunden(Array.isArray(d) ? d : []))
      .catch((err) => {
        Sentry.captureException(err);
        setStunden([]);
      });
  }, [monat, jahr]);

  useEffect(() => { ladeMitarbeiter(); }, [ladeMitarbeiter]);
  useEffect(() => { ladeStunden(); }, [ladeStunden]);

  const zeitVorschlag = art === "arbeit" ? bevorzugtesZeitfensterFuerDatum(datum, ma?.bevorzugteArbeitszeiten ?? null) : null;
  const von = zeitAuto ? (zeitVorschlag?.von ?? "") : manuelleVon;
  const bis = zeitAuto ? (zeitVorschlag?.bis ?? "") : manuelleBis;
  const stundenAusZeit = art === "arbeit" ? stundenZwischenUhrzeiten(von, bis) : null;

  const stundenWert = stundenAusZeit != null
    ? String(stundenAusZeit)
    : stundenAuto && ma && (ma.bevorzugteArbeitszeiten !== null || ma.wochenstunden !== null)
      ? String(sollStundenFuerDatum(datum, ma.bevorzugteArbeitszeiten, ma.wochenstunden))
      : manuelleStunden;

  function zeitZuruecksetzen() {
    setManuelleVon("");
    setManuelleBis("");
    setZeitAuto(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError("");

    try {
      const res = await fetch("/api/personal/arbeitsstunden", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datum,
          stunden: parseFloat(stundenWert),
          art,
          von: art === "arbeit" && von ? von : null,
          bis: art === "arbeit" && bis ? bis : null,
          notiz: notiz || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setFormError(d.error ?? "Fehler beim Speichern");
        return;
      }
      setNotiz("");
      zeitZuruecksetzen();
      setStundenAuto(true);
      ladeStunden();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Diesen Eintrag wirklich löschen?")) return;
    const res = await fetch(`/api/personal/arbeitsstunden/${id}`, { method: "DELETE" });
    if (res.ok) ladeStunden();
  }

  const stundenSumme = stunden.filter((s) => s.art === "arbeit").reduce((sum, s) => sum + s.stunden, 0);

  if (loadError) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
          {loadError}{" "}
          <button onClick={ladeMitarbeiter} className="underline font-medium">Erneut versuchen</button>
        </div>
      </div>
    );
  }

  if (!ma) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-xl font-bold">Meine Arbeitszeit — {ma.vorname} {ma.nachname}</h1>

      <form onSubmit={handleSubmit} className="bg-white border rounded-lg p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Eintrag erfassen</h2>
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
            stundenAuto && ma.bevorzugteArbeitszeiten && (
              <p className="text-xs text-green-700 -mt-0.5 mb-1">Vorschlag aus bevorzugten Arbeitszeiten</p>
            )
          )}
          <input
            type="number"
            required
            step="0.5"
            min="0.5"
            max="24"
            value={stundenWert}
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

        {formError && <p className="text-red-600 text-sm">{formError}</p>}

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-800 disabled:opacity-50"
          >
            {saving ? "Speichern…" : "Speichern"}
          </button>
        </div>
      </form>

      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-2">
            <select
              value={monat}
              onChange={(e) => setMonat(parseInt(e.target.value, 10))}
              className="border rounded-lg px-3 py-1.5 text-sm"
            >
              {MONATE.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <select
              value={jahr}
              onChange={(e) => setJahr(parseInt(e.target.value, 10))}
              className="border rounded-lg px-3 py-1.5 text-sm"
            >
              {getJahreListeNum().map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-1.5 text-sm">
            <span className="text-green-700">Arbeitsstunden: </span>
            <span className="font-bold text-green-800">{stundenSumme.toFixed(1)} h</span>
          </div>
        </div>

        {stunden.length === 0 ? (
          <div className="bg-white border rounded-lg p-8 text-center text-gray-400">
            Keine Einträge für diesen Monat
          </div>
        ) : (
          <div className="bg-white border rounded-lg overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <th className="px-4 py-2 text-left">Datum</th>
                  <th className="px-4 py-2 text-left">Art</th>
                  <th className="px-4 py-2 text-left hidden sm:table-cell">Zeit</th>
                  <th className="px-4 py-2 text-right">Stunden</th>
                  <th className="px-4 py-2 text-left hidden md:table-cell">Notiz</th>
                  <th className="px-4 py-2 text-right">Löschen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {stunden.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      {formatDatum(s.datum)}
                      {s.von && s.bis && (
                        <div className="sm:hidden text-xs text-gray-400">{s.von}–{s.bis}</div>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ART_COLOR[s.art] ?? "bg-gray-100"}`}>
                        {ART_LABEL[s.art] ?? s.art}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-500 hidden sm:table-cell">
                      {s.von && s.bis ? `${s.von}–${s.bis}` : "—"}
                    </td>
                    <td className="px-4 py-2 text-right font-mono">{s.stunden.toFixed(1)}</td>
                    <td className="px-4 py-2 text-gray-500 hidden md:table-cell">{s.notiz ?? "—"}</td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => handleDelete(s.id)} className="text-xs text-red-500 hover:text-red-700">
                        Löschen
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
