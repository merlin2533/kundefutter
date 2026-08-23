import { prisma } from "@/lib/prisma";

export interface LieferantVorschlag {
  lieferantId: number;
  name: string;
  einkaufspreis: number;
  mindestbestellmenge: number;
  lieferzeitTage: number;
}

/**
 * Schlägt für einen Artikel den zu bestellenden Lieferanten vor: zuerst der als "bevorzugt"
 * markierte (ArtikelLieferant.bevorzugt), sonst der günstigste mit hinterlegtem Einkaufspreis,
 * sonst irgendein zugeordneter Lieferant. Rein datenbasiert (keine KI nötig) — dieselbe Quelle,
 * aus der auch der Bestellvorschlag in /api/prognose seinen "bevorzugterLieferant" zieht, nur mit
 * Fallback statt null, damit beim schnellen Erfassen in der Bestellliste immer ein Vorschlag da
 * ist (frei überschreibbar).
 */
export async function vorschlagLieferantFuerArtikel(artikelId: number): Promise<LieferantVorschlag | null> {
  const zuordnungen = await prisma.artikelLieferant.findMany({
    where: { artikelId },
    include: { lieferant: { select: { id: true, name: true, aktiv: true } } },
  });
  const aktive = zuordnungen.filter((z) => z.lieferant.aktiv);
  if (aktive.length === 0) return null;

  const bevorzugt = aktive.find((z) => z.bevorzugt);
  const guenstigste = [...aktive.filter((z) => z.einkaufspreis > 0)].sort((a, b) => a.einkaufspreis - b.einkaufspreis)[0];
  const gewaehlt = bevorzugt ?? guenstigste ?? aktive[0];

  return {
    lieferantId: gewaehlt.lieferantId,
    name: gewaehlt.lieferant.name,
    einkaufspreis: gewaehlt.einkaufspreis,
    mindestbestellmenge: gewaehlt.mindestbestellmenge,
    lieferzeitTage: gewaehlt.lieferzeitTage,
  };
}
