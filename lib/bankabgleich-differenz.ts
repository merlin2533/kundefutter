// Erfasst beim Bankabgleich eine Betragsdifferenz zwischen Kontoumsatz und zugeordneter
// Rechnung (Lieferung/Sammelrechnung) als Gutschrift (Überzahlung) oder KundeForderung
// (Unterzahlung/Fehlbetrag). Beide fließen automatisch in die nächste Rechnung dieses
// Kunden ein — siehe injiziereAlteForderungen()/injiziereOffeneGutschriften() in
// lib/lieferung.ts.

import { naechsteGutschriftsnummer } from "@/lib/utils";
import { ladeOderErstelleAusgleichsArtikel, GUTSCHRIFT_VERRECHNUNG_ARTIKELNUMMER, type Tx } from "@/lib/lieferung";
import { berechneLieferungBrutto, berechneSammelrechnungBrutto } from "@/lib/lieferung-brutto";
import { DEFAULT_AMOUNT_TOLERANZ } from "@/lib/bankabgleich-matching";

export type BankabgleichZielTyp = "lieferung" | "sammelrechnung";
export type DifferenzArt = "gutschrift" | "forderung";

/** Signalisiert einen Eingabefehler (falsches Vorzeichen) statt eines echten Serverfehlers —
 * Aufrufer können damit gezielt 400 statt 500 zurückgeben. */
export class DifferenzValidierungsFehler extends Error {}

const ZIEL_ARTIKEL_SELECT = { artikel: { select: { mwstSatz: true } } } as const;

/** Lädt kundeId, Brutto-Betrag, Skonto-Konditionen und eine Kurzbezeichnung des Zuordnungsziels
 * (für Belegtexte). */
export async function ladeZielFuerDifferenz(
  tx: Tx,
  zielTyp: BankabgleichZielTyp,
  zielId: number
): Promise<{ kundeId: number; betrag: number; bezeichnung: string; skontoProzent: number | null } | null> {
  if (zielTyp === "lieferung") {
    const l = await tx.lieferung.findUnique({
      where: { id: zielId },
      select: { kundeId: true, rechnungNr: true, skontoProzent: true, positionen: { select: { menge: true, verkaufspreis: true, rabattProzent: true, mwstSatz: true, ...ZIEL_ARTIKEL_SELECT } } },
    });
    if (!l) return null;
    return { kundeId: l.kundeId, betrag: berechneLieferungBrutto(l), bezeichnung: l.rechnungNr ?? `Lieferung ${zielId}`, skontoProzent: l.skontoProzent };
  }
  const s = await tx.sammelrechnung.findUnique({
    where: { id: zielId },
    select: {
      kundeId: true,
      rechnungNr: true,
      skontoProzent: true,
      lieferungen: { select: { positionen: { select: { menge: true, verkaufspreis: true, rabattProzent: true, mwstSatz: true, ...ZIEL_ARTIKEL_SELECT } } } },
    },
  });
  if (!s) return null;
  return { kundeId: s.kundeId, betrag: berechneSammelrechnungBrutto(s), bezeichnung: s.rechnungNr ?? `Sammelrechnung ${zielId}`, skontoProzent: s.skontoProzent };
}

/** Toleranz (€) für den Vergleich Bankbetrag ↔ Skonto-reduzierter Rechnungsbetrag — deckt
 * Rundungsdifferenzen ab, ohne einen echten (größeren) Fehlbetrag fälschlich als Skonto
 * durchgehen zu lassen. Gleiche Schwelle wie DIFFERENZ_SCHWELLE in ZuordnungsVorschlagCard.tsx —
 * beide beziehen sich jetzt auf dieselbe DEFAULT_AMOUNT_TOLERANZ statt sie unabhängig zu duplizieren. */
const SKONTO_TOLERANZ = DEFAULT_AMOUNT_TOLERANZ;

/** Entspricht der gezahlte Betrag dem Skonto-reduzierten statt dem vollen Rechnungsbetrag? */
export function istSkontoBetrag(bankBetrag: number, zielBrutto: number, skontoProzent: number | null): boolean {
  if (skontoProzent == null) return false;
  const skontoBrutto = zielBrutto * (1 - skontoProzent / 100);
  return Math.abs(bankBetrag - skontoBrutto) <= SKONTO_TOLERANZ;
}

/**
 * Markiert Lieferung/Sammelrechnung automatisch als "Skonto genutzt", wenn der beim Bankabgleich
 * zugeordnete Betrag dem Skonto-reduzierten Rechnungsbetrag entspricht — unabhängig davon, ob
 * zusätzlich eine Differenzbuchung angefordert wurde. Kein Fehler/Log, falls kein Skonto
 * hinterlegt ist oder der Betrag nicht passt (Normalfall).
 */
