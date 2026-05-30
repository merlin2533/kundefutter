"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatDatum } from "@/lib/utils";

interface Nachweis {
  id: number;
  typ: string;
  nummer: string | null;
  ausstellung: string | null;
  gueltigBis: string | null;
  ausgestelltVon: string | null;
  notiz: string | null;
  belegPfad: string | null;
  belegName: string | null;
}

function statusAmpel(gueltigBis: string | null): { label: string; cls: string } {
  if (!gueltigBis) return { label: "Kein Ablaufdatum", cls: "bg-gray-100 text-gray-500" };
  const diff = (new Date(gueltigBis).getTime() - Date.now()) / 86400000;
  if (diff < 0) return { label: "Abgelaufen", cls: "bg-red-100 text-red-700" };
  if (diff < 90) return { label: `Läuft ab (${Math.round(diff)} Tage)`, cls: "bg-yellow-100 text-yellow-800" };
  return { label: "Gültig", cls: "bg-green-100 text-green-700" };
}

export default function SachkundenachweiseTab({ kundeId }: { kundeId: number }) {
  const [liste, setListe] = useState<Nachweis[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<number | null>(null);
  const fileRefs = useRef<Record<number, HTMLInputElement | null>>({});

  async function load() {
    const res = await fetch(`/api/sachkundenachweise?kundeId=${kundeId}`);
    const d = await res.json();
    setListe(Array.isArray(d) ? d : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [kundeId]);

  async function handleDelete(id: number) {
    if (!confirm("Nachweis wirklich löschen?")) return;
    await fetch(`/api/sachkundenachweise?id=${id}`, { method: "DELETE" });
    setListe(l => l.filter(e => e.id !== id));
  }

  async function handleBelegDelete(id: number) {
    if (!confirm("Dokument entfernen?")) return;
    await fetch(`/api/sachkundenachweise/${id}/beleg`, { method: "DELETE" });
    setListe(l => l.map(e => e.id === id ? { ...e, belegPfad: null, belegName: null } : e));
  }

  async function handleUpload(id: number, file: File) {
    setUploading(id);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/sachkundenachweise/${id}/beleg`, { method: "POST", body: fd });
    setUploading(null);
    if (res.ok) {
      const json = await res.json();
      setListe(l => l.map(e => e.id === id ? { ...e, belegPfad: json.belegPfad, belegName: json.belegName } : e));
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error ?? "Upload fehlgeschlagen");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-800">Sachkundenachweise</h3>
        <Link
          href={`/sachkundenachweise/neu?kundeId=${kundeId}`}
          className="text-sm px-3 py-1.5 bg-green-700 hover:bg-green-800 text-white rounded-lg transition-colors font-medium"
        >
          + Neuer Nachweis
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Lade…</p>
      ) : liste.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <p>Keine Sachkundenachweise vorhanden.</p>
          <Link href={`/sachkundenachweise/neu?kundeId=${kundeId}`} className="text-green-700 hover:underline text-sm mt-2 inline-block">
            Ersten Nachweis erfassen →
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {liste.map(e => {
            const ampel = statusAmpel(e.gueltigBis);
            const isUploading = uploading === e.id;
            return (
              <div key={e.id} className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-medium text-gray-800 text-sm">{e.typ}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ampel.cls}`}>{ampel.label}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500">
                      {e.nummer && <span>Nr. {e.nummer}</span>}
                      {e.ausstellung && <span>Ausgestellt: {formatDatum(e.ausstellung)}</span>}
                      {e.gueltigBis && <span>Gültig bis: {formatDatum(e.gueltigBis)}</span>}
                      {e.ausgestelltVon && <span>{e.ausgestelltVon}</span>}
                    </div>
                    {e.notiz && <p className="text-xs text-gray-400 mt-1 truncate">{e.notiz}</p>}

                    {/* Dokument */}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {e.belegPfad ? (
                        <>
                          <a
                            href={`/api/uploads/${e.belegPfad}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            {e.belegName ?? "Dokument"}
                          </a>
                          <button
                            onClick={() => handleBelegDelete(e.id)}
                            className="text-xs text-gray-400 hover:text-red-600"
                            title="Dokument entfernen"
                          >
                            ✕
                          </button>
                        </>
                      ) : (
                        <label className={`inline-flex items-center gap-1 text-xs cursor-pointer px-2 py-0.5 border border-dashed border-gray-300 rounded hover:border-green-500 hover:text-green-700 transition-colors ${isUploading ? "opacity-50 pointer-events-none" : ""}`}>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                          </svg>
                          {isUploading ? "Lädt…" : "Dokument hochladen"}
                          <input
                            ref={el => { fileRefs.current[e.id] = el; }}
                            type="file"
                            accept="application/pdf,image/*"
                            className="hidden"
                            onChange={async (ev) => {
                              const f = ev.target.files?.[0];
                              if (!f) return;
                              await handleUpload(e.id, f);
                              if (fileRefs.current[e.id]) fileRefs.current[e.id]!.value = "";
                            }}
                          />
                        </label>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleDelete(e.id)}
                    className="text-xs px-2 py-1 border border-red-200 text-red-600 rounded hover:bg-red-50 transition-colors flex-shrink-0"
                  >
                    Löschen
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
