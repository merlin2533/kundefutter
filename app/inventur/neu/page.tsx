"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NeueInventurPage() {
  const router = useRouter();
  const [bezeichnung, setBezeichnung] = useState("");
  const [artikelAnzahl, setArtikelAnzahl] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/artikel?limit=5000")
      .then((r) => r.json())
      .then((data: Array<{ aktiv: boolean }>) => {
        const aktiv = data.filter((a) => a.aktiv);
        setArtikelAnzahl(aktiv.length);
      })
      .catch(() => setArtikelAnzahl(0));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/inventur", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bezeichnung: bezeichnung.trim() || undefined }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Fehler beim Erstellen");
      }
      const inv = await res.json();
      router.push(`/inventur/${inv.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      setSaving(false);
    }
  }

  return (
    <div className="max-w-lg">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/inventur"
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          ← Zurück
        </Link>
        <h1 className="text-2xl font-bold">Neue Inventur starten</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {error}
          </p>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Bezeichnung <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={bezeichnung}
            onChange={(e) => setBezeichnung(e.target.value)}
            placeholder="z.B. Jahresinventur 2026"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
          />
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
          {artikelAnzahl === null ? (
            "Lade Artikelanzahl…"
          ) : (
            <>
              Es werden alle <strong>{artikelAnzahl}</strong> aktiven Artikel übernommen.
              Der aktuelle Lagerbestand wird als Soll-Bestand gespeichert.
            </>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Link
            href="/inventur"
            className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            Abbrechen
          </Link>
          <button
            type="submit"
            disabled={saving || artikelAnzahl === 0}
            className="px-5 py-2 text-sm rounded-lg bg-green-800 hover:bg-green-700 text-white font-medium disabled:opacity-60 transition-colors"
          >
            {saving ? "Wird erstellt…" : "Inventur starten"}
          </button>
        </div>
      </form>
    </div>
  );
}
