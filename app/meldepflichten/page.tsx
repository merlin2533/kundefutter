"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDatum } from "@/lib/utils";
import * as Sentry from "@sentry/nextjs";

interface AufgabeItem {
  id: number;
  betreff: string;
  faelligAm: string | null;
  prioritaet: string;
  erledigt: boolean;
}

function istEierhandelMeldung(betreff: string) {
  return betreff.includes("Tierseuchenkasse") || betreff.includes("KAT-Wochenmeldung");
}

function ampelFarbe(faelligAm: string | null): string {
  if (!faelligAm) return "bg-gray-100 text-gray-600";
  const tage = Math.floor((new Date(faelligAm).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  if (tage < 0) return "bg-red-100 text-red-800";
  if (tage <= 7) return "bg-amber-100 text-amber-800";
  return "bg-green-100 text-green-800";
}

function istUeberfaellig(faelligAm: string | null): boolean {
  return !!faelligAm && new Date(faelligAm).getTime() < Date.now();
}

export default function MeldepflichtenPage() {
  const [items, setItems] = useState<AufgabeItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/aufgaben?status=offen&limit=500")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => {
        const list: AufgabeItem[] = Array.isArray(d) ? d : (d.items ?? []);
        setItems(list.filter((a) => istEierhandelMeldung(a.betreff)));
      })
      .catch((err) => Sentry.captureException(err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">Meldepflichten</h1>
        <p className="text-sm text-gray-500">
          Fristen-Tracker für Eierhandel-Meldepflichten: jährliche Tierseuchenkasse-Tierzahlmeldung
          (Frist 31.01.) und wöchentliche KAT-Warenstrommeldung. Wird automatisch per Cron-Job als
          Aufgabe angelegt, sobald sie fällig wird.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Lade…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-400 italic">Aktuell keine offene Meldepflicht.</p>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-100">
          {items.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-4 px-5 py-4">
              <div>
                <p className="text-sm font-medium text-gray-800">{a.betreff}</p>
                {a.faelligAm && <p className="text-xs text-gray-500 mt-0.5">Fällig: {formatDatum(a.faelligAm)}</p>}
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium shrink-0 ${ampelFarbe(a.faelligAm)}`}>
                {istUeberfaellig(a.faelligAm) ? "Überfällig" : "Offen"}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6">
        <Link href="/aufgaben" className="text-sm text-green-700 hover:text-green-900 font-medium">
          → Alle Aufgaben ansehen
        </Link>
      </div>
    </div>
  );
}
