"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function BenutzerNeuPage() {
  const router = useRouter();
  const [benutzername, setBenutzername] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [rolle, setRolle] = useState("benutzer");
  const [passwort, setPasswort] = useState("");
  const [passwort2, setPasswort2] = useState("");
  const [passwortSichtbar, setPasswortSichtbar] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFehler(null);
    if (passwort !== passwort2) {
      setFehler("Passwörter stimmen nicht überein");
      return;
    }
    if (passwort.length < 8) {
      setFehler("Passwort muss mindestens 8 Zeichen haben");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/benutzer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ benutzername, name, email, rolle, passwort }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setFehler(data?.error ?? `HTTP ${res.status}`);
        setSaving(false);
        return;
      }
      router.push("/einstellungen/benutzer");
    } catch {
      setFehler("Netzwerkfehler");
      setSaving(false);
    }
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
        {" › "}Neu
      </div>

      <h1 className="text-2xl font-bold mb-6">Neuer Benutzer</h1>

      {fehler && (
        <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
          {fehler}
        </div>
      )}

      <form
        onSubmit={onSubmit}
        className="max-w-xl bg-white border border-gray-200 rounded-xl shadow-sm p-6 space-y-4"
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Benutzername <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            value={benutzername}
            onChange={(e) => setBenutzername(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 focus:border-green-500 focus:outline-none"
            required
            minLength={3}
            autoComplete="off"
          />
          <p className="text-xs text-gray-500 mt-1">
            Mindestens 3 Zeichen, eindeutig.
          </p>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Passwort <span className="text-red-600">*</span>
            </label>
            <div className="relative">
              <input
                type={passwortSichtbar ? "text" : "password"}
                value={passwort}
                onChange={(e) => setPasswort(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 pr-12 focus:border-green-500 focus:outline-none"
                required
                minLength={8}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setPasswortSichtbar((s) => !s)}
                aria-label={passwortSichtbar ? "Passwort verbergen" : "Passwort anzeigen"}
                aria-pressed={passwortSichtbar}
                className="absolute inset-y-0 right-0 px-3 text-sm text-gray-600 hover:text-green-700 focus:outline-none"
              >
                {passwortSichtbar ? "🙈" : "👁️"}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Passwort wiederholen <span className="text-red-600">*</span>
            </label>
            <div className="relative">
              <input
                type={passwortSichtbar ? "text" : "password"}
                value={passwort2}
                onChange={(e) => setPasswort2(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 pr-12 focus:border-green-500 focus:outline-none"
                required
                minLength={8}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setPasswortSichtbar((s) => !s)}
                aria-label={passwortSichtbar ? "Passwort verbergen" : "Passwort anzeigen"}
                aria-pressed={passwortSichtbar}
                className="absolute inset-y-0 right-0 px-3 text-sm text-gray-600 hover:text-green-700 focus:outline-none"
              >
                {passwortSichtbar ? "🙈" : "👁️"}
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Link
            href="/einstellungen/benutzer"
            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
          >
            Abbrechen
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white px-4 py-2 rounded font-medium"
          >
            {saving ? "Speichert…" : "Anlegen"}
          </button>
        </div>
      </form>
    </div>
  );
}
