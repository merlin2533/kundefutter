"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Reklamation {
  id: number;
  nummer: string;
  datum: string;
  betreff: string;
  beschreibung: string;
  kategorie: string;
  prioritaet: string;
  status: string;
  zugewiesen: string | null;
  loesung: string | null;
  geloestAm: string | null;
  kunde: { id: number; name: string; firma: string | null };
  lieferung: { id: number; datum: string; rechnungNr: string | null } | null;
}

const STATUS_LABEL: Record<string, string> = {
  OFFEN: "Offen",
  IN_BEARBEITUNG: "In Bearbeitung",
  GELOEST: "Gelöst",
  GESCHLOSSEN: "Geschlossen",
};

const STATUS_BADGE: Record<string, string> = {
  OFFEN: "bg-yellow-100 text-yellow-800",
  IN_BEARBEITUNG: "bg-blue-100 text-blue-800",
  GELOEST: "bg-green-100 text-green-800",
  GESCHLOSSEN: "bg-gray-100 text-gray-700",
};

const KATEGORIE_LABEL: Record<string, string> = {
  Qualitaet: "Qualität",
  Menge: "Menge",
  Lieferung: "Lieferung",
  Preis: "Preis",
  Sonstiges: "Sonstiges",
};

type Params = { params: Promise<{ id: string }> };

