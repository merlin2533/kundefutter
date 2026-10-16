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

export interface GutschriftpositionFuerBrutto {
  menge: number;
  preis: number;
  // GutschriftPosition hat (anders als Lieferposition) kein eigenes mwstSatz-Snapshot-Feld
  // — liest live von Artikel.mwstSatz, identisch zu generiereGutschriftPdf().
  artikel?: { mwstSatz: number | null } | null;
}

/**
 * Brutto-Summe einer Gutschrift (Menge × Preis × (1+MwSt%), je Position). Eine Gutschrift
 * gegen eine bereits gestellte (brutto ausgewiesene) Rechnung muss ebenfalls brutto
 * verrechnet werden — sonst fehlt der Restdifferenz genau der MwSt-Anteil der Gutschrift
 * (siehe verrechneOffeneRestdifferenz() in lib/lieferung.ts).
 */
export function berechneGutschriftBrutto(positionen: GutschriftpositionFuerBrutto[]): number {
  return positionen.reduce((sum, p) => {
    const mwst = p.artikel?.mwstSatz ?? 19;
    return sum + p.menge * p.preis * (1 + mwst / 100);
  }, 0);
}

/**
 * Noch offener Betrag einer gestellten Rechnung: Brutto abzüglich bereits erfasster
 * Teilzahlungen (kaufmännisch gerundet, nie negativ). Einzige Quelle für Mahnwesen,
 * Dashboard, Liquidität — verbuchte Gutschriften/Forderungen werden wie auf der
 * Lieferungs-Detailseite bewusst nicht pauschal abgezogen (sie sind eigene Belege).
 */
export function berechneOffenenBetrag(l: LieferungFuerBrutto & { teilzahlungen?: { betrag: number }[] }): number {
  const bezahlt = (l.teilzahlungen ?? []).reduce((s, t) => s + t.betrag, 0);
  return Math.max(0, Math.round((berechneLieferungBrutto(l) - bezahlt) * 100) / 100);
}

/**
 * Entscheidet nach dem Löschen einer Teilzahlung, ob "bezahlt" zurückgenommen wird.
 * Nur wenn bezahltAm genau von dieser Teilzahlung gesetzt wurde (gleiches Datum), keine
 * Bankabgleich-Zuordnung existiert und die Rechnung wieder offen ist.
 */
export function sollBezahltZurueckgenommenWerden(p: {
  bezahltAm: Date | null;
  geloeschtDatum: Date;
  hatKontoumsatz: boolean;
  offenerBetrag: number;
}): boolean {
  if (!p.bezahltAm || p.hatKontoumsatz) return false;
  if (p.bezahltAm.getTime() !== p.geloeschtDatum.getTime()) return false;
  return p.offenerBetrag > 0.005;
}
