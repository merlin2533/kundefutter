import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { naechsteGutschriftsnummer } from "@/lib/utils";
import { liefposArtikelSelect } from "@/lib/artikel-select";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const kundeId = searchParams.get("kundeId");
  const status = searchParams.get("status");
  const von = searchParams.get("von");
  const bis = searchParams.get("bis");

  const where: Record<string, unknown> = {};
  if (kundeId) where.kundeId = Number(kundeId);
  if (status) where.status = status;
  if (von || bis) {
    where.datum = {
      ...(von && { gte: new Date(von) }),
      ...(bis && { lte: new Date(bis) }),
    };
  }

  try {
    const gutschriften = await prisma.gutschrift.findMany({
      where,
      include: {
        kunde: true,
        lieferung: true,
        positionen: { include: { artikel: { select: liefposArtikelSelect } } },
      },
      orderBy: { datum: "desc" },
      take: 200,
    });

    return NextResponse.json(gutschriften);
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

  const { kundeId, lieferungId, datum, grund, notiz } = body;
  const positionen: { artikelId: number; menge: number; preis: number; ruecknahme?: boolean }[] =
    body.positionen;

  if (!kundeId || !grund) {
    return NextResponse.json(
      { error: "kundeId und grund sind Pflichtfelder" },
      { status: 400 }
    );
  }
  if (!Array.isArray(positionen) || positionen.length === 0) {
    return NextResponse.json(
      { error: "Mindestens eine Position erforderlich" },
      { status: 400 }
    );
  }

  const GRUENDE = ["Reklamation", "Retoure", "Preiskorrektur", "Sonstiges"];
  if (!GRUENDE.includes(grund)) {
    return NextResponse.json({ error: "Ungültiger Grund" }, { status: 400 });
  }

  try {
    const gutschrift = await prisma.$transaction(async (tx) => {
      // Generate number
      const einstellung = await tx.einstellung.findUnique({
        where: { key: "system.letzteGutschriftNr" },
      });
      const nummer = naechsteGutschriftsnummer(einstellung?.value ?? null);
      await tx.einstellung.upsert({
        where: { key: "system.letzteGutschriftNr" },
        update: { value: nummer },
        create: { key: "system.letzteGutschriftNr", value: nummer },
      });

      // Create gutschrift with positions
      const gs = await tx.gutschrift.create({
        data: {
          nummer,
          kundeId: Number(kundeId),
          lieferungId: lieferungId ? Number(lieferungId) : null,
          datum: datum ? new Date(datum) : new Date(),
          grund,
          notiz: notiz?.trim() || null,
          positionen: {
            create: positionen.map((pos) => ({
              artikelId: Number(pos.artikelId),
              menge: Number(pos.menge),
              preis: Number(pos.preis),
              ruecknahme: pos.ruecknahme ?? false,
            })),
          },
        },
        include: {
          kunde: true,
          lieferung: true,
          positionen: { include: { artikel: { select: liefposArtikelSelect } } },
        },
      });

      // Process stock returns for positions with ruecknahme = true
      const ruecknahmePos = gs.positionen.filter((p) => p.ruecknahme);
      if (ruecknahmePos.length > 0) {
        const artikelIds = [...new Set(ruecknahmePos.map((p) => p.artikelId))];
        const artikelList = await tx.artikel.findMany({ where: { id: { in: artikelIds } } });
        const artikelMap = new Map(artikelList.map((a) => [a.id, a]));
        for (const pos of ruecknahmePos) {
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
              notiz: `Retoure Gutschrift ${gs.nummer}`,
            },
          });
        }
      }

      return gs;
    });

    return NextResponse.json(gutschrift, { status: 201 });
  } catch (err) {
    console.error("Gutschrift POST error:", err);
    const isDev = process.env.NODE_ENV === "development";
    const message = isDev && err instanceof Error ? err.message : "Gutschrift konnte nicht angelegt werden";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