export default function ReklamationDetailPage({ params }: Params) {
  const router = useRouter();
  const [rek, setRek] = useState<Reklamation | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [rekId, setRekId] = useState<number | null>(null);

  // Editable fields
  const [betreff, setBetreff] = useState("");
  const [beschreibung, setBeschreibung] = useState("");
  const [kategorie, setKategorie] = useState("Qualitaet");
  const [prioritaet, setPrioritaet] = useState("normal");
  const [zugewiesen, setZugewiesen] = useState("");

  // For "Als gelöst markieren" flow
  const [showLoesung, setShowLoesung] = useState(false);
  const [loesungText, setLoesungText] = useState("");

  useEffect(() => {
    params.then(({ id }) => {
      const numId = parseInt(id, 10);
      setRekId(numId);
    });
  }, [params]);

  useEffect(() => {
    if (rekId === null) return;
    setLoading(true);
    fetch(`/api/reklamationen/${rekId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data: Reklamation | null) => {
        if (!data) { setError("Reklamation nicht gefunden."); setLoading(false); return; }
        setRek(data);
        setBetreff(data.betreff);
        setBeschreibung(data.beschreibung);
        setKategorie(data.kategorie);
        setPrioritaet(data.prioritaet);
        setZugewiesen(data.zugewiesen ?? "");
        setLoesungText(data.loesung ?? "");
      })
      .catch(() => setError("Fehler beim Laden."))
      .finally(() => setLoading(false));
  }, [rekId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!rek || rekId === null) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/reklamationen/${rekId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          betreff: betreff.trim(),
          beschreibung: beschreibung.trim(),
          kategorie,
          prioritaet,
          zugewiesen: zugewiesen.trim() || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Fehler beim Speichern.");
        return;
      }
      const updated: Reklamation = await res.json();
      setRek(updated);
      setSuccess("Gespeichert.");
      setTimeout(() => setSuccess(""), 3000);
    } catch {
      setError("Netzwerkfehler.");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(status: string) {
    if (!rek || rekId === null) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/reklamationen/${rekId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Fehler beim Statuswechsel.");
        return;
      }
      const updated: Reklamation = await res.json();
      setRek(updated);
    } catch {
      setError("Netzwerkfehler.");
    } finally {
      setSaving(false);
    }
  }

  async function handleLoesen() {
    if (!rek || rekId === null) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/reklamationen/${rekId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aktion: "loesen",
          loesung: loesungText.trim() || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Fehler beim Lösen.");
        return;
      }
      const updated: Reklamation = await res.json();
      setRek(updated);
      setShowLoesung(false);
    } catch {
      setError("Netzwerkfehler.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!rek || rekId === null) return;
    if (!confirm(`Reklamation ${rek.nummer} wirklich löschen?`)) return;
    try {
      const res = await fetch(`/api/reklamationen/${rekId}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Fehler beim Löschen.");
        return;
      }
      router.push("/reklamationen");
    } catch {
      setError("Netzwerkfehler.");
    }
  }

  if (loading) return <div className="p-8 text-center text-gray-500">Lade…</div>;
  if (error && !rek) return <div className="p-8 text-center text-red-600">{error}</div>;
  if (!rek) return null;

  const loesezeit = rek.geloestAm
    ? Math.round((new Date(rek.geloestAm).getTime() - new Date(rek.datum).getTime()) / 86400000)
    : null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/reklamationen" className="text-gray-500 hover:text-gray-700">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900 font-mono">{rek.nummer}</h1>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[rek.status] ?? "bg-gray-100 text-gray-700"}`}>
              {STATUS_LABEL[rek.status] ?? rek.status}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            Erfasst am {new Date(rek.datum).toLocaleDateString("de-DE")} ·{" "}
            <Link href={`/kunden/${rek.kunde.id}`} className="text-green-700 hover:underline">
              {rek.kunde.firma ?? rek.kunde.name}
            </Link>
          </p>
        </div>
      </div>

      {/* Status info */}
      {rek.geloestAm && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4 text-sm text-green-800">
          <span className="font-medium">Gelöst am:</span>{" "}
          {new Date(rek.geloestAm).toLocaleDateString("de-DE")}
          {loesezeit !== null && (
            <span className="ml-2 text-green-600">({loesezeit} Tag{loesezeit !== 1 ? "e" : ""})</span>
          )}
          {rek.loesung && <p className="mt-1 text-green-700">{rek.loesung}</p>}
        </div>
      )}

      {/* Lieferung hint */}
      {rek.lieferung && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 text-sm text-blue-800">
          Zugeordnete Lieferung:{" "}
          <Link href={`/lieferungen/${rek.lieferung.id}`} className="font-medium hover:underline">
            {rek.lieferung.rechnungNr ?? `Lieferung #${rek.lieferung.id}`}
          </Link>{" "}
          vom {new Date(rek.lieferung.datum).toLocaleDateString("de-DE")}
        </div>
      )}

      {/* Status workflow buttons */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Status-Aktionen</p>
        <div className="flex flex-wrap gap-2">
          {rek.status === "OFFEN" && (
            <>
              <button
                onClick={() => handleStatusChange("IN_BEARBEITUNG")}
                disabled={saving}
                className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                In Bearbeitung nehmen
              </button>
              <button
                onClick={() => handleStatusChange("GESCHLOSSEN")}
                disabled={saving}
                className="px-3 py-1.5 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                Schließen
              </button>
            </>
          )}
          {rek.status === "IN_BEARBEITUNG" && (
            <>
              <button
                onClick={() => setShowLoesung(!showLoesung)}
                disabled={saving}
                className="px-3 py-1.5 bg-green-700 text-white text-sm rounded-lg hover:bg-green-800 disabled:opacity-50 transition-colors"
              >
                Als gelöst markieren
              </button>
              <button
                onClick={() => handleStatusChange("GESCHLOSSEN")}
                disabled={saving}
                className="px-3 py-1.5 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                Schließen
              </button>
            </>
          )}
          {rek.status === "GELOEST" && (
            <>
              <button
                onClick={() => handleStatusChange("GESCHLOSSEN")}
                disabled={saving}
                className="px-3 py-1.5 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                Schließen
              </button>
              <button
                onClick={() => handleStatusChange("OFFEN")}
                disabled={saving}
                className="px-3 py-1.5 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Wieder öffnen
              </button>
            </>
          )}
          {rek.status === "GESCHLOSSEN" && (
            <button
              onClick={() => handleStatusChange("OFFEN")}
              disabled={saving}
              className="px-3 py-1.5 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              Wieder öffnen
            </button>
          )}
        </div>

        {/* Lösungs-Textarea */}
        {showLoesung && (
          <div className="mt-3 space-y-2">
            <label className="block text-sm font-medium text-gray-700">Lösung / Maßnahme</label>
            <textarea
              value={loesungText}
              onChange={(e) => setLoesungText(e.target.value)}
              rows={3}
              placeholder="Was wurde getan, um die Reklamation zu lösen?"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 resize-y"
            />
            <div className="flex gap-2">
              <button
                onClick={handleLoesen}
                disabled={saving}
                className="px-4 py-2 bg-green-700 text-white text-sm rounded-lg hover:bg-green-800 disabled:opacity-50"
              >
                Jetzt als gelöst markieren
              </button>
              <button
                onClick={() => setShowLoesung(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50"
              >
                Abbrechen
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit form */}
      <form onSubmit={handleSave} className="space-y-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">Reklamationsdaten</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Betreff <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={betreff}
              onChange={(e) => setBetreff(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Beschreibung <span className="text-red-500">*</span>
            </label>
            <textarea
              value={beschreibung}
              onChange={(e) => setBeschreibung(e.target.value)}
              required
              rows={5}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 resize-y"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kategorie</label>
              <select
                value={kategorie}
                onChange={(e) => setKategorie(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
              >
                {Object.entries(KATEGORIE_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Zugewiesen an</label>
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
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">{success}</div>
        )}

        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 disabled:opacity-50 transition-colors"
            >
              {saving ? "Speichern…" : "Änderungen speichern"}
            </button>
            <Link
              href="/reklamationen"
              className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Zurück
            </Link>
          </div>
          {rek.status === "OFFEN" && (
            <button
              type="button"
              onClick={handleDelete}
              className="px-4 py-2.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
            >
              Löschen
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
