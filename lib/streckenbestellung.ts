import type { Tx } from "@/lib/lieferung";

/**
 * Hält `Bestellposition`/`BestellungPosition` einer bereits erzeugten Streckengeschäft-Bestellung
 * (siehe `POST /api/lieferungen/[id]/streckenbestellung`) mit der Lieferposition synchron, wenn
 * deren Menge NACHTRÄGLICH korrigiert wird (`PATCH /api/lieferungen/[id]/positionen/[posId]`) —
 * ohne diesen Abgleich bliebe die beim Lieferanten einzureichende Bestellmenge auf dem alten,
 * ggf. fehlerhaften Stand stehen, obwohl der Kundenauftrag bereits korrigiert wurde.
 *
 * Bewusst NUR solange die Bestellung noch nicht versendet wurde (`Bestellung.versendetAm` null)
 * UND noch nichts davon geliefert ist — ist sie bereits beim Lieferanten oder hat sich etwas
 * daran schon real bewegt, darf sich ihr Inhalt nicht mehr stillschweigend ändern (analog zur
 * `rechnungVersendetAm`-Sperre bei Rechnungen); eine nötige Korrektur muss der Nutzer dann bewusst
 * mit dem Lieferanten klären, wie bisher. Kein Fehler, wenn keine Streckenbestellung existiert
 * (Normalfall) — reiner No-op.
 */
export async function syncStreckenbestellungMenge(
  tx: Tx,
  lieferungId: number,
  artikelId: number,
  neueMenge: number
): Promise<void> {
  const bestellposition = await tx.bestellposition.findFirst({
    where: { lieferungId, artikelId, bestellungId: { not: null } },
    select: { id: true, bestellungId: true, status: true, mengeGeliefert: true },
  });
  if (!bestellposition || !bestellposition.bestellungId) return;
  if (bestellposition.status !== "bestellt" || bestellposition.mengeGeliefert > 0) return;

  const bestellung = await tx.bestellung.findUnique({
    where: { id: bestellposition.bestellungId },
    select: { versendetAm: true },
  });
  if (!bestellung || bestellung.versendetAm) return;

  await tx.bestellposition.update({ where: { id: bestellposition.id }, data: { menge: neueMenge } });
  await tx.bestellungPosition.updateMany({
    where: { bestellungId: bestellposition.bestellungId, artikelId },
    data: { menge: neueMenge },
  });
}
