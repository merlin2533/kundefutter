// MHD-Berechnung für Eier: 28 Tage ab Legedatum (nicht ab Wareneingangs-/Rechnungsdatum!) —
// EU-Vermarktungsnorm, Del. VO (EU) 2023/2465 + DVO (EU) 2023/2466. Reine Datumsarithmetik ohne
// Abhängigkeiten — client- und serverseitig gleichermaßen nutzbar (Live-Vorschau im
// Lieferungs-Formular UND serverseitige Berechnung für Druck/Export).

const EIER_MHD_TAGE = 28;

export function berechneEierMhd(legedatum: Date): Date {
  const mhd = new Date(legedatum);
  mhd.setDate(mhd.getDate() + EIER_MHD_TAGE);
  return mhd;
}

export type EierMhdStatus = "abgelaufen" | "ablaufend" | "gueltig" | "unbekannt";

// Einzige Quelle der Wahrheit für die MHD-Ampel-Schwelle (≤7 Tage = "läuft bald ab") — vorher an
// zwei Stellen dupliziert (app/eierkontrolle/page.tsx, app/page.tsx-Dashboard-Widget) mit
// abweichender Umsetzung (u.a. `Date.now()` direkt im Render, was den ESLint-Regel
// react-hooks/purity verletzt hatte). Nimmt bewusst `legedatum: string | null` (nicht `Date`),
// da beide Aufrufer den Wert unverändert aus einer JSON-Response reichen.
export function eierMhdStatus(legedatum: string | null): EierMhdStatus {
  if (!legedatum) return "unbekannt";
  const mhd = berechneEierMhd(new Date(legedatum));
  const tage = Math.ceil((mhd.getTime() - Date.now()) / 86400000);
  if (tage < 0) return "abgelaufen";
  if (tage <= 7) return "ablaufend";
  return "gueltig";
}

/**
 * Baut die Eier-Kennzeichnungszeile (EU-Vermarktungsnorm) für eine Lieferposition:
 * "Güteklasse A · Gewichtsklasse M · Erzeugercode … · MHD …", nur die tatsächlich gesetzten
 * Teile. Leerer String, wenn keine Güteklasse gesetzt ist (Position ist kein Ei) — es wird
 * also nichts mit Platzhaltern aufgefüllt. Einzige Quelle der Wahrheit für dieses Format:
 * genutzt vom server-seitigen PDF (lib/pdfGenerator.ts) UND den zwei Bildschirm-Vorschauen
 * (app/lieferungen/[id]/rechnung, .../lieferschein) — vorher an allen drei Stellen dupliziert.
 * Datumsformatierung bewusst per einfachem `toLocaleDateString("de-DE")` statt eines Imports aus
 * lib/utils.ts (formatDatum), damit dieses Modul weiterhin importfrei bleibt.
 */
export function eierKennzeichnungZeile(p: {
  gueteklasse?: string | null;
  gewichtsklasse?: string | null;
  erzeugercode?: string | null;
  legedatum?: Date | string | null;
}): string {
  if (!p.gueteklasse) return "";
  const teile = [
    `Güteklasse ${p.gueteklasse}`,
    p.gewichtsklasse ? `Gewichtsklasse ${p.gewichtsklasse}` : null,
    p.erzeugercode ? `Erzeugercode ${p.erzeugercode}` : null,
    p.legedatum ? `MHD ${berechneEierMhd(new Date(p.legedatum)).toLocaleDateString("de-DE")}` : null,
  ].filter(Boolean);
  return teile.join(" · ");
}
