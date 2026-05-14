"use client";

import React, { useCallback, useEffect, useState } from "react";

interface AufgabeItem {
  id: number;
  betreff: string;
  faelligAm: string | null;
  erledigt: boolean;
  prioritaet: string;
  typ: string;
  tags: string;
}

const PRIO_BADGE: Record<string, string> = {
  kritisch: "bg-red-100 text-red-800",
  hoch: "bg-orange-100 text-orange-800",
  normal: "bg-blue-100 text-blue-700",
  niedrig: "bg-gray-100 text-gray-600",
};

export default function AufgabenTab({ kundeId }: { kundeId: number }) {
  const [aufgaben, setAufgaben] = useState<AufgabeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [betreff, setBetreff] = useState("");
  const [faelligAm, setFaelligAm] = useState("");
  const [prioritaet, setPrioritaet] = useState("normal");
  const [typ, setTyp] = useState("aufgabe");
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState<number | null>(null);

  const fetchAufgaben = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/aufgaben?kundeId=${kundeId}&status=alle`);
    const data = await res.json();
    setAufgaben(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [kundeId]);

  useEffect(() => { fetchAufgaben(); }, [fetchAufgaben]);

  async function createAufgabe(e: React.FormEvent) {
    e.preventDefault();
    if (!betreff.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/aufgaben", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ betreff: betreff.trim(), faelligAm: faelligAm || null, prioritaet, typ, kundeId }),
      });
      if (!res.ok) return;
      setBetreff(""); setFaelligAm(""); setPrioritaet("normal"); setTyp("aufgabe");
      setShowForm(false);
      fetchAufgaben();
    } finally {
      setSaving(false);
    }
  }

  async function toggleErledigt(a: AufgabeItem) {
    setToggling(a.id);
    try {
      const res = await fetch(`/api/aufgaben/${a.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ erledigt: !a.erledigt }),
      });
      if (res.ok) await fetchAufgaben();
    } finally {
      setToggling(null);
    }
  }

  const offen = aufgaben.filter((a) => !a.erledigt);
  const erledigt = aufgaben.filter((a) => a.erledigt);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-900">
          Aufgaben
          {offen.length > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-orange-100 text-orange-800 rounded-full text-xs font-medium">{offen.length} offen</span>
          )}
        </h3>
        <div className="flex gap-2">
          <a href={`/aufgaben/neu?kundeId=${kundeId}`} className="text-xs text-green-700 hover:underline">
            Detailformular →
          </a>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
          >
            + Schnell-Aufgabe
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={createAufgabe} className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-3">
          <div>
            <input
              type="text"
              value={betreff}
              onChange={(e) => setBetreff(e.target.value)}
              placeholder="Betreff *"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <select value={typ} onChange={(e) => setTyp(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-green-500">
              <option value="aufgabe">Aufgabe</option>
              <option value="anruf">Anruf</option>
              <option value="besuch">Besuch</option>
              <option value="email">E-Mail</option>
            </select>
            <select value={prioritaet} onChange={(e) => setPrioritaet(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-green-500">
              <option value="niedrig">Niedrig</option>
              <option value="normal">Normal</option>
              <option value="hoch">Hoch</option>
              <option value="kritisch">Kritisch</option>
            </select>
            <input type="date" value={faelligAm} onChange={(e) => setFaelligAm(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving || !betreff.trim()} className="bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50 transition-colors">
              {saving ? "…" : "Erstellen"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-700 hover:bg-gray-100 transition-colors">
              Abbrechen
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">Lade Aufgaben…</p>
      ) : aufgaben.length === 0 ? (
        <p className="text-sm text-gray-400">Noch keine Aufgaben für diesen Kunden.</p>
      ) : (
        <div className="space-y-1">
          {[...offen, ...erledigt].map((a) => {
            const ueberfaellig = !a.erledigt && a.faelligAm && new Date(a.faelligAm) < new Date();
            return (
              <div key={a.id} className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${a.erledigt ? "opacity-50 bg-gray-50 border-gray-100" : "bg-white border-gray-200 hover:border-green-300"}`}>
                <button
                  onClick={() => toggleErledigt(a)}
                  disabled={toggling === a.id}
                  className={`mt-0.5 w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors disabled:opacity-50 ${a.erledigt ? "bg-green-500 border-green-500" : "border-gray-400 hover:border-green-500"}`}
                >
                  {a.erledigt && <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M2 6l3 3 5-5" /></svg>}
                </button>
                <div className="flex-1 min-w-0">
                  <span className={`text-sm font-medium ${a.erledigt ? "line-through text-gray-400" : "text-gray-900"}`}>{a.betreff}</span>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <span className={`px-1.5 py-0.5 rounded text-xs capitalize ${PRIO_BADGE[a.prioritaet] ?? "bg-gray-100 text-gray-600"}`}>{a.prioritaet}</span>
                    {a.faelligAm && (
                      <span className={`text-xs ${ueberfaellig ? "text-red-600 font-medium" : "text-gray-500"}`}>
                        {ueberfaellig ? "⚠ " : ""}Fällig: {new Date(a.faelligAm).toLocaleDateString("de-DE")}
                      </span>
                    )}
                  </div>
                </div>
                <a href={`/aufgaben/${a.id}`} className="text-xs text-green-700 hover:underline flex-shrink-0">Bearb.</a>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
