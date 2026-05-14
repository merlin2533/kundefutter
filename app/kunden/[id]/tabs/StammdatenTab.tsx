"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { formatDatum } from "@/lib/utils";
import { Kunde, KundeNotiz, Field, InfoRow, NaechsterBesuchInfo } from "../_shared";

export default function StammdatenTab({ kunde, onRefresh }: { kunde: Kunde; onRefresh: () => void }) {
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
    kreditlimit: kunde.kreditlimit != null ? String(kunde.kreditlimit) : "",
    sachkundeNr: kunde.sachkundeNr ?? "",
    sachkundeGueltigBis: kunde.sachkundeGueltigBis ? kunde.sachkundeGueltigBis.slice(0, 10) : "",
    vvvoNr: kunde.vvvoNr ?? "",
  });

  useEffect(() => {
    fetch("/api/einstellungen?prefix=system.")
      .then((r) => r.ok ? r.json() : {})
      .then((d: Record<string, string>) => {
        if (d["system.kundenkategorien"]) {
          try { setKategorien(JSON.parse(d["system.kundenkategorien"])); } catch { /* ignore */ }
        }
        if (d["system.mitarbeiter"]) {
          try { setMitarbeiter(JSON.parse(d["system.mitarbeiter"])); } catch { /* ignore */ }
        }
      })
      .catch(() => {});
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
      kreditlimit: kunde.kreditlimit != null ? String(kunde.kreditlimit) : "",
      sachkundeNr: kunde.sachkundeNr ?? "",
      sachkundeGueltigBis: kunde.sachkundeGueltigBis ? kunde.sachkundeGueltigBis.slice(0, 10) : "",
      vvvoNr: kunde.vvvoNr ?? "",
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
          kreditlimit: form.kreditlimit ? parseFloat(form.kreditlimit) : null,
          sachkundeNr: form.sachkundeNr || null,
          sachkundeGueltigBis: form.sachkundeGueltigBis || null,
          vvvoNr: form.vvvoNr || null,
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
          <InfoRow
            label="Kreditlimit (€)"
            value={kunde.kreditlimit != null ? kunde.kreditlimit.toLocaleString("de-DE", { style: "currency", currency: "EUR" }) : "Kein Limit"}
          />
          <InfoRow label="Sachkunde-Nr." value={kunde.sachkundeNr} />
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Sachkunde gültig bis</p>
            {kunde.sachkundeGueltigBis ? (() => {
              const bis = new Date(kunde.sachkundeGueltigBis);
              const now = new Date();
              const diffDays = Math.ceil((bis.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              const warn = diffDays <= 90;
              return (
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-sm text-gray-800">{bis.toLocaleDateString("de-DE")}</span>
                  {warn && (
                    <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full font-medium">
                      {diffDays < 0 ? "Abgelaufen" : `läuft ab in ${diffDays}d`}
                    </span>
                  )}
                </div>
              );
            })() : <p className="text-sm text-gray-400 mt-0.5">—</p>}
          </div>
          {kunde.lat !== undefined && kunde.lat !== null && (
            <InfoRow label="Koordinaten" value={`${kunde.lat?.toFixed(4)}, ${kunde.lng?.toFixed(4)}`} />
          )}
          {kunde.vvvoNr && (() => {
            const ziffern = (kunde.vvvoNr || "").replace(/\D/g, "");
            const normalisiert = ziffern.length === 9 ? "276" + ziffern : ziffern.substring(0, 12);
            const blMap: Record<string, string> = {
              "01": "Schleswig-Holstein", "02": "Hamburg", "03": "Niedersachsen", "04": "Bremen",
              "05": "Nordrhein-Westfalen", "06": "Hessen", "07": "Rheinland-Pfalz",
              "08": "Baden-Württemberg", "09": "Bayern", "10": "Saarland", "11": "Berlin",
              "12": "Brandenburg", "13": "Mecklenburg-Vorpommern", "14": "Sachsen",
              "15": "Sachsen-Anhalt", "16": "Thüringen",
            };
            const bl = blMap[normalisiert.substring(3, 5)];
            return <InfoRow label="VVVO/HIT-Nr." value={`DE ${normalisiert.substring(3, 5)} ${normalisiert.substring(5)}${bl ? ` (${bl})` : ""}`} />;
          })()}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href={`/sachkundenachweise?kundeId=${kunde.id}`} className="text-xs px-3 py-1.5 border rounded hover:bg-gray-50">📜 Sachkundenachweise</Link>
          <Link href={`/bodenproben?kundeId=${kunde.id}`} className="text-xs px-3 py-1.5 border rounded hover:bg-gray-50">🧪 Bodenproben</Link>
          <Link href={`/duengebedarf?kundeId=${kunde.id}`} className="text-xs px-3 py-1.5 border rounded hover:bg-gray-50">🧮 Düngebedarf</Link>
          <Link href={`/vorbestellungen?kundeId=${kunde.id}`} className="text-xs px-3 py-1.5 border rounded hover:bg-gray-50">📋 Vorbestellungen</Link>
        </div>
        {/* Contact info from KundeKontakt */}
        {kunde.kontakte.length > 0 && (() => {
          const telefone = kunde.kontakte.filter((k) => k.typ === "telefon" || k.typ === "mobil");
          const emails = kunde.kontakte.filter((k) => k.typ === "email");
          const faxe = kunde.kontakte.filter((k) => k.typ === "fax");
          return (
            <div className="col-span-2 space-y-2">
              {telefone.map((k) => (
                <div key={k.id} className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide w-28">{k.typ === "mobil" ? "Mobil" : "Telefon"}{k.label ? ` (${k.label})` : ""}</span>
                  <a href={`tel:${k.wert}`} className="text-sm text-green-700 hover:underline">{k.wert}</a>
                  {(k.vorname || k.nachname) && <span className="text-xs text-gray-400">— {[k.vorname, k.nachname].filter(Boolean).join(" ")}</span>}
                </div>
              ))}
              {emails.map((k) => (
                <div key={k.id} className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide w-28">E-Mail{k.label ? ` (${k.label})` : ""}</span>
                  <a href={`mailto:${k.wert}`} className="text-sm text-green-700 hover:underline">{k.wert}</a>
                  {(k.vorname || k.nachname) && <span className="text-xs text-gray-400">— {[k.vorname, k.nachname].filter(Boolean).join(" ")}</span>}
                </div>
              ))}
              {faxe.map((k) => (
                <div key={k.id} className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide w-28">Fax{k.label ? ` (${k.label})` : ""}</span>
                  <span className="text-sm text-gray-700">{k.wert}</span>
                </div>
              ))}
            </div>
          );
        })()}
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
        <label className="block text-sm font-medium text-gray-700 mb-1">Kreditlimit (€)</label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={form.kreditlimit}
          onChange={(e) => setForm({ ...form, kreditlimit: e.target.value })}
          placeholder="Leer = kein Limit"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <p className="text-xs text-gray-400 mt-0.5">Leer lassen = kein Kreditlimit</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Sachkunde-Nr.</label>
          <input
            type="text"
            value={form.sachkundeNr}
            onChange={(e) => setForm({ ...form, sachkundeNr: e.target.value })}
            placeholder="Sachkundenummer"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Sachkunde gültig bis</label>
          <input
            type="date"
            value={form.sachkundeGueltigBis}
            onChange={(e) => setForm({ ...form, sachkundeGueltigBis: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          {form.sachkundeGueltigBis && (() => {
            const bis = new Date(form.sachkundeGueltigBis);
            const now = new Date();
            const diffDays = Math.ceil((bis.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays <= 90) {
              return (
                <p className="text-xs text-orange-600 mt-0.5">
                  {diffDays < 0 ? "Sachkunde abgelaufen!" : `Sachkunde läuft in ${diffDays} Tagen ab`}
                </p>
              );
            }
            return null;
          })()}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">VVVO/HIT-Betriebsnummer</label>
        <input
          type="text"
          value={form.vvvoNr}
          onChange={(e) => setForm({ ...form, vvvoNr: e.target.value })}
          placeholder="z.B. DE 03 12345678 oder 276031234567"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        {form.vvvoNr && (() => {
          const ziffern = form.vvvoNr.replace(/\D/g, "");
          if (ziffern.length === 0) return null;
          if (ziffern.length !== 9 && ziffern.length !== 12 && ziffern.length !== 15) {
            return <p className="text-xs text-orange-600 mt-0.5">⚠ Format prüfen (9 oder 12 Ziffern)</p>;
          }
          const normalisiert = ziffern.length === 9 ? "276" + ziffern : ziffern.substring(0, 12);
          if (!normalisiert.startsWith("276")) {
            return <p className="text-xs text-orange-600 mt-0.5">⚠ Erwartet DE-Code 276</p>;
          }
          const blCode = normalisiert.substring(3, 5);
          const bundeslaender: Record<string, string> = {
            "01": "Schleswig-Holstein", "02": "Hamburg", "03": "Niedersachsen",
            "04": "Bremen", "05": "Nordrhein-Westfalen", "06": "Hessen",
            "07": "Rheinland-Pfalz", "08": "Baden-Württemberg", "09": "Bayern",
            "10": "Saarland", "11": "Berlin", "12": "Brandenburg",
            "13": "Mecklenburg-Vorpommern", "14": "Sachsen", "15": "Sachsen-Anhalt", "16": "Thüringen",
          };
          const bl = bundeslaender[blCode];
          return bl
            ? <p className="text-xs text-green-700 mt-0.5">✓ {bl} (DE {blCode} {normalisiert.substring(5)})</p>
            : <p className="text-xs text-orange-600 mt-0.5">⚠ Unbekannter Bundeslandcode {blCode}</p>;
        })()}
      </div>
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
