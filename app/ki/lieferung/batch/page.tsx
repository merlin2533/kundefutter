"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import MultiCameraUpload, { type AusgewaehlteDatei } from "@/components/MultiCameraUpload";

interface BatchUebersicht {
  id: number;
  status: string;
  itemCount: number;
  counts: Record<string, number>;
  createdAt: string;
  abgeschlossenAm: string | null;
}

function statusLabel(status: string) {
  switch (status) {
    case "offen": return { label: "Offen", cls: "bg-gray-100 text-gray-700" };
    case "verarbeitung": return { label: "In Verarbeitung", cls: "bg-blue-100 text-blue-800" };
    case "bereit": return { label: "Bereit zum Abschließen", cls: "bg-amber-100 text-amber-800" };
    case "abgeschlossen": return { label: "Abgeschlossen", cls: "bg-green-100 text-green-800" };
    default: return { label: status, cls: "bg-gray-100 text-gray-600" };
  }
}

export default function KiLieferungBatchStartPage() {
  const router = useRouter();
  const [dateien, setDateien] = useState<AusgewaehlteDatei[]>([]);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [batches, setBatches] = useState<BatchUebersicht[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(true);

  useEffect(() => {
    fetch("/api/ki/lieferung/batch")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setBatches(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoadingBatches(false));
  }, []);

  async function starteBatch() {
    if (dateien.length === 0) return;
    setStarting(true);
    setError("");
    try {
      const formData = new FormData();
      for (const d of dateien) formData.append("files", d.file, d.file.name);

      const res = await fetch("/api/ki/lieferung/batch", { method: "POST", body: formData });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Batch konnte nicht angelegt werden");
      }
      const neu = await res.json();
      router.push(`/ki/lieferung/batch/${neu.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      setStarting(false);
    }
  }

  const offeneBatches = batches.filter((b) => b.status !== "abgeschlossen");

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900">KI-Lieferung: Batch-Modus</h1>
        <Link href="/ki/lieferung" className="text-sm font-medium text-green-700 hover:text-green-800">
          ← Einzelnen Lieferschein erkennen
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <h2 className="text-lg font-semibold mb-2 text-gray-800">Neue Lieferscheine hochladen</h2>
        <p className="text-sm text-gray-500 mb-6">
          Fotografiere oder lade mehrere Lieferscheine auf einmal hoch (empfohlen: 10–20 Stück).
          Die KI analysiert anschließend jeden einzeln und du prüfst danach alle gesammelt in
          einer Übersicht.
        </p>

        <MultiCameraUpload dateien={dateien} onChange={setDateien} />

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            onClick={starteBatch}
            disabled={dateien.length === 0 || starting}
            className="px-6 py-2.5 rounded-lg text-sm font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {starting && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            Batch starten {dateien.length > 0 && `(${dateien.length} Lieferscheine)`}
          </button>
        </div>
      </div>

      {!loadingBatches && offeneBatches.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-800">Offene Batches fortsetzen</h2>
          <div className="space-y-2">
            {offeneBatches.map((b) => {
              const s = statusLabel(b.status);
              const analysiert = (b.counts.analysiert ?? 0) + (b.counts.uebernommen ?? 0) + (b.counts.fehler ?? 0);
              return (
                <Link
                  key={b.id}
                  href={`/ki/lieferung/batch/${b.id}`}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg border border-gray-200 hover:border-green-300 hover:bg-green-50/50 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Batch #{b.id} — {b.itemCount} Lieferscheine
                    </p>
                    <p className="text-xs text-gray-400">
                      {analysiert} von {b.itemCount} analysiert · erstellt am{" "}
                      {new Date(b.createdAt).toLocaleDateString("de-DE")}
                    </p>
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${s.cls}`}>
                    {s.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
