// Gemeinsame, reine Auswertungslogik für KI-erkannte Eingangsrechnungs-Daten
// (KiEingangsrechnungBatchItem) — genutzt von der Batch-Review-Seite
// (app/eingangsrechnungen/batch/[id]/page.tsx, clientseitig) UND vom automatischen
// E-Mail-Rechnungseingang (lib/email-eingang-verarbeitung.ts, serverseitig).
//
// War ursprünglich nur als lokale Funktion in der Batch-Review-Seite vorhanden — hierher
// verschoben, damit beide Aufrufer exakt dieselbe "was fehlt noch"-Bewertung nutzen und nicht
// unbemerkt auseinanderlaufen (analog zum bereits etablierten Muster in lib/kiMatching.ts).
// Bewusst importfrei/dependency-frei, damit die Datei sowohl im Client-Bundle (Batch-Review-Seite)
// als auch server-only (E-Mail-Pipeline) sicher verwendbar ist.

import type { Konfidenz } from "./kiMatching";

export interface BelegKiErgebnis {
  datum: string | null;
  belegNr: string | null;
  faelligAm: string | null;
  beschreibung: string | null;
  betragNetto: number | null;
  betragBrutto: number | null;
  mwstSatz: number;
  lieferant: string | null;
  iban: string | null;
  bic: string | null;
}

const GUELTIGE_MWST = [0, 7, 19];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Normalisiert/validiert das rohe KI-JSON-Ergebnis von `PROMPTS.beleg` (lib/ai.ts) zu einem
 * sicheren, typgeprüften Objekt — einzige Quelle der Wahrheit für diese Umwandlung, genutzt vom
 * manuellen Batch-Analyze-Endpunkt (`app/api/ki/eingangsrechnung/batch/[id]/analyze/route.ts`)
 * UND vom automatischen E-Mail-Rechnungseingang (`lib/email-eingang-verarbeitung.ts`), damit beide
 * Wege identisch mit demselben KI-Ergebnis umgehen.
 */
export function parseBelegKiErgebnis(p: Record<string, unknown>): BelegKiErgebnis {
  const mwstRaw = Number(p.mwstSatz);
  const mwstSatz = GUELTIGE_MWST.includes(mwstRaw) ? mwstRaw : 19;
  return {
    datum: typeof p.datum === "string" && DATE_PATTERN.test(p.datum) ? p.datum : null,
    belegNr: typeof p.belegNr === "string" ? p.belegNr : null,
    faelligAm: typeof p.faelligAm === "string" && DATE_PATTERN.test(p.faelligAm) ? p.faelligAm : null,
    beschreibung: typeof p.beschreibung === "string" ? p.beschreibung.substring(0, 80) : null,
    betragNetto: typeof p.betragNetto === "number" ? Math.round(p.betragNetto * 100) / 100 : null,
    betragBrutto: typeof p.betragBrutto === "number" ? Math.round(p.betragBrutto * 100) / 100 : null,
    mwstSatz,
    lieferant: typeof p.lieferant === "string" ? p.lieferant : null,
    iban:
      typeof p.iban === "string" && /^[A-Z]{2}[0-9A-Z]{10,30}$/.test(p.iban.replace(/\s/g, "").toUpperCase())
        ? p.iban.replace(/\s/g, "").toUpperCase()
        : null,
    bic: typeof p.bic === "string" && p.bic.trim() ? p.bic.trim().toUpperCase() : null,
  };
}

/**
 * Berechnet eine Liste von Hinweistexten für Dinge, die bei einer KI-erkannten Eingangsrechnung
 * noch manuell geprüft/ergänzt werden sollten, bevor sie "passt" (verbuchungsbereit) ist. Ein
 * leeres Array bedeutet: alle Pflichtfelder für `PUT .../abschliessen` sind vorhanden.
 */
export function berechneFehlendeFelderEingangsrechnung(item: {
  lieferantKonfidenz: Konfidenz | null;
  nummer: string | null;
  datum: string | null;
  betragNetto: number | null;
}): string[] {
  const felder: string[] = [];
  if (!item.lieferantKonfidenz || item.lieferantKonfidenz === "keine" || item.lieferantKonfidenz === "niedrig") {
    felder.push("Lieferant nicht eindeutig zugeordnet");
  }
  if (!item.datum) felder.push("Rechnungsdatum fehlt");
  if (item.betragNetto == null || item.betragNetto <= 0) felder.push("Betrag fehlt");
  if (!item.nummer || !item.nummer.trim()) felder.push("Rechnungsnummer fehlt");
  return felder;
}
