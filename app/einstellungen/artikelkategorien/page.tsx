"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  DEFAULT_ARTIKEL_KATEGORIEN,
  DEFAULT_UNTERKATEGORIEN,
  getUnterkategorienKey,
  parseListSetting,
} from "@/lib/auswahllisten";

const STORE_KEY = "system.artikelkategorien";

// ── Editierbare Liste (Unterkategorien) ──────────────────────────────────────

function EditableList({
  title,
  storeKey,
  defaultItems,
  placeholder,
}: {
  title: string;
  storeKey: string;
  defaultItems?: string[];
  placeholder: string;
}) {
  const [items, setItems] = useState<string[]>([]);
  const [newItem, setNewItem] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/einstellungen?prefix=system.")
      .then((r) => r.ok ? r.json() : {})
      .then((d: Record<string, string>) => {
        if (d[storeKey]) {
          try { setItems(JSON.parse(d[storeKey])); } catch { /* ignore */ }
        } else if (defaultItems) {
          setItems(defaultItems);
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [storeKey, defaultItems]);

  async function save(list: string[]) {
    setSaving(true);
    try {
      const res = await fetch("/api/einstellungen", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: storeKey, value: JSON.stringify(list) }),
      });
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 1500); }
    } finally { setSaving(false); }
  }

  function addItem() {
    const v = newItem.trim();
    if (!v || items.includes(v)) return;
    const next = [...items, v];
    setItems(next);
    setNewItem("");
    save(next);
  }

  function removeItem(item: string) {
    const next = items.filter((i) => i !== item);
    setItems(next);
    save(next);
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        {saved && <span className="text-xs text-green-600">✓ Gespeichert</span>}
      </div>
      {!loaded ? (
        <p className="text-xs text-gray-400">Lade…</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mb-3 min-h-[2rem]">
            {items.map((item) => (
              <span
                key={item}
                className="flex items-center gap-1 bg-green-50 text-green-800 border border-green-200 px-2.5 py-1 rounded-full text-xs"
              >
                {item}
                <button
                  onClick={() => removeItem(item)}
                  className="ml-0.5 text-green-600 hover:text-red-600 leading-none"
                  disabled={saving}
                  title="Entfernen"
                >
                  ×
                </button>
              </span>
            ))}
            {items.length === 0 && (
              <p className="text-xs text-gray-400">Noch keine Einträge</p>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addItem())}
              placeholder={placeholder}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <button
              onClick={addItem}
              disabled={!newItem.trim() || saving}
              className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50 transition-colors"
            >
              + Hinzufügen
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Hauptseite ───────────────────────────────────────────────────────────────

export default function ArtikelkategorienPage() {
  const [items, setItems] = useState<string[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [newItem, setNewItem] = useState("");
  const [editing, setEditing] = useState<{ index: number; value: string } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; kind: "ok" | "err" } | null>(null);

  async function ladeStats() {
    try {
      const res = await fetch("/api/artikel/kategorien");
      if (res.ok) setCounts(await res.json());
    } catch { /* ignore */ }
  }

  useEffect(() => {
    fetch("/api/einstellungen?prefix=system.")
      .then((r) => r.ok ? r.json() : {})
      .then((raw) => {
        const d = raw as Record<string, string>;
        setItems(parseListSetting(d, STORE_KEY, DEFAULT_ARTIKEL_KATEGORIEN));
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    ladeStats();
  }, []);

  function flash(text: string, kind: "ok" | "err" = "ok") {
    setMessage({ text, kind });
    setTimeout(() => setMessage(null), 2500);
  }

  async function saveList(list: string[]) {
    setSaving(true);
    try {
      const res = await fetch("/api/einstellungen", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: STORE_KEY, value: JSON.stringify(list) }),
      });
      if (!res.ok) throw new Error();
      return true;
    } catch {
      flash("Fehler beim Speichern", "err");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function addItem() {
    const v = newItem.trim();
    if (!v) return;
    if (items.some((i) => i.toLowerCase() === v.toLowerCase())) {
      flash("Kategorie existiert bereits", "err");
      return;
    }
    const next = [...items, v];
    setItems(next);
    setNewItem("");
    if (await saveList(next)) flash("Hinzugefügt");
  }

  async function removeItem(index: number) {
    const name = items[index];
    const count = counts[name] ?? 0;
    const frage = count > 0
      ? `„${name}" löschen? ${count} Artikel nutzen diese Kategorie noch (bleiben unverändert).`
      : `„${name}" löschen?`;
    if (!confirm(frage)) return;
    const next = items.filter((_, i) => i !== index);
    setItems(next);
    if (await saveList(next)) flash("Gelöscht");
  }

  function startEdit(index: number) {
    setEditing({ index, value: items[index] });
  }

  async function commitEdit() {
    if (!editing) return;
    const neu = editing.value.trim();
    const alt = items[editing.index];
    if (!neu || neu === alt) { setEditing(null); return; }
    if (items.some((i, idx) => idx !== editing.index && i.toLowerCase() === neu.toLowerCase())) {
      flash("Kategorie existiert bereits", "err");
      return;
    }
    const count = counts[alt] ?? 0;
    if (count > 0) {
      const ok = confirm(`„${alt}" in „${neu}" umbenennen? ${count} Artikel werden aktualisiert.`);
      if (!ok) return;
    }
    setSaving(true);
    try {
      if (count > 0) {
        const res = await fetch("/api/artikel/kategorien", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ aktion: "umbenennen", von: alt, zu: neu }),
        });
        if (!res.ok) { flash("Fehler beim Aktualisieren der Artikel", "err"); return; }
      }
      const next = items.map((x, i) => (i === editing.index ? neu : x));
      setItems(next);
      setEditing(null);
      if (await saveList(next)) {
        flash(count > 0 ? `Umbenannt – ${count} Artikel aktualisiert` : "Umbenannt");
        ladeStats();
      }
    } finally {
      setSaving(false);
    }
  }

  const displayName = (k: string) => k === "Duenger" ? "Dünger" : k;

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/einstellungen" className="hover:text-green-700">Einstellungen</Link>
        <span>›</span>
        <span className="text-gray-800 font-medium">Artikelkategorien</span>
      </div>

      <h1 className="text-2xl font-bold mb-2">Artikelkategorien</h1>
      <p className="text-sm text-gray-500 mb-6">
        Kategorien zur Gruppierung von Artikeln (z.B. Futter, Dünger, Saatgut). Beim Umbenennen
        werden bereits gespeicherte Artikel automatisch aktualisiert.
      </p>

      {message && (
        <p className={`text-sm mb-3 ${message.kind === "ok" ? "text-green-700" : "text-red-600"}`}>
          {message.kind === "ok" ? "✓ " : "⚠ "}{message.text}
        </p>
      )}

      {/* Kategorien-Liste */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-1">Kategorien</h2>
        <p className="text-sm text-gray-500 mb-4">Hauptkategorien verwalten.</p>
        {!loaded ? (
          <p className="text-sm text-gray-400">Lade…</p>
        ) : (
          <>
            <ul className="divide-y divide-gray-100 mb-4">
              {items.length === 0 && (
                <li className="text-sm text-gray-400 py-2">Noch keine Kategorien vorhanden</li>
              )}
              {items.map((item, idx) => {
                const count = counts[item] ?? 0;
                const isEditing = editing?.index === idx;
                return (
                  <li key={`${item}-${idx}`} className="flex items-center gap-2 py-2">
                    {isEditing ? (
                      <input
                        autoFocus
                        type="text"
                        value={editing.value}
                        onChange={(e) => setEditing({ index: idx, value: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
                          else if (e.key === "Escape") setEditing(null);
                        }}
                        onBlur={commitEdit}
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    ) : (
                      <span className="flex-1 text-sm text-gray-800">
                        {displayName(item)}
                        {count > 0 && (
                          <span className="ml-2 text-xs text-gray-400">{count} Artikel</span>
                        )}
                      </span>
                    )}
                    {!isEditing && (
                      <>
                        <button
                          onClick={() => startEdit(idx)}
                          disabled={saving}
                          className="text-xs px-2 py-1 text-gray-600 hover:text-green-700 hover:bg-green-50 rounded disabled:opacity-50"
                        >
                          Bearbeiten
                        </button>
                        <button
                          onClick={() => removeItem(idx)}
                          disabled={saving}
                          className="text-xs px-2 py-1 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                        >
                          Löschen
                        </button>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
            <div className="flex gap-2 pt-2 border-t border-gray-100">
              <input
                type="text"
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addItem())}
                placeholder="Neue Kategorie, z.B. Pflanzenschutz"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <button
                onClick={addItem}
                disabled={!newItem.trim() || saving}
                className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50 transition-colors"
              >
                + Hinzufügen
              </button>
            </div>
          </>
        )}
      </div>

      {/* Unterkategorien je Kategorie */}
      {loaded && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-1">Unterkategorien</h2>
          <p className="text-sm text-gray-500 mb-4">
            Unterkategorien je Hauptkategorie verwalten. Sie erscheinen als Filter in der Artikelliste
            und als Dropdown bei der Artikel-Erfassung.
          </p>
          <div className="flex flex-col gap-4">
            {items.map((k) => (
              <EditableList
                key={k}
                title={displayName(k)}
                storeKey={getUnterkategorienKey(k)}
                defaultItems={DEFAULT_UNTERKATEGORIEN[k]}
                placeholder={`Neue Unterkat. für ${displayName(k)}`}
              />
            ))}
            {items.length === 0 && (
              <p className="text-sm text-gray-400">Erst Kategorien anlegen.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
