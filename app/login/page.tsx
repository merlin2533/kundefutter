"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";

  const [benutzername, setBenutzername] = useState("");
  const [passwort, setPasswort] = useState("");
  const [passwortSichtbar, setPasswortSichtbar] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFehler(null);
    setSaving(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ benutzername, passwort }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setFehler(data?.error ?? "Anmeldung fehlgeschlagen");
        setSaving(false);
        return;
      }
      // Hard-Navigation, damit Middleware/Cookie beim ersten Request auf
      // der Ziel-Seite korrekt anliegen und keine stale Client-Caches bleiben.
      window.location.href = next.startsWith("/") ? next : "/";
    } catch {
      setFehler("Netzwerkfehler");
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-green-50 p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg border border-green-200 p-8">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🌾</div>
          <h1 className="text-2xl font-bold text-green-800">AgrarOffice</h1>
          <p className="text-sm text-gray-600 mt-1">Röthemeier</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Benutzername
            </label>
            <input
              type="text"
              autoComplete="username"
              autoFocus
              value={benutzername}
              onChange={(e) => setBenutzername(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Passwort
            </label>
            <div className="relative">
              <input
                type={passwortSichtbar ? "text" : "password"}
                autoComplete="current-password"
                value={passwort}
                onChange={(e) => setPasswort(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 pr-12 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                required
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

          {fehler && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
              {fehler}
            </div>
          )}

          <button
            type="submit"
            disabled={saving || !benutzername || !passwort}
            className="w-full bg-green-700 hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2 rounded transition"
          >
            {saving ? "Anmelden …" : "Anmelden"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Lädt…</div>}>
      <LoginForm />
    </Suspense>
  );
}
