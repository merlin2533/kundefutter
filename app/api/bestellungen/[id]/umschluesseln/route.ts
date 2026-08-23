import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/bestellungen/[id]/umschluesseln — eine einzelne Position auf einen anderen
 * Lieferanten verlegen (z.B. weil der ursprüngliche Lieferant meldet, dass ein Artikel nicht
 * verfügbar ist). Legt dafür immer eine NEUE Bestellung beim Ziel-Lieferanten an (statt eine
 * evtl. schon offene zusammenzuführen — vermeidet mehrdeutiges "welche der mehreren offenen
 * Bestellungen?") und entfernt die Position aus der ursprünglichen Bestellung. Ein per
 * bestellungId verknüpfter Bestellliste-Eintrag (siehe /bestellliste) wird auf den neuen
 * Lieferanten/die neue Bestellung nachgezogen, damit die Herkunft nachvollziehbar bleibt.
 * Body: { positionId: number, lieferantId: number }
 */
export async function POST(req: NextRequest, ctx: Params) {
  const { id } = await ctx.params;
  const nId = parseInt(id, 10);
  if (isNaN(nId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  let body: { positionId?: unknown; lieferantId?: unknown };
  try {
    body = await req.json();
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const positionId = parseInt(String(body.positionId), 10);
  const neueLieferantId = parseInt(String(body.lieferantId), 10);
  if (isNaN(positionId)) return NextResponse.json({ error: "Ungültige positionId" }, { status: 400 });
  if (isNaN(neueLieferantId)) return NextResponse.json({ error: "Ungültige lieferantId" }, { status: 400 });

  try {
    const position = await prisma.bestellungPosition.findUnique({
      where: { id: positionId },
      include: { bestellung: { select: { id: true, lieferantId: true, status: true } } },
    });
    if (!position || position.bestellung.id !== nId) {
      return NextResponse.json({ error: "Position nicht in dieser Bestellung gefunden" }, { status: 404 });
    }
    if (position.bestellung.lieferantId === neueLieferantId) {
      return NextResponse.json({ error: "Position ist bereits bei diesem Lieferanten" }, { status: 400 });
    }

    const ergebnis = await prisma.$transaction(async (tx) => {
      const zuordnung = await tx.artikelLieferant.findUnique({
        where: { artikelId_lieferantId: { artikelId: position.artikelId, lieferantId: neueLieferantId } },
        select: { einkaufspreis: true },
      });

      const jahr = new Date().getFullYear();
      const key = "letzte_bestellungsnummer";
      const existing = await tx.einstellung.findUnique({ where: { key } });
      const nr = (existing ? parseInt(existing.value, 10) : 0) + 1;
      await tx.einstellung.upsert({ where: { key }, update: { value: String(nr) }, create: { key, value: String(nr) } });
      const nummer = `BES-${jahr}-${String(nr).padStart(4, "0")}`;

      const neueBestellung = await tx.bestellung.create({
        data: {
          nummer,
          lieferantId: neueLieferantId,
          notiz: `Umgeschlüsselt aus Bestellung ${nId} (Artikel nicht verfügbar o.ä.)`,
          positionen: {
            create: {
              artikelId: position.artikelId,
              menge: position.menge,
              einheit: position.einheit,
              preis: zuordnung?.einkaufspreis ?? position.preis,
            },
          },
        },
        include: {
          lieferant: { select: { id: true, name: true } },
          positionen: { include: { artikel: { select: { id: true, name: true, artikelnummer: true, einheit: true } } } },
        },
      });

      await tx.bestellungPosition.delete({ where: { id: positionId } });

      // Verknüpften Bestellliste-Eintrag (falls vorhanden) mit umschlüsseln, damit
      // /bestellliste weiterhin den korrekten (neuen) Lieferanten zeigt.
      await tx.bestellposition.updateMany({
        where: { bestellungId: nId, artikelId: position.artikelId },
        data: { lieferantId: neueLieferantId, bestellungId: neueBestellung.id, einkaufspreis: zuordnung?.einkaufspreis ?? undefined },
      });

      return neueBestellung;
    });

    return NextResponse.json({ ok: true, neueBestellung: ergebnis }, { status: 201 });
  } catch (err) {
    Sentry.captureException(err);
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Umschlüsseln fehlgeschlagen";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
