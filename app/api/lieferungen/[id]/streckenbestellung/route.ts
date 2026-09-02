import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { naechsteBestellungsnummer } from "@/lib/utils";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// POST /api/lieferungen/[id]/streckenbestellung — erzeugt aus einer als Streckengeschäft markierten
// Lieferung (Kundenauftrag) in einem Schritt eine formelle Bestellung beim hinterlegten
// Direktlieferanten: für jede Lieferposition eine Bestellliste-Position (Rückverfolgbarkeit:
// kundeId/lieferungId gesetzt) UND direkt gebündelt zu einer neuen Bestellung — der Nutzer landet
// danach direkt auf /bestellungen/[id] und kann von dort per E-Mail/PDF an den Lieferanten senden
// (bestellungEmail()/generiereBestellungPdf() zeigen dabei zusätzlich einen "Versand direkt an
// Endkunde"-Block, siehe lib/email-templates.ts/lib/pdfGenerator.ts).
export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const lieferungId = Number(id);
  if (isNaN(lieferungId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const lieferung = await prisma.lieferung.findUnique({
      where: { id: lieferungId },
      include: { positionen: { include: { artikel: { select: { id: true, einheit: true } } } } },
    });
    if (!lieferung) return NextResponse.json({ error: "Lieferung nicht gefunden" }, { status: 404 });
    if (!lieferung.istStreckengeschaeft || !lieferung.streckenLieferantId) {
      return NextResponse.json({ error: "Lieferung ist kein Streckengeschäft mit hinterlegtem Lieferanten" }, { status: 400 });
    }
    if (lieferung.positionen.length === 0) {
      return NextResponse.json({ error: "Lieferung hat keine Positionen" }, { status: 400 });
    }

    // Schutz vor Doppel-Bestellung bei mehrfachem Klick: existiert für diese Lieferung bereits
    // eine (nicht stornierte) Bestellliste-Position mit Bestellungs-Verknüpfung, verweisen wir
    // auf diese statt eine zweite anzulegen.
    const bestehende = await prisma.bestellposition.findFirst({
      where: { lieferungId, bestellungId: { not: null } },
      select: { bestellung: { select: { id: true, nummer: true } } },
    });
    if (bestehende?.bestellung) {
      return NextResponse.json(
        { error: `Für diese Lieferung wurde bereits eine Bestellung angelegt: ${bestehende.bestellung.nummer}`, bestellungId: bestehende.bestellung.id },
        { status: 409 }
      );
    }

    const streckenLieferantId = lieferung.streckenLieferantId;
    const artikelIds = lieferung.positionen.map((p) => p.artikelId);
    const ekZuordnungen = await prisma.artikelLieferant.findMany({
      where: { artikelId: { in: artikelIds }, lieferantId: streckenLieferantId },
      select: { artikelId: true, einkaufspreis: true },
    });
    const ekMap = new Map(ekZuordnungen.map((z) => [z.artikelId, z.einkaufspreis]));

    const bestellung = await prisma.$transaction(async (tx) => {
      const bestellpositionen = [];
      for (const pos of lieferung.positionen) {
        const einkaufspreis = ekMap.get(pos.artikelId) ?? 0;
        bestellpositionen.push(
          await tx.bestellposition.create({
            data: {
              artikelId: pos.artikelId,
              lieferantId: streckenLieferantId,
              kundeId: lieferung.kundeId,
              lieferungId: lieferung.id,
              menge: pos.menge,
              einheit: pos.artikel.einheit,
              einkaufspreis,
              status: "offen",
            },
          })
        );
      }

      const key = "letzte_bestellungsnummer";
      const existingNr = await tx.einstellung.findUnique({ where: { key } });
      const nummer = naechsteBestellungsnummer(existingNr?.value ?? null);
      await tx.einstellung.upsert({
        where: { key },
        update: { value: nummer },
        create: { key, value: nummer },
      });

      const neueBestellung = await tx.bestellung.create({
        data: {
          nummer,
          lieferantId: streckenLieferantId,
          positionen: {
            create: bestellpositionen.map((p) => ({
              artikelId: p.artikelId,
              menge: p.menge,
              preis: p.einkaufspreis > 0 ? p.einkaufspreis : null,
              einheit: p.einheit,
            })),
          },
        },
      });

      await tx.bestellposition.updateMany({
        where: { id: { in: bestellpositionen.map((p) => p.id) } },
        data: { status: "bestellt", bestelltAm: new Date(), bestellungId: neueBestellung.id },
      });

      return neueBestellung;
    });

    return NextResponse.json({ ok: true, bestellungId: bestellung.id, nummer: bestellung.nummer }, { status: 201 });
  } catch (err) {
    Sentry.captureException(err);
    console.error("Streckenbestellung POST error:", err);
    const isDev = process.env.NODE_ENV === "development";
    const message = isDev && err instanceof Error ? err.message : "Bestellung konnte nicht angelegt werden";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
