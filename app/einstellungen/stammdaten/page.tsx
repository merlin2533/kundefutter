"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DEFAULT_SAATGUT_KULTUREN, DEFAULT_EINHEITEN } from "@/lib/auswahllisten";

type ListKey =
  | "system.kundenkategorien"
  | "system.mitarbeiter"
  | "system.einheiten"
  | "system.notiz_themen"
  | "system.gutschrift_gruende"
  | "system.saatgut_kulturen";
const DEFAULT_NOTIZ_THEMEN = ["Info", "Wichtig", "Offener Punkt", "Erledigt", "Rückruf", "Angebot"];
const DEFAULT_GUTSCHRIFT_GRUENDE = ["Reklamation", "Retoure", "Preiskorrektur", "Sonstiges"];

function EditableList({
  title,
  description,
  storeKey,
  defaultItems,
  placeholder,
}: {
  title: string;
  description: string;
  storeKey: ListKey;
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
      .then((r) => r.json())
      .then((d) => {
        if (d[storeKey]) {
          try {
            setItems(JSON.parse(d[storeKey]));
          } catch {
            /* ignore */
          }
        } else if (defaultItems) {
          setItems(defaultItems);
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [storeKey, defaultItems]);

  async function save(list: string[]) {
    setSaving(true);
    await fetch("/api/einstellungen", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: storeKey, value: JSON.stringify(list) }),
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
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold mb-1">{title}</h2>
      <p className="text-sm text-gray-500 mb-3">{description}</p>
      {saved && <p className="text-xs text-green-600 mb-2">✓ Gespeichert</p>}
      {!loaded ? (
        <p className="text-sm text-gray-400">Lade…</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mb-3 min-h-[2rem]">
            {items.map((item) => (
              <span
                key={item}
                className="flex items-center gap-1 bg-green-50 text-green-800 border border-green-200 px-3 py-1 rounded-full text-sm"
              >
                {item}
                <button
                  onClick={() => removeItem(item)}
                  className="ml-1 text-green-600 hover:text-red-600 leading-none text-base"
                  disabled={saving}
                >
                  ×
                </button>
              </span>
            ))}
            {items.length === 0 && (
              <p className="text-sm text-gray-400">Noch keine Einträge vorhanden</p>
            )}
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
        </>
      )}
    </div>
  );
}

export default function StammdatenPage() {
  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/einstellungen" className="hover:text-green-700">
          Einstellungen
        </Link>
        <span>›</span>
        <span className="text-gray-800 font-medium">Stammdaten</span>
      </div>

      <h1 className="text-2xl font-bold mb-6">Stammdaten</h1>

      <div className="flex flex-col gap-6">
        <EditableList
          title="Kundenkategorien"
          description="Kategorien zur Klassifizierung von Kunden (z.B. Landwirt, Händler, Genossenschaft)."
          storeKey="system.kundenkategorien"
          placeholder="z.B. Landwirt"
        />
        <EditableList
          title="Mitarbeiter"
          description="Liste der Mitarbeiter für Zuordnungen in CRM und Touren."
          storeKey="system.mitarbeiter"
          placeholder="z.B. Max Mustermann"
        />
        <EditableList
          title="Einheiten"
          description="Mengeneinheiten für Artikel (kg, t, dt, l, Stk, km …)."
          storeKey="system.einheiten"
          defaultItems={DEFAULT_EINHEITEN}
          placeholder="z.B. Fass"
        />
        <EditableList
          title="Saatgut-Kulturen"
          description="Sub-Kategorien für Saatgut-Artikel (Mais, Raps, Getreide …). Erscheinen als Filter und Dropdown bei Artikeln der Kategorie 'Saatgut'."
          storeKey="system.saatgut_kulturen"
          defaultItems={DEFAULT_SAATGUT_KULTUREN}
          placeholder="z.B. Hirse"
        />
        <EditableList
          title="Notiz-Themen"
          description="Kategorien für Kundennotizen (z.B. Wichtig, Info, Offener Punkt)."
          storeKey="system.notiz_themen"
          defaultItems={DEFAULT_NOTIZ_THEMEN}
          placeholder="z.B. Reklamation"
        />
        <EditableList
          title="Gutschrift-Gründe"
          description="Gründe für Gutschriften und Retouren."
          storeKey="system.gutschrift_gruende"
          defaultItems={DEFAULT_GUTSCHRIFT_GRUENDE}
          placeholder="z.B. Transportschaden"
        />

        {/* Kundenimport */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold text-gray-800">Kundenimport</h2>
              <p className="text-sm text-gray-500 mt-1">
                Excel- oder CSV-Datei hochladen und Kunden-Stammdaten importieren.
                Unterstützte Spalten: Name, Firma, Kategorie, Strasse, PLZ, Ort, Land, Telefon, Mobil, E-Mail, Notizen.
              </p>
            </div>
            <Link
              href="/kundenimport"
              className="whitespace-nowrap px-4 py-2 text-sm bg-green-700 hover:bg-green-800 text-white rounded-lg font-medium transition-colors"
            >
              → Importieren
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
