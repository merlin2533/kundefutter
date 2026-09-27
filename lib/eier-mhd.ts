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
