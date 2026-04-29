// Safe select for Artikel that omits `unterkategorie` so API routes keep working
// even before the `20260427000000_add_artikel_unterkategorie` migration is applied
// in environments that lag behind the codebase. Use this everywhere artikel data
// is loaded for read-only display in lists/details.
export const artikelSafeSelect = {
  id: true,
  artikelnummer: true,
  name: true,
  kategorie: true,
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
