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
 * Offene Gutschriften sind zusätzlich per Checkbox abwählbar (gutschriftBeruecksichtigen) —
 * bleibt sie unangehakt, wird die Gutschrift bei DIESER Rechnung übersprungen und bei einer
 * späteren Rechnung dieses Kunden erneut vorgeschlagen. Offene Forderungen (Unterzahlung, die
 * der Kunde noch schuldet) bleiben bewusst ohne Abwahlmöglichkeit — anders als eine Gutschrift
 * gibt es keinen Grund, eine dem Kunden bereits bekannte Nachforderung zurückzuhalten.
 */
export default function OffenePostenHinweis({
  kundeId,
  gutschriftBeruecksichtigen,
  onGutschriftBeruecksichtigenChange,
}: {
  kundeId: number;
  gutschriftBeruecksichtigen: boolean;
  onGutschriftBeruecksichtigenChange: (value: boolean) => void;
}) {
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
    <div className="mb-3 text-xs bg-blue-50 border border-blue-200 text-blue-800 rounded-lg px-3 py-2 print:hidden space-y-1.5">
      {gutschriften.length > 0 && (
        <label className="flex items-start gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={gutschriftBeruecksichtigen}
            onChange={(e) => onGutschriftBeruecksichtigenChange(e.target.checked)}
            className="mt-0.5 rounded border-gray-300 text-green-600 focus:ring-green-500"
          />
          <span>
            ℹ️ {gutschriften.length} offene Gutschrift{gutschriften.length > 1 ? "en" : ""} (−{formatEuro(gutschriftSumme)}) bei
            dieser Rechnung berücksichtigen — sonst bleib{gutschriften.length > 1 ? "en sie offen und werden" : "t sie offen und wird"} bei
            einer späteren Rechnung erneut vorgeschlagen.
          </span>
        </label>
      )}
      {forderungen.length > 0 && (
        <div>
          ℹ️ {forderungen.length} offene Forderung{forderungen.length > 1 ? "en" : ""} (+{formatEuro(forderungSumme)}) werden
          automatisch mit aufgeführt.
        </div>
      )}
    </div>
  );
}
