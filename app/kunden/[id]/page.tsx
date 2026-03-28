"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { formatEuro, formatDatum } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface KundeKontakt {
  id: number;
  kundeId: number;
  typ: string;
  wert: string;
  label?: string;
}

interface Artikel {
  id: number;
  name: string;
  artikelnummer: string;
  einheit: string;
  standardpreis: number;
}

interface KundeBedarf {
  id: number;
  artikelId: number;
  menge: number;
  intervallTage: number;
  notiz?: string;
  aktiv: boolean;
  artikel: Artikel;
}

interface KundeArtikelPreis {
  id: number;
  artikelId: number;
  preis: number;
  rabatt: number;
  artikel: Artikel;
}

interface Lieferposition {
  id: number;
  menge: number;
  verkaufspreis: number;
  artikel: Artikel;
}

interface Lieferung {
  id: number;
  datum: string;
  status: string;
  notiz?: string;
  rechnungNr?: string | null;
  rechnungDatum?: string | null;
  bezahltAm?: string | null;
  zahlungsziel?: number | null;
  positionen: Lieferposition[];
}

interface Kunde {
  id: number;
  name: string;
  firma?: string;
  kategorie: string;
  strasse?: string;
  plz?: string;
  ort?: string;
  land: string;
  lat?: number;
  lng?: number;
  notizen?: string;
  aktiv: boolean;
  createdAt: string;
  updatedAt: string;
  kontakte: KundeKontakt[];
  bedarfe: KundeBedarf[];
  artikelPreise: KundeArtikelPreis[];
  lieferungen: Lieferung[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const KATEGORIEN = ["Landwirt", "Pferdehof", "Kleintierhalter", "Großhändler", "Sonstige"];
const TABS = ["Stammdaten", "Kontakte", "Bedarfe", "Sonderpreise", "Lieferhistorie"] as const;
type Tab = (typeof TABS)[number];

const KONTAKT_TYPEN = ["telefon", "mobil", "fax", "email"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function kontaktIcon(typ: string) {
  if (typ === "email") return "📧";
  if (typ === "fax") return "📠";
  return "📞";
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    geplant: "bg-yellow-100 text-yellow-800",
    geliefert: "bg-green-100 text-green-800",
    storniert: "bg-red-100 text-red-700",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status] ?? "bg-gray-100 text-gray-700"}`}>
      {status}
    </span>
  );
}

function lieferungTotal(l: Lieferung) {
  return l.positionen.reduce((s, p) => s + p.menge * p.verkaufspreis, 0);
}

// ─── Input helper ─────────────────────────────────────────────────────────────

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
      />
    </div>
  );
}

// ─── Stammdaten Tab ──────────────────────────────────────────────────────────

function StammdatenTab({ kunde, onRefresh }: { kunde: Kunde; onRefresh: () => void }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: kunde.name,
    firma: kunde.firma ?? "",
    kategorie: kunde.kategorie,
    strasse: kunde.strasse ?? "",
    plz: kunde.plz ?? "",
    ort: kunde.ort ?? "",
    land: kunde.land,
    notizen: kunde.notizen ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function startEdit() {
    setForm({
      name: kunde.name,
      firma: kunde.firma ?? "",
      kategorie: kunde.kategorie,
      strasse: kunde.strasse ?? "",
      plz: kunde.plz ?? "",
      ort: kunde.ort ?? "",
      land: kunde.land,
      notizen: kunde.notizen ?? "",
    });
    setError("");
    setEditing(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Name ist erforderlich."); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/kunden/${kunde.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          firma: form.firma || null,
          kategorie: form.kategorie,
          strasse: form.strasse || null,
          plz: form.plz || null,
          ort: form.ort || null,
          land: form.land || "Deutschland",
          notizen: form.notizen || null,
        }),
      });
      if (!res.ok) throw new Error();
      setEditing(false);
      onRefresh();
    } catch {
      setError("Fehler beim Speichern.");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <button
            onClick={startEdit}
            className="text-sm px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
          >
            Bearbeiten
          </button>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <InfoRow label="Name" value={kunde.name} />
          <InfoRow label="Firma" value={kunde.firma} />
          <InfoRow label="Kategorie" value={kunde.kategorie} />
          <InfoRow label="Status" value={kunde.aktiv ? "Aktiv" : "Inaktiv"} />
          <InfoRow label="Straße" value={kunde.strasse} />
          <InfoRow label="PLZ / Ort" value={[kunde.plz, kunde.ort].filter(Boolean).join(" ")} />
          <InfoRow label="Land" value={kunde.land} />
          {kunde.lat !== undefined && kunde.lat !== null && (
            <InfoRow label="Koordinaten" value={`${kunde.lat?.toFixed(4)}, ${kunde.lng?.toFixed(4)}`} />
          )}
        </div>
        {kunde.notizen && (
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Notizen</p>
            <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">{kunde.notizen}</p>
          </div>
        )}
        <p className="text-xs text-gray-400">
          Erstellt: {formatDatum(kunde.createdAt)} · Geändert: {formatDatum(kunde.updatedAt)}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-4 max-w-xl">
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
      )}
      <Field label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
      <Field label="Firma" value={form.firma} onChange={(v) => setForm({ ...form, firma: v })} />
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Kategorie</label>
        <select
          value={form.kategorie}
          onChange={(e) => setForm({ ...form, kategorie: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          {KATEGORIEN.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
      </div>
      <Field label="Straße" value={form.strasse} onChange={(v) => setForm({ ...form, strasse: v })} />
      <div className="grid grid-cols-3 gap-3">
        <Field label="PLZ" value={form.plz} onChange={(v) => setForm({ ...form, plz: v })} />
        <div className="col-span-2">
          <Field label="Ort" value={form.ort} onChange={(v) => setForm({ ...form, ort: v })} />
        </div>
      </div>
      <Field label="Land" value={form.land} onChange={(v) => setForm({ ...form, land: v })} />
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notizen</label>
        <textarea
          value={form.notizen}
          onChange={(e) => setForm({ ...form, notizen: e.target.value })}
          rows={4}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
        />
      </div>
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-60"
        >
          {saving ? "Speichern…" : "Speichern"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Abbrechen
        </button>
      </div>
    </form>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-sm text-gray-800 mt-0.5">{value || <span className="text-gray-400">—</span>}</p>
    </div>
  );
}

// ─── Kontakte Tab ────────────────────────────────────────────────────────────

function KontakteTab({ kunde, onRefresh }: { kunde: Kunde; onRefresh: () => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ typ: "telefon", wert: "", label: "" });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.wert.trim()) return;
    setSaving(true);
    try {
      const newKontakte = [
        ...kunde.kontakte.map(({ typ, wert, label }) => ({ typ, wert, label })),
        { typ: form.typ, wert: form.wert.trim(), label: form.label || undefined },
      ];
      const res = await fetch(`/api/kunden/${kunde.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kontakte: newKontakte }),
      });
      if (!res.ok) throw new Error();
      setShowAdd(false);
      setForm({ typ: "telefon", wert: "", label: "" });
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
        .map(({ typ, wert, label }) => ({ typ, wert, label }));
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
          <h3 className="text-sm font-semibold mb-3">Neuer Kontakt</h3>
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Typ</label>
                <select
                  value={form.typ}
                  onChange={(e) => setForm({ ...form, typ: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  {KONTAKT_TYPEN.map((t) => (
                    <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Label (optional)</label>
                <input
                  type="text"
                  placeholder="z.B. Büro"
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Wert <span className="text-red-500">*</span></label>
              <input
                type="text"
                placeholder={form.typ === "email" ? "email@beispiel.de" : "0123 456789"}
                value={form.wert}
                onChange={(e) => setForm({ ...form, wert: e.target.value })}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
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

// ─── Bedarfe Tab ─────────────────────────────────────────────────────────────

function BedarfeTab({ kunde, onRefresh }: { kunde: Kunde; onRefresh: () => void }) {
  const [artikel, setArtikel] = useState<Artikel[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ artikelId: "", menge: "", intervallTage: "30", notiz: "" });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/artikel?aktiv=true")
      .then((r) => r.json())
      .then(setArtikel)
      .catch(() => {});
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.artikelId || !form.menge) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/kunden/${kunde.id}/bedarfe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artikelId: Number(form.artikelId),
          menge: Number(form.menge),
          intervallTage: Number(form.intervallTage) || 30,
          notiz: form.notiz || undefined,
        }),
      });
      if (!res.ok) throw new Error();
      setShowAdd(false);
      setForm({ artikelId: "", menge: "", intervallTage: "30", notiz: "" });
      onRefresh();
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(artikelId: number) {
    setDeleting(artikelId);
    try {
      await fetch(`/api/kunden/${kunde.id}/bedarfe`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artikelId }),
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
          + Bedarf hinzufügen
        </button>
      </div>

      {kunde.bedarfe.length === 0 ? (
        <p className="text-sm text-gray-400">Keine Bedarfe erfasst.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Artikel</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Menge</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Intervall</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Notiz</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {kunde.bedarfe.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5">
                    <p className="font-medium">{b.artikel.name}</p>
                    <p className="text-xs text-gray-400">{b.artikel.artikelnummer}</p>
                  </td>
                  <td className="px-4 py-2.5">{b.menge} {b.artikel.einheit}</td>
                  <td className="px-4 py-2.5">alle {b.intervallTage} Tage</td>
                  <td className="px-4 py-2.5 text-gray-500">{b.notiz ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => handleDelete(b.artikelId)}
                      disabled={deleting === b.artikelId}
                      className="text-red-500 hover:text-red-700 text-xs disabled:opacity-50"
                    >
                      {deleting === b.artikelId ? "…" : "Löschen"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <h3 className="text-sm font-semibold mb-3">Neuer Bedarf</h3>
          <form onSubmit={handleAdd} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Artikel <span className="text-red-500">*</span></label>
              <select
                value={form.artikelId}
                onChange={(e) => setForm({ ...form, artikelId: e.target.value })}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">— Bitte wählen —</option>
                {artikel.map((a) => (
                  <option key={a.id} value={a.id}>{a.name} ({a.artikelnummer})</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Menge <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={form.menge}
                  onChange={(e) => setForm({ ...form, menge: e.target.value })}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Intervall (Tage)</label>
                <input
                  type="number"
                  min="1"
                  value={form.intervallTage}
                  onChange={(e) => setForm({ ...form, intervallTage: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notiz</label>
              <input
                type="text"
                value={form.notiz}
                onChange={(e) => setForm({ ...form, notiz: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
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

// ─── Sonderpreise Tab ─────────────────────────────────────────────────────────

function SonderpreiseTab({ kunde, onRefresh }: { kunde: Kunde; onRefresh: () => void }) {
  const [artikel, setArtikel] = useState<Artikel[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ artikelId: "", preis: "", rabatt: "0" });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/artikel?aktiv=true")
      .then((r) => r.json())
      .then(setArtikel)
      .catch(() => {});
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.artikelId || !form.preis) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/kunden/${kunde.id}/preise`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artikelId: Number(form.artikelId),
          preis: Number(form.preis),
          rabatt: Number(form.rabatt) || 0,
        }),
      });
      if (!res.ok) throw new Error();
      setShowAdd(false);
      setForm({ artikelId: "", preis: "", rabatt: "0" });
      onRefresh();
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(artikelId: number) {
    setDeleting(artikelId);
    try {
      await fetch(`/api/kunden/${kunde.id}/preise`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artikelId }),
      });
      onRefresh();
    } finally {
      setDeleting(null);
    }
  }

  function effectivePrice(p: KundeArtikelPreis) {
    return Math.round(p.preis * (1 - p.rabatt / 100) * 100) / 100;
  }

  function marge(p: KundeArtikelPreis) {
    const eff = effectivePrice(p);
    const std = p.artikel.standardpreis;
    if (std <= 0) return null;
    const pct = ((eff - std) / std) * 100;
    return pct.toFixed(1);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setShowAdd(true)}
          className="text-sm px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
        >
          + Sonderpreis hinzufügen
        </button>
      </div>

      {kunde.artikelPreise.length === 0 ? (
        <p className="text-sm text-gray-400">Keine Sonderpreise erfasst.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Artikel</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600">Listenpreis</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600">Sonderpreis</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600">Rabatt</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600">Effektiv</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600">Marge vs. Standard</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {kunde.artikelPreise.map((p) => {
                const eff = effectivePrice(p);
                const m = marge(p);
                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5">
                      <p className="font-medium">{p.artikel.name}</p>
                      <p className="text-xs text-gray-400">{p.artikel.artikelnummer}</p>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-gray-500">
                      {formatEuro(p.artikel.standardpreis)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono">{formatEuro(p.preis)}</td>
                    <td className="px-4 py-2.5 text-right">{p.rabatt > 0 ? `${p.rabatt}%` : "—"}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold">{formatEuro(eff)}</td>
                    <td className="px-4 py-2.5 text-right">
                      {m !== null ? (
                        <span className={Number(m) >= 0 ? "text-green-700" : "text-red-600"}>
                          {Number(m) >= 0 ? "+" : ""}{m}%
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => handleDelete(p.artikelId)}
                        disabled={deleting === p.artikelId}
                        className="text-red-500 hover:text-red-700 text-xs disabled:opacity-50"
                      >
                        {deleting === p.artikelId ? "…" : "Löschen"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <h3 className="text-sm font-semibold mb-3">Neuer Sonderpreis</h3>
          <form onSubmit={handleAdd} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Artikel <span className="text-red-500">*</span></label>
              <select
                value={form.artikelId}
                onChange={(e) => setForm({ ...form, artikelId: e.target.value })}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">— Bitte wählen —</option>
                {artikel.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.artikelnummer}) — Standard: {formatEuro(a.standardpreis)}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Preis (€) <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.preis}
                  onChange={(e) => setForm({ ...form, preis: e.target.value })}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Rabatt (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={form.rabatt}
                  onChange={(e) => setForm({ ...form, rabatt: e.target.value })}
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

// ─── Abrechnungsübersicht Tab ─────────────────────────────────────────────────

function LieferhistorieTab({ kunde, onRefresh }: { kunde: Kunde; onRefresh: () => void }) {
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [lieferscheinModal, setLieferscheinModal] = useState<Lieferung | null>(null);
  const [rechnungModal, setRechnungModal] = useState<Lieferung | null>(null);

  const heute = new Date();
  heute.setHours(0, 0, 0, 0);

  function zahlungsStatus(l: Lieferung): { label: string; cls: string } {
    if (l.status !== "geliefert") return { label: "—", cls: "text-gray-400" };
    if (l.bezahltAm) return { label: "Bezahlt", cls: "text-green-700 font-medium" };
    const tage = l.zahlungsziel ?? 30;
    const faellig = new Date(new Date(l.datum).getTime() + tage * 24 * 60 * 60 * 1000);
    if (heute > faellig) return { label: "Überfällig", cls: "text-red-600 font-medium" };
    return { label: "Offen", cls: "text-yellow-700 font-medium" };
  }

  async function markiereAlsBezahlt(l: Lieferung) {
    setActionLoading(l.id);
    await fetch(`/api/lieferungen/${l.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bezahltAm: l.bezahltAm ? null : new Date().toISOString() }),
    });
    setActionLoading(null);
    onRefresh();
  }

  async function rechnungErstellen(l: Lieferung) {
    setActionLoading(l.id);
    // PDF direkt öffnen — Rechnungsnummer wird serverseitig automatisch vergeben
    window.open(`/api/exporte/rechnung?lieferungId=${l.id}`, "_blank");
    // Kurz warten dann refresh damit rechnungNr in UI erscheint
    setTimeout(() => { setActionLoading(null); onRefresh(); }, 1500);
  }

  const gesamtBetrag = kunde.lieferungen
    .filter((l) => l.status === "geliefert")
    .reduce((s, l) => s + lieferungTotal(l), 0);
  const offen = kunde.lieferungen
    .filter((l) => l.status === "geliefert" && !l.bezahltAm)
    .reduce((s, l) => s + lieferungTotal(l), 0);

  if (kunde.lieferungen.length === 0) {
    return <p className="text-sm text-gray-400">Keine Lieferungen vorhanden.</p>;
  }

  return (
    <div className="space-y-4">
      {/* Zusammenfassung */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-xs text-green-700 font-medium">Gesamtumsatz</p>
          <p className="text-lg font-bold text-green-800">{formatEuro(gesamtBetrag)}</p>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-xs text-yellow-700 font-medium">Offen</p>
          <p className="text-lg font-bold text-yellow-800">{formatEuro(offen)}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs text-blue-700 font-medium">Bezahlt</p>
          <p className="text-lg font-bold text-blue-800">{formatEuro(gesamtBetrag - offen)}</p>
        </div>
      </div>

      {/* Tabelle */}
      <div className="overflow-x-auto border border-gray-200 rounded-xl">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-3 py-2.5 font-medium text-gray-600 text-xs">Datum</th>
              <th className="text-left px-3 py-2.5 font-medium text-gray-600 text-xs">Artikel</th>
              <th className="text-right px-3 py-2.5 font-medium text-gray-600 text-xs">Betrag</th>
              <th className="text-left px-3 py-2.5 font-medium text-gray-600 text-xs">Status</th>
              <th className="text-left px-3 py-2.5 font-medium text-gray-600 text-xs">Lieferschein</th>
              <th className="text-left px-3 py-2.5 font-medium text-gray-600 text-xs">Rechnung</th>
              <th className="text-left px-3 py-2.5 font-medium text-gray-600 text-xs">Zahlung</th>
              <th className="px-3 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {kunde.lieferungen.map((l) => {
              const total = lieferungTotal(l);
              const posSummary = l.positionen.slice(0, 2)
                .map((p) => `${p.menge} ${p.artikel.einheit} ${p.artikel.name}`)
                .join(", ");
              const more = l.positionen.length > 2 ? ` +${l.positionen.length - 2}` : "";
              const zStatus = zahlungsStatus(l);
              const isLoading = actionLoading === l.id;

              return (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2.5 whitespace-nowrap text-xs">{formatDatum(l.datum)}</td>
                  <td className="px-3 py-2.5 text-gray-600 text-xs max-w-[180px] truncate">
                    {posSummary}{more}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-medium text-xs whitespace-nowrap">
                    {formatEuro(total)}
                  </td>
                  <td className="px-3 py-2.5">{statusBadge(l.status)}</td>

                  {/* Lieferschein */}
                  <td className="px-3 py-2.5">
                    <button
                      onClick={() => setLieferscheinModal(l)}
                      className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-100 transition-colors whitespace-nowrap"
                    >
                      📄 Lieferschein
                    </button>
                  </td>

                  {/* Rechnung */}
                  <td className="px-3 py-2.5">
                    {l.rechnungNr ? (
                      <button
                        onClick={() => setRechnungModal(l)}
                        className="text-xs px-2 py-1 border border-green-300 text-green-700 rounded hover:bg-green-50 transition-colors whitespace-nowrap"
                      >
                        🧾 {l.rechnungNr}
                      </button>
                    ) : l.status === "geliefert" ? (
                      <button
                        onClick={() => rechnungErstellen(l)}
                        disabled={isLoading}
                        className="text-xs px-2 py-1 bg-green-700 hover:bg-green-800 text-white rounded transition-colors disabled:opacity-50 whitespace-nowrap"
                      >
                        {isLoading ? "…" : "+ Rechnung erstellen"}
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>

                  {/* Zahlung */}
                  <td className="px-3 py-2.5">
                    {l.status === "geliefert" ? (
                      <label className="flex items-center gap-1.5 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={!!l.bezahltAm}
                          disabled={isLoading}
                          onChange={() => markiereAlsBezahlt(l)}
                          className="rounded border-gray-300 text-green-700 focus:ring-green-700"
                        />
                        <span className={`text-xs ${zStatus.cls}`}>{zStatus.label}</span>
                      </label>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>

                  <td className="px-3 py-2.5">
                    <Link
                      href={`/lieferungen/${l.id}`}
                      className="text-green-700 hover:underline text-xs font-medium"
                    >
                      Details →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Lieferschein Modal */}
      {lieferscheinModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-3">Lieferschein erstellen</h2>
            <p className="text-sm text-gray-600 mb-1">
              Lieferung vom <strong>{formatDatum(lieferscheinModal.datum)}</strong>
            </p>
            <p className="text-sm text-gray-600 mb-4">
              {lieferscheinModal.positionen.length} Position(en) · {formatEuro(lieferungTotal(lieferscheinModal))}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setLieferscheinModal(null)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Abbrechen
              </button>
              <a
                href={`/api/exporte/lieferschein?lieferungId=${lieferscheinModal.id}`}
                target="_blank"
                rel="noreferrer"
                onClick={() => setLieferscheinModal(null)}
                className="px-4 py-2 text-sm bg-green-700 hover:bg-green-800 text-white rounded-lg font-medium"
              >
                📄 PDF herunterladen
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Rechnung Modal */}
      {rechnungModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-3">Rechnung</h2>
            <p className="text-sm text-gray-600 mb-1">
              Rechnungsnr.: <strong>{rechnungModal.rechnungNr}</strong>
            </p>
            <p className="text-sm text-gray-600 mb-1">
              Lieferung vom <strong>{formatDatum(rechnungModal.datum)}</strong>
            </p>
            <p className="text-sm text-gray-600 mb-4">
              Betrag: <strong>{formatEuro(lieferungTotal(rechnungModal))}</strong>
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setRechnungModal(null)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Schließen
              </button>
              <a
                href={`/api/exporte/rechnung?lieferungId=${rechnungModal.id}`}
                target="_blank"
                rel="noreferrer"
                onClick={() => setRechnungModal(null)}
                className="px-4 py-2 text-sm bg-green-700 hover:bg-green-800 text-white rounded-lg font-medium"
              >
                🧾 Rechnung als PDF
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function KundeDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [kunde, setKunde] = useState<Kunde | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("Stammdaten");

  const fetchKunde = useCallback(async () => {
    const res = await fetch(`/api/kunden/${id}`);
    if (res.status === 404) { setNotFound(true); setLoading(false); return; }
    const data = await res.json();
    setKunde(data);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchKunde();
  }, [fetchKunde]);

  if (loading) {
    return <p className="text-gray-400 mt-8 text-sm">Lade Kunde…</p>;
  }
  if (notFound || !kunde) {
    return (
      <div className="mt-8">
        <p className="text-gray-600">Kunde nicht gefunden.</p>
        <Link href="/kunden" className="text-green-700 hover:underline text-sm mt-2 inline-block">
          ← Zurück zur Übersicht
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/kunden" className="text-sm text-gray-500 hover:text-gray-700">
              Kunden
            </Link>
            <span className="text-gray-400">/</span>
            <span className="text-sm text-gray-700">{kunde.name}</span>
          </div>
          <h1 className="text-2xl font-bold">{kunde.name}</h1>
          {kunde.firma && <p className="text-gray-500 mt-0.5">{kunde.firma}</p>}
        </div>
        <div className="flex items-center gap-2">
          <KategorieBadge kategorie={kunde.kategorie} />
          {!kunde.aktiv && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">Inaktiv</span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-1 -mb-px overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-green-600 text-green-700"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        {activeTab === "Stammdaten" && <StammdatenTab kunde={kunde} onRefresh={fetchKunde} />}
        {activeTab === "Kontakte" && <KontakteTab kunde={kunde} onRefresh={fetchKunde} />}
        {activeTab === "Bedarfe" && <BedarfeTab kunde={kunde} onRefresh={fetchKunde} />}
        {activeTab === "Sonderpreise" && <SonderpreiseTab kunde={kunde} onRefresh={fetchKunde} />}
        {activeTab === "Lieferhistorie" && <LieferhistorieTab kunde={kunde} onRefresh={fetchKunde} />}
      </div>
    </div>
  );
}

function KategorieBadge({ kategorie }: { kategorie: string }) {
  const styles: Record<string, string> = {
    Landwirt: "bg-green-100 text-green-800",
    Pferdehof: "bg-blue-100 text-blue-800",
    Kleintierhalter: "bg-orange-100 text-orange-800",
    Großhändler: "bg-purple-100 text-purple-800",
    Sonstige: "bg-gray-100 text-gray-700",
  };
  const cls = styles[kategorie] ?? "bg-gray-100 text-gray-700";
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {kategorie}
    </span>
  );
}
