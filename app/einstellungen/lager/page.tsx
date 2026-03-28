"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

function ListenEditor({ settingKey, label, placeholder }: { settingKey: string; label: string; placeholder: string }) {
  const [items, setItems] = useState<string[]>([]);
  const [newItem, setNewItem] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`/api/einstellungen?prefix=system.`)
      .then((r) => r.json())
      .then((d) => {
        if (d[settingKey]) {
          try { setItems(JSON.parse(d[settingKey])); } catch { /* ignore */ }
        }
      });
  }, [settingKey]);

  async function save(list: string[]) {
    setSaving(true);
    await fetch("/api/einstellungen", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: settingKey, value: JSON.stringify(list) }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
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
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mt-6">
      <h2 className="text-lg font-semibold mb-1">{label}</h2>
      {saved && <p className="text-xs text-green-600 mb-2">✓ Gespeichert</p>}
      <div className="flex flex-wrap gap-2 mb-3 min-h-[2rem]">
        {items.map((item) => (
          <span key={item} className="flex items-center gap-1 bg-green-50 text-green-800 border border-green-200 px-3 py-1 rounded-full text-sm">
            {item}
            <button onClick={() => removeItem(item)} className="ml-1 text-green-600 hover:text-red-600 leading-none text-base" disabled={saving}>×</button>
          </span>
        ))}
        {items.length === 0 && <p className="text-sm text-gray-400">Noch keine Einträge</p>}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addItem())}
          placeholder={placeholder}
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
    </div>
  );
}

export default function LagerPage() {
  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/einstellungen" className="hover:text-green-700">Einstellungen</Link>
        <span>›</span>
        <span className="text-gray-800 font-medium">Lager</span>
      </div>

      <h1 className="text-2xl font-bold mb-6">Lager</h1>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-1">Mindestbestände & Alarme</h2>
        <p className="text-sm text-gray-500">
          Globale Schwellenwerte für Mindestbestände und Lageralarme können hier konfiguriert werden.
          Artikel-spezifische Einstellungen finden Sie im Artikelstamm.
        </p>
      </div>

      <ListenEditor
        settingKey="system.mitarbeiter"
        label="Mitarbeiter / Verantwortliche"
        placeholder="z.B. Max Mustermann"
      />
      <ListenEditor
        settingKey="system.kundenkategorien"
        label="Kunden-Kategorien"
        placeholder="z.B. Landwirt"
      />
    </div>
  );
}
