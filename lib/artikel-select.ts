export const artikelSafeSelect = {
  id: true,
  artikelnummer: true,
  name: true,
  kategorie: true,
  unterkategorie: true,
  einheit: true,
  beschreibung: true,
  standardpreis: true,
  preisStand: true,
  mwstSatz: true,
  mindestbestand: true,
  aktuellerBestand: true,
  aktiv: true,
  lagerort: true,
  liefergroesse: true,
  createdAt: true,
  updatedAt: true,
  driveOrdnerId: true,
} as const;

// Minimal artikel fields needed when loading Lieferpositionen / Wareneingangspositionen
// for PDFs and exports. Keeps queries lean.
export const liefposArtikelSelect = {
  id: true,
  name: true,
  artikelnummer: true,
  einheit: true,
  mwstSatz: true,
  standardpreis: true,
} as const;
