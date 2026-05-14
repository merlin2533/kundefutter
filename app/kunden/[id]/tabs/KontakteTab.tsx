"use client";

import React, { useState } from "react";
import { Kunde, kontaktIcon } from "../_shared";

export default function KontakteTab({ kunde, onRefresh }: { kunde: Kunde; onRefresh: () => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    vorname: "",
    nachname: "",
    label: "",
    telefon: "",
    mobil: "",
    email: "",
    fax: "",
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const telefon = form.telefon.trim();
    const mobil = form.mobil.trim();
    const email = form.email.trim();
    const fax = form.fax.trim();
    const vorname = form.vorname.trim();
    const nachname = form.nachname.trim();
    const label = form.label.trim();
    // Mindestens ein Kommunikationskanal muss gesetzt sein
    if (!telefon && !mobil && !email && !fax) return;
    setSaving(true);
    try {
      const zusatz: { typ: string; wert: string; label?: string; vorname?: string; nachname?: string }[] = [];
      const gemeinsam = {
        label: label || undefined,
        vorname: vorname || undefined,
        nachname: nachname || undefined,
      };
      if (telefon) zusatz.push({ typ: "telefon", wert: telefon, ...gemeinsam });
      if (mobil) zusatz.push({ typ: "mobil", wert: mobil, ...gemeinsam });
      if (email) zusatz.push({ typ: "email", wert: email, ...gemeinsam });
      if (fax) zusatz.push({ typ: "fax", wert: fax, ...gemeinsam });

      const newKontakte = [
        ...kunde.kontakte.map(({ typ, wert, label, vorname, nachname }) => ({ typ, wert, label, vorname, nachname })),
        ...zusatz,
      ];
      const res = await fetch(`/api/kunden/${kunde.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kontakte: newKontakte }),
      });
      if (!res.ok) throw new Error();
      setShowAdd(false);
      setForm({ vorname: "", nachname: "", label: "", telefon: "", mobil: "", email: "", fax: "" });
      onRefresh();
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(kontaktId: number) {
    setDeleting(kontaktId);
    try {
      const newKontakte = kunde.kontakte
        .filter((k) => k.id !== kontaktId)
        .map(({ typ, wert, label, vorname, nachname }) => ({ typ, wert, label, vorname, nachname }));
      await fetch(`/api/kunden/${kunde.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kontakte: newKontakte }),
      });
      onRefresh();
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setShowAdd(true)}
          className="text-sm px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
        >
          + Kontakt hinzufügen
        </button>
      </div>

      {kunde.kontakte.length === 0 ? (
        <p className="text-sm text-gray-400">Keine Kontakte erfasst.</p>
      ) : (
        <div className="space-y-2">
          {kunde.kontakte.map((k) => (
            <div
              key={k.id}
              className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3 border border-gray-200"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">{kontaktIcon(k.typ)}</span>
                <div>
                  {(k.vorname || k.nachname) && (
                    <p className="text-xs font-medium text-gray-700">{[k.vorname, k.nachname].filter(Boolean).join(" ")}</p>
                  )}
                  <p className="text-sm font-medium text-gray-800">{k.wert}</p>
                  <p className="text-xs text-gray-500">
                    {k.typ.charAt(0).toUpperCase() + k.typ.slice(1)}
                    {k.label && ` · ${k.label}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleDelete(k.id)}
                disabled={deleting === k.id}
                className="text-red-500 hover:text-red-700 text-sm disabled:opacity-50 px-2 py-1"
              >
                {deleting === k.id ? "…" : "Löschen"}
              </button>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <h3 className="text-sm font-semibold mb-1">Neuer Kontakt</h3>
          <p className="text-xs text-gray-500 mb-3">
            Person einmal erfassen — Telefon, Mobil und E-Mail gemeinsam angeben. Leere Felder werden ignoriert.
          </p>
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Vorname</label>
                <input
                  type="text"
                  placeholder="Max"
                  value={form.vorname}
                  onChange={(e) => setForm({ ...form, vorname: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nachname</label>
                <input
                  type="text"
                  placeholder="Mustermann"
                  value={form.nachname}
                  onChange={(e) => setForm({ ...form, nachname: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Label (optional)</label>
              <input
                type="text"
                placeholder="z.B. Büro, Privat, Buchhaltung"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">📞 Telefon</label>
                <input
                  type="tel"
                  placeholder="05734 / 959 83 377"
                  value={form.telefon}
                  onChange={(e) => setForm({ ...form, telefon: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">📱 Mobil</label>
                <input
                  type="tel"
                  placeholder="0175 / 56 400 53"
                  value={form.mobil}
                  onChange={(e) => setForm({ ...form, mobil: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">✉️ E-Mail</label>
                <input
                  type="email"
                  placeholder="kontakt@beispiel.de"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">📠 Fax (optional)</label>
                <input
                  type="tel"
                  placeholder="05734 / 959 83 378"
                  value={form.fax}
                  onChange={(e) => setForm({ ...form, fax: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
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
    </div>
  );
}
