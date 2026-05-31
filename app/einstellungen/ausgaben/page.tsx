"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { SACHKONTEN_SKR03, ZAHLUNGSWEGE } from "@/lib/datev";

const DEFAULT_KATEGORIEN = [
  "Wareneinkauf",
  "Betriebsbedarf",
  "Fahrtkosten",
  "Bürobedarf",
  "Telefon/Internet",
  "Versicherung",
  "Miete",
  "Personal",
  "Sonstige",
];

async function saveKey(key: string, value: string) {
  await fetch("/api/einstellungen", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, value }),
  });
}

export default function AusgabenEinstellungenPage() {
  const [kategorien, setKategorien] = useState<string[]>(DEFAULT_KATEGORIEN);
  const [neueKategorie, setNeueKategorie] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sachkonto-Zuordnung je Kategorie
  const [sachkontoMap, setSachkontoMap] = useState<Record<string, string>>({});
  const [sachkontoSaved, setSachkontoSaved] = useState(false);

  // Kostenstellen
  const [kostenstellen, setKostenstellen] = useState<string[]>([]);
  const [neueKostenstelle, setNeueKostenstelle] = useState("");
  const [kostenstelleSaved, setKostenstelleSaved] = useState(false);

  // Gegenkonten je Zahlungsweg
  const [gegenkonten, setGegenkonten] = useState<Record<string, string>>({
    Bar: "1000", Überweisung: "1200", EC: "1200", Kreditkarte: "1200", Privat: "1890",
  });
  const [gegenkonteSaved, setGegenkonteSaved] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/einstellungen?prefix=ausgaben.");
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data["ausgaben.kategorien"]) {
        try {
          const parsed = JSON.parse(data["ausgaben.kategorien"]);
          if (Array.isArray(parsed)) setKategorien(parsed);
        } catch { /* keep defaults */ }
      }
      if (data["ausgaben.sachkonten"]) {
        try { setSachkontoMap(JSON.parse(data["ausgaben.sachkonten"]) ?? {}); } catch { /* ignore */ }
      }
      if (data["ausgaben.kostenstellen"]) {
        try { setKostenstellen(JSON.parse(data["ausgaben.kostenstellen"]) ?? []); } catch { /* ignore */ }
      }
      if (data["ausgaben.gegenkonten"]) {
        try { setGegenkonten(prev => ({ ...prev, ...JSON.parse(data["ausgaben.gegenkonten"]) })); } catch { /* ignore */ }
      }
    } catch {
      setError("Fehler beim Laden der Einstellungen.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  // ── Kategorien ────────────────────────────────────────────────────────────
  function handleAdd() {
    const trimmed = neueKategorie.trim();
    if (!trimmed) return;
    if (kategorien.includes(trimmed)) { setError("Diese Kategorie ist bereits vorhanden."); return; }
    setKategorien(prev => [...prev, trimmed]);
    setNeueKategorie("");
    setError(null);
  }

  function handleRemove(idx: number) {
    setKategorien(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleSaveKategorien(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await saveKey("ausgaben.kategorien", JSON.stringify(kategorien));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { setError("Fehler beim Speichern."); }
    finally { setSaving(false); }
  }

  // ── Sachkonten ────────────────────────────────────────────────────────────
  async function handleSaveSachkonten() {
    await saveKey("ausgaben.sachkonten", JSON.stringify(sachkontoMap));
    setSachkontoSaved(true);
    setTimeout(() => setSachkontoSaved(false), 2000);
  }

  // ── Kostenstellen ─────────────────────────────────────────────────────────
  function addKostenstelle() {
    const t = neueKostenstelle.trim();
    if (!t || kostenstellen.includes(t)) return;
    setKostenstellen(prev => [...prev, t]);
    setNeueKostenstelle("");
  }

  async function handleSaveKostenstellen() {
    await saveKey("ausgaben.kostenstellen", JSON.stringify(kostenstellen));
    setKostenstelleSaved(true);
    setTimeout(() => setKostenstelleSaved(false), 2000);
  }

  // ── Gegenkonten ───────────────────────────────────────────────────────────
  async function handleSaveGegenkonten() {
    await saveKey("ausgaben.gegenkonten", JSON.stringify(gegenkonten));
    setGegenkonteSaved(true);
    setTimeout(() => setGegenkonteSaved(false), 2000);
  }

  if (loading) {
    return <p className="text-gray-400 mt-8 text-sm">Lade Einstellungen…</p>;
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/einstellungen" className="hover:text-green-700">Einstellungen</Link>
        <span>›</span>
        <span className="text-gray-800 font-medium">Ausgaben</span>
      </div>

      <h1 className="text-2xl font-bold mb-2">Ausgaben-Einstellungen</h1>
      <p className="text-sm text-gray-500 mb-6">
        Kategorien, Buchungskonten (DATEV), Kostenstellen und Zahlungsweg-Gegenkonten.
      </p>

      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <p className="font-medium mb-1">GoBD-Hinweis</p>
        <p className="text-blue-700">
          Belege müssen gemäß GoBD 10 Jahre aufbewahrt werden. Die hier konfigurierten Sachkonten werden
          automatisch bei neuen Ausgaben vorgeschlagen und können pro Beleg überschrieben werden.
        </p>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* ── Sektion 1: Kategorien ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <form onSubmit={handleSaveKategorien} className="space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Kategorien</h2>
            <div className="space-y-2 mb-4">
              {kategorien.map((kat, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50">{kat}</span>
                  <button type="button" onClick={() => handleRemove(idx)}
                    className="px-3 py-2 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors whitespace-nowrap">
                    Entfernen
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input type="text" value={neueKategorie} onChange={e => setNeueKategorie(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
                placeholder="Neue Kategorie…"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              <button type="button" onClick={handleAdd}
                className="px-4 py-2 text-sm border border-green-600 text-green-700 rounded-lg hover:bg-green-50 transition-colors whitespace-nowrap">
                + Hinzufügen
              </button>
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button type="submit" disabled={saving}
              className="px-5 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-60">
              {saving ? "Speichern…" : saved ? "✓ Gespeichert" : "Speichern"}
            </button>
          </div>
        </form>
      </div>

      {/* ── Sektion 2: Sachkonto-Zuordnung ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mt-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-1">Buchungskonto-Zuordnung (Sachkonten)</h2>
        <p className="text-xs text-gray-400 mb-4">
          Standard-Sachkonto je Ausgaben-Kategorie für den DATEV-Export (SKR03-Vorschläge vorbelegt).
          Kann pro Ausgabe manuell überschrieben werden.
        </p>
        <div className="space-y-2 mb-4">
          {kategorien.map(kat => (
            <div key={kat} className="flex items-center gap-3">
              <span className="flex-1 text-sm text-gray-700">{kat}</span>
              <input
                type="text"
                value={sachkontoMap[kat] ?? ""}
                onChange={e => setSachkontoMap(prev => ({ ...prev, [kat]: e.target.value }))}
                placeholder={SACHKONTEN_SKR03[kat] ?? "4900"}
                className="w-28 border rounded px-2 py-1 text-sm text-right font-mono"
              />
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mb-3">
          Typ-basierte Konten (Privatentnahme=1800, Privateinlage=1890, Bewirtung=4654, Reisekosten=4530)
          werden unabhängig von dieser Tabelle automatisch gesetzt.
        </p>
        <div className="flex justify-end">
          <button type="button" onClick={handleSaveSachkonten}
            className="px-5 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors">
            {sachkontoSaved ? "✓ Gespeichert" : "Speichern"}
          </button>
        </div>
      </div>

      {/* ── Sektion 3: Kostenstellen ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mt-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-1">Kostenstellen</h2>
        <p className="text-xs text-gray-400 mb-4">
          Kostenstellen für die Buchung (werden im Ausgabeformular als Vorschläge angezeigt).
          Wird in DATEV-Export-Feld &ldquo;Kostenrechnung - Kostenstelle 1&rdquo; übertragen.
        </p>
        <div className="space-y-2 mb-4">
          {kostenstellen.map((ks, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50">{ks}</span>
              <button type="button" onClick={() => setKostenstellen(prev => prev.filter((_, i) => i !== idx))}
                className="px-3 py-2 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50 whitespace-nowrap">
                Entfernen
              </button>
            </div>
          ))}
          {kostenstellen.length === 0 && (
            <p className="text-xs text-gray-400 italic">Noch keine Kostenstellen konfiguriert.</p>
          )}
        </div>
        <div className="flex gap-2 mb-4">
          <input type="text" value={neueKostenstelle} onChange={e => setNeueKostenstelle(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addKostenstelle(); } }}
            placeholder="z.B. Vertrieb, Verwaltung, Fuhrpark…"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          <button type="button" onClick={addKostenstelle}
            className="px-4 py-2 text-sm border border-green-600 text-green-700 rounded-lg hover:bg-green-50 whitespace-nowrap">
            + Hinzufügen
          </button>
        </div>
        <div className="flex justify-end">
          <button type="button" onClick={handleSaveKostenstellen}
            className="px-5 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors">
            {kostenstelleSaved ? "✓ Gespeichert" : "Speichern"}
          </button>
        </div>
      </div>

      {/* ── Sektion 4: Gegenkonten je Zahlungsweg ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mt-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-1">Standard-Gegenkonten (Zahlungsweg)</h2>
        <p className="text-xs text-gray-400 mb-4">
          Gegenkonto je Zahlungsweg im DATEV-Export. Vorbelegt mit SKR03-Standardkonten.
        </p>
        <div className="space-y-2 mb-4">
          {(ZAHLUNGSWEGE as readonly string[]).map(zw => (
            <div key={zw} className="flex items-center gap-3">
              <span className="w-32 text-sm text-gray-700">{zw}</span>
              <span className="text-xs text-gray-400">→ Konto</span>
              <input
                type="text"
                value={gegenkonten[zw] ?? ""}
                onChange={e => setGegenkonten(prev => ({ ...prev, [zw]: e.target.value }))}
                placeholder="z.B. 1200"
                className="w-28 border rounded px-2 py-1 text-sm text-right font-mono"
              />
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mb-3">
          SKR03-Defaults: Bar=1000, Überweisung/EC/Kreditkarte=1200, Privat=1890 |
          SKR04: Bar=1600, Bank=1800, Privat=2110
        </p>
        <div className="flex justify-end">
          <button type="button" onClick={handleSaveGegenkonten}
            className="px-5 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors">
            {gegenkonteSaved ? "✓ Gespeichert" : "Speichern"}
          </button>
        </div>
      </div>
    </div>
  );
}
