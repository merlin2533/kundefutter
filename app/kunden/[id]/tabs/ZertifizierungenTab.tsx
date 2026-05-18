"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Zertifizierung {
  id: number;
  typ: string;
  nummer: string | null;
  ausstellerOrg: string | null;
  ausstellungsdatum: string | null;
  ablaufdatum: string | null;
  status: string;
  notiz: string | null;
}

function formatDatum(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("de-DE");
}

function ablaufAmpel(ablaufdatum: string | null): { icon: string; text: string; label: string } {
  if (!ablaufdatum) return { icon: "⚪", text: "text-gray-500", label: "Kein Ablaufdatum" };
  const diff = (new Date(ablaufdatum).getTime() - Date.now()) / 86400000;
  if (diff < 0) return { icon: "🔴", text: "text-red-600", label: "Abgelaufen" };
  if (diff < 30) return { icon: "🟠", text: "text-orange-600", label: `< 30 Tage` };
  if (diff < 90) return { icon: "🟡", text: "text-amber-600", label: `${Math.round(diff)} Tage` };
  return { icon: "🟢", text: "text-green-700", label: "Gültig" };
}

export default function ZertifizierungenTab({ kundeId }: { kundeId: number }) {
  const [liste, setListe] = useState<Zertifizierung[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch(`/api/zertifizierungen?kundeId=${kundeId}`);
    const d = await res.json();
    setListe(Array.isArray(d) ? d : []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [kundeId]);

  async function handleDelete(id: number) {
    if (!confirm("Zertifizierung löschen?")) return;
    await fetch(`/api/zertifizierungen/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-800">Zertifizierungen</h3>
        <Link
          href={`/zertifizierungen/neu?kundeId=${kundeId}`}
          className="text-sm px-3 py-1.5 bg-green-700 hover:bg-green-800 text-white rounded-lg transition-colors font-medium"
        >
          + Neue Zertifizierung
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Lade…</p>
      ) : liste.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <p>Keine Zertifizierungen vorhanden.</p>
          <Link
            href={`/zertifizierungen/neu?kundeId=${kundeId}`}
            className="text-green-700 hover:underline text-sm mt-2 inline-block"
          >
            Erste Zertifizierung erfassen →
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {liste.map((z) => {
            const ampel = ablaufAmpel(z.ablaufdatum);
            return (
              <div key={z.id} className="border border-gray-200 rounded-lg p-3 flex items-center justify-between gap-3 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-lg">{ampel.icon}</span>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-800 text-sm">{z.typ}</p>
                    <div className="flex gap-2 flex-wrap mt-0.5">
                      {z.nummer && <span className="text-xs text-gray-500 font-mono">{z.nummer}</span>}
                      {z.ausstellerOrg && <span className="text-xs text-gray-400">{z.ausstellerOrg}</span>}
                      {z.ablaufdatum && (
                        <span className={`text-xs font-medium ${ampel.text}`}>
                          Ablauf: {formatDatum(z.ablaufdatum)} · {ampel.label}
                        </span>
                      )}
                    </div>
                    {z.notiz && <p className="text-xs text-gray-400 mt-0.5 truncate">{z.notiz}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Link
                    href={`/zertifizierungen/${z.id}`}
                    className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-100 transition-colors"
                  >
                    Bearbeiten
                  </Link>
                  <button
                    onClick={() => handleDelete(z.id)}
                    className="text-xs px-2 py-1 border border-red-200 text-red-600 rounded hover:bg-red-50 transition-colors"
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
