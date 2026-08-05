// Erfasst beim Bankabgleich eine Betragsdifferenz zwischen Kontoumsatz und zugeordneter
// Rechnung (Lieferung/Sammelrechnung) als Gutschrift (Überzahlung) oder KundeForderung
// (Unterzahlung/Fehlbetrag). Beide fließen automatisch in die nächste Rechnung dieses
// Kunden ein — siehe injiziereAlteForderungen()/injiziereOffeneGutschriften() in
// lib/lieferung.ts.

import { naechsteGutschriftsnummer } from "@/lib/utils";
import { ladeOderErstelleAusgleichsArtikel, GUTSCHRIFT_VERRECHNUNG_ARTIKELNUMMER, type Tx } from "@/lib/lieferung";
import { berechneLieferungBrutto, berechneSammelrechnungBrutto } from "@/lib/lieferung-brutto";

export type BankabgleichZielTyp = "lieferung" | "sammelrechnung";
export type DifferenzArt = "gutschrift" | "forderung";

/** Signalisiert einen Eingabefehler (falsches Vorzeichen) statt eines echten Serverfehlers —
 * Aufrufer können damit gezielt 400 statt 500 zurückgeben. */
export class DifferenzValidierungsFehler extends Error {}

const ZIEL_ARTIKEL_SELECT = { artikel: { select: { mwstSatz: true } } } as const;

/** Lädt kundeId, Brutto-Betrag und eine Kurzbezeichnung des Zuordnungsziels (für Belegtexte). */
export async function ladeZielFuerDifferenz(
  tx: Tx,
  zielTyp: BankabgleichZielTyp,
  zielId: number
): Promise<{ kundeId: number; betrag: number; bezeichnung: string } | null> {
  if (zielTyp === "lieferung") {
    const l = await tx.lieferung.findUnique({
      where: { id: zielId },
      select: { kundeId: true, rechnungNr: true, positionen: { select: { menge: true, verkaufspreis: true, rabattProzent: true, ...ZIEL_ARTIKEL_SELECT } } },
    });
    if (!l) return null;
    return { kundeId: l.kundeId, betrag: berechneLieferungBrutto(l), bezeichnung: l.rechnungNr ?? `Lieferung ${zielId}` };
  }
  const s = await tx.sammelrechnung.findUnique({
    where: { id: zielId },
    select: {
      kundeId: true,
      rechnungNr: true,
      lieferungen: { select: { positionen: { select: { menge: true, verkaufspreis: true, rabattProzent: true, ...ZIEL_ARTIKEL_SELECT } } } },
    },
  });
  if (!s) return null;
  return { kundeId: s.kundeId, betrag: berechneSammelrechnungBrutto(s), bezeichnung: s.rechnungNr ?? `Sammelrechnung ${zielId}` };
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
    bankDatum: Date;
    art: DifferenzArt;
  }
): Promise<void> {
  const { zielTyp, zielId, kundeId, diff, zielBezeichnung, bankDatum, art } = opts;
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
