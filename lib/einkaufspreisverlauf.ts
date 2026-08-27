// Datumsgenaue Einkaufspreis-Historie je Lieferant (ArtikelLieferantPreis) — Preise ändern sich
// häufig innerhalb der Saison, nicht nur zwischen Jahren. Im Unterschied zu
// ArtikelLieferantJahrespreis (lib/jahrespreis.ts, grobe Jahresgültigkeit mit automatischer
// Nächstjahr-Interpolation) gibt es hier keine automatische Auflösung: der Nutzer markiert per
// "aktiv"-Häkchen explizit EINEN Eintrag als aktuell gültig. Aktivieren synct sofort
// ArtikelLieferant.einkaufspreis — die einzige Stelle, die der Rest der App (Lieferungen,
// Kalkulation, Artikelliste, Bestellvorschlag …) tatsächlich liest.

import { prisma } from "@/lib/prisma";

// Deaktiviert alle anderen Einträge desselben Lieferanten und setzt den gewählten auf aktiv,
// synct danach ArtikelLieferant.einkaufspreis auf dessen Preis — alles in einer Transaktion.
export async function setAktiverEinkaufspreis(artikelLieferantId: number, preisId: number): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const eintrag = await tx.artikelLieferantPreis.findFirst({ where: { id: preisId, artikelLieferantId } });
    if (!eintrag) return;
    await tx.artikelLieferantPreis.updateMany({
      where: { artikelLieferantId, NOT: { id: preisId } },
      data: { aktiv: false },
    });
    await tx.artikelLieferantPreis.update({ where: { id: preisId }, data: { aktiv: true } });
    await tx.artikelLieferant.update({ where: { id: artikelLieferantId }, data: { einkaufspreis: eintrag.einkaufspreis } });
  });
}

// Prüft, ob für diesen Lieferanten aktuell ein Preisverlauf-Eintrag als aktiv markiert ist —
// genutzt von syncEinkaufspreis() (lib/jahrespreis.ts), damit ein Löschen/Ändern eines
// Jahrespreises einen bewusst gewählten Preisverlauf-Preis nicht überschreibt.
export async function hatAktivenEinkaufspreis(artikelLieferantId: number): Promise<boolean> {
  const eintrag = await prisma.artikelLieferantPreis.findFirst({ where: { artikelLieferantId, aktiv: true }, select: { id: true } });
  return eintrag !== null;
}
