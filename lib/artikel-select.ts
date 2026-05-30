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
  sprengstoffvorlaeufer: true,
  chargePflicht: true,
  lagerTracking: true,
  ghsKlassen: true,
  hSaetze: true,
  pSaetze: true,
  signalwort: true,
} as const;

// Same as artikelSafeSelect but includes the inhaltsstoffe relation and GHS fields.
// Use this in Prisma queries where nutrient data and safety data are needed (e.g. delivery note print).
// NOTE: Prisma select does not support relation fields with `true`; they must be
// included via a nested include object.
export const artikelWithInhaltSelect = {
  select: {
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
    sprengstoffvorlaeufer: true,
    chargePflicht: true,
    lagerTracking: true,
    ghsKlassen: true,
    hSaetze: true,
    pSaetze: true,
    signalwort: true,
    inhaltsstoffe: true,
  },
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

// Explicit Lieferung field list — prevents "column not found" errors when include:true
// loads ALL columns including ones added by newer migrations not yet applied on the DB.
export const lieferungSafeSelect = {
  id: true,
  kundeId: true,
  datum: true,
  lieferDatum: true,
  status: true,
  stornoBegründung: true,
  notiz: true,
  rechnungNr: true,
  rechnungDatum: true,
  bezahltAm: true,
  zahlungsziel: true,
  wiederkehrend: true,
  sammelrechnungId: true,
  createdAt: true,
  updatedAt: true,
} as const;
