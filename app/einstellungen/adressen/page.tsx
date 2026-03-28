"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";

function BatchAdressValidierung() {
  const [stats, setStats] = useState<{ total: number; ohneKoords: number } | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errors, setErrors] = useState(0);
  const [done, setDone] = useState(false);
  const abortRef = useRef(false);

  useEffect(() => {
    fetch("/api/kunden/adress-validierung")
      .then((r) => r.json())
      .then((d) => setStats(d))
      .catch(() => {});
  }, []);

  async function startBatch() {
    setRunning(true);
    setProgress(0);
    setErrors(0);
    setDone(false);
    abortRef.current = false;

    let processed = 0;
    let errCount = 0;

    while (!abortRef.current) {
      const res = await fetch("/api/kunden/adress-validierung?batch=1");
      if (!res.ok) break;
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) break;

      for (const kunde of data) {
        if (abortRef.current) break;
        try {
          const postRes = await fetch("/api/kunden/adress-validierung", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ kundeId: kunde.id }),
          });
          if (!postRes.ok) errCount++;
        } catch {
          errCount++;
        }
        processed++;
        setProgress(processed);
        setErrors(errCount);
        await new Promise((r) => setTimeout(r, 1200));
      }
    }

    setRunning(false);
    setDone(true);
    fetch("/api/kunden/adress-validierung")
      .then((r) => r.json())
      .then((d) => setStats(d))
      .catch(() => {});
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold mb-1">Adress-Validierung (Batch)</h2>
      <p className="text-sm text-gray-500 mb-4">
        Kunden ohne Koordinaten per OpenStreetMap/Nominatim geocodieren.
      </p>

      {stats && (
        <div className="flex gap-4 mb-4">
          <div className="bg-gray-50 rounded-lg px-4 py-2 text-sm">
            <span className="text-gray-500">Gesamt:</span>{" "}
            <span className="font-semibold">{stats.total}</span>
          </div>
          <div className={`rounded-lg px-4 py-2 text-sm ${stats.ohneKoords > 0 ? "bg-yellow-50" : "bg-green-50"}`}>
            <span className="text-gray-500">Ohne Koordinaten:</span>{" "}
            <span className="font-semibold">{stats.ohneKoords}</span>
          </div>
        </div>
      )}

      {running && (
        <div className="mb-4">
          <p className="text-sm text-blue-700 mb-1">
            Verarbeitet: <strong>{progress}</strong>
            {errors > 0 && <span className="text-red-600 ml-2">({errors} Fehler)</span>}
          </p>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: stats?.ohneKoords ? `${Math.min(100, (progress / stats.ohneKoords) * 100)}%` : "0%" }}
            />
          </div>
        </div>
      )}

      {done && !running && (
        <p className="text-sm text-green-700 mb-4">
          Fertig! {progress} Adressen verarbeitet{errors > 0 ? `, ${errors} Fehler` : ""}.
        </p>
      )}

      <div className="flex gap-2">
        <button
          onClick={startBatch}
          disabled={running || (stats?.ohneKoords === 0)}
          className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          {running ? "Läuft…" : "Batch-Validierung starten"}
        </button>
        {running && (
          <button
            onClick={() => { abortRef.current = true; }}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
          >
            Abbrechen
          </button>
        )}
      </div>
    </div>
  );
}

export default function AdressenPage() {
  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/einstellungen" className="hover:text-green-700">Einstellungen</Link>
        <span>›</span>
        <span className="text-gray-800 font-medium">Adress-Validierung</span>
      </div>

      <h1 className="text-2xl font-bold mb-6">Adress-Validierung</h1>

      <BatchAdressValidierung />
    </div>
  );
}
