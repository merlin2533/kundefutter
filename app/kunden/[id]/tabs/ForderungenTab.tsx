"use client";

import { useEffect, useState } from "react";
import { formatEuro, formatDatum } from "@/lib/utils";
import * as Sentry from "@sentry/nextjs";

interface ForderungLieferungRef {
  id: number;
  rechnungNr: string | null;
  datum: string;
}

interface Forderung {
  id: number;
  betrag: number;
  grund: string;
  erledigt: boolean;
  createdAt: string;
  quelleLieferung: ForderungLieferungRef | null;
  erledigtBeiLieferung: ForderungLieferungRef | null;
}

export default function ForderungenTab({ kundeId }: { kundeId: number }) {
  const [forderungen, setForderungen] = useState<Forderung[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [betrag, setBetrag] = useState("");
  const [grund, setGrund] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState<number | null>(null);

  function load() {
    setLoading(true);
    fetch(`/api/kunden/${kundeId}/forderungen`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setForderungen(Array.isArray(d) ? d : []))
      .catch((err) => {
        Sentry.captureException(err);
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, [kundeId]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const betragNum = parseFloat(betrag.replace(",", "."));
    if (!Number.isFinite(betragNum) || betragNum <= 0) {
      setError("Ungültiger Betrag.");
      return;
    }
    if (!grund.trim()) {
      setError("Bitte einen Grund angeben.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/kunden/${kundeId}/forderungen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ betrag: betragNum, grund: grund.trim() }),
      });
      if (!res.ok) {
        const d = await res.json().catch((err) => {
          Sentry.captureException(err);
          return ({});
        });
        setError((d as { error?: string }).error ?? "Fehler beim Speichern.");
        return;
      }
      setShowAdd(false);
      setBetrag("");
      setGrund("");
      load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(forderungId: number) {
    if (!confirm("Diese Forderung wirklich löschen?")) return;
    setDeleting(forderungId);
    try {
      const res = await fetch(`/api/kunden/${kundeId}/forderungen?forderungId=${forderungId}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch((err) => {
          Sentry.captureException(err);
          return ({});
        });
        alert((d as { error?: string }).error ?? "Löschen fehlgeschlagen.");
        return;
      }
      load();
    } finally {
      setDeleting(null);
    }
  }

  const offene = forderungen.filter((f) => !f.erledigt);
  const erledigte = forderungen.filter((f) => f.erledigt);
  const summeOffen = offene.reduce((s, f) => s + f.betrag, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Alte Forderungen</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Offene Restdifferenzen (z.B. aus einer Unterzahlung) — werden automatisch als
            zusätzliche Position auf die nächste Rechnung dieses Kunden übernommen.
          </p>
        </div>
        <button
          onClick={() => { setShowAdd(true); setError(""); }}
          className="text-sm px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors shrink-0"
        >
          + Forderung erfassen
        </button>
      </div>

      {showAdd && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <h4 className="text-sm font-semibold mb-3">Neue Forderung</h4>
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Betrag (€) <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={betrag}
                  onChange={(e) => setBetrag(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Grund <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={grund}
                  onChange={(e) => setGrund(e.target.value)}
                  placeholder="z.B. Unterzahlung Rechnung RE-2026-0123 vom 30.7.2026"
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-60"
              >
                {saving ? "…" : "Speichern"}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">Lade…</p>
      ) : (
        <>
          {offene.length === 0 ? (
            <p className="text-sm text-gray-400">Keine offenen Forderungen.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">Grund</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">Erfasst am</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-600">Betrag</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {offene.map((f) => (
                    <tr key={f.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5">
                        {f.grund}
                        {f.quelleLieferung && (
                          <span className="text-xs text-gray-400 ml-1">
                            ({f.quelleLieferung.rechnungNr ?? `Lieferung #${f.quelleLieferung.id}`})
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-gray-500">{formatDatum(f.createdAt)}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold">{formatEuro(f.betrag)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => handleDelete(f.id)}
                          disabled={deleting === f.id}
                          className="text-red-500 hover:text-red-700 text-xs disabled:opacity-50"
                        >
                          {deleting === f.id ? "…" : "Löschen"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200">
                    <td className="px-4 py-2 font-semibold" colSpan={2}>Summe offen</td>
                    <td className="px-4 py-2 text-right font-mono font-semibold">{formatEuro(summeOffen)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {erledigte.length > 0 && (
            <div className="mt-6">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Bereits abgerechnet</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium text-gray-600">Grund</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-600">Übernommen in</th>
                      <th className="text-right px-4 py-2 font-medium text-gray-600">Betrag</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-500">
                    {erledigte.map((f) => (
                      <tr key={f.id}>
                        <td className="px-4 py-2.5">{f.grund}</td>
                        <td className="px-4 py-2.5">
                          {f.erledigtBeiLieferung?.rechnungNr ?? (f.erledigtBeiLieferung ? `Lieferung #${f.erledigtBeiLieferung.id}` : "—")}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono">{formatEuro(f.betrag)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
