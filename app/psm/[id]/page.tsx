"use client";
import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SearchableSelect from "@/components/SearchableSelect";

interface Kunde {
  id: number;
  name: string;
  firma: string | null;
}

interface Schlag {
  id: number;
  name: string;
  flaeche: number | null;
  fruchtart: string | null;
}

interface PSMAusbringung {
  id: number;
  datum: string;
  mittel: string;
  wirkstoff: string | null;
  menge: number;
  einheit: string;
  kultur: string | null;
  flaeche: number | null;
  anwendungsgrund: string | null;
  wartezeit: number | null;
  notiz: string | null;
  kundeId: number;
  schlagId: number | null;
  kunde: { id: number; name: string; firma: string | null } | null;
  schlag: { id: number; name: string } | null;
}

const EINHEITEN = ["l/ha", "kg/ha", "ml/ha", "g/ha"];

function PSMDetailInner({ id }: { id: string }) {
  const router = useRouter();
  const [data, setData] = useState<PSMAusbringung | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [kunden, setKunden] = useState<Kunde[]>([]);
  const [schlaegte, setSchlaegte] = useState<Schlag[]>([]);

  const [form, setForm] = useState({
    kundeId: "",
    schlagId: "",
    datum: "",
    mittel: "",
    wirkstoff: "",
    menge: "",
    einheit: "l/ha",
    kultur: "",
    flaeche: "",
    anwendungsgrund: "",
    wartezeit: "",
    notiz: "",
  });

  useEffect(() => {
    fetch("/api/kunden?limit=500")
      .then((r) => r.json())
      .then((d) => setKunden(Array.isArray(d) ? d : (d.kunden ?? [])))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`/api/psm/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("not found");
        return r.json();
      })
      .then((d: PSMAusbringung) => {
        setData(d);
        setForm({
          kundeId: String(d.kundeId),
          schlagId: d.schlagId ? String(d.schlagId) : "",
          datum: d.datum.slice(0, 10),
          mittel: d.mittel,
          wirkstoff: d.wirkstoff ?? "",
          menge: String(d.menge),
          einheit: d.einheit,
          kultur: d.kultur ?? "",
          flaeche: d.flaeche != null ? String(d.flaeche) : "",
          anwendungsgrund: d.anwendungsgrund ?? "",
          wartezeit: d.wartezeit != null ? String(d.wartezeit) : "",
          notiz: d.notiz ?? "",
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!form.kundeId) { setSchlaegte([]); return; }
    fetch(`/api/kunden/${form.kundeId}/schlaegte`)
      .then((r) => r.json())
      .then((d) => setSchlaegte(Array.isArray(d) ? d : []))
      .catch(() => setSchlaegte([]));
  }, [form.kundeId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.kundeId || !form.mittel.trim() || !form.menge || !form.datum) {
      setError("Bitte alle Pflichtfelder ausfüllen.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const body = {
        kundeId: parseInt(form.kundeId, 10),
        schlagId: form.schlagId ? parseInt(form.schlagId, 10) : null,
        datum: form.datum,
        mittel: form.mittel.trim(),
        wirkstoff: form.wirkstoff.trim() || null,
        menge: parseFloat(form.menge),
        einheit: form.einheit,
        kultur: form.kultur.trim() || null,
        flaeche: form.flaeche ? parseFloat(form.flaeche) : null,
        anwendungsgrund: form.anwendungsgrund.trim() || null,
        wartezeit: form.wartezeit ? parseInt(form.wartezeit, 10) : null,
        notiz: form.notiz.trim() || null,
      };
      const res = await fetch(`/api/psm/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Fehler beim Speichern.");
        return;
      }
      const updated: PSMAusbringung = await res.json();
      setData(updated);
      setEditing(false);
    } catch {
      setError("Fehler beim Speichern.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`PSM-Ausbringung "${data?.mittel}" wirklich löschen?`)) return;
    setDeleting(true);
    try {
      await fetch(`/api/psm/${id}`, { method: "DELETE" });
      router.push("/psm");
    } catch {
      setDeleting(false);
    }
  }

  const kundenOptions = kunden.map((k) => ({
    value: k.id,
    label: k.firma ?? k.name,
    sub: k.firma ? k.name : undefined,
  }));

  const schlagOptions = schlaegte.map((s) => ({
    value: s.id,
    label: s.name,
    sub: s.fruchtart ?? undefined,
  }));

  if (loading) return <div className="container mx-auto px-4 py-8 text-gray-400">Lade…</div>;
  if (!data) return <div className="container mx-auto px-4 py-8 text-red-600">Ausbringung nicht gefunden.</div>;

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/psm" className="text-gray-500 hover:text-gray-700 text-sm">← Zurück</Link>
        <h1 className="text-2xl font-bold text-gray-900">PSM-Ausbringung</h1>
      </div>

      {!editing ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setEditing(true)}
              className="text-sm px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
            >
              Bearbeiten
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-sm px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {deleting ? "Löschen…" : "Löschen"}
            </button>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Datum</p>
              <p className="text-sm text-gray-800 mt-0.5">{new Date(data.datum).toLocaleDateString("de-DE")}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Kunde</p>
              <p className="text-sm text-gray-800 mt-0.5">
                {data.kunde ? (
                  <Link href={`/kunden/${data.kunde.id}`} className="text-green-700 hover:underline">
                    {data.kunde.firma ?? data.kunde.name}
                  </Link>
                ) : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Schlag</p>
              <p className="text-sm text-gray-800 mt-0.5">{data.schlag?.name ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Mittel</p>
              <p className="text-sm font-semibold text-gray-900 mt-0.5">{data.mittel}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Wirkstoff</p>
              <p className="text-sm text-gray-800 mt-0.5">{data.wirkstoff ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Menge</p>
              <p className="text-sm text-gray-800 mt-0.5">{data.menge} {data.einheit}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Kultur</p>
              <p className="text-sm text-gray-800 mt-0.5">{data.kultur ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Fläche (ha)</p>
              <p className="text-sm text-gray-800 mt-0.5">{data.flaeche != null ? data.flaeche : "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Anwendungsgrund</p>
              <p className="text-sm text-gray-800 mt-0.5">{data.anwendungsgrund ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Wartezeit (Tage)</p>
              <p className="text-sm text-gray-800 mt-0.5">{data.wartezeit != null ? data.wartezeit : "—"}</p>
            </div>
          </div>
          {data.notiz && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Notiz</p>
              <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">{data.notiz}</p>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={handleSave} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Kunde <span className="text-red-500">*</span>
            </label>
            <SearchableSelect
              options={kundenOptions}
              value={form.kundeId}
              onChange={(v) => setForm({ ...form, kundeId: v, schlagId: "" })}
              placeholder="Kunde auswählen…"
              required
            />
          </div>

          {form.kundeId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Schlag (optional)</label>
              <SearchableSelect
                options={schlagOptions}
                value={form.schlagId}
                onChange={(v) => setForm({ ...form, schlagId: v })}
                placeholder="— Kein Schlag —"
                allowClear
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Datum <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={form.datum}
              onChange={(e) => setForm({ ...form, datum: e.target.value })}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mittel / Präparatname <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.mittel}
              onChange={(e) => setForm({ ...form, mittel: e.target.value })}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Wirkstoff (optional)</label>
            <input
              type="text"
              value={form.wirkstoff}
              onChange={(e) => setForm({ ...form, wirkstoff: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Menge <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={form.menge}
                onChange={(e) => setForm({ ...form, menge: e.target.value })}
                required
                min="0"
                step="0.01"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Einheit</label>
              <select
                value={form.einheit}
                onChange={(e) => setForm({ ...form, einheit: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {EINHEITEN.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kultur (optional)</label>
              <input
                type="text"
                value={form.kultur}
                onChange={(e) => setForm({ ...form, kultur: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fläche (ha, optional)</label>
              <input
                type="number"
                value={form.flaeche}
                onChange={(e) => setForm({ ...form, flaeche: e.target.value })}
                min="0"
                step="0.01"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Anwendungsgrund (optional)</label>
            <input
              type="text"
              value={form.anwendungsgrund}
              onChange={(e) => setForm({ ...form, anwendungsgrund: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Wartezeit (Tage, optional)</label>
            <input
              type="number"
              value={form.wartezeit}
              onChange={(e) => setForm({ ...form, wartezeit: e.target.value })}
              min="0"
              step="1"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notiz (optional)</label>
            <textarea
              value={form.notiz}
              onChange={(e) => setForm({ ...form, notiz: e.target.value })}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-800 disabled:opacity-60 transition-colors"
            >
              {saving ? "Speichern…" : "Speichern"}
            </button>
            <button
              type="button"
              onClick={() => { setEditing(false); setError(""); }}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
            >
              Abbrechen
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default function PSMDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    params.then((p) => setId(p.id));
  }, [params]);
  if (!id) return <div className="container mx-auto px-4 py-8 text-gray-400">Lade…</div>;
  return (
    <Suspense fallback={<div className="container mx-auto px-4 py-8 text-gray-400">Lade…</div>}>
      <PSMDetailInner id={id} />
    </Suspense>
  );
}
