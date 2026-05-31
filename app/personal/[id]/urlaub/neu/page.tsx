"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Params = { params: Promise<{ id: string }> };

function arbeitstage(von: string, bis: string): number {
  if (!von || !bis) return 0;
  const start = new Date(von);
  const end = new Date(bis);
  let tage = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) tage++;
    cur.setDate(cur.getDate() + 1);
  }
  return tage;
}

export default function UrlaubNeuPage({ params }: Params) {
  const router = useRouter();
  const [mitarbeiterId, setMitarbeiterId] = useState<string | null>(null);
  const [maName, setMaName] = useState("");
  const [von, setVon] = useState(new Date().toISOString().split("T")[0]);
  const [bis, setBis] = useState(new Date().toISOString().split("T")[0]);
  const [tage, setTage] = useState("1");
  const [notiz, setNotiz] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    params.then((p) => {
      setMitarbeiterId(p.id);
      fetch(`/api/personal/mitarbeiter/${p.id}`)
        .then((r) => r.ok ? r.json() : null)
        .then((d) => { if (d) setMaName(`${d.vorname} ${d.nachname}`); });
    });
  }, [params]);

  useEffect(() => {
    const at = arbeitstage(von, bis);
    if (at > 0) setTage(String(at));
  }, [von, bis]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!mitarbeiterId) return;
    setSaving(true);
    setError("");

    const res = await fetch("/api/personal/urlaubsantraege", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mitarbeiterId: parseInt(mitarbeiterId, 10),
        von,
        bis,
        tage: parseFloat(tage),
        notiz: notiz || null,
      }),
    });

    setSaving(false);
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Fehler");
      return;
    }
    router.push(`/personal/${mitarbeiterId}?tab=urlaub`);
  }

  if (!mitarbeiterId) return null;

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/personal/${mitarbeiterId}?tab=urlaub`} className="text-gray-400 hover:text-gray-600 text-sm">
          ← {maName || "Mitarbeiter"}
        </Link>
        <h1 className="text-xl font-bold">Urlaubsantrag</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border rounded-lg p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Von *</label>
            <input
              type="date"
              required
              value={von}
              onChange={(e) => setVon(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bis *</label>
            <input
              type="date"
              required
              value={bis}
              min={von}
              onChange={(e) => setBis(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Arbeitstage *</label>
          <input
            type="number"
            required
            step="0.5"
            min="0.5"
            value={tage}
            onChange={(e) => setTage(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none"
          />
          <p className="text-xs text-gray-400 mt-1">Automatisch berechnet (ohne Wochenenden). Bitte anpassen bei Feiertagen.</p>
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
          <Link href={`/personal/${mitarbeiterId}?tab=urlaub`} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">
            Abbrechen
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-800 disabled:opacity-50"
          >
            {saving ? "Speichern…" : "Antrag stellen"}
          </button>
        </div>
      </form>
    </div>
  );
}
