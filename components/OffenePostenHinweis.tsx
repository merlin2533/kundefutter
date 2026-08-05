"use client";

import { useEffect, useState } from "react";
import { formatEuro } from "@/lib/utils";

interface GutschriftPosition {
  menge: number;
  preis: number;
}
interface OffeneGutschrift {
  id: number;
  positionen: GutschriftPosition[];
}
interface OffeneForderung {
  id: number;
  betrag: number;
}

/**
 * Kompakter Hinweis auf der Lieferungs-Detailseite, bevor eine Rechnung erstellt wird: macht
 * sichtbar, dass offene Gutschriften/Forderungen dieses Kunden automatisch mit in die neue
 * Rechnung übernommen werden (injiziereOffeneGutschriften()/injiziereAlteForderungen() in
 * lib/lieferung.ts) — sonst käme die zusätzliche Position auf dem gedruckten Beleg überraschend.
 */
export default function OffenePostenHinweis({ kundeId }: { kundeId: number }) {
  const [gutschriften, setGutschriften] = useState<OffeneGutschrift[]>([]);
  const [forderungen, setForderungen] = useState<OffeneForderung[]>([]);

  useEffect(() => {
    Promise.all([
      fetch(`/api/gutschriften?kundeId=${kundeId}&status=OFFEN`).then((r) => (r.ok ? r.json() : [])),
      fetch(`/api/kunden/${kundeId}/forderungen?offen=true`).then((r) => (r.ok ? r.json() : [])),
    ]).then(([gs, fs]) => {
      setGutschriften(Array.isArray(gs) ? gs : []);
      setForderungen(Array.isArray(fs) ? fs : []);
    });
  }, [kundeId]);

  if (gutschriften.length === 0 && forderungen.length === 0) return null;

  const gutschriftSumme = gutschriften.reduce(
    (s, g) => s + g.positionen.reduce((ps, p) => ps + p.menge * p.preis, 0),
    0
  );
  const forderungSumme = forderungen.reduce((s, f) => s + f.betrag, 0);

  return (
    <div className="mb-3 text-xs bg-blue-50 border border-blue-200 text-blue-800 rounded-lg px-3 py-2 print:hidden">
      ℹ️ Bei der nächsten Rechnung dieses Kunden werden automatisch mit aufgeführt:{" "}
      {gutschriften.length > 0 && (
        <>
          {gutschriften.length} offene Gutschrift{gutschriften.length > 1 ? "en" : ""} (−{formatEuro(gutschriftSumme)})
        </>
      )}
      {gutschriften.length > 0 && forderungen.length > 0 && " · "}
      {forderungen.length > 0 && (
        <>
          {forderungen.length} offene Forderung{forderungen.length > 1 ? "en" : ""} (+{formatEuro(forderungSumme)})
        </>
      )}
    </div>
  );
}
