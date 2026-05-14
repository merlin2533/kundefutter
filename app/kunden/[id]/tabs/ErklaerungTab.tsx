"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ToastProvider";

interface SprengstoffErklaerung {
  id: number;
  jahr: number;
  datum: string;
  notiz?: string | null;
  dokumentPfad?: string | null;
  createdAt: string;
}

export default function ErklaerungTab({ kundeId }: { kundeId: number }) {
  const [erklaerungen, setErklaerungen] = useState<SprengstoffErklaerung[]>([]);
  const [loading, setLoading] = useState(true);
  const [formJahr, setFormJahr] = useState(String(new Date().getFullYear()));
  const [formDatum, setFormDatum] = useState(new Date().toISOString().slice(0, 10));
  const [formNotiz, setFormNotiz] = useState("");
  const [formFile, setFormFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { showToast } = useToast();

  const load = async () => {
    setLoading(true);
    const r = await fetch(`/api/kunden/${kundeId}/erklaerungen`);
    const data = r.ok ? await r.json() : [];
    setErklaerungen(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [kundeId]);

  const save = async () => {
    const jahr = parseInt(formJahr, 10);
    if (!jahr || jahr < 2000) { setError("Bitte gültiges Jahr eingeben"); return; }
    if (!formDatum) { setError("Bitte Datum eingeben"); return; }
    setSaving(true); setError("");
    try {
      let res: Response;
      if (formFile) {
        const fd = new FormData();
        fd.append("jahr", String(jahr));
        fd.append("datum", formDatum);
        fd.append("notiz", formNotiz);
        fd.append("dokument", formFile);
        res = await fetch(`/api/kunden/${kundeId}/erklaerungen`, { method: "POST", body: fd });
      } else {
        res = await fetch(`/api/kunden/${kundeId}/erklaerungen`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jahr, datum: formDatum, notiz: formNotiz }),
        });
      }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Fehler beim Speichern");
      } else {
        showToast("Erklärung gespeichert", "success");
        setFormNotiz(""); setFormFile(null);
        await load();
      }
    } finally {
      setSaving(false);
    }
  };

  const del = async (id: number) => {
    if (!confirm("Erklärung löschen?")) return;
    const r = await fetch(`/api/kunden/${kundeId}/erklaerungen/${id}`, { method: "DELETE" });
    if (r.ok) { showToast("Gelöscht", "success"); await load(); }
  };

  const aktuellesJahr = new Date().getFullYear();
  const hatAktuellesJahr = erklaerungen.some((e) => e.jahr === aktuellesJahr);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">Sprengstoffvorläufer-Erklärungen</h3>
        <p className="text-sm text-gray-500">
          Gemäß EU-VO 2019/1148 ist jährlich eine Erklärung des Käufers für beschränkte Stoffe (z.B. KAS &gt;16 % N, H₂O₂ &gt;12 %) einzuholen.
        </p>
      </div>

      {!hatAktuellesJahr && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
          <span className="text-lg leading-none">⚠</span>
          <span>Für {aktuellesJahr} liegt noch <strong>keine gültige Erklärung</strong> vor.</span>
        </div>
      )}

      {/* Formular neue Erklärung */}
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
        <h4 className="text-sm font-medium text-gray-700">Neue Erklärung erfassen</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Jahr</label>
            <input
              type="number" min={2000} max={2100}
              value={formJahr}
              onChange={(e) => setFormJahr(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Datum der Unterzeichnung</label>
            <input
              type="date"
              value={formDatum}
              onChange={(e) => setFormDatum(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notiz</label>
            <input
              type="text"
              value={formNotiz}
              onChange={(e) => setFormNotiz(e.target.value)}
              placeholder="optional"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Dokument hochladen (optional, PDF/Bild)</label>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={(e) => setFormFile(e.target.files?.[0] ?? null)}
            className="text-sm text-gray-600"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 text-sm rounded-lg bg-green-800 hover:bg-green-700 text-white font-medium disabled:opacity-60"
        >
          {saving ? "Speichern…" : "Erklärung speichern"}
        </button>
      </div>

      {/* Liste */}
      {loading ? (
        <p className="text-sm text-gray-400">Lade…</p>
      ) : erklaerungen.length === 0 ? (
        <p className="text-sm text-gray-500">Noch keine Erklärungen erfasst.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left px-4 py-2 font-medium text-gray-600">Jahr</th>
              <th className="text-left px-4 py-2 font-medium text-gray-600 hidden sm:table-cell">Unterzeichnet am</th>
              <th className="text-left px-4 py-2 font-medium text-gray-600 hidden md:table-cell">Notiz</th>
              <th className="text-left px-4 py-2 font-medium text-gray-600 hidden sm:table-cell">Dokument</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {erklaerungen.map((e) => (
              <tr key={e.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-2.5 font-medium">
                  {e.jahr}
                  {e.jahr === aktuellesJahr && (
                    <span className="ml-2 px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded">✓ aktuell</span>
                  )}
                </td>
                <td className="px-4 py-2.5 hidden sm:table-cell text-gray-600">
                  {new Date(e.datum).toLocaleDateString("de-DE")}
                </td>
                <td className="px-4 py-2.5 hidden md:table-cell text-gray-500">{e.notiz ?? "—"}</td>
                <td className="px-4 py-2.5 hidden sm:table-cell">
                  {e.dokumentPfad ? (
                    <a href={e.dokumentPfad} target="_blank" rel="noopener noreferrer" className="text-green-700 hover:underline text-xs">
                      Dokument öffnen
                    </a>
                  ) : <span className="text-gray-400 text-xs">—</span>}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    onClick={() => del(e.id)}
                    className="text-red-500 hover:text-red-700 text-xs"
                  >
                    Löschen
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
