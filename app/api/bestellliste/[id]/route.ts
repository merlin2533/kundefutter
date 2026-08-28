import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";


type Params = { params: Promise<{ id: string }> };

// PATCH /api/bestellliste/[id] — Status ändern: bestellen | geliefert | stornieren | zurueck
export async function PATCH(req: NextRequest, ctx: Params) {
  const { id } = await ctx.params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  let body;
  try { body = await req.json(); } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const VALID_STATUS = ["offen", "bestellt", "geliefert", "storniert"];
  const { status, notiz, lieferantId } = body as { status?: string; notiz?: string; lieferantId?: unknown };

  if (status && !VALID_STATUS.includes(status)) {
    return NextResponse.json({ error: `Ungültiger Status: ${status}` }, { status: 400 });
  }

  try {
    const updateData: Record<string, unknown> = {};
    if (status) {
      updateData.status = status;
      if (status === "bestellt") updateData.bestelltAm = new Date();
      if (status === "geliefert") updateData.geliefertAm = new Date();
      if (status === "offen") { updateData.bestelltAm = null; updateData.geliefertAm = null; }
    }
    if (notiz !== undefined) updateData.notiz = notiz || null;

    // Umschlüsseln auf einen anderen Lieferanten, solange die Position noch nicht zu einer
    // formellen Bestellung gebündelt wurde (bestellungId gesetzt) — danach läuft das Umschlüsseln
    // über POST /api/bestellungen/[id]/umschluesseln, da die Position dann Teil einer bereits
    // versendeten/bestätigten Bestellung sein kann.
    if (lieferantId !== undefined) {
      const neueLieferantId = parseInt(String(lieferantId), 10);
      if (isNaN(neueLieferantId)) return NextResponse.json({ error: "Ungültige lieferantId" }, { status: 400 });
      const bestehend = await prisma.bestellposition.findUnique({ where: { id: numId }, select: { bestellungId: true, artikelId: true } });
      if (!bestehend) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
      if (bestehend.bestellungId) {
        return NextResponse.json(
          { error: "Position ist bereits Teil einer Bestellung — dort über 'Umschlüsseln' verschieben." },
          { status: 409 }
        );
      }
      updateData.lieferantId = neueLieferantId;
      const zuordnung = await prisma.artikelLieferant.findUnique({
        where: { artikelId_lieferantId: { artikelId: bestehend.artikelId, lieferantId: neueLieferantId } },
        select: { einkaufspreis: true },
      });
      // Nur überschreiben, wenn beim neuen Lieferanten tatsächlich ein Preis gepflegt ist — sonst
      // hätte das Umschlüsseln auf einen Lieferanten ohne EK einen zuvor korrekt angezeigten Preis
      // stillschweigend auf 0,00 € zurückgesetzt.
      if (zuordnung && zuordnung.einkaufspreis > 0) updateData.einkaufspreis = zuordnung.einkaufspreis;
    }

    const pos = await prisma.bestellposition.update({
      where: { id: numId },
      data: updateData,
      include: {
        lieferant: { select: { id: true, name: true, email: true, telefon: true, frachtkosten: true, mindestbestellwert: true } },
        artikel: { select: { id: true, name: true } },
        kunde: { select: { id: true, name: true, firma: true } },
      },
    });
    return NextResponse.json(pos);
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

// DELETE /api/bestellliste/[id]
export async function DELETE(_req: NextRequest, ctx: Params) {
  const { id } = await ctx.params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    await prisma.bestellposition.delete({ where: { id: numId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }
}
