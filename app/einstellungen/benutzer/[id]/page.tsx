"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PERMISSION_META, ALL_PERMISSIONS } from "@/lib/permissions";

type Rolle = {
  id: number;
  name: string;
  bezeichnung: string;
  berechtigungen: string[];
};

type Benutzer = {
  id: number;
  benutzername: string;
  name: string;
  email: string | null;
  rolle: string;
  rolleId: number | null;
  berechtigungen: string[];
  rolleRef: Rolle | null;
  aktiv: boolean;
  letzterLogin: string | null;
  erstelltAm: string;
};

export default function BenutzerBearbeitenPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [benutzer, setBenutzer] = useState<Benutzer | null>(null);
  const [rollen, setRollen] = useState<Rolle[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [aktiv, setAktiv] = useState(true);
  const [rolleId, setRolleId] = useState<number | null>(null);
  const [overrides, setOverrides] = useState<string[]>([]); // individuelle Zusatz-Permissions
  const [overridesOffen, setOverridesOffen] = useState(false);
  const [passwort, setPasswort] = useState("");
  const [passwortSichtbar, setPasswortSichtbar] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const laden = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setFehler(null);
    try {
      const [bRes, rRes] = await Promise.all([
        fetch(`/api/benutzer/${id}`),
        fetch("/api/rollen"),
      ]);
      if (!bRes.ok) {
        const data = await bRes.json().catch(() => ({}));
        throw new Error(data?.error ?? `HTTP ${bRes.status}`);
      }
      const b: Benutzer = await bRes.json();
      setBenutzer(b);
      setName(b.name);
      setEmail(b.email ?? "");
      setAktiv(b.aktiv);
      setRolleId(b.rolleId);
      // berechtigungen aus JSON parsen falls noch String
      const perms = Array.isArray(b.berechtigungen)
        ? b.berechtigungen
        : (() => { try { return JSON.parse(b.berechtigungen as unknown as string); } catch { return []; } })();
      setOverrides(perms);
      if (rRes.ok) setRollen(await rRes.json());
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { laden(); }, [laden]);

  // Wenn Rolle wechselt: Overrides nicht automatisch zurücksetzen (bewusste Entscheidung)
  const gewaehlteRolle = rollen.find((r) => r.id === rolleId) ?? null;
  const rollenPerms = gewaehlteRolle?.berechtigungen ?? [];
  const hatAlles = rollenPerms.includes("*");

  function toggleOverride(permId: string, checked: boolean) {
    setOverrides((prev) =>
      checked ? [...prev, permId] : prev.filter((p) => p !== permId),
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setFehler(null);
    setSaved(false);
    if (passwort && passwort.length < 8) {
      setFehler("Passwort muss mindestens 8 Zeichen haben");
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name,
        email,
        aktiv,
        rolleId,
        berechtigungen: overrides,
      };
      if (passwort) body.passwort = passwort;
      const res = await fetch(`/api/benutzer/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setFehler(data?.error ?? `HTTP ${res.status}`);
        setSaving(false);
        return;
      }
      setPasswort("");
      setSaved(true);
      laden();
    } catch {
      setFehler("Netzwerkfehler");
    } finally {
      setSaving(false);
    }
  }

  async function loeschen() {
    if (!id || !benutzer) return;
    if (!confirm(`Benutzer „${benutzer.name}" wirklich löschen?`)) return;
    try {
      const res = await fetch(`/api/benutzer/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data?.error ?? "Löschen fehlgeschlagen");
        return;
      }
      router.push("/einstellungen/benutzer");
    } catch {
      alert("Netzwerkfehler");
    }
  }

  if (loading) return <div className="p-4 text-gray-500">Lädt…</div>;
  if (!benutzer) {
    return (
      <div className="p-4">
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
          {fehler ?? "Benutzer nicht gefunden"}
        </div>
        <Link href="/einstellungen/benutzer" className="text-green-700 hover:underline mt-3 inline-block">
          ← Zurück
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="text-sm text-gray-500 mb-2">
        <Link href="/einstellungen" className="hover:text-green-700">Einstellungen</Link>
        {" › "}
        <Link href="/einstellungen/benutzer" className="hover:text-green-700">Benutzer</Link>
        {" › "}
        {benutzer.benutzername}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold">Benutzer bearbeiten</h1>
        <button type="button" onClick={loeschen} className="text-red-700 border border-red-300 hover:bg-red-50 px-3 py-1.5 rounded">
          Benutzer löschen
        </button>
      </div>

      {fehler && (
        <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{fehler}</div>
      )}
      {saved && (
        <div className="mb-4 text-sm text-green-800 bg-green-50 border border-green-200 rounded px-3 py-2">✓ Gespeichert</div>
      )}

      <form onSubmit={onSubmit} className="max-w-2xl space-y-4">
        {/* Stammdaten */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">Stammdaten</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Benutzername</label>
            <input type="text" value={benutzer.benutzername} disabled
              className="w-full border border-gray-200 bg-gray-50 rounded px-3 py-2 text-gray-600" />
            <p className="text-xs text-gray-500 mt-1">Benutzername kann nicht geändert werden.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-600">*</span></label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 focus:border-green-500 focus:outline-none" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-Mail</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 focus:border-green-500 focus:outline-none" />
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={aktiv} onChange={(e) => setAktiv(e.target.checked)} className="h-4 w-4" />
              <span>Aktiv (kann sich anmelden)</span>
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Neues Passwort</label>
            <div className="relative">
              <input
                type={passwortSichtbar ? "text" : "password"}
                value={passwort}
                onChange={(e) => setPasswort(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 pr-12 focus:border-green-500 focus:outline-none"
                minLength={8}
                autoComplete="new-password"
                placeholder="Leer lassen = unverändert"
              />
              <button type="button" onClick={() => setPasswortSichtbar((s) => !s)}
                aria-label={passwortSichtbar ? "Passwort verbergen" : "Passwort anzeigen"}
                className="absolute inset-y-0 right-0 px-3 text-sm text-gray-600 hover:text-green-700 focus:outline-none">
                {passwortSichtbar ? "🙈" : "👁️"}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">Nur ausfüllen, wenn das Passwort zurückgesetzt werden soll (min. 8 Zeichen).</p>
          </div>
        </div>

        {/* Rollenzuweisung */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">Berechtigungen</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rolle</label>
            <select
              value={rolleId ?? ""}
              onChange={(e) => setRolleId(e.target.value ? parseInt(e.target.value, 10) : null)}
              className="w-full border border-gray-300 rounded px-3 py-2 focus:border-green-500 focus:outline-none"
            >
              <option value="">— Keine Rolle —</option>
              {rollen.map((r) => (
                <option key={r.id} value={r.id}>{r.bezeichnung}</option>
              ))}
            </select>
            {gewaehlteRolle && (
              <p className="text-xs text-gray-500 mt-1">
                {hatAlles
                  ? "Diese Rolle hat Vollzugriff (*)"
                  : `${rollenPerms.length} Berechtigungen über die Rolle`}
              </p>
            )}
          </div>

          {/* Individuelle Overrides */}
          <div>
            <button
              type="button"
              onClick={() => setOverridesOffen((o) => !o)}
              className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-green-700"
            >
              <span>{overridesOffen ? "▾" : "▸"}</span>
              <span>Individuelle Zusatz-Berechtigungen</span>
              {overrides.length > 0 && (
                <span className="ml-1 text-xs bg-amber-100 text-amber-700 border border-amber-200 rounded px-1.5 py-0.5">
                  {overrides.length} aktiv
                </span>
              )}
            </button>
            <p className="text-xs text-gray-400 mt-0.5 ml-4">
              Diese Berechtigungen gelten zusätzlich zur ausgewählten Rolle.
            </p>

            {overridesOffen && (
              <div className="mt-3 ml-4 space-y-4">
                {Object.entries(
                  ALL_PERMISSIONS.reduce<Record<string, string[]>>((acc, permId) => {
                    const meta = PERMISSION_META[permId];
                    if (!meta) return acc;
                    if (!acc[meta.gruppe]) acc[meta.gruppe] = [];
                    acc[meta.gruppe].push(permId);
                    return acc;
                  }, {}),
                ).map(([gruppe, perms]) => (
                  <div key={gruppe}>
                    <h4 className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1.5">{gruppe}</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                      {perms.map((permId) => {
                        const meta = PERMISSION_META[permId];
                        const ausRolle = hatAlles || rollenPerms.includes(permId);
                        const checked = ausRolle || overrides.includes(permId);
                        return (
                          <label
                            key={permId}
                            className={`flex items-center gap-2 text-xs cursor-pointer rounded px-2 py-1 ${ausRolle ? "opacity-50" : "hover:bg-gray-50"}`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={ausRolle}
                              onChange={(e) => toggleOverride(permId, e.target.checked)}
                              className="h-3.5 w-3.5 accent-green-600"
                            />
                            <span className={ausRolle ? "text-gray-400" : "text-gray-700"}>
                              {meta?.label ?? permId}
                            </span>
                            {ausRolle && <span className="text-gray-300 text-xs">aus Rolle</span>}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Link href="/einstellungen/benutzer" className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50">
            Zurück
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white px-4 py-2 rounded font-medium"
          >
            {saving ? "Speichert…" : "Speichern"}
          </button>
        </div>
      </form>

      <div className="max-w-2xl mt-4 text-xs text-gray-500">
        Erstellt: {new Date(benutzer.erstelltAm).toLocaleString("de-DE")}
        {" · "}
        Letzter Login:{" "}
        {benutzer.letzterLogin ? new Date(benutzer.letzterLogin).toLocaleString("de-DE") : "noch nie"}
      </div>
    </div>
  );
}
