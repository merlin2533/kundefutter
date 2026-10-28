"use client";
import { useEffect, useState } from "react";
import * as Sentry from "@sentry/nextjs";
import { bestaetige } from "@/lib/dialog";
import type { LagerortAdresse } from "@/lib/auswahllisten";

const STORE_KEY = "system.lagerortAdressen";

export default function LagerortAdressenManager() {
  const [adressen, setAdressen] = useState<LagerortAdresse[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState<LagerortAdresse>({ name: "", strasse: "", plz: "", ort: "" });
  const [editIndex, setEditIndex] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/einstellungen?prefix=system.")
      .then((r) => (r.ok ? r.json() : {}))
      .then((d: Record<string, string>) => {
        if (d[STORE_KEY]) {
          try {
            setAdressen(JSON.parse(d[STORE_KEY]));
          } catch (err) {
            Sentry.captureException(err);
          }
        }
        setLoaded(true);
      })
      .catch((err) => {
        Sentry.captureException(err);
        setLoaded(true);
      });
  }, []);

  async function speichern(next: LagerortAdresse[]) {
    setSaving(true);
    try {
      const res = await fetch("/api/einstellungen", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: STORE_KEY, value: JSON.stringify(next) }),
      });
      if (res.ok) {
        setAdressen(next);
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      }
    } finally {
      setSaving(false);
    }
  }

  function starteNeu() {
    setEditIndex(null);
    setForm({ name: "", strasse: "", plz: "", ort: "" });
  }

  function starteBearbeiten(i: number) {
    setEditIndex(i);
    setForm({ ...adressen[i] });
  }

  async function uebernehmen() {
    const name = form.name.trim();
    if (!name) return;
    const eintrag: LagerortAdresse = {
      name,
      strasse: form.strasse?.trim() || undefined,
      plz: form.plz?.trim() || undefined,
      ort: form.ort?.trim() || undefined,
    };
    const next = [...adressen];
    if (editIndex !== null) {
      next[editIndex] = eintrag;
    } else {
      if (next.some((a) => a.name === name)) return;
      next.push(eintrag);
    }
    await speichern(next);
    starteNeu();
  }

  async function entfernen(i: number) {
    if (!(await bestaetige(`Lagerort-Adresse „${adressen[i].name}" wirklich entfernen?`))) return;
    const next = adressen.filter((_, idx) => idx !== i);
    await speichern(next);
    if (editIndex === i) starteNeu();
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold mb-1">Lagerort-Adressen</h2>
      <p className="text-sm text-gray-500 mb-3">
        Zustelladresse je Lagerort — ermöglicht, bei einer Lieferantenbestellung „an unser Lager"
        statt an einen Kunden (Streckengeschäft) zu liefern. Nur Lagerorte mit vollständiger Adresse
        (Straße, PLZ, Ort) stehen dort zur Auswahl.
      </p>
      {saved && <p className="text-xs text-green-600 mb-2">✓ Gespeichert</p>}
      {!loaded ? (
        <p className="text-sm text-gray-400">Lade…</p>
      ) : (
        <>
          <div className="space-y-2 mb-4">
            {adressen.length === 0 && (
              <p className="text-sm text-gray-400">Noch keine Lagerort-Adresse hinterlegt.</p>
            )}
            {adressen.map((a, i) => (
              <div
                key={a.name}
                className="flex items-center justify-between gap-3 border border-gray-200 rounded-lg px-3 py-2"
              >
                <div className="text-sm">
                  <span className="font-medium">{a.name}</span>
                  {a.strasse || a.plz || a.ort ? (
                    <span className="text-gray-500">
                      {" — "}
                      {[a.strasse, [a.plz, a.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ")}
                    </span>
                  ) : (
                    <span className="text-amber-600"> — keine Adresse, nicht auswählbar</span>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => starteBearbeiten(i)}
                    className="text-xs px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg transition-colors"
                  >
                    Bearbeiten
                  </button>
                  <button
                    onClick={() => entfernen(i)}
                    className="text-xs px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg transition-colors"
                  >
                    Entfernen
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
            <p className="text-sm font-medium mb-2">
              {editIndex !== null ? "Lagerort-Adresse bearbeiten" : "Neue Lagerort-Adresse"}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Name (z.B. Hauptlager)"
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm sm:col-span-2"
              />
              <input
                value={form.strasse ?? ""}
                onChange={(e) => setForm({ ...form, strasse: e.target.value })}
                placeholder="Straße + Hausnummer"
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm sm:col-span-2"
              />
              <input
                value={form.plz ?? ""}
                onChange={(e) => setForm({ ...form, plz: e.target.value })}
                placeholder="PLZ"
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
              />
              <input
                value={form.ort ?? ""}
                onChange={(e) => setForm({ ...form, ort: e.target.value })}
                placeholder="Ort"
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
              />
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={uebernehmen}
                disabled={saving || !form.name.trim()}
                className="text-sm px-3 py-1.5 bg-green-700 hover:bg-green-800 text-white rounded-lg font-medium transition-colors disabled:opacity-40"
              >
                {editIndex !== null ? "Speichern" : "Hinzufügen"}
              </button>
              {editIndex !== null && (
                <button
                  onClick={starteNeu}
                  className="text-sm px-3 py-1.5 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded-lg transition-colors"
                >
                  Abbrechen
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
