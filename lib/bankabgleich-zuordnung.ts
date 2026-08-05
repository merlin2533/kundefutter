// Zentrale Logik zum Setzen/Zurücknehmen des "bezahlt"-Zustands beim Bankabgleich.
// Bewusst von der reinen Zuordnung (FK setzen) getrennt: "als bezahlt markieren" ist ein
// eigener, im UI sichtbarer Schritt (Checkbox), kein stiller Nebeneffekt des Zuordnens.
//
// EingangsRechnung weicht von den anderen drei Zieltypen ab: statt `bezahltAm` gibt es
// `zahlungsDatum` + `status` (OFFEN/BEZAHLT/STORNIERT).

import { prisma } from "@/lib/prisma";

export type ZielTyp = "lieferung" | "sammelrechnung" | "ausgabe" | "eingangsrechnung";
type Client = Parameters<Parameters<typeof prisma.$transaction>[0]>[0] | typeof prisma;

export const ZIEL_FELD: Record<ZielTyp, "lieferungId" | "sammelrechnungId" | "ausgabeId" | "eingangsRechnungId"> = {
  lieferung: "lieferungId",
  sammelrechnung: "sammelrechnungId",
  ausgabe: "ausgabeId",
  eingangsrechnung: "eingangsRechnungId",
};

/** Markiert das Zielobjekt als bezahlt (nur falls es noch nicht bezahlt/storniert ist).
 * Optionaler `client` erlaubt den Aufruf innerhalb einer bestehenden `$transaction` (z.B.
 * wenn beim Zuordnen zusätzlich eine Gutschrift/Forderung erfasst wird — beides muss
 * atomar zusammen gelten). */
export async function markiereAlsBezahlt(zielTyp: ZielTyp, zielId: number, datum: Date, client: Client = prisma): Promise<void> {
  switch (zielTyp) {
    case "lieferung":
      await client.lieferung.updateMany({ where: { id: zielId, bezahltAm: null }, data: { bezahltAm: datum } });
      break;
    case "sammelrechnung":
      await client.sammelrechnung.updateMany({ where: { id: zielId, bezahltAm: null }, data: { bezahltAm: datum } });
      break;
    case "ausgabe":
      await client.ausgabe.updateMany({ where: { id: zielId, bezahltAm: null }, data: { bezahltAm: datum } });
      break;
    case "eingangsrechnung":
      await client.eingangsRechnung.updateMany({
        where: { id: zielId, status: "OFFEN" },
        data: { zahlungsDatum: datum, status: "BEZAHLT" },
      });
      break;
  }
}

/**
 * Macht die Bezahlt-Markierung rückgängig — aber NUR, wenn das Zielobjekt exakt mit dem
 * Buchungsdatum dieses Umsatzes markiert wurde (sonst könnte ein zwischenzeitlich anders
 * gesetzter Bezahlt-Status fälschlich gelöscht werden).
 */
export async function macheBezahltRueckgaengig(zielTyp: ZielTyp, zielId: number, buchungsdatum: Date): Promise<void> {
  const t = buchungsdatum.getTime();
  switch (zielTyp) {
    case "lieferung": {
      const l = await prisma.lieferung.findUnique({ where: { id: zielId }, select: { bezahltAm: true } });
      if (l?.bezahltAm && l.bezahltAm.getTime() === t) {
        await prisma.lieferung.update({ where: { id: zielId }, data: { bezahltAm: null } });
      }
      break;
    }
    case "sammelrechnung": {
      const s = await prisma.sammelrechnung.findUnique({ where: { id: zielId }, select: { bezahltAm: true } });
      if (s?.bezahltAm && s.bezahltAm.getTime() === t) {
        await prisma.sammelrechnung.update({ where: { id: zielId }, data: { bezahltAm: null } });
      }
      break;
    }
    case "ausgabe": {
      const a = await prisma.ausgabe.findUnique({ where: { id: zielId }, select: { bezahltAm: true } });
      if (a?.bezahltAm && a.bezahltAm.getTime() === t) {
        await prisma.ausgabe.update({ where: { id: zielId }, data: { bezahltAm: null } });
      }
      break;
    }
    case "eingangsrechnung": {
      const r = await prisma.eingangsRechnung.findUnique({ where: { id: zielId }, select: { zahlungsDatum: true, status: true } });
      if (r?.status === "BEZAHLT" && r.zahlungsDatum && r.zahlungsDatum.getTime() === t) {
        await prisma.eingangsRechnung.update({ where: { id: zielId }, data: { zahlungsDatum: null, status: "OFFEN" } });
      }
      break;
    }
  }
}
