"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Benutzer = {
  id: number;
  benutzername: string;
  name: string;
  email: string | null;
  rolle: string;
  aktiv: boolean;
  letzterLogin: string | null;
  erstelltAm: string;
};

export default function BenutzerBearbeitenPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [benutzer, setBenutzer] = useState<Benutzer | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [rolle, setRolle] = useState("benutzer");
  const [aktiv, setAktiv] = useState(true);
  const [passwort, setPasswort] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const laden = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setFehler(null);
    try {
      const res = await fetch(`/api/benutzer/${id}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      const b: Benutzer = await res.json();
      setBenutzer(b);
      setName(b.name);
      setEmail(b.email ?? "");
      setRolle(b.rolle);
      setAktiv(b.aktiv);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    laden();
  }, [laden]);

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
      const body: Record<string, unknown> = { name, email, rolle, aktiv };
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

  if (loading) {
    return <div className="p-4 text-gray-500">Lädt…</div>;
  }
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
        <Link href="/einstellungen" className="hover:text-green-700">
          Einstellungen
        </Link>
        {" › "}
        <Link href="/einstellungen/benutzer" className="hover:text-green-700">
          Benutzer
        </Link>
        {" › "}
        {benutzer.benutzername}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold">Benutzer bearbeiten</h1>
        <button
          type="button"
          onClick={loeschen}
          className="text-red-700 border border-red-300 hover:bg-red-50 px-3 py-1.5 rounded"
        >
          Benutzer löschen
        </button>
      </div>

      {fehler && (
        <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
          {fehler}
        </div>
      )}
      {saved && (
        <div className="mb-4 text-sm text-green-800 bg-green-50 border border-green-200 rounded px-3 py-2">
          ✓ Gespeichert
        </div>
      )}

      <form
        onSubmit={onSubmit}
        className="max-w-xl bg-white border border-gray-200 rounded-xl shadow-sm p-6 space-y-4"
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Benutzername</label>
          <input
            type="text"
            value={benutzer.benutzername}
            disabled
            className="w-full border border-gray-200 bg-gray-50 rounded px-3 py-2 text-gray-600"
          />
          <p className="text-xs text-gray-500 mt-1">Benutzername kann nicht geändert werden.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Name <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 focus:border-green-500 focus:outline-none"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">E-Mail</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 focus:border-green-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Rolle</label>
          <select
            value={rolle}
            onChange={(e) => setRolle(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 focus:border-green-500 focus:outline-none"
          >
            <option value="benutzer">Benutzer</option>
            <option value="admin">Administrator</option>
          </select>
        </div>
        <div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={aktiv}
              onChange={(e) => setAktiv(e.target.checked)}
              className="h-4 w-4"
            />
            <span>Aktiv (kann sich anmelden)</span>
          </label>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Neues Passwort</label>
          <input
            type="password"
            value={passwort}
            onChange={(e) => setPasswort(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 focus:border-green-500 focus:outline-none"
            minLength={8}
            autoComplete="new-password"
            placeholder="Leer lassen = unverändert"
          />
          <p className="text-xs text-gray-500 mt-1">
            Nur ausfüllen, wenn das Passwort zurückgesetzt werden soll (min. 8 Zeichen).
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Link
            href="/einstellungen/benutzer"
            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
          >
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

      <div className="max-w-xl mt-4 text-xs text-gray-500">
        Erstellt: {new Date(benutzer.erstelltAm).toLocaleString("de-DE")}
        {" · "}
        Letzter Login:{" "}
        {benutzer.letzterLogin
          ? new Date(benutzer.letzterLogin).toLocaleString("de-DE")
          : "noch nie"}
      </div>
    </div>
  );
}
