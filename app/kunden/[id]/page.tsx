"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import DriveOrdner from "@/components/DriveOrdner";
import { formatEuro, formatDatum, formatPercent } from "@/lib/utils";
import SearchableSelect from "@/components/SearchableSelect";
import { useToast } from "@/components/ToastProvider";

// ─── Types ────────────────────────────────────────────────────────────────────

interface KundeKontakt {
  id: number;
  kundeId: number;
  typ: string;
  wert: string;
  label?: string;
  vorname?: string;
  nachname?: string;
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
  sammelrechnungId?: number | null;
  positionen: Lieferposition[];
}

interface Kunde {
  id: number;
  name: string;
  firma?: string;
  kategorie: string;
  verantwortlicher?: string;
  strasse?: string;
  plz?: string;
  ort?: string;
  land: string;
  lat?: number;
  lng?: number;
  notizen?: string;
  tags?: string;
  ustIdNr?: string;
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
const TABS = ["Stammdaten", "Lieferhistorie", "CRM", "Angebote", "Aufgaben", "Kontakte", "Bedarfe", "Notizen", "Sonderpreise", "Statistik", "Schlagkartei", "Agrarantrag", "Dokumente", "Vorgangskette"] as const;
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

// ─── Nächster Besuch Info ────────────────────────────────────────────────────

interface NaechsterBesuchItem {
  id: number;
  datum: string;
  betreff: string;
  inhalt: string | null;
}

function NaechsterBesuchInfo({ kundeId }: { kundeId: number }) {
  const [besuche, setBesuche] = useState<NaechsterBesuchItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/besuchstermine?kundeId=${kundeId}`)
      .then((r) => r.json())
      .then((d) => setBesuche(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, [kundeId]);

  if (loading) return null;
  if (besuche.length === 0) return null;

  const naechster = besuche[0];
  return (
    <div className="mt-2 p-3 rounded-xl border border-blue-200 bg-blue-50">
      <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">Nächster Besuch</p>
      <p className="text-sm font-medium text-blue-900">
        {new Date(naechster.datum).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}
        {" — "}
        {naechster.betreff}
      </p>
      {naechster.inhalt && <p className="text-xs text-blue-600 mt-0.5">{naechster.inhalt}</p>}
      {besuche.length > 1 && (
        <p className="text-xs text-blue-500 mt-1">+{besuche.length - 1} weitere geplante Besuche</p>
      )}
    </div>
  );
}

// ─── Stammdaten Tab ──────────────────────────────────────────────────────────

function StammdatenTab({ kunde, onRefresh }: { kunde: Kunde; onRefresh: () => void }) {
  const [editing, setEditing] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validMsg, setValidMsg] = useState("");
  const [kategorien, setKategorien] = useState<string[]>(["Landwirt", "Pferdehof", "Kleintierhalter", "Großhändler", "Sonstige"]);
  const [mitarbeiter, setMitarbeiter] = useState<string[]>([]);

  // Wettbewerber-Notizen
  const [wettbNotizenLoading, setWettbNotizenLoading] = useState(true);
  const [wettbNotizen, setWettbNotizen] = useState<KundeNotiz[]>([]);
  const [wettbNewText, setWettbNewText] = useState("");
  const [wettbSaving, setWettbSaving] = useState(false);
  const [wettbDeleting, setWettbDeleting] = useState<number | null>(null);

  useEffect(() => {
    fetch(`/api/kunden/${kunde.id}/notizen`)
      .then((r) => r.json())
      .then((data: KundeNotiz[]) => {
        setWettbNotizen(Array.isArray(data) ? data.filter((n) => n.thema === "Wettbewerber") : []);
        setWettbNotizenLoading(false);
      })
      .catch(() => setWettbNotizenLoading(false));
  }, [kunde.id]);

  async function handleWettbAdd() {
    if (!wettbNewText.trim()) return;
    setWettbSaving(true);
    try {
      const res = await fetch(`/api/kunden/${kunde.id}/notizen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: wettbNewText.trim(), thema: "Wettbewerber" }),
      });
      if (res.ok) {
        const notiz: KundeNotiz = await res.json();
        setWettbNotizen((prev) => [notiz, ...prev]);
        setWettbNewText("");
      }
    } finally {
      setWettbSaving(false);
    }
  }

  async function handleWettbDelete(notizId: number) {
    setWettbDeleting(notizId);
    try {
      const res = await fetch(`/api/kunden/${kunde.id}/notizen?notizId=${notizId}`, { method: "DELETE" });
      if (res.ok) setWettbNotizen((prev) => prev.filter((n) => n.id !== notizId));
    } finally {
      setWettbDeleting(null);
    }
  }
  const [form, setForm] = useState({
    name: kunde.name,
    firma: kunde.firma ?? "",
    kategorie: kunde.kategorie,
    verantwortlicher: kunde.verantwortlicher ?? "",
    strasse: kunde.strasse ?? "",
    plz: kunde.plz ?? "",
    ort: kunde.ort ?? "",
    land: kunde.land,
    notizen: kunde.notizen ?? "",
    ustIdNr: kunde.ustIdNr ?? "",
  });

  useEffect(() => {
    fetch("/api/einstellungen?prefix=system.")
      .then((r) => r.json())
      .then((d) => {
        if (d["system.kundenkategorien"]) {
          try { setKategorien(JSON.parse(d["system.kundenkategorien"])); } catch { /* ignore */ }
        }
        if (d["system.mitarbeiter"]) {
          try { setMitarbeiter(JSON.parse(d["system.mitarbeiter"])); } catch { /* ignore */ }
        }
      });
  }, []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [tags, setTags] = useState<string[]>(() => {
    try { return JSON.parse(kunde.tags || "[]"); } catch { return []; }
  });
  const [newTag, setNewTag] = useState("");

  function addTag() {
    const t = newTag.trim();
    if (!t || tags.includes(t)) { setNewTag(""); return; }
    setTags([...tags, t]);
    setNewTag("");
  }

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag));
  }

  function startEdit() {
    setForm({
      name: kunde.name,
      firma: kunde.firma ?? "",
      kategorie: kunde.kategorie,
      verantwortlicher: kunde.verantwortlicher ?? "",
      strasse: kunde.strasse ?? "",
      plz: kunde.plz ?? "",
      ort: kunde.ort ?? "",
      land: kunde.land,
      notizen: kunde.notizen ?? "",
      ustIdNr: kunde.ustIdNr ?? "",
    });
    setTags(() => { try { return JSON.parse(kunde.tags || "[]"); } catch { return []; } });
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
          verantwortlicher: form.verantwortlicher || null,
          strasse: form.strasse || null,
          plz: form.plz || null,
          ort: form.ort || null,
          land: form.land || "Deutschland",
          notizen: form.notizen || null,
          tags,
          ustIdNr: form.ustIdNr || null,
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
        <div className="flex justify-end gap-2">
          <button
            onClick={async () => {
              setValidating(true); setValidMsg("");
              try {
                const res = await fetch("/api/kunden/adress-validierung", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ kundeId: kunde.id }),
                });
                const data = await res.json();
                if (res.ok) { setValidMsg(`Koordinaten aktualisiert: ${data.lat?.toFixed(4)}, ${data.lng?.toFixed(4)}`); onRefresh(); }
                else setValidMsg(data.error ?? "Fehler");
              } finally { setValidating(false); }
            }}
            disabled={validating || !kunde.strasse}
            className="text-sm px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            title="Adresse über OpenStreetMap geocodieren"
          >
            {validating ? "Suche…" : "Adresse prüfen (OSM)"}
          </button>
          <button
            onClick={startEdit}
            className="text-sm px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
          >
            Bearbeiten
          </button>
        </div>
        {validMsg && <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-3 py-1.5">{validMsg}</p>}
        <div className="grid sm:grid-cols-2 gap-4">
          <InfoRow label="Name" value={kunde.name} />
          <InfoRow label="Firma" value={kunde.firma} />
          <InfoRow label="Kategorie" value={kunde.kategorie} />
          <InfoRow label="Verantwortlicher" value={kunde.verantwortlicher} />
          <InfoRow label="Status" value={kunde.aktiv ? "Aktiv" : "Inaktiv"} />
          <InfoRow label="Straße" value={kunde.strasse} />
          <InfoRow label="PLZ / Ort" value={[kunde.plz, kunde.ort].filter(Boolean).join(" ")} />
          <InfoRow label="Land" value={kunde.land} />
          <InfoRow label="USt-IdNr." value={kunde.ustIdNr} />
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
        {(() => { try { const t = JSON.parse(kunde.tags || "[]"); return t.length > 0 ? (
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Tags</p>
            <div className="flex flex-wrap gap-2">
              {t.map((tag: string) => (
                <span key={tag} className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">{tag}</span>
              ))}
            </div>
          </div>
        ) : null; } catch { return null; } })()}
        <p className="text-xs text-gray-400">
          Erstellt: {formatDatum(kunde.createdAt)} · Geändert: {formatDatum(kunde.updatedAt)}
        </p>
        <NaechsterBesuchInfo kundeId={kunde.id} />

        {/* Wettbewerber-Info */}
        <div className="border border-orange-200 rounded-xl p-4 bg-orange-50 space-y-3">
          <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide">Wettbewerber-Info</p>
          {wettbNotizenLoading ? (
            <p className="text-xs text-gray-400">Lade…</p>
          ) : wettbNotizen.length > 0 ? (
            <div className="space-y-2">
              {wettbNotizen.map((n) => (
                <div key={n.id} className="flex items-start justify-between gap-2 bg-white border border-orange-100 rounded-lg px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{n.text}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{new Date(n.erstellt).toLocaleDateString("de-DE")}</p>
                  </div>
                  <button
                    onClick={() => handleWettbDelete(n.id)}
                    disabled={wettbDeleting === n.id}
                    className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50 flex-shrink-0 px-1"
                    title="Löschen"
                  >
                    {wettbDeleting === n.id ? "…" : "✕"}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400">Noch keine Wettbewerber-Infos erfasst.</p>
          )}
          <div className="space-y-2">
            <textarea
              value={wettbNewText}
              onChange={(e) => setWettbNewText(e.target.value)}
              placeholder="Wettbewerber-Info hinzufügen…"
              rows={2}
              className="w-full border border-orange-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none bg-white"
            />
            <button
              onClick={handleWettbAdd}
              disabled={!wettbNewText.trim() || wettbSaving}
              className="px-4 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {wettbSaving ? "Speichern…" : "Speichern"}
            </button>
          </div>
        </div>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Kategorie</label>
          <select
            value={form.kategorie}
            onChange={(e) => setForm({ ...form, kategorie: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            {kategorien.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Verantwortlicher</label>
          <input
            type="text"
            value={form.verantwortlicher}
            onChange={(e) => setForm({ ...form, verantwortlicher: e.target.value })}
            list="mitarbeiter-liste"
            placeholder={mitarbeiter.length ? "Auswählen oder eingeben…" : "Name eingeben…"}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          {mitarbeiter.length > 0 && (
            <datalist id="mitarbeiter-liste">
              {mitarbeiter.map((m) => <option key={m} value={m} />)}
            </datalist>
          )}
        </div>
      </div>
      <Field label="Straße" value={form.strasse} onChange={(v) => setForm({ ...form, strasse: v })} />
      <div className="grid grid-cols-3 gap-3">
        <Field label="PLZ" value={form.plz} onChange={(v) => setForm({ ...form, plz: v })} />
        <div className="col-span-2">
          <Field label="Ort" value={form.ort} onChange={(v) => setForm({ ...form, ort: v })} />
        </div>
      </div>
      <Field label="Land" value={form.land} onChange={(v) => setForm({ ...form, land: v })} />
      <Field label="USt-IdNr." value={form.ustIdNr} onChange={(v) => setForm({ ...form, ustIdNr: v })} />
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notizen</label>
        <textarea
          value={form.notizen}
          onChange={(e) => setForm({ ...form, notizen: e.target.value })}
          rows={4}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
        />
      </div>
      {/* Tags */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {tags.map((tag: string) => (
            <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
              {tag}
              <button type="button" onClick={() => removeTag(tag)} className="text-green-600 hover:text-green-900 font-bold">×</button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newTag}
            onChange={e => setNewTag(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
            placeholder="Neuer Tag..."
            className="border border-gray-300 rounded px-2 py-1 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-green-700"
          />
          <button type="button" onClick={addTag} className="px-3 py-1 bg-green-700 text-white rounded text-sm hover:bg-green-800">+</button>
        </div>
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
  const [form, setForm] = useState({ typ: "telefon", wert: "", label: "", vorname: "", nachname: "" });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.wert.trim()) return;
    setSaving(true);
    try {
      const newKontakte = [
        ...kunde.kontakte.map(({ typ, wert, label, vorname, nachname }) => ({ typ, wert, label, vorname, nachname })),
        { typ: form.typ, wert: form.wert.trim(), label: form.label || undefined, vorname: form.vorname.trim() || undefined, nachname: form.nachname.trim() || undefined },
      ];
      const res = await fetch(`/api/kunden/${kunde.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kontakte: newKontakte }),
      });
      if (!res.ok) throw new Error();
      setShowAdd(false);
      setForm({ typ: "telefon", wert: "", label: "", vorname: "", nachname: "" });
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
          <h3 className="text-sm font-semibold mb-3">Neuer Kontakt</h3>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

// ─── Bedarfsableitung aus Schlagkartei ───────────────────────────────────────

interface AbgeleiteterBedarf {
  fruchtart: string;
  schlagName: string;
  flaeche: number;
  nBedarf: number; // kg N-Dünger gesamt
  pBedarf: number; // kg P-Dünger gesamt
}

function berechneBedarfFuerFruchtart(fruchtart: string | null | undefined, flaeche: number): { nKgHa: number; pKgHa: number } {
  const f = (fruchtart ?? "").toLowerCase();
  if (f.includes("mais")) return { nKgHa: 200, pKgHa: 50 };
  if (f.includes("raps")) return { nKgHa: 190, pKgHa: 60 };
  if (f.includes("weizen") || f.includes("gerste") || f.includes("roggen") || f.includes("getreide") || f.includes("triticale") || f.includes("hafer")) return { nKgHa: 180, pKgHa: 40 };
  if (f.includes("gras") || f.includes("grünland") || f.includes("grunland") || f.includes("wiese") || f.includes("weide")) return { nKgHa: 150, pKgHa: 0 };
  return { nKgHa: 160, pKgHa: 30 };
}

// ─── Bedarfe Tab ─────────────────────────────────────────────────────────────

function BedarfeTab({ kunde, onRefresh }: { kunde: Kunde; onRefresh: () => void }) {
  const [artikel, setArtikel] = useState<Artikel[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ artikelId: "", menge: "", intervallTage: "30", notiz: "" });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  // Schlagkartei-Ableitung
  const [showAbleitung, setShowAbleitung] = useState(false);
  const [schlaegte, setSchlaegte] = useState<KundeSchlag[]>([]);
  const [loadingSchlaegte, setLoadingSchlaegte] = useState(false);
  const [abgeleiteteBedarfe, setAbgeleiteteBedarfe] = useState<AbgeleiteterBedarf[]>([]);
  const [uebernehmen, setUebernehmen] = useState(false);
  // Per-row artikel selection for N and P
  const [nArtikelId, setNArtikelId] = useState("");
  const [pArtikelId, setPArtikelId] = useState("");

  useEffect(() => {
    fetch("/api/artikel?aktiv=true")
      .then((r) => r.json())
      .then(setArtikel)
      .catch(() => {});
  }, []);

  async function handleLadeSchlaegte() {
    setLoadingSchlaegte(true);
    setShowAbleitung(true);
    try {
      const res = await fetch(`/api/kunden/${kunde.id}/schlaegte`);
      const data = await res.json();
      const list: KundeSchlag[] = Array.isArray(data) ? data : [];
      setSchlaegte(list);
      const bedarfe: AbgeleiteterBedarf[] = list
        .filter((s) => s.flaeche > 0)
        .map((s) => {
          const { nKgHa, pKgHa } = berechneBedarfFuerFruchtart(s.fruchtart, s.flaeche);
          return {
            fruchtart: s.fruchtart ?? "Sonstige",
            schlagName: s.name,
            flaeche: s.flaeche,
            nBedarf: Math.round(nKgHa * s.flaeche),
            pBedarf: Math.round(pKgHa * s.flaeche),
          };
        });
      setAbgeleiteteBedarfe(bedarfe);
    } catch {
      // ignore
    } finally {
      setLoadingSchlaegte(false);
    }
  }

  async function handleBedarfeUebernehmen() {
    if (!nArtikelId && !pArtikelId) return;
    setUebernehmen(true);
    try {
      const totalN = abgeleiteteBedarfe.reduce((s, b) => s + b.nBedarf, 0);
      const totalP = abgeleiteteBedarfe.reduce((s, b) => s + b.pBedarf, 0);

      const promises: Promise<Response>[] = [];
      if (nArtikelId && totalN > 0) {
        promises.push(fetch(`/api/kunden/${kunde.id}/bedarfe`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ artikelId: Number(nArtikelId), menge: totalN, intervallTage: 365, notiz: "Aus Schlagkartei abgeleitet (N-Dünger)" }),
        }));
      }
      if (pArtikelId && totalP > 0) {
        promises.push(fetch(`/api/kunden/${kunde.id}/bedarfe`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ artikelId: Number(pArtikelId), menge: totalP, intervallTage: 365, notiz: "Aus Schlagkartei abgeleitet (P-Dünger)" }),
        }));
      }
      await Promise.all(promises);
      setShowAbleitung(false);
      setAbgeleiteteBedarfe([]);
      setSchlaegte([]);
      setNArtikelId("");
      setPArtikelId("");
      onRefresh();
    } catch {
      // ignore
    } finally {
      setUebernehmen(false);
    }
  }

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

  const totalN = abgeleiteteBedarfe.reduce((s, b) => s + b.nBedarf, 0);
  const totalP = abgeleiteteBedarfe.reduce((s, b) => s + b.pBedarf, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 justify-between items-center">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleLadeSchlaegte}
            className="text-sm px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Bedarf aus Schlagkartei ableiten
          </button>
          {kunde.bedarfe.length > 0 && (
            <Link
              href={`/angebote/neu?kundeId=${kunde.id}&ausBedarfen=true`}
              className="text-sm px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors inline-block"
            >
              Angebot aus Bedarfen erstellen
            </Link>
          )}
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="text-sm px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
        >
          + Bedarf hinzufügen
        </button>
      </div>

      {/* Schlagkartei-Ableitung Panel */}
      {showAbleitung && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-blue-900">Bedarfsableitung aus Schlagkartei</h3>
            <button
              onClick={() => setShowAbleitung(false)}
              className="text-blue-400 hover:text-blue-700 text-xs"
            >
              Schließen
            </button>
          </div>

          {loadingSchlaegte ? (
            <p className="text-sm text-blue-600">Lade Schlagdaten…</p>
          ) : schlaegte.length === 0 ? (
            <p className="text-sm text-blue-600">Keine Schlagdaten vorhanden. Bitte zuerst Schläge in der Schlagkartei anlegen.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm bg-white rounded-lg overflow-hidden border border-blue-100">
                  <thead className="bg-blue-100 text-blue-800">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Schlag</th>
                      <th className="hidden sm:table-cell text-left px-3 py-2 font-medium">Fruchtart</th>
                      <th className="text-right px-3 py-2 font-medium">Fläche (ha)</th>
                      <th className="text-right px-3 py-2 font-medium">N-Bedarf (kg)</th>
                      <th className="text-right px-3 py-2 font-medium hidden sm:table-cell">P-Bedarf (kg)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-50">
                    {abgeleiteteBedarfe.map((b, i) => (
                      <tr key={i} className="hover:bg-blue-50">
                        <td className="px-3 py-2 font-medium">
                          {b.schlagName}
                          <div className="sm:hidden text-xs text-gray-500">{b.fruchtart}</div>
                        </td>
                        <td className="hidden sm:table-cell px-3 py-2 text-gray-600">{b.fruchtart}</td>
                        <td className="px-3 py-2 text-right">{b.flaeche.toLocaleString("de-DE")}</td>
                        <td className="px-3 py-2 text-right font-medium">{b.nBedarf.toLocaleString("de-DE")}</td>
                        <td className="px-3 py-2 text-right hidden sm:table-cell">{b.pBedarf > 0 ? b.pBedarf.toLocaleString("de-DE") : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-blue-100 font-semibold text-blue-900">
                    <tr>
                      <td className="px-3 py-2" colSpan={2}>Gesamt</td>
                      <td className="px-3 py-2 text-right">
                        {abgeleiteteBedarfe.reduce((s, b) => s + b.flaeche, 0).toLocaleString("de-DE")} ha
                      </td>
                      <td className="px-3 py-2 text-right">{totalN.toLocaleString("de-DE")} kg</td>
                      <td className="px-3 py-2 text-right hidden sm:table-cell">{totalP > 0 ? `${totalP.toLocaleString("de-DE")} kg` : "—"}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="bg-white border border-blue-200 rounded-lg p-4 space-y-3">
                <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Als Bedarfe übernehmen</p>
                <p className="text-xs text-gray-500">Wähle die Artikel für N-Dünger und P-Dünger. Der Gesamtbedarf wird als Jahresbedarf (365 Tage Intervall) gespeichert.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {totalN > 0 && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        N-Dünger-Artikel ({totalN.toLocaleString("de-DE")} kg gesamt)
                      </label>
                      <SearchableSelect
                        options={artikel.map((a) => ({ value: String(a.id), label: a.name, sub: a.artikelnummer }))}
                        value={nArtikelId}
                        onChange={setNArtikelId}
                        placeholder="— N-Dünger wählen —"
                      />
                    </div>
                  )}
                  {totalP > 0 && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        P-Dünger-Artikel ({totalP.toLocaleString("de-DE")} kg gesamt)
                      </label>
                      <SearchableSelect
                        options={artikel.map((a) => ({ value: String(a.id), label: a.name, sub: a.artikelnummer }))}
                        value={pArtikelId}
                        onChange={setPArtikelId}
                        placeholder="— P-Dünger wählen —"
                      />
                    </div>
                  )}
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowAbleitung(false)}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="button"
                    onClick={handleBedarfeUebernehmen}
                    disabled={uebernehmen || (!nArtikelId && !pArtikelId)}
                    className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uebernehmen ? "Speichere…" : "Als Bedarfe übernehmen"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {kunde.bedarfe.length === 0 ? (
        <p className="text-sm text-gray-400">Keine Bedarfe erfasst.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Artikel</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Menge</th>
                <th className="hidden sm:table-cell text-left px-4 py-2 font-medium text-gray-600">Intervall</th>
                <th className="hidden md:table-cell text-left px-4 py-2 font-medium text-gray-600">Notiz</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {kunde.bedarfe.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5">
                    <p className="font-medium">{b.artikel.name}</p>
                    <p className="text-xs text-gray-400">{b.artikel.artikelnummer}</p>
                    <div className="sm:hidden text-xs text-gray-500 mt-0.5">alle {b.intervallTage} Tage</div>
                  </td>
                  <td className="px-4 py-2.5">{b.menge} {b.artikel.einheit}</td>
                  <td className="hidden sm:table-cell px-4 py-2.5">alle {b.intervallTage} Tage</td>
                  <td className="hidden md:table-cell px-4 py-2.5 text-gray-500">{b.notiz ?? "—"}</td>
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
              <SearchableSelect
                options={artikel.map((a) => ({ value: a.id, label: a.name, sub: a.artikelnummer }))}
                value={form.artikelId}
                onChange={(v) => setForm({ ...form, artikelId: v })}
                placeholder="— Bitte wählen —"
                required
              />
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
                <th className="hidden md:table-cell text-right px-4 py-2 font-medium text-gray-600">Listenpreis</th>
                <th className="hidden sm:table-cell text-right px-4 py-2 font-medium text-gray-600">Sonderpreis</th>
                <th className="hidden lg:table-cell text-right px-4 py-2 font-medium text-gray-600">Rabatt</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600">Effektiv</th>
                <th className="hidden md:table-cell text-right px-4 py-2 font-medium text-gray-600">Marge vs. Standard</th>
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
                      <div className="sm:hidden text-xs text-gray-500 mt-0.5">{formatEuro(p.preis)}{p.rabatt > 0 ? ` · ${p.rabatt}% Rabatt` : ""}</div>
                    </td>
                    <td className="hidden md:table-cell px-4 py-2.5 text-right font-mono text-gray-500">
                      {formatEuro(p.artikel.standardpreis)}
                    </td>
                    <td className="hidden sm:table-cell px-4 py-2.5 text-right font-mono">{formatEuro(p.preis)}</td>
                    <td className="hidden lg:table-cell px-4 py-2.5 text-right">{p.rabatt > 0 ? `${p.rabatt}%` : "—"}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold">{formatEuro(eff)}</td>
                    <td className="hidden md:table-cell px-4 py-2.5 text-right">
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
              <SearchableSelect
                options={artikel.map((a) => ({ value: a.id, label: a.name, sub: `${a.artikelnummer} · ${formatEuro(a.standardpreis)}` }))}
                value={form.artikelId}
                onChange={(v) => setForm({ ...form, artikelId: v })}
                placeholder="— Bitte wählen —"
                required
              />
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


// ─── Statistik Tab ────────────────────────────────────────────────────────────

function StatistikTab({ kunde }: { kunde: Kunde }) {
  const jetzt = new Date();
  const vor12Monaten = new Date(jetzt.getFullYear(), jetzt.getMonth() - 11, 1);

  // Berechne Monatsumsätze aus vorhandenen Lieferungen (letzte 12 Monate, nur geliefert)
  const monatMap = new Map<string, number>();
  for (let i = 0; i < 12; i++) {
    const d = new Date(jetzt.getFullYear(), jetzt.getMonth() - 11 + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monatMap.set(key, 0);
  }

  const gelieferteLieferungen = kunde.lieferungen.filter((l) => l.status === "geliefert");

  for (const l of gelieferteLieferungen) {
    const d = new Date(l.datum);
    if (d < vor12Monaten) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!monatMap.has(key)) continue;
    const total = l.positionen.reduce((s, p) => s + p.menge * p.verkaufspreis, 0);
    monatMap.set(key, (monatMap.get(key) ?? 0) + total);
  }

  const monatsDaten = Array.from(monatMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monat, umsatz]) => ({ monat, umsatz }));

  const gesamtUmsatz = gelieferteLieferungen.reduce(
    (s, l) => s + l.positionen.reduce((ss, p) => ss + p.menge * p.verkaufspreis, 0),
    0
  );
  const durchschnitt =
    gelieferteLieferungen.length > 0
      ? gesamtUmsatz / gelieferteLieferungen.length
      : 0;

  // Top 5 Artikel nach Umsatz
  const artikelMap = new Map<string, { menge: number; umsatz: number }>();
  for (const l of gelieferteLieferungen) {
    for (const p of l.positionen) {
      const existing = artikelMap.get(p.artikel.name) ?? { menge: 0, umsatz: 0 };
      artikelMap.set(p.artikel.name, {
        menge: existing.menge + p.menge,
        umsatz: existing.umsatz + p.menge * p.verkaufspreis,
      });
    }
  }
  const topArtikel = Array.from(artikelMap.entries())
    .map(([name, v]) => ({ name, menge: v.menge, umsatz: v.umsatz }))
    .sort((a, b) => b.umsatz - a.umsatz)
    .slice(0, 5);

  // Jahresvergleich
  const jahreMap = new Map<number, { umsatz: number; anzahl: number }>();
  for (const l of gelieferteLieferungen) {
    const jahr = new Date(l.datum).getFullYear();
    const total = l.positionen.reduce((s, p) => s + p.menge * p.verkaufspreis, 0);
    const existing = jahreMap.get(jahr) ?? { umsatz: 0, anzahl: 0 };
    jahreMap.set(jahr, { umsatz: existing.umsatz + total, anzahl: existing.anzahl + 1 });
  }
  const jahresDaten = Array.from(jahreMap.entries())
    .filter(([, v]) => v.anzahl > 0)
    .sort(([a], [b]) => b - a)
    .slice(0, 5)
    .map(([jahr, v]) => ({ jahr, umsatz: v.umsatz, anzahl: v.anzahl, durchschnitt: v.umsatz / v.anzahl }));

  // SVG Chart
  const maxUmsatz = Math.max(...monatsDaten.map((d) => d.umsatz), 1);
  const W = 600;
  const H = 180;
  const padL = 60;
  const padR = 16;
  const padT = 16;
  const padB = 44;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const barW = Math.min(32, chartW / monatsDaten.length - 4);
  const step = chartW / monatsDaten.length;

  const monatNamen = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

  const [tooltip, setTooltip] = React.useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = React.useState({ x: 0, y: 0 });

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-xs text-green-700 font-medium">Gesamtumsatz</p>
          <p className="text-lg font-bold text-green-800">{formatEuro(gesamtUmsatz)}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs text-blue-700 font-medium">Lieferungen gesamt</p>
          <p className="text-lg font-bold text-blue-800">{gelieferteLieferungen.length}</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <p className="text-xs text-gray-600 font-medium">Ø pro Lieferung</p>
          <p className="text-lg font-bold text-gray-800">{formatEuro(durchschnitt)}</p>
        </div>
      </div>

      {/* Balkenchart letzte 12 Monate */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Umsatz letzte 12 Monate</h3>
        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full"
            style={{ minWidth: 400 }}
            onMouseLeave={() => setTooltip(null)}
          >
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((frac, i) => {
              const y = padT + chartH - frac * chartH;
              const val = frac * maxUmsatz;
              return (
                <g key={i}>
                  <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#e5e7eb" strokeWidth={1} />
                  <text x={padL - 4} y={y + 4} textAnchor="end" fontSize={9} fill="#9ca3af">
                    {val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val.toFixed(0)}
                  </text>
                </g>
              );
            })}
            <line x1={padL} y1={padT + chartH} x2={W - padR} y2={padT + chartH} stroke="#d1d5db" strokeWidth={1} />

            {/* Bars */}
            {monatsDaten.map((d, i) => {
              const barH = Math.max(2, (d.umsatz / maxUmsatz) * chartH);
              const cx = padL + i * step + step / 2;
              const x = cx - barW / 2;
              const y = padT + chartH - barH;
              const [yr, mo] = d.monat.split("-");
              const label = `${monatNamen[Number(mo) - 1]} ${yr}`;
              return (
                <g key={d.monat}>
                  <rect
                    x={x}
                    y={y}
                    width={barW}
                    height={barH}
                    fill="#16a34a"
                    rx={2}
                    className="cursor-pointer hover:fill-green-500 transition-colors"
                    onMouseEnter={() => {
                      setTooltip(`${label}: ${formatEuro(d.umsatz)}`);
                      setTooltipPos({ x: cx, y: y - 8 });
                    }}
                  />
                  <text
                    x={cx}
                    y={padT + chartH + 14}
                    textAnchor="middle"
                    fontSize={8}
                    fill="#6b7280"
                    transform={`rotate(-30 ${cx} ${padT + chartH + 14})`}
                  >
                    {monatNamen[Number(mo) - 1]}
                  </text>
                </g>
              );
            })}

            {/* Tooltip */}
            {tooltip && (
              <g>
                <rect
                  x={Math.min(tooltipPos.x - 70, W - padR - 150)}
                  y={tooltipPos.y - 22}
                  width={160}
                  height={24}
                  rx={4}
                  fill="#1f2937"
                  opacity={0.9}
                />
                <text
                  x={Math.min(tooltipPos.x - 70, W - padR - 150) + 8}
                  y={tooltipPos.y - 6}
                  fontSize={10}
                  fill="white"
                >
                  {tooltip}
                </text>
              </g>
            )}
          </svg>
        </div>
      </div>

      {/* Jahresvergleich */}
      {jahresDaten.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Jahresvergleich</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border border-gray-200">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Jahr</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Umsatz</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Lieferungen</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Ø Lieferung</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Trend</th>
                </tr>
              </thead>
              <tbody>
                {jahresDaten.map((row, i) => {
                  const vorjahr = jahresDaten[i + 1];
                  let trendEl: React.ReactNode = <span className="text-gray-400">—</span>;
                  if (vorjahr && vorjahr.umsatz > 0) {
                    const diff = (row.umsatz - vorjahr.umsatz) / vorjahr.umsatz;
                    const absPct = formatPercent(Math.abs(diff) * 100);
                    trendEl = diff >= 0
                      ? <span className="text-green-600 font-medium">▲ +{absPct}</span>
                      : <span className="text-red-600 font-medium">▼ -{absPct}</span>;
                  }
                  return (
                    <tr key={row.jahr} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2.5 font-semibold text-gray-800">{row.jahr}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-gray-800">{formatEuro(row.umsatz)}</td>
                      <td className="px-3 py-2.5 text-right text-gray-700">{row.anzahl}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-gray-700">{formatEuro(row.durchschnitt)}</td>
                      <td className="px-3 py-2.5 text-right">{trendEl}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top 5 Artikel nach Umsatz */}
      {topArtikel.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Top Artikel nach Umsatz (Top 5)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border border-gray-200">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">#</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Artikel</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Menge</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Umsatz</th>
                </tr>
              </thead>
              <tbody>
                {topArtikel.map((a, i) => (
                  <tr key={a.name} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2.5 text-xs text-gray-400 font-medium">#{i + 1}</td>
                    <td className="px-3 py-2.5 font-medium text-gray-800">{a.name}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-gray-600">
                      {a.menge.toLocaleString("de-DE")} Einh.
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-gray-800 font-semibold">
                      {formatEuro(a.umsatz)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [sammelrechnungLoading, setSammelrechnungLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"alle" | "geplant" | "geliefert" | "storniert">("alle");
  const [zahlungFilter, setZahlungFilter] = useState<"alle" | "offen" | "bezahlt" | "ueberfaellig">("alle");

  const heute = new Date();
  heute.setHours(0, 0, 0, 0);

  function zahlungsStatus(l: Lieferung): { label: string; cls: string } {
    if (l.status !== "geliefert") return { label: "—", cls: "text-gray-400" };
    if (l.bezahltAm) return { label: "Bezahlt", cls: "text-green-700 font-medium" };
    if (!l.rechnungNr) return { label: "Offen", cls: "text-yellow-700 font-medium" };
    const tage = l.zahlungsziel ?? 30;
    const basisDatum = l.rechnungDatum ?? l.datum;
    const faellig = new Date(new Date(basisDatum).getTime() + tage * 24 * 60 * 60 * 1000);
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
    window.open(`/lieferungen/${l.id}/rechnung`, "_blank");
    setTimeout(() => { setActionLoading(null); onRefresh(); }, 1500);
  }

  function toggleSammelrechnungSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function erstelleSammelrechnung() {
    if (selectedIds.size < 2) return;
    setSammelrechnungLoading(true);
    try {
      const res = await fetch("/api/exporte/sammelrechnung", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kundeId: kunde.id, lieferungIds: Array.from(selectedIds) }),
      });
      if (!res.ok) throw new Error("Fehler beim Erstellen der Sammelrechnung");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sammelrechnung-${kunde.name}-${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setSelectedIds(new Set());
      onRefresh();
    } catch {
      // ignore
    } finally {
      setSammelrechnungLoading(false);
    }
  }

  // Only deliveries with status=geliefert and no invoice yet are eligible
  const sammelrechnungFaehig = (l: Lieferung) =>
    l.status === "geliefert" && !l.rechnungNr && !l.sammelrechnungId;

  const gefiltert = kunde.lieferungen.filter((l) => {
    if (statusFilter !== "alle" && l.status !== statusFilter) return false;
    if (zahlungFilter !== "alle") {
      const zs = zahlungsStatus(l);
      if (zahlungFilter === "bezahlt" && zs.label !== "Bezahlt") return false;
      if (zahlungFilter === "offen" && zs.label !== "Offen") return false;
      if (zahlungFilter === "ueberfaellig" && zs.label !== "Überfällig") return false;
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const inRechnungNr = l.rechnungNr?.toLowerCase().includes(q) ?? false;
      const inArtikel = l.positionen.some((p) =>
        p.artikel.name.toLowerCase().includes(q)
      );
      if (!inRechnungNr && !inArtikel) return false;
    }
    return true;
  });

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

      {/* Sammelrechnung Action */}
      {selectedIds.size >= 2 && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
          <span className="text-sm text-green-800 font-medium">{selectedIds.size} Lieferungen ausgewählt</span>
          <button
            onClick={erstelleSammelrechnung}
            disabled={sammelrechnungLoading}
            className="px-4 py-1.5 text-sm bg-green-700 hover:bg-green-800 text-white rounded-lg font-medium transition-colors disabled:opacity-60"
          >
            {sammelrechnungLoading ? "Erstelle PDF…" : "Sammelrechnung erstellen"}
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Auswahl löschen
          </button>
        </div>
      )}

      {/* Suchleiste und Filter */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Suche nach Artikel oder Rechnungsnr."
          className="flex-1 min-w-[200px] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <div className="flex gap-1">
          {(["alle", "geplant", "geliefert", "storniert"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                statusFilter === s
                  ? "bg-green-600 text-white"
                  : "border border-gray-300 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {s === "alle" ? "Alle Status" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {(["alle", "offen", "bezahlt", "ueberfaellig"] as const).map((z) => (
            <button
              key={z}
              onClick={() => setZahlungFilter(z)}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                zahlungFilter === z
                  ? "bg-green-600 text-white"
                  : "border border-gray-300 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {z === "alle" ? "Alle Zahlungen" : z === "ueberfaellig" ? "Überfällig" : z.charAt(0).toUpperCase() + z.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Tabelle */}
      <div className="overflow-x-auto border border-gray-200 rounded-xl">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="hidden md:table-cell px-3 py-2.5 text-xs font-medium text-gray-500" title="Für Sammelrechnung auswählen">SR</th>
              <th className="text-left px-3 py-2.5 font-medium text-gray-600 text-xs">Datum</th>
              <th className="hidden sm:table-cell text-left px-3 py-2.5 font-medium text-gray-600 text-xs">Artikel</th>
              <th className="text-right px-3 py-2.5 font-medium text-gray-600 text-xs">Betrag</th>
              <th className="text-left px-3 py-2.5 font-medium text-gray-600 text-xs">Status</th>
              <th className="hidden lg:table-cell text-left px-3 py-2.5 font-medium text-gray-600 text-xs">Lieferschein</th>
              <th className="hidden md:table-cell text-left px-3 py-2.5 font-medium text-gray-600 text-xs">Rechnung</th>
              <th className="hidden sm:table-cell text-left px-3 py-2.5 font-medium text-gray-600 text-xs">Zahlung</th>
              <th className="px-3 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {gefiltert.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-sm text-gray-400">
                  Keine Lieferungen gefunden.
                </td>
              </tr>
            ) : null}
            {gefiltert.map((l) => {
              const total = lieferungTotal(l);
              const posSummary = l.positionen.slice(0, 2)
                .map((p) => `${p.menge} ${p.artikel.einheit} ${p.artikel.name}`)
                .join(", ");
              const more = l.positionen.length > 2 ? ` +${l.positionen.length - 2}` : "";
              const zStatus = zahlungsStatus(l);
              const isLoading = actionLoading === l.id;

              return (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="hidden md:table-cell px-3 py-2.5 text-center">
                    {sammelrechnungFaehig(l) ? (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(l.id)}
                        onChange={() => toggleSammelrechnungSelect(l.id)}
                        className="rounded border-gray-300 text-green-700 focus:ring-green-700"
                        title="Für Sammelrechnung auswählen"
                      />
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-xs">
                    {formatDatum(l.datum)}
                    <div className="sm:hidden text-xs text-gray-500 mt-0.5">{posSummary}{more}</div>
                  </td>
                  <td className="hidden sm:table-cell px-3 py-2.5 text-gray-600 text-xs max-w-[180px] truncate">
                    {posSummary}{more}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-medium text-xs whitespace-nowrap">
                    {formatEuro(total)}
                  </td>
                  <td className="px-3 py-2.5">{statusBadge(l.status)}</td>

                  {/* Lieferschein */}
                  <td className="hidden lg:table-cell px-3 py-2.5">
                    <button
                      onClick={() => setLieferscheinModal(l)}
                      className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-100 transition-colors whitespace-nowrap"
                    >
                      📄 Lieferschein
                    </button>
                  </td>

                  {/* Rechnung */}
                  <td className="hidden md:table-cell px-3 py-2.5">
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
                  <td className="hidden sm:table-cell px-3 py-2.5">
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
                href={`/lieferungen/${lieferscheinModal.id}/lieferschein`}
                target="_blank"
                rel="noreferrer"
                onClick={() => setLieferscheinModal(null)}
                className="px-4 py-2 text-sm bg-green-700 hover:bg-green-800 text-white rounded-lg font-medium"
              >
                🖨 Lieferschein drucken
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
            <div className="flex justify-end gap-2 flex-wrap">
              <button
                onClick={() => setRechnungModal(null)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Schließen
              </button>
              {(() => {
                const emailKontakt = kunde.kontakte.find((k) => k.typ === "email");
                if (!emailKontakt) return null;
                const rechnungNr = rechnungModal.rechnungNr ?? "";
                const datum = formatDatum(rechnungModal.datum);
                const betrag = formatEuro(lieferungTotal(rechnungModal));
                const subject = encodeURIComponent(`Rechnung ${rechnungNr} - AgrarOffice Röthemeier`);
                const body = encodeURIComponent(
                  `Sehr geehrte Damen und Herren,\n\nerbeten Sie die Rechnung ${rechnungNr} vom ${datum} über ${betrag}.\n\nMit freundlichen Grüßen\nAgrarOffice Röthemeier`
                );
                return (
                  <a
                    href={`mailto:${emailKontakt.wert}?subject=${subject}&body=${body}`}
                    onClick={() => setRechnungModal(null)}
                    className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
                  >
                    📧 Per E-Mail senden
                  </a>
                );
              })()}
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
  const [crmAutoOpen, setCrmAutoOpen] = useState(false);

  // Rückruf planen
  const [showRueckruf, setShowRueckruf] = useState(false);
  const [rueckrufDatum, setRueckrufDatum] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 2);
    return d.toISOString().slice(0, 16);
  });
  const [rueckrufNotiz, setRueckrufNotiz] = useState("");
  const [rueckrufSaving, setRueckrufSaving] = useState(false);
  const [rueckrufSuccess, setRueckrufSuccess] = useState(false);

  async function handleRueckrufEinplanen() {
    if (!kunde) return;
    setRueckrufSaving(true);
    try {
      const res = await fetch("/api/aufgaben", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          betreff: "Rückruf",
          typ: "anruf",
          prioritaet: "hoch",
          faelligAm: rueckrufDatum ? new Date(rueckrufDatum).toISOString() : null,
          beschreibung: rueckrufNotiz.trim() || null,
          kundeId: kunde.id,
        }),
      });
      if (!res.ok) throw new Error();
      setRueckrufSuccess(true);
      setShowRueckruf(false);
      setRueckrufNotiz("");
      setTimeout(() => setRueckrufSuccess(false), 2000);
    } catch {
      // ignore
    } finally {
      setRueckrufSaving(false);
    }
  }

  // Support ?tab=CRM URL param for direct navigation
  useEffect(() => {
    if (typeof window !== "undefined") {
      const t = new URLSearchParams(window.location.search).get("tab");
      if (t && (TABS as readonly string[]).includes(t)) setActiveTab(t as Tab);
    }
  }, []);

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
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/kunden" className="text-sm text-gray-500 hover:text-gray-700">
              Kunden
            </Link>
            <span className="text-gray-400">/</span>
            <span className="text-sm text-gray-700 truncate">{kunde.name}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold">{kunde.name}</h1>
          {kunde.firma && <p className="text-gray-500 mt-0.5">{kunde.firma}</p>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <KategorieBadge kategorie={kunde.kategorie} />
          {!kunde.aktiv && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">Inaktiv</span>
          )}
          <Link
            href={`/kunden/${kunde.id}/mappe`}
            target="_blank"
            rel="noreferrer"
            className="text-xs px-3 py-2 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 rounded-lg transition-colors font-medium"
          >
            🖨 Kundenmappe drucken
          </Link>
        </div>
      </div>

      {/* Schnellübersicht */}
      {(() => {
        const phone = kunde.kontakte.find((k) => k.typ === "telefon" || k.typ === "mobil");
        const email = kunde.kontakte.find((k) => k.typ === "email");
        const geliefert = kunde.lieferungen.filter((l) => l.status === "geliefert");
        const offen = geliefert.filter((l) => !l.bezahltAm).reduce((s, l) => s + lieferungTotal(l), 0);
        const letzteL = [...kunde.lieferungen].sort((a, b) => new Date(b.datum).getTime() - new Date(a.datum).getTime())[0];
        const offeneLieferungen = kunde.lieferungen.filter((l) => l.status === "geplant").length;
        return (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
            {/* Kontakt */}
            <div className="bg-white border border-gray-200 rounded-xl p-3 flex flex-col gap-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Kontakt</p>
              {phone ? (
                <a href={`tel:${phone.wert}`} className="text-sm text-green-700 hover:underline font-medium truncate">📞 {phone.wert}</a>
              ) : <p className="text-sm text-gray-400">—</p>}
              {email ? (
                <a href={`mailto:${email.wert}`} className="text-xs text-blue-600 hover:underline truncate">✉ {email.wert}</a>
              ) : null}
            </div>
            {/* Adresse */}
            <div className="bg-white border border-gray-200 rounded-xl p-3 flex flex-col gap-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Adresse</p>
              {kunde.strasse && <p className="text-sm text-gray-700 truncate">{kunde.strasse}</p>}
              <p className="text-sm text-gray-700">{[kunde.plz, kunde.ort].filter(Boolean).join(" ") || "—"}</p>
            </div>
            {/* Offener Betrag */}
            <div className={`border rounded-xl p-3 flex flex-col gap-1 ${offen > 0 ? "bg-red-50 border-red-200" : "bg-white border-gray-200"}`}>
              <p className={`text-xs font-semibold uppercase tracking-wide ${offen > 0 ? "text-red-400" : "text-gray-400"}`}>Offen</p>
              <p className={`text-lg font-bold ${offen > 0 ? "text-red-700" : "text-gray-500"}`}>{formatEuro(offen)}</p>
              {offeneLieferungen > 0 && (
                <p className="text-xs text-yellow-700">{offeneLieferungen} Lieferschein{offeneLieferungen > 1 ? "e" : ""} geplant</p>
              )}
            </div>
            {/* Letzte Lieferung */}
            <div className="bg-white border border-gray-200 rounded-xl p-3 flex flex-col gap-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Letzte Lieferung</p>
              {letzteL ? (
                <>
                  <p className="text-sm font-medium text-gray-800">{formatDatum(letzteL.datum)}</p>
                  <div className="flex items-center gap-1.5">
                    {statusBadge(letzteL.status)}
                    {letzteL.rechnungNr && <span className="text-xs text-gray-500 truncate">{letzteL.rechnungNr}</span>}
                  </div>
                </>
              ) : <p className="text-sm text-gray-400">Keine</p>}
            </div>
            {/* Schnellaktionen */}
            <div className="col-span-2 sm:col-span-1 bg-white border border-gray-200 rounded-xl p-3 flex flex-col gap-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Schnellaktionen</p>
              <Link
                href={`/lieferungen/neu?kundeId=${kunde.id}`}
                className="w-full text-center text-xs px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
              >
                + Neue Lieferung
              </Link>
              <button
                onClick={() => { setActiveTab("CRM"); setCrmAutoOpen(true); }}
                className="w-full text-xs px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg font-medium transition-colors"
              >
                + CRM Aktivität
              </button>
              {rueckrufSuccess ? (
                <div className="w-full text-xs px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg font-medium text-center">
                  ✓ Rückruf eingeplant
                </div>
              ) : (
                <button
                  onClick={() => setShowRueckruf((v) => !v)}
                  className="w-full text-xs px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg font-medium transition-colors"
                >
                  📞 Rückruf planen
                </button>
              )}
              {showRueckruf && !rueckrufSuccess && (
                <div className="border border-purple-200 rounded-lg p-2 bg-purple-50 space-y-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Termin</label>
                    <input
                      type="datetime-local"
                      value={rueckrufDatum}
                      onChange={(e) => setRueckrufDatum(e.target.value)}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Notiz (optional)</label>
                    <input
                      type="text"
                      value={rueckrufNotiz}
                      onChange={(e) => setRueckrufNotiz(e.target.value)}
                      placeholder="z.B. Angebot besprechen"
                      className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500 bg-white"
                    />
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={handleRueckrufEinplanen}
                      disabled={rueckrufSaving || !rueckrufDatum}
                      className="flex-1 px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded font-medium disabled:opacity-50 transition-colors"
                    >
                      {rueckrufSaving ? "…" : "Einplanen"}
                    </button>
                    <button
                      onClick={() => setShowRueckruf(false)}
                      className="px-2 py-1 border border-gray-300 text-xs rounded hover:bg-gray-50 transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-1 -mb-px overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 sm:px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
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
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        {activeTab === "Stammdaten" && <StammdatenTab kunde={kunde} onRefresh={fetchKunde} />}
        {activeTab === "Kontakte" && <KontakteTab kunde={kunde} onRefresh={fetchKunde} />}
        {activeTab === "Bedarfe" && <BedarfeTab kunde={kunde} onRefresh={fetchKunde} />}
        {activeTab === "Sonderpreise" && <SonderpreiseTab kunde={kunde} onRefresh={fetchKunde} />}
        {activeTab === "Statistik" && <StatistikTab kunde={kunde} />}
        {activeTab === "Lieferhistorie" && <LieferhistorieTab kunde={kunde} onRefresh={fetchKunde} />}
        {activeTab === "CRM" && <CrmTab kundeId={kunde.id} autoOpen={crmAutoOpen} />}
        {activeTab === "Notizen" && <NotizenTab kundeId={kunde.id} />}
        {activeTab === "Agrarantrag" && <AgrarantragTab kundeId={kunde.id} />}
        {activeTab === "Schlagkartei" && <SchlagkarteiTab kundeId={kunde.id} />}
        {activeTab === "Angebote" && <AngeboteTab kundeId={kunde.id} />}
        {activeTab === "Aufgaben" && <AufgabenTab kundeId={kunde.id} />}
        {activeTab === "Dokumente" && <DriveOrdner entityType="kunde" entityId={kunde.id} />}
        {activeTab === "Vorgangskette" && <VorgangskettTab kundeId={kunde.id} lieferungen={kunde.lieferungen} />}
      </div>
    </div>
  );
}

// ─── Notizen Tab ──────────────────────────────────────────────────────────────

const THEMEN = ["Info", "Wichtig", "Offener Punkt", "Erledigt", "Rückruf", "Angebot"];
const THEMA_FARBEN: Record<string, string> = {
  "Info": "bg-blue-50 text-blue-700 border-blue-200",
  "Wichtig": "bg-red-50 text-red-700 border-red-200",
  "Offener Punkt": "bg-orange-50 text-orange-700 border-orange-200",
  "Erledigt": "bg-green-50 text-green-700 border-green-200",
  "Rückruf": "bg-purple-50 text-purple-700 border-purple-200",
  "Angebot": "bg-yellow-50 text-yellow-700 border-yellow-200",
};

interface KundeNotiz {
  id: number;
  kundeId: number;
  text: string;
  thema?: string | null;
  erstellt: string;
}

function NotizenTab({ kundeId }: { kundeId: number }) {
  const { showToast } = useToast();
  const [notizen, setNotizen] = useState<KundeNotiz[]>([]);
  const [newText, setNewText] = useState("");
  const [newThema, setNewThema] = useState("");
  const [loading, setLoading] = useState(true);
  const [filterThema, setFilterThema] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/kunden/${kundeId}/notizen`)
      .then((r) => r.json())
      .then((data) => {
        setNotizen(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [kundeId]);

  async function handleAdd() {
    if (!newText.trim()) return;
    // Optimistic update: add a temporary note immediately
    const tempId = -Date.now();
    const tempNotiz: KundeNotiz = {
      id: tempId,
      kundeId,
      text: newText,
      thema: newThema || null,
      erstellt: new Date().toISOString(),
    };
    setNotizen((prev) => [tempNotiz, ...prev]);
    const savedText = newText;
    const savedThema = newThema;
    setNewText("");
    setNewThema("");
    setSaving(true);
    try {
      const res = await fetch(`/api/kunden/${kundeId}/notizen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: savedText, thema: savedThema || null }),
      });
      if (res.ok) {
        const notiz = await res.json();
        // Replace temp note with real one from server
        setNotizen((prev) => prev.map((n) => (n.id === tempId ? notiz : n)));
        showToast("Notiz gespeichert", "success");
      } else {
        // Revert on error
        setNotizen((prev) => prev.filter((n) => n.id !== tempId));
        setNewText(savedText);
        setNewThema(savedThema);
        showToast("Fehler beim Speichern", "error");
      }
    } catch {
      // Revert on network error
      setNotizen((prev) => prev.filter((n) => n.id !== tempId));
      setNewText(savedText);
      setNewThema(savedThema);
      showToast("Fehler beim Speichern", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(notizId: number) {
    // Optimistic delete
    setNotizen((prev) => prev.filter((n) => n.id !== notizId));
    try {
      const res = await fetch(`/api/kunden/${kundeId}/notizen?notizId=${notizId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        // Revert: re-fetch to restore
        fetch(`/api/kunden/${kundeId}/notizen`)
          .then((r) => r.json())
          .then(setNotizen)
          .catch(() => {});
        showToast("Fehler beim Löschen", "error");
      }
    } catch {
      fetch(`/api/kunden/${kundeId}/notizen`)
        .then((r) => r.json())
        .then(setNotizen)
        .catch(() => {});
      showToast("Fehler beim Löschen", "error");
    }
  }

  const filtered = filterThema ? notizen.filter((n) => n.thema === filterThema) : notizen;

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-800">Notizen</h3>

      {/* Add form */}
      <div className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50">
        <textarea
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          placeholder="Neue Notiz eingeben…"
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
        />
        <div className="flex items-center gap-3">
          <select
            value={newThema}
            onChange={(e) => setNewThema(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">Kein Thema</option>
            {THEMEN.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <button
            onClick={handleAdd}
            disabled={!newText.trim() || saving}
            className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Speichern…" : "Notiz hinzufügen"}
          </button>
        </div>
      </div>

      {/* Filter buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilterThema(null)}
          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
            filterThema === null
              ? "bg-gray-800 text-white border-gray-800"
              : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
          }`}
        >
          Alle ({notizen.length})
        </button>
        {THEMEN.map((t) => {
          const count = notizen.filter((n) => n.thema === t).length;
          if (count === 0) return null;
          return (
            <button
              key={t}
              onClick={() => setFilterThema(filterThema === t ? null : t)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                filterThema === t
                  ? "bg-gray-800 text-white border-gray-800"
                  : `${THEMA_FARBEN[t] ?? "bg-gray-50 text-gray-700 border-gray-200"} hover:opacity-80`
              }`}
            >
              {t} ({count})
            </button>
          );
        })}
      </div>

      {/* Notes list */}
      {loading ? (
        <p className="text-sm text-gray-400">Lade Notizen…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-400">Keine Notizen vorhanden.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((notiz) => (
            <div key={notiz.id} className="border border-gray-200 rounded-lg p-4 bg-white space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">
                    {new Date(notiz.erstellt).toLocaleString("de-DE", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {notiz.thema && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                        THEMA_FARBEN[notiz.thema] ?? "bg-gray-50 text-gray-700 border-gray-200"
                      }`}
                    >
                      {notiz.thema}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(notiz.id)}
                  className="text-gray-400 hover:text-red-500 transition-colors text-sm"
                  title="Notiz löschen"
                >
                  ✕
                </button>
              </div>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{notiz.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── CRM Tab ──────────────────────────────────────────────────────────────────

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

function CrmTab({ kundeId, autoOpen }: { kundeId: number; autoOpen?: boolean }) {
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

// ─── Agrarantrag Tab ──────────────────────────────────────────────────────────

interface AntragDaten {
  id: number;
  haushaltsjahr: number;
  name: string;
  plz: string | null;
  gemeinde: string | null;
  land: string | null;
  egflGesamt: number;
  elerGesamt: number;
  gesamtBetrag: number;
  massnahmen: string | null;
  mutterunternehmen: string | null;
  importiertAm: string;
}

interface AntragMassnahme {
  code: string;
  ziel: string;
  egfl: number;
  eler: number;
}

function formatEurAntrag(n: number) {
  return n.toLocaleString("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
}

function AgrarantragTab({ kundeId }: { kundeId: number }) {
  const [antragDaten, setAntragDaten] = useState<AntragDaten[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  // Betrieb/Fläche edit state (stored on Kunde)
  const [betriebsnummer, setBetriebsnummer] = useState("");
  const [flaeche, setFlaeche] = useState("");
  const [savingMeta, setSavingMeta] = useState(false);
  const [metaSaved, setMetaSaved] = useState(false);

  // Load existing kunde fields
  useEffect(() => {
    fetch(`/api/kunden/${kundeId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.betriebsnummer) setBetriebsnummer(d.betriebsnummer);
        if (d.flaeche) setFlaeche(String(d.flaeche));
      });
    loadAntragDaten();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kundeId]);

  function loadAntragDaten() {
    setLoading(true);
    fetch(`/api/agrarantraege?kundeId=${kundeId}`)
      .then((r) => r.json())
      .then((d) => { setAntragDaten(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }

  async function saveMeta() {
    setSavingMeta(true);
    await fetch(`/api/kunden/${kundeId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        betriebsnummer: betriebsnummer.trim() || undefined,
        flaeche: flaeche ? parseFloat(flaeche) : undefined,
      }),
    });
    setSavingMeta(false);
    setMetaSaved(true);
    setTimeout(() => setMetaSaved(false), 2000);
  }

  const totalGesamt = antragDaten.reduce((s, a) => s + a.gesamtBetrag, 0);
  const totalEgfl   = antragDaten.reduce((s, a) => s + a.egflGesamt, 0);
  const totalEler   = antragDaten.reduce((s, a) => s + a.elerGesamt, 0);

  return (
    <div className="space-y-5">
      {/* Betriebsdaten (manuell) */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Betriebsdaten</h3>
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Betriebsnummer</label>
            <input
              type="text"
              value={betriebsnummer}
              onChange={(e) => setBetriebsnummer(e.target.value)}
              placeholder="z.B. DE-NW-12345678"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Fläche (ha)</label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={flaeche}
              onChange={(e) => setFlaeche(e.target.value)}
              placeholder="z.B. 120.5"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={saveMeta}
              disabled={savingMeta}
              className="px-4 py-2 text-sm bg-green-700 hover:bg-green-800 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {savingMeta ? "…" : metaSaved ? "✓ Gespeichert" : "Speichern"}
            </button>
          </div>
        </div>
      </div>

      {/* Verknüpfte AFIG-Daten */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">
          Förderzahlungen (AFIG / agrarzahlungen.de)
        </h3>
        <div className="flex gap-2">
          <button
            onClick={loadAntragDaten}
            className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            ↻ Aktualisieren
          </button>
          <a
            href={`/api/agrarantraege/pdf?kundeId=${kundeId}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 rounded-lg transition-colors font-medium"
          >
            📄 PDF drucken
          </a>
          <a
            href="/agrarantraege"
            className="text-xs px-3 py-1.5 border border-blue-200 text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
          >
            Alle Antragsdaten →
          </a>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Lade…</p>
      ) : antragDaten.length === 0 ? (
        <div className="text-center py-10 text-gray-400 border border-dashed border-gray-200 rounded-xl">
          <p className="text-2xl mb-2">📋</p>
          <p className="text-sm">Noch keine Antragsdaten verknüpft.</p>
          <p className="text-xs mt-1">
            Im Bereich{" "}
            <a href="/agrarantraege" className="text-green-700 hover:underline">Agraranträge</a>
            {" "}CSV importieren und diesen Kunden verknüpfen.
          </p>
        </div>
      ) : (
        <>
          {/* Gesamtübersicht */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">Gesamt (alle Jahre)</p>
              <p className="text-lg font-bold text-green-800">{formatEurAntrag(totalGesamt)}</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">EGFL</p>
              <p className="text-lg font-bold text-blue-800">{formatEurAntrag(totalEgfl)}</p>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">ELER</p>
              <p className="text-lg font-bold text-orange-800">{formatEurAntrag(totalEler)}</p>
            </div>
          </div>

          {/* Pro Jahr */}
          <div className="space-y-3">
            {antragDaten.map((antrag) => {
              let massnahmen: AntragMassnahme[] = [];
              try { if (antrag.massnahmen) massnahmen = JSON.parse(antrag.massnahmen); } catch { /* ignore */ }
              return (
                <div key={antrag.id} className="border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpanded(expanded === antrag.id ? null : antrag.id)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-sm">Haushaltsjahr {antrag.haushaltsjahr}</span>
                      <span className="text-xs text-gray-500">{[antrag.plz, antrag.gemeinde].filter(Boolean).join(" ")}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="font-mono text-green-700 font-semibold">{formatEurAntrag(antrag.gesamtBetrag)}</span>
                      <span className="text-gray-400 text-xs">{massnahmen.length} Maßnahmen</span>
                      <span className="text-gray-400">{expanded === antrag.id ? "▲" : "▼"}</span>
                    </div>
                  </button>
                  {expanded === antrag.id && (
                    <div className="px-4 py-4 space-y-3">
                      <div className="flex gap-4 text-sm">
                        <div><span className="text-gray-500">EGFL:</span> <span className="font-medium">{formatEurAntrag(antrag.egflGesamt)}</span></div>
                        <div><span className="text-gray-500">ELER:</span> <span className="font-medium">{formatEurAntrag(antrag.elerGesamt)}</span></div>
                        {antrag.mutterunternehmen && (
                          <div><span className="text-gray-500">Mutter:</span> <span className="font-medium">{antrag.mutterunternehmen}</span></div>
                        )}
                      </div>
                      {massnahmen.length > 0 && (
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-gray-500 border-b border-gray-200">
                              <th className="text-left pb-1.5 pr-3">Maßnahme-Code</th>
                              <th className="text-left pb-1.5 pr-3">Spezifisches Ziel</th>
                              <th className="text-right pb-1.5 pr-3">EGFL</th>
                              <th className="text-right pb-1.5">ELER</th>
                            </tr>
                          </thead>
                          <tbody>
                            {massnahmen.map((m, i) => (
                              <tr key={i} className="border-b border-gray-100 last:border-0">
                                <td className="py-1.5 pr-3 font-mono font-medium">{m.code}</td>
                                <td className="py-1.5 pr-3 text-gray-600 max-w-[200px] truncate" title={m.ziel}>{m.ziel || "—"}</td>
                                <td className="py-1.5 pr-3 text-right font-mono">{m.egfl > 0 ? formatEurAntrag(m.egfl) : "—"}</td>
                                <td className="py-1.5 text-right font-mono">{m.eler > 0 ? formatEurAntrag(m.eler) : "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                      <p className="text-xs text-gray-400">
                        Importiert: {new Date(antrag.importiertAm).toLocaleDateString("de-DE")}
                        {" · "}Quelle: AFIG agrarzahlungen.de
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Schlagkartei Tab ─────────────────────────────────────────────────────────

interface KundeSchlag {
  id: number;
  kundeId: number;
  name: string;
  flaeche: number;
  fruchtart?: string | null;
  sorte?: string | null;
  vorfrucht?: string | null;
  aussaatJahr?: number | null;
  aussaatMenge?: number | null;
  notiz?: string | null;
  erstellt: string;
}

const inputClsSchlag =
  "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500";

function SchlagkarteiTab({ kundeId }: { kundeId: number }) {
  const [schlaegte, setSchlaegte] = useState<KundeSchlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    flaeche: "",
    fruchtart: "",
    sorte: "",
    vorfrucht: "",
    aussaatJahr: "",
    aussaatMenge: "",
    notiz: "",
  });

  const fetchSchlaegte = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/kunden/${kundeId}/schlaegte`);
    const data = await res.json();
    setSchlaegte(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [kundeId]);

  useEffect(() => { fetchSchlaegte(); }, [fetchSchlaegte]);

  function resetForm() {
    setForm({ name: "", flaeche: "", fruchtart: "", sorte: "", vorfrucht: "", aussaatJahr: "", aussaatMenge: "", notiz: "" });
    setError("");
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.flaeche) { setError("Name und Fläche sind erforderlich."); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/kunden/${kundeId}/schlaegte`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          flaeche: parseFloat(form.flaeche),
          fruchtart: form.fruchtart || null,
          sorte: form.sorte || null,
          vorfrucht: form.vorfrucht || null,
          aussaatJahr: form.aussaatJahr ? parseInt(form.aussaatJahr) : null,
          aussaatMenge: form.aussaatMenge ? parseFloat(form.aussaatMenge) : null,
          notiz: form.notiz || null,
        }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error ?? "Fehler"); return; }
      resetForm();
      setShowForm(false);
      fetchSchlaegte();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(schlagId: number) {
    setDeleting(schlagId);
    try {
      await fetch(`/api/kunden/${kundeId}/schlaegte?schlagId=${schlagId}`, { method: "DELETE" });
      fetchSchlaegte();
    } finally {
      setDeleting(null);
    }
  }

  const totalFlaeche = schlaegte.reduce((s, sl) => s + sl.flaeche, 0);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => { setShowForm(!showForm); if (showForm) resetForm(); }}
          className="text-sm px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
        >
          {showForm ? "Abbrechen" : "+ Neuer Schlag"}
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-3">Neuer Schlag erfassen</h3>
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2 mb-3">{error}</p>}
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Name <span className="text-red-500">*</span></label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className={inputClsSchlag} placeholder="z.B. Südfeld" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Fläche (ha) <span className="text-red-500">*</span></label>
                <input type="number" step="0.01" min="0" value={form.flaeche} onChange={(e) => setForm({ ...form, flaeche: e.target.value })} required className={inputClsSchlag} placeholder="z.B. 5.5" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Fruchtart</label>
                <input type="text" value={form.fruchtart} onChange={(e) => setForm({ ...form, fruchtart: e.target.value })} className={inputClsSchlag} placeholder="z.B. Winterweizen" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Sorte</label>
                <input type="text" value={form.sorte} onChange={(e) => setForm({ ...form, sorte: e.target.value })} className={inputClsSchlag} placeholder="Sortenname" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Vorfrucht</label>
                <input type="text" value={form.vorfrucht} onChange={(e) => setForm({ ...form, vorfrucht: e.target.value })} className={inputClsSchlag} placeholder="z.B. Raps" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Aussaat-Jahr</label>
                <input type="number" min="2000" max="2100" value={form.aussaatJahr} onChange={(e) => setForm({ ...form, aussaatJahr: e.target.value })} className={inputClsSchlag} placeholder="z.B. 2024" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Aussaat-Menge (kg/ha)</label>
                <input type="number" step="0.1" min="0" value={form.aussaatMenge} onChange={(e) => setForm({ ...form, aussaatMenge: e.target.value })} className={inputClsSchlag} placeholder="z.B. 180" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notiz</label>
                <input type="text" value={form.notiz} onChange={(e) => setForm({ ...form, notiz: e.target.value })} className={inputClsSchlag} placeholder="Optionale Notiz" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => { setShowForm(false); resetForm(); }} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Abbrechen</button>
              <button type="submit" disabled={saving} className="px-4 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-60">{saving ? "…" : "Speichern"}</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">Lade Schlagkartei…</p>
      ) : schlaegte.length === 0 ? (
        <p className="text-sm text-gray-400">Noch keine Schläge erfasst.</p>
      ) : (
        <div className="overflow-x-auto bg-white rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Fläche (ha)</th>
                <th className="hidden sm:table-cell px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Fruchtart</th>
                <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Sorte</th>
                <th className="hidden lg:table-cell px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Vorfrucht</th>
                <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Aussaat-Jahr</th>
                <th className="hidden lg:table-cell px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">kg/ha</th>
                <th className="hidden lg:table-cell px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Notiz</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {schlaegte.map((sl) => (
                <tr key={sl.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-900">
                    {sl.name}
                    <div className="sm:hidden text-xs text-gray-500 mt-0.5">{sl.fruchtart ?? "—"}{sl.sorte ? ` · ${sl.sorte}` : ""}</div>
                  </td>
                  <td className="px-4 py-2.5 font-mono">{sl.flaeche.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="hidden sm:table-cell px-4 py-2.5 text-gray-600">{sl.fruchtart ?? "—"}</td>
                  <td className="hidden md:table-cell px-4 py-2.5 text-gray-600">{sl.sorte ?? "—"}</td>
                  <td className="hidden lg:table-cell px-4 py-2.5 text-gray-600">{sl.vorfrucht ?? "—"}</td>
                  <td className="hidden md:table-cell px-4 py-2.5 text-gray-600">{sl.aussaatJahr ?? "—"}</td>
                  <td className="hidden lg:table-cell px-4 py-2.5 font-mono text-gray-600">{sl.aussaatMenge != null ? sl.aussaatMenge : "—"}</td>
                  <td className="hidden lg:table-cell px-4 py-2.5 text-gray-500 max-w-[160px] truncate">{sl.notiz ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => handleDelete(sl.id)}
                      disabled={deleting === sl.id}
                      className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40 transition-colors"
                    >
                      {deleting === sl.id ? "…" : "Löschen"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 text-sm font-medium text-gray-700">
            Gesamt: {totalFlaeche.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ha ({schlaegte.length} Schlag{schlaegte.length !== 1 ? "schläge" : ""})
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Angebote Tab ─────────────────────────────────────────────────────────────

interface AngebotListItem {
  id: number;
  nummer: string;
  datum: string;
  gueltigBis: string | null;
  status: string;
  gesamtbetrag: number;
  positionenAnzahl: number;
}

const ANGEBOT_STATUS_LABELS: Record<string, string> = {
  OFFEN: "Offen",
  ANGENOMMEN: "Angenommen",
  ABGELEHNT: "Abgelehnt",
  ABGELAUFEN: "Abgelaufen",
};

const ANGEBOT_STATUS_FARBEN: Record<string, string> = {
  OFFEN: "bg-yellow-100 text-yellow-800",
  ANGENOMMEN: "bg-green-100 text-green-800",
  ABGELEHNT: "bg-red-100 text-red-800",
  ABGELAUFEN: "bg-gray-100 text-gray-600",
};

function AngeboteTab({ kundeId }: { kundeId: number }) {
  const [angebote, setAngebote] = useState<AngebotListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/angebote?kundeId=${kundeId}`)
      .then((r) => r.json())
      .then((d) => { setAngebote(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [kundeId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-900">Angebote</h3>
        <a
          href={`/angebote/neu?kundeId=${kundeId}`}
          className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-700 text-white text-xs font-medium rounded-lg hover:bg-green-800 transition-colors"
        >
          + Neues Angebot
        </a>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Lade…</p>
      ) : angebote.length === 0 ? (
        <div className="text-center py-10 text-gray-400 border border-dashed border-gray-200 rounded-xl">
          <p className="text-2xl mb-2">📋</p>
          <p className="text-sm">Noch keine Angebote für diesen Kunden.</p>
          <a href={`/angebote/neu?kundeId=${kundeId}`} className="mt-2 inline-block text-green-700 text-sm hover:underline">
            Erstes Angebot erstellen
          </a>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nummer</th>
                <th className="hidden sm:table-cell text-left py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Datum</th>
                <th className="hidden md:table-cell text-left py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Gültig bis</th>
                <th className="hidden md:table-cell text-right py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Pos.</th>
                <th className="text-right py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Betrag</th>
                <th className="text-center py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {angebote.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="py-2 pr-4 font-mono font-medium text-gray-900">
                    {a.nummer}
                    <div className="sm:hidden text-xs text-gray-500 mt-0.5">{formatDatum(a.datum)}</div>
                  </td>
                  <td className="hidden sm:table-cell py-2 pr-4 text-gray-600">{formatDatum(a.datum)}</td>
                  <td className="hidden md:table-cell py-2 pr-4 text-gray-600">
                    {a.gueltigBis ? formatDatum(a.gueltigBis) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="hidden md:table-cell py-2 pr-4 text-right text-gray-600">{a.positionenAnzahl}</td>
                  <td className="py-2 pr-4 text-right font-medium text-gray-900">{formatEuro(a.gesamtbetrag)}</td>
                  <td className="py-2 pr-4 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${ANGEBOT_STATUS_FARBEN[a.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {ANGEBOT_STATUS_LABELS[a.status] ?? a.status}
                    </span>
                  </td>
                  <td className="py-2 text-right">
                    <a href={`/angebote/${a.id}`} className="text-xs text-green-700 hover:underline font-medium">
                      Details →
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Aufgaben Tab ─────────────────────────────────────────────────────────────
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

function AufgabenTab({ kundeId }: { kundeId: number }) {
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

// ─── Vorgangskette Tab ────────────────────────────────────────────────────────

interface VorgangAngebot {
  id: number;
  nummer: string;
  datum: string;
  status: string;
  gesamtbetrag: number;
}

function VorgangskettTab({ kundeId, lieferungen }: { kundeId: number; lieferungen: Lieferung[] }) {
  const [angebote, setAngebote] = useState<VorgangAngebot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/angebote?kundeId=${kundeId}`)
      .then((r) => r.json())
      .then((d) => { setAngebote(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [kundeId]);

  // Match Lieferungen zu Angeboten via Notiz-Text
  function findLinkedLieferungen(angebot: VorgangAngebot): Lieferung[] {
    return lieferungen.filter((l) =>
      l.notiz && (
        l.notiz.includes(`Angebot ${angebot.nummer}`) ||
        l.notiz.includes(`AN-`) && l.notiz.includes(angebot.nummer)
      )
    );
  }

  // Lieferungen ohne Angebots-Referenz
  const unlinkedLieferungen = lieferungen.filter((l) =>
    !angebote.some((a) => l.notiz && l.notiz.includes(a.nummer))
  );

  function stepColor(done: boolean, active: boolean) {
    if (done) return "bg-green-500 border-green-500 text-white";
    if (active) return "bg-yellow-400 border-yellow-400 text-white";
    return "bg-gray-200 border-gray-300 text-gray-400";
  }

  function lieferungStepColor(l: Lieferung) {
    if (l.status === "storniert") return "bg-red-400 border-red-400 text-white";
    if (l.bezahltAm) return "bg-green-500 border-green-500 text-white";
    if (l.rechnungNr) return "bg-yellow-400 border-yellow-400 text-white";
    if (l.status === "geliefert") return "bg-blue-400 border-blue-400 text-white";
    return "bg-gray-200 border-gray-300 text-gray-400";
  }

  if (loading) return <p className="text-sm text-gray-400">Lade Vorgangskette…</p>;

  const hasData = angebote.length > 0 || lieferungen.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-900">Vorgangskette</h3>
        <div className="flex gap-2">
          <a href={`/angebote/neu?kundeId=${kundeId}`} className="text-xs px-2.5 py-1.5 bg-green-700 text-white rounded-lg hover:bg-green-800 transition-colors">
            + Angebot
          </a>
          <a href={`/lieferungen/neu?kundeId=${kundeId}`} className="text-xs px-2.5 py-1.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
            + Lieferung
          </a>
        </div>
      </div>

      {!hasData && (
        <div className="text-center py-10 text-gray-400 border border-dashed border-gray-200 rounded-xl">
          <p className="text-2xl mb-2">📋</p>
          <p className="text-sm">Noch keine Vorgänge für diesen Kunden.</p>
        </div>
      )}

      {/* Angebot-basierte Ketten */}
      {angebote.length > 0 && (
        <div className="space-y-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Angebote &amp; zugehörige Lieferungen</p>
          {angebote.map((a) => {
            const linkedLief = findLinkedLieferungen(a);
            const isAngenommen = a.status === "ANGENOMMEN";
            const isAbgelehnt = a.status === "ABGELEHNT" || a.status === "ABGELAUFEN";
            return (
              <div key={a.id} className="border border-gray-200 rounded-xl p-4 bg-white">
                {/* Angebot Step */}
                <div className="flex items-start gap-3">
                  <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${stepColor(isAngenommen, !isAngenommen && !isAbgelehnt)}`}>
                    A
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <a href={`/angebote/${a.id}`} className="text-sm font-semibold text-green-700 hover:underline">
                        {a.nummer}
                      </a>
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${ANGEBOT_STATUS_FARBEN[a.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {ANGEBOT_STATUS_LABELS[a.status] ?? a.status}
                      </span>
                      <span className="text-xs text-gray-400">{formatDatum(a.datum)}</span>
                      <span className="text-xs font-medium text-gray-700">{formatEuro(a.gesamtbetrag)}</span>
                    </div>
                    {a.status === "ANGENOMMEN" && linkedLief.length === 0 && (
                      <a
                        href={`/lieferungen/neu?ausAngebot=${a.id}`}
                        className="mt-1.5 inline-block text-xs text-blue-600 hover:underline"
                      >
                        Als Lieferung übernehmen →
                      </a>
                    )}
                  </div>
                </div>

                {/* Verbindungslinie + Lieferungen */}
                {linkedLief.length > 0 && (
                  <div className="ml-3.5 mt-1 border-l-2 border-gray-200 pl-6 space-y-3 pt-2">
                    {linkedLief.map((l) => {
                      const hatRechnung = !!l.rechnungNr;
                      const hatBezahlt = !!l.bezahltAm;
                      const total = l.positionen.reduce((s, p) => s + p.menge * p.verkaufspreis, 0);
                      return (
                        <div key={l.id}>
                          {/* Lieferung Step */}
                          <div className="flex items-start gap-3">
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${lieferungStepColor(l)}`}>
                              L
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <a href={`/lieferungen/${l.id}`} className="text-sm font-medium text-gray-800 hover:text-green-700">
                                  Lieferung #{l.id}
                                </a>
                                {statusBadge(l.status)}
                                <span className="text-xs text-gray-400">{formatDatum(l.datum)}</span>
                                <span className="text-xs font-medium text-gray-700">{formatEuro(total)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Rechnung Step */}
                          <div className="mt-1 ml-3 border-l-2 border-gray-100 pl-5 space-y-2 pt-2">
                            <div className="flex items-start gap-3">
                              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold flex-shrink-0 ${stepColor(hatBezahlt, hatRechnung && !hatBezahlt)}`}>
                                R
                              </div>
                              <div className="flex-1 min-w-0">
                                {hatRechnung ? (
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <a href={`/lieferungen/${l.id}/rechnung`} target="_blank" className="text-sm font-medium text-gray-800 hover:text-green-700">
                                      Rechnung {l.rechnungNr}
                                    </a>
                                    {l.rechnungDatum && <span className="text-xs text-gray-400">{formatDatum(l.rechnungDatum)}</span>}
                                    {hatBezahlt ? (
                                      <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">Bezahlt</span>
                                    ) : (
                                      <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">Offen</span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-400 italic">Noch keine Rechnung</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Lieferungen ohne Angebots-Referenz */}
      {unlinkedLieferungen.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Direkte Lieferungen (ohne Angebot)</p>
          {unlinkedLieferungen.map((l) => {
            const hatRechnung = !!l.rechnungNr;
            const hatBezahlt = !!l.bezahltAm;
            const total = l.positionen.reduce((s, p) => s + p.menge * p.verkaufspreis, 0);
            return (
              <div key={l.id} className="border border-gray-200 rounded-xl p-4 bg-white">
                {/* Lieferung */}
                <div className="flex items-start gap-3">
                  <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${lieferungStepColor(l)}`}>
                    L
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <a href={`/lieferungen/${l.id}`} className="text-sm font-semibold text-gray-800 hover:text-green-700">
                        Lieferung #{l.id}
                      </a>
                      {statusBadge(l.status)}
                      <span className="text-xs text-gray-400">{formatDatum(l.datum)}</span>
                      <span className="text-xs font-medium text-gray-700">{formatEuro(total)}</span>
                    </div>
                    {l.notiz && <p className="text-xs text-gray-500 mt-0.5 truncate">{l.notiz}</p>}
                  </div>
                </div>

                {/* Rechnung */}
                <div className="mt-2 ml-3.5 border-l-2 border-gray-100 pl-5 pt-1">
                  <div className="flex items-start gap-3">
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold flex-shrink-0 ${stepColor(hatBezahlt, hatRechnung && !hatBezahlt)}`}>
                      R
                    </div>
                    <div className="flex-1">
                      {hatRechnung ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <a href={`/lieferungen/${l.id}/rechnung`} target="_blank" className="text-sm font-medium text-gray-800 hover:text-green-700">
                            {l.rechnungNr}
                          </a>
                          {l.rechnungDatum && <span className="text-xs text-gray-400">{formatDatum(l.rechnungDatum)}</span>}
                          {hatBezahlt ? (
                            <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">Bezahlt</span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">Offen</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Noch keine Rechnung</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Legende */}
      <div className="flex gap-4 flex-wrap text-xs text-gray-500 pt-2 border-t border-gray-100">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
          Abgeschlossen / Bezahlt
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-yellow-400 inline-block" />
          In Bearbeitung
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-gray-200 inline-block" />
          Ausstehend
        </span>
        <span className="flex items-center gap-1.5">
          <span className="font-bold text-gray-600">A</span> = Angebot,
          <span className="font-bold text-gray-600 ml-1">L</span> = Lieferung,
          <span className="font-bold text-gray-600 ml-1">R</span> = Rechnung
        </span>
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
