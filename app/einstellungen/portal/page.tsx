"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface PortalZugang {
  id: number;
  kundeId: number;
  benutzername: string;
  aktiv: boolean;
  letzterLogin: string | null;
  createdAt: string;
  kunde: { id: number; name: string; firma: string | null };
}

interface KundeOption {
  id: number;
  name: string;
  firma: string | null;
}

function formatDatum(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function PortalEinstellungenPage() {
  const [zugaenge, setZugaenge] = useState<PortalZugang[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [kunden, setKunden] = useState<KundeOption[]>([]);
  const [search, setSearch] = useState("");

  // Form state
  const [kundeId, setKundeId] = useState("");
  const [benutzername, setBenutzername] = useState("");
  const [passwort, setPasswort] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Reset PW
  const [resetId, setResetId] = useState<number | null>(null);
  const [neuesPasswort, setNeuesPasswort] = useState("");
  const [resetSaving, setResetSaving] = useState(false);

  async function load() {
    const res = await fetch("/api/einstellungen/portal");
    const d = await res.json();
    setZugaenge(Array.isArray(d) ? d : []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function loadKunden(q: string) {
    if (q.length < 2) { setKunden([]); return; }
    const res = await fetch(`/api/kunden?search=${encodeURIComponent(q)}&limit=20`);
    if (!res.ok) return;
    const d = await res.json();
    const list: KundeOption[] = Array.isArray(d) ? d : (d.kunden ?? []);
    setKunden(list);
  }

  async function handleCreate() {
    setFormError("");
    if (!kundeId || !benutzername.trim() || !passwort) {
      setFormError("Alle Felder ausfüllen");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/einstellungen/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kundeId: parseInt(kundeId), benutzername, passwort }),
      });
      if (!res.ok) {
        const d = await res.json();
        setFormError(d.error ?? "Fehler");
        return;
      }
      setShowForm(false);
      setBenutzername("");
      setPasswort("");
      setKundeId("");
      setSearch("");
      setKunden([]);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function toggleAktiv(id: number, aktiv: boolean) {
    await fetch(`/api/einstellungen/portal?id=${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aktiv: !aktiv }),
    });
    await load();
  }

  async function handleDelete(id: number) {
    if (!confirm("Portal-Zugang löschen?")) return;
    await fetch(`/api/einstellungen/portal?id=${id}`, { method: "DELETE" });
    await load();
  }

  async function handleResetPasswort(id: number) {
    if (!neuesPasswort || neuesPasswort.length < 6) {
      alert("Passwort mind. 6 Zeichen");
      return;
    }
    setResetSaving(true);
    try {
      const res = await fetch(`/api/einstellungen/portal?id=${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passwort: neuesPasswort }),
      });
      if (!res.ok) {
        const d = await res.json();
        alert(d.error ?? "Fehler");
        return;
      }
      setResetId(null);
      setNeuesPasswort("");
    } finally {
      setResetSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/einstellungen" className="text-sm text-gray-500 hover:text-gray-700">
          ← Einstellungen
        </Link>
        <h1 className="text-xl font-bold">Kunden-Portal Zugänge</h1>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-800">
        Hier verwalten Sie die Zugangsdaten für das Kunden-Self-Service-Portal unter{" "}
        <code className="bg-amber-100 px-1 rounded">/portal</code>.
        Kunden können sich damit Rechnungen, Lieferscheine und Kontostand ansehen sowie Bestellungen aufgeben.
      </div>

      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">{zugaenge.length} Zugänge</p>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="px-4 py-2 bg-green-700 hover:bg-green-800 text-white text-sm font-medium rounded-lg transition-colors"
        >
          + Zugang erstellen
        </button>
      </div>

      {/* Inline-Formular */}
      {showForm && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 mb-6 space-y-4">
          <h3 className="font-semibold text-green-800">Neuen Portal-Zugang erstellen</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kunde</label>
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); loadKunden(e.target.value); setKundeId(""); }}
                placeholder="Kundenname suchen…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
              />
              {kunden.length > 0 && !kundeId && (
                <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10 mt-1 max-h-40 overflow-y-auto">
                  {kunden.map((k) => (
                    <button
                      key={k.id}
                      onClick={() => { setKundeId(String(k.id)); setSearch(k.firma ?? k.name); setKunden([]); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-green-50 border-b border-gray-50 last:border-0"
                    >
                      {k.firma ?? k.name}
                      {k.firma && <span className="text-gray-400 ml-2">{k.name}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Benutzername</label>
              <input
                type="text"
                value={benutzername}
                onChange={(e) => setBenutzername(e.target.value)}
                placeholder="z.B. mustermann"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Passwort</label>
              <input
                type="password"
                value={passwort}
                onChange={(e) => setPasswort(e.target.value)}
                placeholder="Mind. 6 Zeichen"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          {formError && (
            <p className="text-red-600 text-sm">{formError}</p>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={saving}
              className="px-4 py-2 bg-green-700 hover:bg-green-800 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
            >
              {saving ? "Speichern…" : "Zugang erstellen"}
            </button>
            <button
              onClick={() => { setShowForm(false); setFormError(""); }}
              className="px-4 py-2 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50 transition-colors"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">Lade…</p>
      ) : zugaenge.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
          Noch keine Portal-Zugänge erstellt.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Kunde</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Benutzername</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden sm:table-cell">Letzter Login</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {zugaenge.map((z) => (
                <React.Fragment key={z.id}>
                  <tr className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link href={`/kunden/${z.kundeId}`} className="font-medium text-green-700 hover:underline">
                        {z.kunde.firma ?? z.kunde.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-700">{z.benutzername}</td>
                    <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{formatDatum(z.letzterLogin)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${z.aktiv ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {z.aktiv ? "Aktiv" : "Deaktiviert"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => toggleAktiv(z.id, z.aktiv)}
                          className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                        >
                          {z.aktiv ? "Deaktivieren" : "Aktivieren"}
                        </button>
                        <button
                          onClick={() => setResetId(resetId === z.id ? null : z.id)}
                          className="text-xs px-2 py-1 border border-amber-300 text-amber-700 rounded hover:bg-amber-50 transition-colors"
                        >
                          PW Reset
                        </button>
                        <button
                          onClick={() => handleDelete(z.id)}
                          className="text-xs px-2 py-1 border border-red-300 text-red-600 rounded hover:bg-red-50 transition-colors"
                        >
                          Löschen
                        </button>
                      </div>
                    </td>
                  </tr>
                  {resetId === z.id && (
                    <tr className="bg-amber-50 border-b border-amber-100">
                      <td colSpan={5} className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="password"
                            value={neuesPasswort}
                            onChange={(e) => setNeuesPasswort(e.target.value)}
                            placeholder="Neues Passwort (mind. 6 Zeichen)"
                            className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white w-64"
                          />
                          <button
                            onClick={() => handleResetPasswort(z.id)}
                            disabled={resetSaving}
                            className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white text-sm rounded transition-colors disabled:opacity-50"
                          >
                            {resetSaving ? "…" : "Speichern"}
                          </button>
                          <button
                            onClick={() => { setResetId(null); setNeuesPasswort(""); }}
                            className="px-3 py-1 border border-gray-300 text-gray-600 text-sm rounded hover:bg-gray-50 transition-colors"
                          >
                            Abbrechen
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Need React import for Fragment
import React from "react";
