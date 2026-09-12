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
