"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SearchableSelect from "@/components/SearchableSelect";

interface Lieferant {
  id: number;
  name: string;
  firma: string | null;
}

interface Eingangsrechnung {
  id: number;
  nummer: string;
  datum: string;
  faelligAm: string | null;
  betrag: number;
  mwst: number;
  status: string;
  notiz: string | null;
  lieferantId: number;
  lieferant: { id: number; name: string; firma: string | null } | null;
}

type Status = "OFFEN" | "BEZAHLT" | "STORNIERT";

const STATUS_COLORS: Record<Status, string> = {
  OFFEN: "bg-yellow-100 text-yellow-800",
  BEZAHLT: "bg-green-100 text-green-800",
  STORNIERT: "bg-gray-100 text-gray-600",
};

const STATUS_LABELS: Record<Status, string> = {
  OFFEN: "Offen",
  BEZAHLT: "Bezahlt",
  STORNIERT: "Storniert",
};

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status as Status] ?? "bg-gray-100 text-gray-600";
  const label = STATUS_LABELS[status as Status] ?? status;
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>{label}</span>;
}

export default function EingangsrechnungDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [id, setId] = useState<string | null>(null);
  const [data, setData] = useState<Eingangsrechnung | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [lieferanten, setLieferanten] = useState<Lieferant[]>([]);

  const [form, setForm] = useState({
    lieferantId: "",
    nummer: "",
    datum: "",
    faelligAm: "",
    betrag: "",
    mwst: "19",
    notiz: "",
  });

  useEffect(() => {
    params.then((p) => setId(p.id));
  }, [params]);

  useEffect(() => {
    fetch("/api/lieferanten?limit=500")
      .then((r) => r.json())
      .then((d) => setLieferanten(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/eingangsrechnungen/${id}`)
      .then((r) => { if (!r.ok) throw new Error("not found"); return r.json(); })
      .then((d: Eingangsrechnung) => {
        setData(d);
        setForm({
          lieferantId: String(d.lieferantId),
          nummer: d.nummer,
          datum: d.datum.slice(0, 10),
          faelligAm: d.faelligAm ? d.faelligAm.slice(0, 10) : "",
          betrag: String(d.betrag),
          mwst: String(d.mwst),
          notiz: d.notiz ?? "",
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  const lieferantenOptions = lieferanten.map((l) => ({
    value: l.id,
    label: l.firma ?? l.name,
    sub: l.firma ? l.name : undefined,
  }));

  async function handleAktion(aktion: string) {
    if (!id) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/eingangsrechnungen/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aktion }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "Fehler."); return; }
      const updated: Eingangsrechnung = await res.json();
      setData(updated);
    } catch {
      setError("Fehler beim Aktualisieren.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !form.lieferantId || !form.nummer.trim() || !form.betrag) {
      setError("Bitte alle Pflichtfelder ausfüllen.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/eingangsrechnungen/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lieferantId: parseInt(form.lieferantId, 10),
          nummer: form.nummer.trim(),
          datum: form.datum,
          faelligAm: form.faelligAm || null,
          betrag: parseFloat(form.betrag),
          mwst: parseFloat(form.mwst),
          notiz: form.notiz.trim() || null,
        }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "Fehler."); return; }
      const updated: Eingangsrechnung = await res.json();
      setData(updated);
      setEditing(false);
    } catch {
      setError("Fehler beim Speichern.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!id || !confirm(`Eingangsrechnung "${data?.nummer}" wirklich löschen?`)) return;
    setDeleting(true);
    try {
      await fetch(`/api/eingangsrechnungen/${id}`, { method: "DELETE" });
      router.push("/eingangsrechnungen");
    } catch {
      setDeleting(false);
    }
  }

  if (loading) return <div className="p-8 text-gray-400">Lade…</div>;
  if (!data) return <div className="p-8 text-red-600">Eingangsrechnung nicht gefunden.</div>;

  const brutto = data.betrag * (1 + data.mwst / 100);
  const isOverdue = data.status === "OFFEN" && data.faelligAm && new Date(data.faelligAm) < new Date();

  return (
    <div className="max-w-2xl">
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/eingangsrechnungen" className="hover:text-green-700">Eingangsrechnungen</Link>
        <span>›</span>
        <span className="text-gray-900 font-medium">{data.nummer}</span>
      </nav>

      {!editing ? (
        <>
          <div className="flex items-start justify-between flex-wrap gap-3 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{data.nummer}</h1>
              <div className="flex items-center gap-2 mt-1">
                <StatusBadge status={data.status} />
                <span className="text-sm text-gray-500">
                  {new Date(data.datum).toLocaleDateString("de-DE")}
                </span>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {data.status === "OFFEN" && (
                <button
                  onClick={() => { if (confirm("Rechnung als bezahlt markieren?")) handleAktion("bezahlen"); }}
                  disabled={saving}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  Als bezahlt markieren
                </button>
              )}
              <button
                onClick={() => setEditing(true)}
                className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm font-medium rounded-lg transition-colors border border-blue-200"
              >
                Bearbeiten
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {deleting ? "Löschen…" : "Löschen"}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
              {error}
            </div>
          )}

          {isOverdue && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
              Diese Rechnung ist überfällig seit {new Date(data.faelligAm!).toLocaleDateString("de-DE")}.
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Lieferant</p>
                <p className="text-sm text-gray-800 mt-0.5">
                  {data.lieferant ? (
                    <Link href={`/lieferanten/${data.lieferant.id}`} className="text-green-700 hover:underline">
                      {data.lieferant.firma ?? data.lieferant.name}
                    </Link>
                  ) : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Rechnungsnummer</p>
                <p className="text-sm text-gray-800 mt-0.5">{data.nummer}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Rechnungsdatum</p>
                <p className="text-sm text-gray-800 mt-0.5">{new Date(data.datum).toLocaleDateString("de-DE")}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Fällig am</p>
                <p className={`text-sm mt-0.5 ${isOverdue ? "text-red-600 font-medium" : "text-gray-800"}`}>
                  {data.faelligAm ? new Date(data.faelligAm).toLocaleDateString("de-DE") : "—"}
                </p>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Netto</span>
                <span className="text-gray-900 font-medium">
                  {data.betrag.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
                </span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-gray-500">MwSt. ({data.mwst}%)</span>
                <span className="text-gray-900">
                  {(brutto - data.betrag).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
                </span>
              </div>
              <div className="flex justify-between text-sm font-bold mt-2 pt-2 border-t border-gray-100">
                <span className="text-gray-800">Brutto</span>
                <span className="text-gray-900">
                  {brutto.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
                </span>
              </div>
            </div>

            {data.notiz && (
              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Notiz</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{data.notiz}</p>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Eingangsrechnung bearbeiten</h1>
          <form onSubmit={handleSave} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 space-y-4">
            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lieferant <span className="text-red-500">*</span></label>
              <SearchableSelect
                options={lieferantenOptions}
                value={form.lieferantId}
                onChange={(v) => setForm({ ...form, lieferantId: v })}
                placeholder="Lieferant wählen…"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rechnungsnummer <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={form.nummer}
                onChange={(e) => setForm({ ...form, nummer: e.target.value })}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rechnungsdatum</label>
                <input
                  type="date"
                  value={form.datum}
                  onChange={(e) => setForm({ ...form, datum: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fällig am</label>
                <input
                  type="date"
                  value={form.faelligAm}
                  onChange={(e) => setForm({ ...form, faelligAm: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Betrag (netto) <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.betrag}
                  onChange={(e) => setForm({ ...form, betrag: e.target.value })}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">MwSt. %</label>
                <select
                  value={form.mwst}
                  onChange={(e) => setForm({ ...form, mwst: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                >
                  <option value="0">0%</option>
                  <option value="7">7%</option>
                  <option value="19">19%</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notiz (optional)</label>
              <textarea
                value={form.notiz}
                onChange={(e) => setForm({ ...form, notiz: e.target.value })}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 resize-none"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg disabled:opacity-60 transition-colors"
              >
                {saving ? "Speichern…" : "Speichern"}
              </button>
              <button
                type="button"
                onClick={() => { setEditing(false); setError(""); }}
                className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors"
              >
                Abbrechen
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
