import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { bestellungEmail } from "@/lib/email-templates";
import { ladeFirmaDaten } from "@/lib/firma";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// POST /api/bestellungen/[id]/mail — Bestellung per E-Mail an den Lieferanten senden. Body:
// { empfaenger?: string; cc?: string }. Vorbereitet/bestätigt wird im Frontend (EmailVersandModal
// zeigt die vorgeschlagene Adresse — Lieferant.email — zur Kontrolle, bevor gesendet wird); hier
// wird der eigentliche Versand ausgeführt und als Nachweis versendetAm/versendetAn gesetzt.
export async function POST(req: NextRequest, ctx: Params) {
  const { id } = await ctx.params;
  const nId = parseInt(id, 10);
  if (isNaN(nId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  let body: { empfaenger?: unknown; cc?: unknown };
  try {
    body = await req.json();
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  try {
    const bestellung = await prisma.bestellung.findUnique({
      where: { id: nId },
      include: {
        lieferant: { select: { id: true, name: true, ansprechpartner: true, email: true } },
        positionen: { include: { artikel: { select: { name: true, artikelnummer: true } } } },
      },
    });
    if (!bestellung) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    if (bestellung.status === "STORNIERT") {
      return NextResponse.json({ error: "Stornierte Bestellung kann nicht versendet werden" }, { status: 400 });
    }

    const empfaenger =
      typeof body.empfaenger === "string" && body.empfaenger.trim()
        ? body.empfaenger.trim()
        : bestellung.lieferant.email ?? "";
    if (!empfaenger) {
      return NextResponse.json(
        { error: "Keine E-Mail-Adresse für diesen Lieferanten hinterlegt und keine Empfänger-Adresse angegeben." },
        { status: 422 }
      );
    }

    // lieferantenArtNr je Position separat nachladen (die Artikel-Include oben kann die Zuordnung
    // nicht direkt filtern, da lieferantId dynamisch pro Bestellung ist).
    const artikelIds = bestellung.positionen.map((p) => p.artikelId);
    const zuordnungen = await prisma.artikelLieferant.findMany({
      where: { artikelId: { in: artikelIds }, lieferantId: bestellung.lieferantId },
      select: { artikelId: true, lieferantenArtNr: true },
    });
    const lieferantenArtNrMap = new Map(zuordnungen.map((z) => [z.artikelId, z.lieferantenArtNr]));

    // Streckengeschäft: Kunden-Versandadresse nur einblenden, wenn sich ALLE Bestellliste-
    // Einträge dieser Bestellung eindeutig auf genau einen Kunden zurückführen lassen — bei einer
    // manuell aus mehreren Kunden gebündelten Bestellung bliebe sonst unklar, wessen Adresse gemeint
    // ist, und es dürfte keine angezeigt werden.
    const bestellliste = await prisma.bestellposition.findMany({
      where: { bestellungId: nId },
      select: { kundeId: true },
    });
    const eindeutigeKundenIds = [...new Set(bestellliste.map((b) => b.kundeId))];
    let versandKunde = null;
    if (bestellliste.length > 0 && eindeutigeKundenIds.length === 1 && eindeutigeKundenIds[0] != null) {
      const kunde = await prisma.kunde.findUnique({
        where: { id: eindeutigeKundenIds[0] },
        select: { name: true, firma: true, strasse: true, plz: true, ort: true },
      });
      if (kunde) versandKunde = kunde;
    }

    const firma = await ladeFirmaDaten();
    const { subject, text, html } = bestellungEmail({
      nummer: bestellung.nummer,
      datum: bestellung.datum,
      lieferdatum: bestellung.lieferdatum,
      lieferantAnrede: bestellung.lieferant.ansprechpartner,
      notiz: bestellung.notiz,
      positionen: bestellung.positionen.map((p) => ({
        artikelName: p.artikel?.name ?? "—",
        artikelnummer: p.artikel?.artikelnummer,
        lieferantenArtNr: lieferantenArtNrMap.get(p.artikelId) ?? null,
        menge: p.menge,
        einheit: p.einheit,
      })),
      versandKunde,
      firma,
    });

    const ccAdresse = typeof body.cc === "string" && body.cc.trim() ? body.cc.trim() : undefined;

    await sendEmail({
      to: empfaenger,
      cc: ccAdresse,
      subject,
      text,
      html,
      fromName: firma.name,
      feature: "bestellung",
      entityId: bestellung.id,
    });

    const updated = await prisma.bestellung.update({
      where: { id: nId },
      data: { versendetAm: new Date(), versendetAn: empfaenger },
      include: {
        lieferant: { select: { id: true, name: true } },
        positionen: { include: { artikel: { select: { id: true, name: true, artikelnummer: true, einheit: true } } } },
      },
    });

    return NextResponse.json({ ok: true, empfaenger, bestellung: updated });
  } catch (err) {
    Sentry.captureException(err);
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "E-Mail-Versand fehlgeschlagen";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
