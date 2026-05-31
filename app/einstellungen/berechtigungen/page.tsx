"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { PERMISSION_META, ROLLE_PRESETS, ALL_PERMISSIONS } from "@/lib/permissions";

type Rolle = {
  id: number;
  name: string;
  bezeichnung: string;
  beschreibung: string | null;
  berechtigungen: string[];
  istSystem: boolean;
  benutzerAnzahl: number;
};

type Benutzer = {
  id: number;
  benutzername: string;
  name: string;
  rolle: string;
  rolleId: number | null;
  rolleRef: { id: number; name: string; bezeichnung: string } | null;
  aktiv: boolean;
};

// Gruppierung der Permissions für die Matrix
const GRUPPEN_REIHENFOLGE = [
  "Übersicht", "Kunden", "Artikel", "Lager", "Lieferung",
  "Finanzen", "Analyse", "Agrar", "Einkauf", "Vertrieb",
  "Export", "System", "Felder",
];

function gruppenMap(): Map<string, { id: string; label: string }[]> {
  const m = new Map<string, { id: string; label: string }[]>();
  for (const id of ALL_PERMISSIONS) {
    const meta = PERMISSION_META[id];
    if (!meta) continue;
    const arr = m.get(meta.gruppe) ?? [];
    arr.push({ id, label: meta.label });
    m.set(meta.gruppe, arr);
  }
  return m;
}

const GRUPPEN = gruppenMap();

