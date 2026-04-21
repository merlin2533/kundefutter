"use client";

import Link from "next/link";
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

function formatDatum(iso: string | null): string {
  if (!iso) return "–";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "–";
  return d.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function BenutzerListePage() {
  const [benutzer, setBenutzer] = useState<Benutzer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const laden = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/benutzer");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      setBenutzer(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    laden();
  }, [laden]);

  async function loeschen(id: number, name: string) {
    if (!confirm(`Benutzer „${name}" wirklich löschen?`)) return;
    try {
      const res = await fetch(`/api/benutzer/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data?.error ?? "Löschen fehlgeschlagen");
        return;
      }
      laden();
    } catch {
      alert("Netzwerkfehler");
    }
  }

  return (
    <div>
      <div className="text-sm text-gray-500 mb-2">
        <Link href="/einstellungen" className="hover:text-green-700">
          Einstellungen
        </Link>
        {" › "}Benutzer
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold">Benutzerverwaltung</h1>
        <Link
          href="/einstellungen/benutzer/neu"
          className="bg-green-700 hover:bg-green-800 text-white px-4 py-2 rounded font-medium"
        >
          + Neuer Benutzer
        </Link>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-gray-500">Lädt…</div>
        ) : benutzer.length === 0 ? (
          <div className="p-6 text-center text-gray-500">Keine Benutzer vorhanden</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left">
                <th className="px-4 py-2 font-medium">Benutzername</th>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium hidden sm:table-cell">E-Mail</th>
                <th className="px-4 py-2 font-medium">Rolle</th>
                <th className="px-4 py-2 font-medium">Aktiv</th>
                <th className="px-4 py-2 font-medium hidden md:table-cell">Letzter Login</th>
                <th className="px-4 py-2 font-medium text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {benutzer.map((b) => (
                <tr key={b.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono">{b.benutzername}</td>
                  <td className="px-4 py-2">
                    {b.name}
                    <div className="sm:hidden text-xs text-gray-500">{b.email}</div>
                  </td>
                  <td className="px-4 py-2 hidden sm:table-cell text-gray-600">
                    {b.email || "–"}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-block text-xs px-2 py-0.5 rounded ${
                        b.rolle === "admin"
                          ? "bg-purple-100 text-purple-800"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {b.rolle}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {b.aktiv ? (
                      <span className="inline-block text-xs px-2 py-0.5 rounded bg-green-100 text-green-800">
                        aktiv
                      </span>
                    ) : (
                      <span className="inline-block text-xs px-2 py-0.5 rounded bg-red-100 text-red-700">
                        gesperrt
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 hidden md:table-cell text-gray-600">
                    {formatDatum(b.letzterLogin)}
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <Link
                      href={`/einstellungen/benutzer/${b.id}`}
                      className="text-green-700 hover:underline mr-3"
                    >
                      Bearbeiten
                    </Link>
                    <button
                      type="button"
                      onClick={() => loeschen(b.id, b.name)}
                      className="text-red-700 hover:underline"
                    >
                      Löschen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
