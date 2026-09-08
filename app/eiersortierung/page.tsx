"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDatum } from "@/lib/utils";
import * as Sentry from "@sentry/nextjs";

interface Position {
  id: number;
  gueteklasse: string;
  gewichtsklasse: string;
  menge: number;
  chargeNr: string | null;
  artikel: { id: number; name: string; einheit: string };
}

interface Sortierung {
  id: number;
  datum: string;
  notiz: string | null;
  anlieferung: { id: number; nummer: string; kunde: { id: number; name: string; firma: string | null } } | null;
  positionen: Position[];
}

export default function EiersortierungListePage() {
  const [liste, setListe] = useState<Sortierung[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/eiersortierung")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setListe(Array.isArray(d) ? d : []))
      .catch((err) => Sentry.captureException(err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">Ei-Sortierprotokoll</h1>
        <Link
          href="/eiersortierung/neu"
          className="px-4 py-2 text-sm bg-green-700 hover:bg-green-800 text-white rounded-lg font-medium"
        >
          + Neue Sortierung
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Lade…</p>
      ) : liste.length === 0 ? (
        <p className="text-sm text-gray-400 italic">Noch keine Sortierung erfasst.</p>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-100">
          {liste.map((s) => {
            const gesamtMenge = s.positionen.reduce((sum, p) => sum + p.menge, 0);
            return (
              <Link
                key={s.id}
                href={`/eiersortierung/${s.id}`}
                className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-gray-50 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {formatDatum(s.datum)}
                    {s.anlieferung && (
                      <span className="text-gray-500 font-normal"> · {s.anlieferung.nummer} ({s.anlieferung.kunde.firma || s.anlieferung.kunde.name})</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {s.positionen.length} Charge{s.positionen.length !== 1 ? "n" : ""} ·{" "}
                    {s.positionen.map((p) => `${p.gueteklasse}/${p.gewichtsklasse}`).join(", ")}
                    {s.notiz && <span> · {s.notiz}</span>}
                  </p>
                </div>
                <span className="text-sm font-medium text-gray-700 shrink-0">{gesamtMenge}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