export default function BerechtigungenPage() {
  const [tab, setTab] = useState<"rollen" | "matrix" | "benutzer">("rollen");
  const [rollen, setRollen] = useState<Rolle[]>([]);
  const [benutzer, setBenutzer] = useState<Benutzer[]>([]);
  const [loading, setLoading] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);

  // Neue Rolle anlegen
  const [neueRolleOffen, setNeueRolleOffen] = useState(false);
  const [neuerName, setNeuerName] = useState("");
  const [neueBezeichnung, setNeueBezeichnung] = useState("");
  const [neuerPreset, setNeuerPreset] = useState("");
  const [anlegenFehler, setAnlegenFehler] = useState<string | null>(null);
  const [anlegenLoading, setAnlegenLoading] = useState(false);

  // Matrix: saving-State per Rollen-ID
  const [saving, setSaving] = useState<Record<number, boolean>>({});
  const saveTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const laden = useCallback(async () => {
    setLoading(true);
    setFehler(null);
    try {
      const [rRes, bRes] = await Promise.all([
        fetch("/api/rollen"),
        fetch("/api/benutzer"),
      ]);
      if (rRes.ok) setRollen(await rRes.json());
      if (bRes.ok) setBenutzer(await bRes.json());
    } catch {
      setFehler("Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { laden(); }, [laden]);

  // Checkbox-Toggle mit Debounce-Save
  function togglePermission(rolleId: number, permId: string, checked: boolean) {
    setRollen((prev) =>
      prev.map((r) => {
        if (r.id !== rolleId) return r;
        const neu = checked
          ? [...r.berechtigungen, permId]
          : r.berechtigungen.filter((p) => p !== permId);
        return { ...r, berechtigungen: neu };
      }),
    );
    // Debounce-Save
    if (saveTimers.current[rolleId]) clearTimeout(saveTimers.current[rolleId]);
    saveTimers.current[rolleId] = setTimeout(() => {
      const rolle = rollen.find((r) => r.id === rolleId) ?? null;
      if (!rolle) return;
      const updated = checked
        ? [...rolle.berechtigungen, permId]
        : rolle.berechtigungen.filter((p) => p !== permId);
      speichereRolle(rolleId, updated);
    }, 800);
  }

  async function speichereRolle(rolleId: number, berechtigungen: string[]) {
    setSaving((s) => ({ ...s, [rolleId]: true }));
    try {
      const res = await fetch(`/api/rollen/${rolleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ berechtigungen }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setFehler(d?.error ?? "Speichern fehlgeschlagen");
      }
    } finally {
      setSaving((s) => ({ ...s, [rolleId]: false }));
    }
  }

  async function rolleLoeschen(rolle: Rolle) {
    if (!confirm(`Rolle „${rolle.bezeichnung}" wirklich löschen?`)) return;
    const res = await fetch(`/api/rollen/${rolle.id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d?.error ?? "Löschen fehlgeschlagen");
      return;
    }
    laden();
  }

  async function rolleAnlegen(e: React.FormEvent) {
    e.preventDefault();
    setAnlegenFehler(null);
    setAnlegenLoading(true);
    try {
      const res = await fetch("/api/rollen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: neuerName, bezeichnung: neueBezeichnung, preset: neuerPreset || undefined }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setAnlegenFehler(d?.error ?? "Fehler"); return; }
      setNeueRolleOffen(false);
      setNeuerName("");
      setNeueBezeichnung("");
      setNeuerPreset("");
      laden();
    } finally {
      setAnlegenLoading(false);
    }
  }

  if (loading) return <div className="text-gray-500">Lädt…</div>;

  return (
    <div>
      <div className="text-sm text-gray-500 mb-2">
        <Link href="/einstellungen" className="hover:text-green-700">Einstellungen</Link>
        {" › "}Berechtigungen
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold">Berechtigungsmatrix</h1>
      </div>

      {fehler && (
        <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
          {fehler}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {(["rollen", "matrix", "benutzer"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t
                ? "border-green-600 text-green-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "rollen" ? "Rollen verwalten" : t === "matrix" ? "Berechtigungsmatrix" : "Benutzer-Zuweisung"}
          </button>
        ))}
      </div>

      {/* ── TAB: Rollen verwalten ──────────────────────────────────────────── */}
      {tab === "rollen" && (
        <div>
          <div className="flex justify-end mb-4">
            <button
              onClick={() => setNeueRolleOffen(true)}
              className="bg-green-700 hover:bg-green-800 text-white px-4 py-2 rounded text-sm font-medium"
            >
              + Neue Rolle
            </button>
          </div>

          {neueRolleOffen && (
            <div className="mb-6 bg-white border border-green-200 rounded-xl p-4 max-w-lg">
              <h3 className="font-semibold mb-3">Neue Rolle anlegen</h3>
              {anlegenFehler && (
                <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                  {anlegenFehler}
                </div>
              )}
              <form onSubmit={rolleAnlegen} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Name (intern)</label>
                    <input
                      value={neuerName}
                      onChange={(e) => setNeuerName(e.target.value)}
                      placeholder="z.B. vertrieb_sued"
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:border-green-500 focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Bezeichnung</label>
                    <input
                      value={neueBezeichnung}
                      onChange={(e) => setNeueBezeichnung(e.target.value)}
                      placeholder="Vertrieb Süd"
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:border-green-500 focus:outline-none"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Preset (optional)</label>
                  <select
                    value={neuerPreset}
                    onChange={(e) => setNeuerPreset(e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:border-green-500 focus:outline-none"
                  >
                    <option value="">— Leer beginnen —</option>
                    {Object.entries(ROLLE_PRESETS).map(([key, p]) => (
                      <option key={key} value={key}>{p.bezeichnung}</option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setNeueRolleOffen(false)} className="px-3 py-1.5 border border-gray-300 rounded text-sm hover:bg-gray-50">Abbrechen</button>
                  <button type="submit" disabled={anlegenLoading} className="bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white px-3 py-1.5 rounded text-sm font-medium">
                    {anlegenLoading ? "…" : "Anlegen"}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="space-y-3">
            {rollen.map((r) => (
              <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-800">{r.bezeichnung}</span>
                      {r.istSystem && (
                        <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded px-1.5 py-0.5">System</span>
                      )}
                      <span className="text-xs text-gray-400 font-mono">{r.name}</span>
                    </div>
                    {r.beschreibung && <p className="text-sm text-gray-500 mt-0.5">{r.beschreibung}</p>}
                    <p className="text-xs text-gray-400 mt-1">
                      {r.berechtigungen.includes("*") ? "Vollzugriff (*)" : `${r.berechtigungen.length} Berechtigungen`}
                      {" · "}
                      {r.benutzerAnzahl} Benutzer
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => setTab("matrix")}
                      className="text-xs text-green-700 border border-green-300 hover:bg-green-50 px-2 py-1 rounded"
                    >
                      Bearbeiten
                    </button>
                    {!r.istSystem && (
                      <button
                        onClick={() => rolleLoeschen(r)}
                        className="text-xs text-red-600 border border-red-200 hover:bg-red-50 px-2 py-1 rounded"
                      >
                        Löschen
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB: Berechtigungsmatrix ───────────────────────────────────────── */}
      {tab === "matrix" && (
        <div>
          <p className="text-sm text-gray-500 mb-4">
            Klicke auf eine Checkbox, um eine Berechtigung für eine Rolle zu aktivieren oder zu deaktivieren.
            Änderungen werden automatisch gespeichert.
          </p>

          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="min-w-max text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-600 w-64 sticky left-0 bg-gray-50">
                    Berechtigung
                  </th>
                  {rollen.map((r) => (
                    <th key={r.id} className="px-3 py-2.5 text-center text-xs font-semibold text-gray-700 min-w-[100px]">
                      <div>{r.bezeichnung}</div>
                      {saving[r.id] && <div className="text-gray-400 font-normal">speichert…</div>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {GRUPPEN_REIHENFOLGE.map((gruppe) => {
                  const perms = GRUPPEN.get(gruppe);
                  if (!perms?.length) return null;
                  return [
                    <tr key={`h-${gruppe}`} className="bg-gray-100 border-t border-gray-200">
                      <td
                        colSpan={rollen.length + 1}
                        className="px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-gray-500 sticky left-0 bg-gray-100"
                      >
                        {gruppe}
                      </td>
                    </tr>,
                    ...perms.map(({ id: permId, label }) => (
                      <tr key={permId} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-700 sticky left-0 bg-white">
                          <span className="text-xs font-mono text-gray-400 mr-2">{permId}</span>
                          {label}
                        </td>
                        {rollen.map((r) => {
                          const hatAlles = r.berechtigungen.includes("*");
                          const checked = hatAlles || r.berechtigungen.includes(permId);
                          return (
                            <td key={r.id} className="px-3 py-2 text-center">
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={hatAlles || r.istSystem && r.name === "admin"}
                                onChange={(e) => togglePermission(r.id, permId, e.target.checked)}
                                className="h-4 w-4 accent-green-600"
                                title={hatAlles ? "Vollzugriff — alle Berechtigungen aktiv" : ""}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    )),
                  ];
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB: Benutzer-Zuweisung ────────────────────────────────────────── */}
      {tab === "benutzer" && (
        <div>
          <p className="text-sm text-gray-500 mb-4">
            Übersicht welcher Benutzer welche Rolle hat.{" "}
            <Link href="/einstellungen/benutzer" className="text-green-700 hover:underline">
              Rollenzuweisung pro Benutzer bearbeiten →
            </Link>
          </p>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-left">
                  <th className="px-3 py-2.5 text-xs font-semibold text-gray-600">Benutzer</th>
                  <th className="px-3 py-2.5 text-xs font-semibold text-gray-600">Zugewiesene Rolle</th>
                  <th className="px-3 py-2.5 text-xs font-semibold text-gray-600">Status</th>
                  <th className="px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {benutzer.map((b) => (
                  <tr key={b.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-gray-800">{b.name}</div>
                      <div className="text-xs text-gray-400">{b.benutzername}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      {b.rolleRef ? (
                        <span className="text-xs bg-green-50 text-green-700 border border-green-200 rounded px-2 py-0.5 font-medium">
                          {b.rolleRef.bezeichnung}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">
                          {b.rolle === "admin" ? "Administrator (Legacy)" : "Nicht zugewiesen"}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`text-xs rounded px-1.5 py-0.5 ${b.aktiv ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {b.aktiv ? "Aktiv" : "Inaktiv"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Link
                        href={`/einstellungen/benutzer/${b.id}`}
                        className="text-xs text-green-700 hover:underline"
                      >
                        Bearbeiten
                      </Link>
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
