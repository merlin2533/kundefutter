"use client";

import React, { useState } from "react";
import * as Sentry from "@sentry/nextjs";

export interface LieferantKontakt {
  id: number;
  typ: string;
  wert: string;
  label?: string | null;
  vorname?: string | null;
  nachname?: string | null;
}

function kontaktIcon(typ: string): string {
  switch (typ) {
    case "telefon": return "📞";
    case "mobil": return "📱";
    case "email": return "✉️";
    case "fax": return "📠";
    default: return "•";
  }
}

/** Weitere Ansprechpartner je Lieferant pflegen (z.B. Verkauf, Buchhaltung) — analog
 *  KontakteTab.tsx für Kunden, aber ohne die Kunden-spezifischen rechnungsEmail/
 *  lieferscheinEmail-Rollen und ohne Visitenkarten-Scan. */
export default function LieferantKontakteManager({
  lieferantId,
  kontakte,
  onRefresh,
}: {
  lieferantId: number;
  kontakte: LieferantKontakt[];
  onRefresh: () => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ vorname: "", nachname: "", label: "", telefon: "", mobil: "", email: "", fax: "" });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ vorname: "", nachname: "", label: "", typ: "telefon", wert: "" });

  function toPayload(list: LieferantKontakt[]) {
    return list.map(({ typ, wert, label, vorname, nachname }) => ({ typ, wert, label, vorname, nachname }));
  }

  async function speichern(newKontakte: { typ: string; wert: string; label?: string | null; vorname?: string | null; nachname?: string | null }[]) {
    const res = await fetch(`/api/lieferanten/${lieferantId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kontakte: newKontakte }),
    });
    if (!res.ok) throw new Error("Speichern fehlgeschlagen");
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const telefon = form.telefon.trim();
    const mobil = form.mobil.trim();
    const email = form.email.trim();
    const fax = form.fax.trim();
    if (!telefon && !mobil && !email && !fax) return;
    setSaving(true);
    try {
      const gemeinsam = {
        label: form.label.trim() || undefined,
        vorname: form.vorname.trim() || undefined,
        nachname: form.nachname.trim() || undefined,
      };
      const zusatz: { typ: string; wert: string; label?: string; vorname?: string; nachname?: string }[] = [];
      if (telefon) zusatz.push({ typ: "telefon", wert: telefon, ...gemeinsam });
      if (mobil) zusatz.push({ typ: "mobil", wert: mobil, ...gemeinsam });
      if (email) zusatz.push({ typ: "email", wert: email, ...gemeinsam });
      if (fax) zusatz.push({ typ: "fax", wert: fax, ...gemeinsam });
      await speichern([...toPayload(kontakte), ...zusatz]);
      setShowAdd(false);
      setForm({ vorname: "", nachname: "", label: "", telefon: "", mobil: "", email: "", fax: "" });
      onRefresh();
    } catch (err) {
      Sentry.captureException(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(kontaktId: number) {
    setDeleting(kontaktId);
    try {
      await speichern(toPayload(kontakte.filter((k) => k.id !== kontaktId)));
      onRefresh();
    } catch (err) {
      Sentry.captureException(err);
    } finally {
      setDeleting(null);
    }
  }

  function startEdit(k: LieferantKontakt) {
    setEditingId(k.id);
    setEditForm({ vorname: k.vorname ?? "", nachname: k.nachname ?? "", label: k.label ?? "", typ: k.typ, wert: k.wert });
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editForm.wert.trim()) return;
    setSaving(true);
    try {
      const newKontakte = kontakte.map((k) =>
        k.id === editingId
          ? { typ: editForm.typ, wert: editForm.wert.trim(), label: editForm.label.trim() || undefined, vorname: editForm.vorname.trim() || undefined, nachname: editForm.nachname.trim() || undefined }
          : { typ: k.typ, wert: k.wert, label: k.label, vorname: k.vorname, nachname: k.nachname }
      );
      await speichern(newKontakte);
      setEditingId(null);
      onRefresh();
    } catch (err) {
      Sentry.captureException(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Weitere Kontakte
        </p>
        {!showAdd && (
          <button
            onClick={() => setShowAdd(true)}
            className="text-xs px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
          >
            + Kontakt
          </button>
        )}
      </div>
      <p className="text-xs text-gray-400 -mt-2">
        z.B. unterschiedliche Ansprechpartner in Verkauf/Buchhaltung — erscheinen bei Bestellungen zur Auswahl
      </p>

      {kontakte.length === 0 ? (
        <p className="text-sm text-gray-400">Keine weiteren Kontakte erfasst.</p>
      ) : (
        <div className="space-y-2">
          {kontakte.map((k) => (
            <React.Fragment key={k.id}>
              {editingId === k.id ? (
                <div className="bg-white border border-green-300 rounded-lg px-3 py-3 shadow-sm">
                  <form onSubmit={handleSaveEdit} className="space-y-2">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Typ</label>
                        <select
                          value={editForm.typ}
                          onChange={(e) => setEditForm({ ...editForm, typ: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        >
                          <option value="telefon">📞 Telefon</option>
                          <option value="mobil">📱 Mobil</option>
                          <option value="email">✉️ E-Mail</option>
                          <option value="fax">📠 Fax</option>
                        </select>
                      </div>
                      <div className="col-span-1 sm:col-span-3">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Wert *</label>
                        <input
                          type={editForm.typ === "email" ? "email" : "text"}
                          required
                          value={editForm.wert}
                          onChange={(e) => setEditForm({ ...editForm, wert: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Vorname</label>
                        <input
                          type="text"
                          value={editForm.vorname}
                          onChange={(e) => setEditForm({ ...editForm, vorname: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Nachname</label>
                        <input
                          type="text"
                          value={editForm.nachname}
                          onChange={(e) => setEditForm({ ...editForm, nachname: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Label</label>
                        <input
                          type="text"
                          placeholder="z.B. Verkauf"
                          value={editForm.label}
                          onChange={(e) => setEditForm({ ...editForm, label: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button type="button" onClick={() => setEditingId(null)} className="px-3 py-1 text-xs border border-gray-300 rounded-lg hover:bg-gray-50">
                        Abbrechen
                      </button>
                      <button type="submit" disabled={saving} className="px-3 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-60">
                        {saving ? "…" : "Speichern"}
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
                  <div className="flex items-center gap-2.5">
                    <span>{kontaktIcon(k.typ)}</span>
                    <div>
                      {(k.vorname || k.nachname) && (
                        <p className="text-xs font-medium text-gray-700">{[k.vorname, k.nachname].filter(Boolean).join(" ")}</p>
                      )}
                      <p className="text-sm text-gray-800">{k.wert}</p>
                      {k.label && <p className="text-xs text-gray-500">{k.label}</p>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => startEdit(k)} className="text-blue-500 hover:text-blue-700 text-xs px-1.5 py-1">
                      Bearbeiten
                    </button>
                    <button onClick={() => handleDelete(k.id)} disabled={deleting === k.id} className="text-red-500 hover:text-red-700 text-xs disabled:opacity-50 px-1.5 py-1">
                      {deleting === k.id ? "…" : "Löschen"}
                    </button>
                  </div>
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      )}

      {showAdd && (
        <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
          <form onSubmit={handleAdd} className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Vorname</label>
                <input
                  type="text"
                  value={form.vorname}
                  onChange={(e) => setForm({ ...form, vorname: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nachname</label>
                <input
                  type="text"
                  value={form.nachname}
                  onChange={(e) => setForm({ ...form, nachname: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Label (optional)</label>
              <input
                type="text"
                placeholder="z.B. Verkauf, Buchhaltung"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">📞 Telefon</label>
                <input
                  type="tel"
                  value={form.telefon}
                  onChange={(e) => setForm({ ...form, telefon: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">📱 Mobil</label>
                <input
                  type="tel"
                  value={form.mobil}
                  onChange={(e) => setForm({ ...form, mobil: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">✉️ E-Mail</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">📠 Fax</label>
                <input
                  type="tel"
                  value={form.fax}
                  onChange={(e) => setForm({ ...form, fax: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <button type="button" onClick={() => setShowAdd(false)} className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50">
                Abbrechen
              </button>
              <button type="submit" disabled={saving} className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-60">
                {saving ? "…" : "Speichern"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
