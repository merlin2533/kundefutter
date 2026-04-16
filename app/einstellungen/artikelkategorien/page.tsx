"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const STORE_KEY = "system.artikelkategorien";
const DEFAULT_KATEGORIEN = ["Futter", "Duenger", "Saatgut", "Analysen", "Beratung"];

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
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    fetch("/api/einstellungen?prefix=system.")
      .then((r) => r.json())
      .then((d) => {
        let list: string[] = DEFAULT_KATEGORIEN;
        if (d[STORE_KEY]) {
          try {
            const parsed = JSON.parse(d[STORE_KEY]);
            if (Array.isArray(parsed)) list = parsed;
          } catch {
            /* ignore */
          }
        }
        setItems(list);
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
    if (!neu || neu === alt) {
      setEditing(null);
      return;
    }
    if (items.some((i, idx) => idx !== editing.index && i.toLowerCase() === neu.toLowerCase())) {
      flash("Kategorie existiert bereits", "err");
      return;
    }

    const count = counts[alt] ?? 0;
    if (count > 0) {
      const ok = confirm(
        `„${alt}" in „${neu}" umbenennen? ${count} Artikel werden aktualisiert.`,
      );
      if (!ok) return;
    }

    setSaving(true);
    try {
      // Zuerst Artikel umbenennen (updateMany), dann Liste speichern
      if (count > 0) {
        const res = await fetch("/api/artikel/kategorien", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ aktion: "umbenennen", von: alt, zu: neu }),
        });
        if (!res.ok) {
          flash("Fehler beim Aktualisieren der Artikel", "err");
          return;
        }
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

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/einstellungen" className="hover:text-green-700">
          Einstellungen
        </Link>
        <span>›</span>
        <span className="text-gray-800 font-medium">Artikelkategorien</span>
      </div>

      <h1 className="text-2xl font-bold mb-2">Artikelkategorien</h1>
      <p className="text-sm text-gray-500 mb-6">
        Kategorien zur Gruppierung von Artikeln (z.B. Futter, Dünger, Saatgut). Beim Umbenennen
        werden bereits gespeicherte Artikel automatisch aktualisiert.
      </p>

      {message && (
        <p
          className={`text-sm mb-3 ${
            message.kind === "ok" ? "text-green-700" : "text-red-600"
          }`}
        >
          {message.kind === "ok" ? "✓ " : "⚠ "}
          {message.text}
        </p>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
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
                          if (e.key === "Enter") {
                            e.preventDefault();
                            commitEdit();
                          } else if (e.key === "Escape") {
                            setEditing(null);
                          }
                        }}
                        onBlur={commitEdit}
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    ) : (
                      <span className="flex-1 text-sm text-gray-800">
                        {item}
                        {count > 0 && (
                          <span className="ml-2 text-xs text-gray-400">
                            {count} Artikel
                          </span>
                        )}
                      </span>
                    )}
                    {!isEditing && (
                      <>
                        <button
                          onClick={() => startEdit(idx)}
                          disabled={saving}
                          className="text-xs px-2 py-1 text-gray-600 hover:text-green-700 hover:bg-green-50 rounded disabled:opacity-50"
                          title="Umbenennen"
                        >
                          Bearbeiten
                        </button>
                        <button
                          onClick={() => removeItem(idx)}
                          disabled={saving}
                          className="text-xs px-2 py-1 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                          title="Löschen"
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
    </div>
  );
}
