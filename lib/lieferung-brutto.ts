// Konsolidierte Brutto-Berechnung für Lieferung/Sammelrechnung — vorher an drei
// Stellen dupliziert (Bankabgleich-Vorschläge, Rechnungsdruck-Ähnliches).

export interface LieferpositionFuerBrutto {
  menge: number;
  verkaufspreis: number;
  rabattProzent: number;
  // Bei Positionserstellung eingefrorener Satz (Lieferposition.mwstSatz) — maßgeblich,
  // sobald vorhanden. artikel.mwstSatz ist nur noch Fallback für Altbestand aus der Zeit
  // vor dieser Migration (dort per Backfill bereits auf mwstSatz übertragen, sollte also
  // nie mehr greifen) bzw. für Aufrufer, die die Position ohne mwstSatz selektieren.
  mwstSatz?: number | null;
  artikel?: { mwstSatz: number | null } | null;
}

export interface LieferungFuerBrutto {
  positionen: LieferpositionFuerBrutto[];
}

/** Brutto-Summe einer Lieferung (Menge × Verkaufspreis × (1-Rabatt%) × (1+MwSt%)). */
export function berechneLieferungBrutto(lieferung: LieferungFuerBrutto): number {
  return lieferung.positionen.reduce((sum, p) => {
    const mwst = p.mwstSatz ?? p.artikel?.mwstSatz ?? 19;
    return sum + p.menge * p.verkaufspreis * (1 - p.rabattProzent / 100) * (1 + mwst / 100);
  }, 0);
}

/** Brutto-Summe einer Sammelrechnung (Summe der Brutto-Beträge ihrer Lieferungen). */
export function berechneSammelrechnungBrutto(sammelrechnung: { lieferungen: LieferungFuerBrutto[] }): number {
  return sammelrechnung.lieferungen.reduce((sum, l) => sum + berechneLieferungBrutto(l), 0);
}
