import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { naechsteRechnungsnummer } from "@/lib/utils";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const lieferung = await prisma.lieferung.findUnique({
    where: { id: Number(id) },
    include: {
      kunde: { include: { kontakte: true } },
      positionen: { include: { artikel: true } },
    },
  });
  if (!lieferung) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  return NextResponse.json(lieferung);
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const { positionen, ...data } = body;

  try {
  const result = await prisma.$transaction(async (tx) => {
    const alt = await tx.lieferung.findUnique({
      where: { id: Number(id) },
      include: { positionen: true },
    });
    if (!alt) throw new Error("Nicht gefunden");

    // Status: geplant → geliefert: Bestand reduzieren
    if (alt.status === "geplant" && data.status === "geliefert") {
      for (const pos of alt.positionen) {
        const artikel = await tx.artikel.findUnique({ where: { id: pos.artikelId } });
        if (!artikel) continue;
        const neuerBestand = artikel.aktuellerBestand - pos.menge;
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
            lieferungId: Number(id),
          },
        });
      }
    }

    // Status: geliefert → storniert: Bestand zurückbuchen
    if (alt.status === "geliefert" && data.status === "storniert") {
      if (!data.stornoBegründung) {
        throw new Error("Stornobegründung ist Pflichtfeld");
      }
      for (const pos of alt.positionen) {
        const artikel = await tx.artikel.findUnique({ where: { id: pos.artikelId } });
        if (!artikel) continue;
        const neuerBestand = artikel.aktuellerBestand + pos.menge;
        await tx.artikel.update({
          where: { id: pos.artikelId },
          data: { aktuellerBestand: neuerBestand },
        });
        await tx.lagerbewegung.create({
          data: {
            artikelId: pos.artikelId,
            typ: "eingang",
            menge: pos.menge,
            bestandNach: neuerBestand,
            lieferungId: Number(id),
            notiz: `Storno: ${data.stornoBegründung}`,
          },
        });
      }
    }

    // Nur erlaubte Felder übergeben (inkl. bezahltAm, zahlungsziel)
    const { bezahltAm, zahlungsziel, ...restData } = data;
    const updateData: Record<string, unknown> = { ...restData };
    if (bezahltAm !== undefined) updateData.bezahltAm = bezahltAm ? new Date(bezahltAm) : null;
    if (zahlungsziel !== undefined) updateData.zahlungsziel = zahlungsziel;

    return tx.lieferung.update({
      where: { id: Number(id) },
      data: updateData,
      include: {
        kunde: true,
        positionen: { include: { artikel: true } },
      },
    });
  });

  return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// Rechnung erstellen
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { aktion } = await req.json();

  if (aktion === "rechnung_erstellen") {
    const lieferung = await prisma.$transaction(async (tx) => {
      const einstellung = await tx.einstellung.findUnique({ where: { key: "letzte_rechnungsnummer" } });
      const rechnungNr = naechsteRechnungsnummer(einstellung?.value ?? null);

      await tx.einstellung.upsert({
        where: { key: "letzte_rechnungsnummer" },
        update: { value: rechnungNr },
        create: { key: "letzte_rechnungsnummer", value: rechnungNr },
      });

      return tx.lieferung.update({
        where: { id: Number(id) },
        data: { rechnungNr, rechnungDatum: new Date() },
        include: {
          kunde: { include: { kontakte: true } },
          positionen: { include: { artikel: true } },
        },
      });
    });
    return NextResponse.json(lieferung);
  }

  return NextResponse.json({ error: "Unbekannte Aktion" }, { status: 400 });
}
