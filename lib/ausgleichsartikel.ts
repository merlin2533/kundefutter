// Zentrale Liste der "Ausgleichsartikel" (Alte Forderung, Gutschrift-Verrechnung,
// Restdifferenz) — Pauschal-Positionen mit mwstSatz 0, die den Ausgleich eines bereits
// versteuerten Vorgangs darstellen, keinen neuen Umsatz. Bewusst importfrei/dependency-frei,
// damit sowohl lib/lieferung.ts (erzeugt sie) als auch lib/datev.ts (muss sie im Export
// erkennen und auf ein neutrales Konto statt eines Erlöskontos buchen) sie ohne
// Zirkelimport nutzen können.

export const ALTE_FORDERUNG_ARTIKELNUMMER = "ALTE-FORDERUNG";
export const GUTSCHRIFT_VERRECHNUNG_ARTIKELNUMMER = "GUTSCHRIFT-VERRECHNUNG";
export const RESTDIFFERENZ_ARTIKELNUMMER = "RESTDIFFERENZ";

export const AUSGLEICHS_ARTIKELNUMMERN: readonly string[] = [
  ALTE_FORDERUNG_ARTIKELNUMMER,
  GUTSCHRIFT_VERRECHNUNG_ARTIKELNUMMER,
  RESTDIFFERENZ_ARTIKELNUMMER,
];

export function istAusgleichsArtikelnummer(artikelnummer: string | null | undefined): boolean {
  return !!artikelnummer && AUSGLEICHS_ARTIKELNUMMERN.includes(artikelnummer);
}