export async function markiereSkontoGenutztFallsPassend(
  tx: Tx,
  zielTyp: BankabgleichZielTyp,
  zielId: number,
  bankBetrag: number
): Promise<void> {
  const ziel = await ladeZielFuerDifferenz(tx, zielTyp, zielId);
  if (!ziel || !istSkontoBetrag(bankBetrag, ziel.betrag, ziel.skontoProzent)) return;
  if (zielTyp === "lieferung") {
    await tx.lieferung.update({ where: { id: zielId }, data: { skontoGenutzt: true } });
  } else {
    await tx.sammelrechnung.update({ where: { id: zielId }, data: { skontoGenutzt: true } });
  }
}

/**
 * Legt je nach Art eine Gutschrift (Überzahlung, diff > 0) oder eine KundeForderung
 * (Unterzahlung/Fehlbetrag, diff < 0) über den Betrag |diff| an. Wirft bei falschem
 * Vorzeichen (z.B. Gutschrift bei einer Unterzahlung angefordert), damit der Aufrufer das
 * dem Nutzer als Fehler zurückmelden kann statt eine unsinnige Buchung zu erzeugen.
 */
export async function erfasseBankabgleichDifferenz(
  tx: Tx,
  opts: {
    zielTyp: BankabgleichZielTyp;
    zielId: number;
    kundeId: number;
    diff: number; // bankBetrag - zielBrutto; positiv = Überzahlung, negativ = Fehlbetrag
    zielBezeichnung: string;
    zielBrutto: number;
    skontoProzent: number | null;
    bankDatum: Date;
    art: DifferenzArt;
  }
): Promise<void> {
  const { zielTyp, zielId, kundeId, diff, zielBezeichnung, zielBrutto, skontoProzent, bankDatum, art } = opts;
  const datumStr = bankDatum.toLocaleDateString("de-DE");

  if (art === "gutschrift") {
    if (diff <= 0.01) throw new DifferenzValidierungsFehler("Kein Überschuss vorhanden — für eine Gutschrift muss der Bankbetrag höher als die Rechnung sein.");
    const artikel = await ladeOderErstelleAusgleichsArtikel(tx, GUTSCHRIFT_VERRECHNUNG_ARTIKELNUMMER, "Gutschrift-Verrechnung");
    const einstellung = await tx.einstellung.findUnique({ where: { key: "system.letzteGutschriftNr" } });
    const nummer = naechsteGutschriftsnummer(einstellung?.value ?? null);
    await tx.einstellung.upsert({
      where: { key: "system.letzteGutschriftNr" },
      update: { value: nummer },
      create: { key: "system.letzteGutschriftNr", value: nummer },
    });
    await tx.gutschrift.create({
      data: {
        nummer,
        kundeId,
        lieferungId: zielTyp === "lieferung" ? zielId : null,
        grund: "Sonstiges",
        notiz: `Überzahlung Bankabgleich: Kontoumsatz vom ${datumStr} über die Rechnung ${zielBezeichnung} hinaus (${diff.toFixed(2)} € mehr überwiesen). Wird automatisch in die nächste Rechnung eingerechnet.`,
        positionen: { create: [{ artikelId: artikel.id, menge: 1, preis: diff }] },
      },
    });
    return;
  }

  if (diff >= -0.01) throw new DifferenzValidierungsFehler("Kein Fehlbetrag vorhanden — für eine Forderung muss der Bankbetrag niedriger als die Rechnung sein.");
  // Schutz vor einer versehentlichen Forderung für einen legitimen Skonto-Abzug: der Bankbetrag
  // entspricht in diesem Fall absichtlich dem Skonto-reduzierten Betrag, keiner echten
  // Unterzahlung. Die UI blendet den Forderung-Button bei erkanntem Skonto zwar bereits aus,
  // dies greift zusätzlich bei direkten API-Aufrufen.
  if (istSkontoBetrag(zielBrutto + diff, zielBrutto, skontoProzent)) {
    throw new DifferenzValidierungsFehler(
      `Diese Abweichung entspricht dem hinterlegten Skonto (${skontoProzent}%) — keine Forderung nötig. Einfach ohne Differenzbuchung übernehmen, "Skonto genutzt" wird automatisch erfasst.`
    );
  }
  const betrag = Math.abs(diff);
  await tx.kundeForderung.create({
    data: {
      kundeId,
      betrag,
      grund: `Unterzahlung Bankabgleich: Kontoumsatz vom ${datumStr}, Rechnung ${zielBezeichnung} nur teilweise beglichen (${betrag.toFixed(2)} € fehlen).`,
      quelleLieferungId: zielTyp === "lieferung" ? zielId : null,
    },
  });
}
