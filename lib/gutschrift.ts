// Gemeinsame Gutschrift-Logik, die von mehreren Stellen aus aufgerufen wird
// (app/api/gutschriften/[id]/route.ts DELETE sowie der Bankabgleich-Doppelzahlungs-Flow) —
// zentral an einer Stelle, damit beide Aufrufer exakt dieselben Nebenwirkungen auslösen.

import { naechsteGutschriftsnummer } from "@/lib/utils";
import { ladeOderErstelleAusgleichsArtikel, GUTSCHRIFT_VERRECHNUNG_ARTIKELNUMMER, type Tx } from "@/lib/lieferung";

export type DoppelzahlungModus = "erstatten" | "verrechnen";
export type DoppelzahlungZielTyp = "lieferung" | "sammelrechnung";

/**
 * Legt eine Gutschrift für eine im Bankabgleich erkannte Doppelzahlung an (Kunde hat dieselbe,
 * bereits bezahlte Rechnung ein zweites Mal überwiesen — die Rechnung selbst taucht dadurch als
 * Zuordnungskandidat nicht mehr auf). `zielId` ist rein informativ (Notiztext + optionaler
 * `lieferungId`-Verweis; Gutschrift kennt keine `sammelrechnungId`).
 *
 * modus "erstatten": Status ERSTATTET — wird NICHT von injiziereOffeneGutschriften() erfasst
 * (die filtert nur status "OFFEN"), fließt also nicht versehentlich zusätzlich in die nächste
 * Rechnung ein, wenn der Betrag bereits per Überweisung zurückgezahlt wurde.
 * modus "verrechnen": Status OFFEN — wird wie eine normale Überzahlungs-Gutschrift automatisch
 * in die nächste Rechnung des Kunden eingerechnet.
 */
export async function erstelleDoppelzahlungsGutschrift(
  tx: Tx,
  opts: {
    kundeId: number;
    zielTyp: DoppelzahlungZielTyp;
    zielId: number;
    zielBezeichnung: string;
    betrag: number;
    bankDatum: Date;
    modus: DoppelzahlungModus;
  }
): Promise<{ id: number; nummer: string }> {
  const { kundeId, zielTyp, zielId, zielBezeichnung, betrag, bankDatum, modus } = opts;
  if (betrag <= 0) throw new Error("Betrag muss größer als 0 sein");
  const datumStr = bankDatum.toLocaleDateString("de-DE");

  const artikel = await ladeOderErstelleAusgleichsArtikel(tx, GUTSCHRIFT_VERRECHNUNG_ARTIKELNUMMER, "Gutschrift-Verrechnung");
  const einstellung = await tx.einstellung.findUnique({ where: { key: "system.letzteGutschriftNr" } });
  const nummer = naechsteGutschriftsnummer(einstellung?.value ?? null);
  await tx.einstellung.upsert({
    where: { key: "system.letzteGutschriftNr" },
    update: { value: nummer },
    create: { key: "system.letzteGutschriftNr", value: nummer },
  });

  const notiz = modus === "erstatten"
    ? `Doppelzahlung Bankabgleich: Kontoumsatz vom ${datumStr} — Rechnung ${zielBezeichnung} war bereits beglichen. Wird per Überweisung an den Kunden zurückerstattet (nicht mit der nächsten Rechnung verrechnet).`
    : `Doppelzahlung Bankabgleich: Kontoumsatz vom ${datumStr} — Rechnung ${zielBezeichnung} war bereits beglichen. Wird automatisch in die nächste Rechnung eingerechnet.`;

  const gs = await tx.gutschrift.create({
    data: {
      nummer,
      kundeId,
      lieferungId: zielTyp === "lieferung" ? zielId : null,
      grund: "Doppelzahlung",
      status: modus === "erstatten" ? "ERSTATTET" : "OFFEN",
      notiz,
      positionen: { create: [{ artikelId: artikel.id, menge: 1, preis: betrag }] },
    },
  });
  return { id: gs.id, nummer: gs.nummer };
}

/**
 * Löscht eine Gutschrift unabhängig vom Status (OFFEN/VERBUCHT/STORNIERT/ERSTATTET) und macht
 * dabei alle Nebenwirkungen rückgängig — extrahiert aus DELETE /api/gutschriften/[id], damit der
 * Bankabgleich-Doppelzahlungs-Flow (Zuordnung aufheben) exakt dieselbe Logik nutzen kann:
 *   • VERBUCHT: entfernt die in injiziereOffeneGutschriften() angelegte negative
 *     Ausgleichsposition aus der Ziel-Lieferung.
 *   • Rücknahme-Positionen: bucht den bei Erstellung gutgeschriebenen Lagerzugang zurück.
 *   • Ein per Doppelzahlung verknüpfter Kontoumsatz (Kontoumsatz.gutschriftId) wird wieder als
 *     offen markiert, statt mit einem toten Verweis auf eine gelöschte Gutschrift stehen zu bleiben.
 * Gibt false zurück, wenn keine Gutschrift mit dieser ID existiert (kein Fehler — idempotent).
 */
export async function loescheGutschriftMitNebenwirkungen(tx: Tx, gutschriftId: number): Promise<boolean> {
  const existing = await tx.gutschrift.findUnique({
    where: { id: gutschriftId },
    include: { positionen: true },
  });
  if (!existing) return false;

  if (existing.verbuchtBeiLieferungId) {
    await tx.lieferposition.deleteMany({
      where: {
        lieferungId: existing.verbuchtBeiLieferungId,
        notiz: { startsWith: `Gutschrift ${existing.nummer}` },
      },
    });
  }

  const ruecknahmePos = existing.positionen.filter((p) => p.ruecknahme);
  if (ruecknahmePos.length > 0) {
    const artikelIds = [...new Set(ruecknahmePos.map((p) => p.artikelId))];
    const artikelList = await tx.artikel.findMany({ where: { id: { in: artikelIds } } });
    const artikelMap = new Map(artikelList.map((a) => [a.id, a]));
    for (const pos of ruecknahmePos) {
      const artikel = artikelMap.get(pos.artikelId);
      if (!artikel) continue;
      const neuerBestand = artikel.aktuellerBestand - pos.menge;
      artikel.aktuellerBestand = neuerBestand;
      await tx.artikel.update({
        where: { id: pos.artikelId },
        data: { aktuellerBestand: neuerBestand },
      });
      await tx.lagerbewegung.create({
        data: {
          artikelId: pos.artikelId,
          typ: "ausgang",
          menge: -pos.menge,
          bestandNach: neuerBestand,
          notiz: `Gutschrift ${existing.nummer} gelöscht – Retoure rückgängig gemacht`,
        },
      });
    }
  }

  await tx.kontoumsatz.updateMany({
    where: { gutschriftId },
    data: { gutschriftId: null, zugeordnet: false, zuordnungsArt: null },
  });

  // GutschriftPosition hat onDelete: Cascade — wird automatisch mitgelöscht.
  await tx.gutschrift.delete({ where: { id: gutschriftId } });
  return true;
}
