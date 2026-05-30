"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { KundeSchlag, inputClsSchlag } from "../_shared";

interface DuengebedarfEintrag {
  id: number;
  schlagId: number;
  jahr: number;
  fruchtart: string;
  ertragsZiel: number | null;
  vorfrucht: string | null;
  nBedarf: number;
  pBedarf: number;
  kBedarf: number;
  mgBedarf: number | null;
  notiz: string | null;
  berechnetAm: string;
  parameter?: string | null; // JSON: { eingaben, rechenweg }
}

const heute = new Date();

export default function DuengebedarfTab({ kundeId }: { kundeId: number }) {
  const [schlaegte, setSchlaegte] = useState<KundeSchlag[]>([]);
  const [eintraege, setEintraege] = useState<Record<number, DuengebedarfEintrag[]>>({});
  const [fruchtarten, setFruchtarten] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [formSchlagId, setFormSchlagId] = useState<number | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState<number | null>(null);
  const [form, setForm] = useState({
    jahr: String(heute.getFullYear()),
    fruchtart: "",
    ertragsZiel: "",
    vorfrucht: "",
    nMin: "",
    zwischenfruchtAngebaut: false,
    notiz: "",
  });

  const ladeEintraege = useCallback(async (schlagList: KundeSchlag[]) => {
    const map: Record<number, DuengebedarfEintrag[]> = {};
    await Promise.all(
      schlagList.map(async (sl) => {
        const res = await fetch(`/api/duengebedarf?schlagId=${sl.id}`);
        const data = res.ok ? await res.json() : [];
        map[sl.id] = Array.isArray(data) ? data : [];
      })
    );
    setEintraege(map);
  }, []);

  const ladeAlles = useCallback(async () => {
    setLoading(true);
    try {
      const [schlagRes, fruchtRes] = await Promise.all([
        fetch(`/api/kunden/${kundeId}/schlaegte`),
        fetch("/api/duengebedarf?fruchtarten=1"),
      ]);
      const schlagData = schlagRes.ok ? await schlagRes.json() : [];
      const fruchtData = fruchtRes.ok ? await fruchtRes.json() : [];
      const schlagList: KundeSchlag[] = Array.isArray(schlagData) ? schlagData : [];
      setSchlaegte(schlagList);
      setFruchtarten(Array.isArray(fruchtData) ? fruchtData : []);
      await ladeEintraege(schlagList);
    } finally {
      setLoading(false);
    }
  }, [kundeId, ladeEintraege]);

  useEffect(() => {
    ladeAlles();
  }, [ladeAlles]);

  function oeffneForm(sl: KundeSchlag) {
    setFormSchlagId(sl.id);
    setEditId(null);
    setError("");
    setForm({
      jahr: String(heute.getFullYear()),
      fruchtart: sl.fruchtart ?? "",
      ertragsZiel: "",
      vorfrucht: sl.vorfrucht ?? "",
      nMin: "",
      zwischenfruchtAngebaut: false,
      notiz: "",
    });
  }

  function bearbeiten(eintrag: DuengebedarfEintrag) {
    let f = {
      jahr: String(eintrag.jahr),
      fruchtart: eintrag.fruchtart,
      ertragsZiel: eintrag.ertragsZiel != null ? String(eintrag.ertragsZiel) : "",
      vorfrucht: eintrag.vorfrucht ?? "",
      nMin: "",
      zwischenfruchtAngebaut: false,
      notiz: eintrag.notiz ?? "",
    };
    if (eintrag.parameter) {
      try {
        const parsed = JSON.parse(eintrag.parameter);
        const e = parsed.eingaben ?? {};
        f = {
          ...f,
          nMin: e.nMin != null ? String(e.nMin) : "",
          zwischenfruchtAngebaut: !!e.zwischenfruchtAngebaut,
        };
      } catch { /* ignore */ }
    }
    setForm(f);
    setFormSchlagId(eintrag.schlagId);
    setEditId(eintrag.id);
    setError("");
  }

  async function berechnen(e: React.FormEvent) {
    e.preventDefault();
    if (formSchlagId == null) return;
    if (!form.fruchtart.trim()) {
      setError("Fruchtart ist erforderlich.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        schlagId: formSchlagId,
        jahr: parseInt(form.jahr, 10) || heute.getFullYear(),
        fruchtart: form.fruchtart.trim(),
        ertragsZiel: form.ertragsZiel ? Number(form.ertragsZiel) : null,
        vorfrucht: form.vorfrucht.trim() || null,
        nMin: form.nMin ? Number(form.nMin) : null,
        zwischenfruchtAngebaut: form.zwischenfruchtAngebaut,
        notiz: form.notiz.trim() || null,
        speichern: true,
      };
      const url = editId != null ? `/api/duengebedarf?id=${editId}` : "/api/duengebedarf";
      const method = editId != null ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Berechnung fehlgeschlagen.");
        return;
      }
      setFormSchlagId(null);
      setEditId(null);
      await ladeEintraege(schlaegte);
    } finally {
      setSaving(false);
    }
  }

  async function loeschen(id: number) {
    if (!confirm("Diesen Eintrag wirklich löschen?")) return;
    setDeleting(id);
    try {
      await fetch(`/api/duengebedarf?id=${id}`, { method: "DELETE" });
      if (editId === id) { setFormSchlagId(null); setEditId(null); }
      await ladeEintraege(schlaegte);
    } finally {
      setDeleting(null);
    }
  }

  if (loading) return <p className="text-sm text-gray-400">Lade Düngebedarf…</p>;

  if (schlaegte.length === 0) {
    return (
      <p className="text-sm text-gray-400">
        Noch keine Schläge erfasst. Lege zuerst im Tab{" "}
        <span className="font-medium">Schlagkartei</span> Schläge an, um den
        Düngebedarf zu ermitteln.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Düngebedarfsermittlung je Schlag (DüV Anlage 4). Versorgungsklassen werden
        aus der jüngsten Bodenprobe des Schlags abgeleitet, sofern vorhanden.
      </p>

      {schlaegte.map((sl) => {
        const liste = eintraege[sl.id] ?? [];
        return (
          <div key={sl.id} className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between gap-3">
              <div>
                <span className="font-medium text-gray-900">{sl.name}</span>
                <span className="text-xs text-gray-500 ml-2">
                  {sl.flaeche} ha{sl.fruchtart ? ` · ${sl.fruchtart}` : ""}
                </span>
              </div>
              <button
                onClick={() => {
                  if (formSchlagId === sl.id) { setFormSchlagId(null); setEditId(null); }
                  else oeffneForm(sl);
                }}
                className="text-sm px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors whitespace-nowrap"
              >
                {formSchlagId === sl.id ? "Abbrechen" : "+ Düngebedarf berechnen"}
              </button>
            </div>

            {formSchlagId === sl.id && (
              <form onSubmit={berechnen} className={`p-4 border-b border-gray-100 space-y-3 ${editId != null ? "bg-blue-50" : "bg-gray-50"}`}>
                {error && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Jahr</label>
                    <input type="number" min="2000" max="2100" value={form.jahr}
                      onChange={(e) => setForm({ ...form, jahr: e.target.value })} className={inputClsSchlag} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Fruchtart <span className="text-red-500">*</span></label>
                    <input type="text" list="duev-fruchtarten" value={form.fruchtart}
                      onChange={(e) => setForm({ ...form, fruchtart: e.target.value })} required className={inputClsSchlag} placeholder="z.B. Winterweizen" />
                    <datalist id="duev-fruchtarten">
                      {fruchtarten.map((f) => <option key={f} value={f} />)}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Ertragsziel (dt/ha)</label>
                    <input type="number" step="0.1" min="0" value={form.ertragsZiel}
                      onChange={(e) => setForm({ ...form, ertragsZiel: e.target.value })} className={inputClsSchlag} placeholder="optional" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Vorfrucht</label>
                    <input type="text" list="duev-fruchtarten" value={form.vorfrucht}
                      onChange={(e) => setForm({ ...form, vorfrucht: e.target.value })} className={inputClsSchlag} placeholder="optional" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">N<sub>min</sub> (kg/ha)</label>
                    <input type="number" step="0.1" min="0" value={form.nMin}
                      onChange={(e) => setForm({ ...form, nMin: e.target.value })} className={inputClsSchlag} placeholder="optional, sonst aus Bodenprobe" />
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input type="checkbox" checked={form.zwischenfruchtAngebaut}
                        onChange={(e) => setForm({ ...form, zwischenfruchtAngebaut: e.target.checked })} />
                      Zwischenfrucht angebaut
                    </label>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Notiz</label>
                    <input type="text" value={form.notiz}
                      onChange={(e) => setForm({ ...form, notiz: e.target.value })} className={inputClsSchlag} placeholder="optional" />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => { setFormSchlagId(null); setEditId(null); }}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Abbrechen</button>
                  <button type="submit" disabled={saving}
                    className="px-4 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-60">
                    {saving ? "Speichere…" : editId != null ? "Änderungen speichern" : "Berechnen & speichern"}
                  </button>
                </div>
              </form>
            )}

            {liste.length === 0 ? (
              <p className="px-4 py-3 text-sm text-gray-400">Noch kein Düngebedarf ermittelt.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Jahr</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Fruchtart</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">N</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">P₂O₅</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">K₂O</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Mg</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {liste.map((e) => (
                    <tr key={e.id} className={`hover:bg-gray-50 ${editId === e.id ? "bg-blue-50" : ""}`}>
                      <td className="px-4 py-2 text-gray-700">{e.jahr}</td>
                      <td className="px-4 py-2 text-gray-900">
                        {e.fruchtart}
                        {e.notiz && <div className="text-xs text-gray-400">{e.notiz}</div>}
                      </td>
                      <td className="px-4 py-2 text-right font-mono">{Math.round(e.nBedarf)}</td>
                      <td className="px-4 py-2 text-right font-mono">{Math.round(e.pBedarf)}</td>
                      <td className="px-4 py-2 text-right font-mono">{Math.round(e.kBedarf)}</td>
                      <td className="px-4 py-2 text-right font-mono">{e.mgBedarf != null ? Math.round(e.mgBedarf) : "—"}</td>
                      <td className="px-4 py-2 text-right whitespace-nowrap">
                        <button
                          onClick={() => bearbeiten(e)}
                          className="text-xs text-blue-600 hover:text-blue-800 mr-2"
                        >
                          Bearbeiten
                        </button>
                        <button
                          onClick={() => loeschen(e.id)}
                          disabled={deleting === e.id}
                          className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40"
                        >
                          {deleting === e.id ? "…" : "Löschen"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}

      <p className="text-xs text-gray-400">
        Hinweis: Werte sind DüV-orientierte Bedarfswerte in kg/ha. Die ausführliche
        interaktive Berechnung steht unter{" "}
        <Link href="/duengebedarf" className="underline hover:text-gray-600">Düngebedarfsermittlung</Link>{" "}
        zur Verfügung.
      </p>
    </div>
  );
}
