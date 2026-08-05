"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatEuro } from "@/lib/utils";

interface GutschriftPosition {
  menge: number;
  preis: number;
}
interface OffeneGutschrift {
  id: number;
  nummer: string;
  positionen: GutschriftPosition[];
}
interface OffeneForderung {
  id: number;
  betrag: number;
}

/**
 * 6. Kachel der Schnellübersicht: offene Gutschriften (Überzahlung) und offene Forderungen
 * (Fehlbetrag), die beide automatisch in die nächste Rechnung dieses Kunden eingerechnet
 * werden (injiziereOffeneGutschriften()/injiziereAlteForderungen() in lib/lieferung.ts).
 * Eigener, kleiner Fetch statt Teil des großen Kunde-Objekts (gleiches Muster wie
 * ForderungenTab) — die Kachel soll nicht das ganze Kunde-Laden verlangsamen/verkomplizieren.
 */
export default function OffenePostenUebersicht({ kundeId, onOpenForderungen }: { kundeId: number; onOpenForderungen: () => void }) {
  const [gutschriften, setGutschriften] = useState<OffeneGutschrift[]>([]);
  const [forderungen, setForderungen] = useState<OffeneForderung[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/gutschriften?kundeId=${kundeId}&status=OFFEN`).then((r) => (r.ok ? r.json() : [])),
      fetch(`/api/kunden/${kundeId}/forderungen?offen=true`).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([gs, fs]) => {
        setGutschriften(Array.isArray(gs) ? gs : []);
        setForderungen(Array.isArray(fs) ? fs : []);
      })
      .finally(() => setLoading(false));
  }, [kundeId]);

  const gutschriftSumme = gutschriften.reduce(
    (s, g) => s + g.positionen.reduce((ps, p) => ps + p.menge * p.preis, 0),
    0
  );
  const forderungSumme = forderungen.reduce((s, f) => s + f.betrag, 0);
  const hatEintraege = gutschriften.length > 0 || forderungen.length > 0;

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-3 flex flex-col gap-1">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Offene Posten (Kunde)</p>
        <p className="text-sm text-gray-400">Lädt…</p>
      </div>
    );
  }

  return (
    <div
      className={`border rounded-xl p-3 flex flex-col gap-1.5 ${
        hatEintraege ? "bg-amber-50 border-amber-200" : "bg-white border-gray-200"
      }`}
    >
      <p className={`text-xs font-semibold uppercase tracking-wide ${hatEintraege ? "text-amber-500" : "text-gray-400"}`}>
        Offene Posten
      </p>
      {!hatEintraege ? (
        <p className="text-sm text-gray-400">Keine</p>
      ) : (
        <>
          {gutschriften.length > 0 && (
            <Link href="/gutschriften" className="text-xs text-blue-700 hover:underline">
              {gutschriften.length} Gutschrift{gutschriften.length > 1 ? "en" : ""}: {formatEuro(gutschriftSumme)} →
            </Link>
          )}
          {forderungen.length > 0 && (
            <button onClick={onOpenForderungen} className="text-xs text-red-700 hover:underline text-left">
              {forderungen.length} Forderung{forderungen.length > 1 ? "en" : ""}: {formatEuro(forderungSumme)} →
            </button>
          )}
          <p className="text-[11px] text-gray-500 mt-0.5">Werden automatisch in die nächste Rechnung übernommen</p>
        </>
      )}
    </div>
  );
}
