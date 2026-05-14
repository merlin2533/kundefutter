"use client";

import React, { useEffect, useState } from "react";

interface Aktivitaet {
  id: number;
  typ: string;
  betreff: string;
  inhalt?: string | null;
  datum: string;
  erledigt: boolean;
  faelligAm?: string | null;
}

const TYP_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  besuch:  { label: "Besuch",  color: "bg-green-100 text-green-800",  icon: "🏠" },
  anruf:   { label: "Anruf",   color: "bg-blue-100 text-blue-800",    icon: "📞" },
  email:   { label: "E-Mail",  color: "bg-yellow-100 text-yellow-800", icon: "✉️" },
  notiz:   { label: "Notiz",   color: "bg-gray-100 text-gray-700",    icon: "📝" },
  aufgabe: { label: "Aufgabe", color: "bg-orange-100 text-orange-800", icon: "✅" },
};

const QUICK_FORM_DEFAULT = { typ: "anruf", betreff: "", inhalt: "" };

export default function CrmTab({ kundeId, autoOpen }: { kundeId: number; autoOpen?: boolean }) {
  const [items, setItems] = useState<Aktivitaet[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [filter, setFilter] = useState<"alle" | "offen">("alle");
  const [showForm, setShowForm] = useState(autoOpen ?? false);
  const [form, setForm] = useState(QUICK_FORM_DEFAULT);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  async function fetch_() {
    setLoading(true);
    const res = await fetch(`/api/kunden/aktivitaeten?kundeId=${kundeId}`);
    const data = await res.json();
    setItems(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { fetch_(); }, [kundeId]);

  async function toggleErledigt(item: Aktivitaet) {
    await fetch(`/api/kunden/aktivitaeten?id=${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ erledigt: !item.erledigt }),
    });
    fetch_();
  }

  async function handleDelete(id: number) {
    setDeleting(id);
    try {
      await fetch(`/api/kunden/aktivitaeten?id=${id}`, { method: "DELETE" });
      fetch_();
    } finally {
      setDeleting(null);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.betreff.trim()) { setSaveError("Betreff ist Pflichtfeld."); return; }
    setSaving(true);
    setSaveError("");
    const res = await fetch("/api/kunden/aktivitaeten", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kundeId, typ: form.typ, betreff: form.betreff.trim(), inhalt: form.inhalt.trim() || undefined }),
    });
    setSaving(false);
    if (res.ok) {
      setForm(QUICK_FORM_DEFAULT);
      setShowForm(false);
      fetch_();
    } else {
      const d = await res.json().catch(() => ({}));
      setSaveError(d.error ?? "Fehler beim Speichern.");
    }
  }

  const displayed = filter === "offen" ? items.filter((i) => !i.erledigt) : items;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1">
          {(["alle", "offen"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${filter === f ? "bg-green-700 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-700"}`}
            >
              {f === "alle" ? "Alle" : "Offen"}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="text-sm px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
        >
          {showForm ? "Abbrechen" : "+ Aktivität erfassen"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="border border-green-200 bg-green-50 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Typ</label>
              <select
                value={form.typ}
                onChange={(e) => setForm({ ...form, typ: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700 bg-white"
              >
                <option value="anruf">📞 Anruf</option>
                <option value="besuch">🏠 Besuch</option>
                <option value="email">✉️ E-Mail</option>
                <option value="notiz">📝 Notiz</option>
                <option value="aufgabe">✅ Aufgabe</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Betreff <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={form.betreff}
                onChange={(e) => setForm({ ...form, betreff: e.target.value })}
                placeholder="z.B. Anruf wegen Lieferung"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700 bg-white"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notiz (optional)</label>
            <textarea
              value={form.inhalt}
              onChange={(e) => setForm({ ...form, inhalt: e.target.value })}
              rows={2}
              placeholder="Kurze Zusammenfassung…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700 bg-white resize-none"
            />
          </div>
          {saveError && <p className="text-xs text-red-600">{saveError}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => { setShowForm(false); setForm(QUICK_FORM_DEFAULT); setSaveError(""); }}
              className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm rounded-lg bg-green-700 hover:bg-green-600 text-white font-medium disabled:opacity-60"
            >
              {saving ? "Speichern…" : "Speichern"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">Lade…</p>
      ) : displayed.length === 0 ? (
        <p className="text-sm text-gray-400">Keine Aktivitäten vorhanden.</p>
      ) : (
        <div className="space-y-2">
          {displayed.map((item) => {
            const meta = TYP_LABELS[item.typ] ?? TYP_LABELS.notiz;
            const isOverdue = item.faelligAm && !item.erledigt && new Date(item.faelligAm) < new Date();
            return (
              <div
                key={item.id}
                className={`flex gap-3 p-4 rounded-xl border transition-colors ${item.erledigt ? "border-gray-100 bg-gray-50 opacity-60" : "border-gray-200 bg-white"}`}
              >
                <div className="text-xl leading-none mt-0.5">{meta.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${meta.color}`}>{meta.label}</span>
                    <span className="text-sm font-medium text-gray-900 truncate">{item.betreff}</span>
                    {item.erledigt && <span className="text-xs text-green-600 font-medium">Erledigt</span>}
                    {isOverdue && <span className="text-xs text-red-600 font-medium">Überfällig</span>}
                  </div>
                  {item.inhalt && <p className="mt-1 text-sm text-gray-600 whitespace-pre-line">{item.inhalt}</p>}
                  <div className="mt-1.5 flex gap-3 text-xs text-gray-400">
                    <span>{new Date(item.datum).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })}</span>
                    {item.faelligAm && (
                      <span className={isOverdue ? "text-red-500" : ""}>
                        Fällig: {new Date(item.faelligAm).toLocaleDateString("de-DE")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-1 items-end shrink-0">
                  {item.typ === "aufgabe" && (
                    <button
                      onClick={() => toggleErledigt(item)}
                      className={`text-xs px-2 py-1 rounded border transition-colors ${item.erledigt ? "border-gray-300 text-gray-500 hover:bg-gray-50" : "border-green-500 text-green-700 hover:bg-green-50"}`}
                    >
                      {item.erledigt ? "Wieder öffnen" : "Erledigen"}
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(item.id)}
                    disabled={deleting === item.id}
                    className="text-xs text-red-400 hover:text-red-600 disabled:opacity-40"
                  >
                    {deleting === item.id ? "…" : "Löschen"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
