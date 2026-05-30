import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { liefposArtikelSelect } from "@/lib/artikel-select";
export const dynamic = "force-dynamic";


export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lieferantId = searchParams.get("lieferantId");

  try {
    const wareneingaenge = await prisma.wareneingang.findMany({
      where: lieferantId ? { lieferantId: Number(lieferantId) } : undefined,
      include: {
        lieferant: true,
        positionen: {
          include: {
            artikel: { select: liefposArtikelSelect },
            bestellposition: { select: { id: true, menge: true, einheit: true, notiz: true } },
          },
        },
      },
      orderBy: { datum: "desc" },
      take: 100,
    });
    return NextResponse.json(wareneingaenge);
  } catch {
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const { lieferantId, datum, notiz } = body;

  if (!body.lieferantId || !Array.isArray(body.positionen) || body.positionen.length === 0) {
    return NextResponse.json({ error: "lieferantId und positionen erforderlich" }, { status: 400 });
  }

  const positionen = (body.positionen as {
    artikelId: unknown;
    menge: unknown;
    einkaufspreis: unknown;
    chargeNr?: unknown;
    bestellpositionId?: unknown;
  }[]).map((p) => ({
    artikelId: Number(p.artikelId),
    menge: Number(p.menge),
    einkaufspreis: Number(p.einkaufspreis ?? 0),
    chargeNr: typeof p.chargeNr === "string" && p.chargeNr.trim() ? p.chargeNr.trim() : null,
    bestellpositionId: p.bestellpositionId ? parseInt(String(p.bestellpositionId), 10) : null,
  })).filter((p) => Number.isInteger(p.artikelId) && p.artikelId > 0 && Number.isFinite(p.menge) && p.menge > 0);

  if (positionen.length === 0) {
    return NextResponse.json({ error: "Keine gültigen Positionen" }, { status: 400 });
  }

  try {
    const wareneingang = await prisma.$transaction(async (tx) => {
      const we = await tx.wareneingang.create({
        data: {
          lieferantId,
          datum: datum ? new Date(datum) : new Date(),
          notiz,
          positionen: {
            create: positionen.map((p) => ({
              artikelId: p.artikelId,
              menge: p.menge,
              einkaufspreis: p.einkaufspreis,
              chargeNr: p.chargeNr,
              bestellpositionId: p.bestellpositionId,
            })),
          },
        },
        include: {
          positionen: {
            include: {
              artikel: { select: liefposArtikelSelect },
              bestellposition: { select: { id: true } },
            },
          },
        },
      });

      const artikelIds = [...new Set(we.positionen.map((p) => p.artikelId))];
      const artikelList = await tx.artikel.findMany({ where: { id: { in: artikelIds } } });
      const artikelMap = new Map(artikelList.map((a) => [a.id, a]));

      const artLiefList = await tx.artikelLieferant.findMany({
        where: { artikelId: { in: artikelIds }, lieferantId },
      });
      const artLiefMap = new Map(artLiefList.map((al) => [al.artikelId, al]));

      for (const pos of we.positionen) {
        const artikel = artikelMap.get(pos.artikelId);
        if (!artikel) continue;
        const neuerBestand = artikel.aktuellerBestand + pos.menge;
        artikel.aktuellerBestand = neuerBestand;
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
            wareneingangId: we.id,
            chargeNr: pos.chargeNr,
            notiz: pos.chargeNr
              ? `Wareneingang #${we.id} · Charge ${pos.chargeNr}`
              : `Wareneingang #${we.id}`,
          },
        });

        // Bestellposition: Teillieferung oder vollständig geliefert
        const bestellpositionId = positionen.find((p) => p.artikelId === pos.artikelId)?.bestellpositionId;
        if (bestellpositionId && !isNaN(bestellpositionId)) {
          const bp = await tx.bestellposition.findUnique({ where: { id: bestellpositionId }, select: { menge: true, mengeGeliefert: true } });
          if (bp) {
            const neueMengeGeliefert = bp.mengeGeliefert + pos.menge;
            const vollstaendig = neueMengeGeliefert >= bp.menge;
            await tx.bestellposition.update({
              where: { id: bestellpositionId },
              data: {
                mengeGeliefert: neueMengeGeliefert,
                status: vollstaendig ? "geliefert" : "teilgeliefert",
                geliefertAm: vollstaendig ? new Date() : undefined,
              },
            });
          }
        }

        const artLief = artLiefMap.get(pos.artikelId);
        if (artLief && artLief.einkaufspreis !== pos.einkaufspreis) {
          await tx.artikelPreisHistorie.create({
            data: {
              artikelId: pos.artikelId,
              alterPreis: artLief.einkaufspreis,
              neuerPreis: pos.einkaufspreis,
              notiz: `Wareneingang #${we.id} — Einkaufspreis aktualisiert`,
            },
          });
        }
        await tx.artikelLieferant.updateMany({
          where: { artikelId: pos.artikelId, lieferantId },
          data: { einkaufspreis: pos.einkaufspreis },
        });
      }

      return we;
    });

    return NextResponse.json(wareneingang, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Fehler beim Speichern des Wareneingangs" }, { status: 500 });
  }
}
