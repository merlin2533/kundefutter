import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const STATUS_WHITELIST = new Set(["OFFEN", "BESTAETIGT", "UMGEWANDELT", "STORNIERT"]);

export async function GET(_req: NextRequest, ctx: Params) {
  const { id } = await ctx.params;
  const vid = parseInt(id, 10);
  if (isNaN(vid)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const v = await prisma.vorbestellung.findUnique({
      where: { id: vid },
      include: {
        kunde: true,
        positionen: { include: { artikel: true } },
      },
    });
    if (!v) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    // Beschaffungsstatus (EinkaufStatus) je Position einmischen → grüner Haken auf der Auftragsbestätigung
    const status = await prisma.einkaufStatus.findMany({
      where: { quelle: "vorbestellung", positionId: { in: v.positionen.map((p) => p.id) } },
    });
    const statusMap = new Map(status.map((s) => [s.positionId, s.bestelltAm]));
    const positionen = v.positionen.map((p) => ({
      ...p,
      bestelltAm: statusMap.get(p.id)?.toISOString() ?? null,
    }));

    return NextResponse.json({ ...v, positionen });
  } catch {
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

// PUT /api/vorbestellungen/[id]
// Body kann enthalten: status, notiz, lieferdatum, bestellfrist, rabattProzent
// Spezial-Aktion: { aktion: "umwandeln" } → wandelt in Lieferung um
export async function PUT(req: NextRequest, ctx: Params) {
  const { id } = await ctx.params;
  const vid = parseInt(id, 10);
  if (isNaN(vid)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const body = await req.json();

    if (body.aktion === "umwandeln") {
      return await umwandelnInLieferung(vid);
    }

    const data: Record<string, unknown> = {};
    if (body.status !== undefined) {
      if (!STATUS_WHITELIST.has(body.status)) return NextResponse.json({ error: "Ungültiger Status" }, { status: 400 });
      data.status = body.status;
    }
    if (body.notiz !== undefined) data.notiz = body.notiz?.trim() || null;
    if (body.lieferdatum !== undefined) data.lieferdatum = body.lieferdatum ? new Date(body.lieferdatum) : null;
    if (body.bestellfrist !== undefined) data.bestellfrist = body.bestellfrist ? new Date(body.bestellfrist) : null;
    if (body.rabattProzent !== undefined) data.rabattProzent = body.rabattProzent != null && body.rabattProzent !== "" ? Number(body.rabattProzent) : null;

    const updated = await prisma.vorbestellung.update({
      where: { id: vid },
      data,
      include: { positionen: { include: { artikel: true } }, kunde: true },
    });
    return NextResponse.json(updated);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "P2025") return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Datenbankfehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Params) {
  const { id } = await ctx.params;
  const vid = parseInt(id, 10);
  if (isNaN(vid)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    await prisma.vorbestellung.delete({ where: { id: vid } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "P2025") return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

async function umwandelnInLieferung(vid: number) {
  const vb = await prisma.vorbestellung.findUnique({
    where: { id: vid },
    include: { positionen: { include: { artikel: true } } },
  });
  if (!vb) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  if (vb.status === "UMGEWANDELT") return NextResponse.json({ error: "Bereits umgewandelt" }, { status: 400 });

  const rabatt = vb.rabattProzent ?? 0;

  const lieferung = await prisma.$transaction(async (tx) => {
    const created = await tx.lieferung.create({
      data: {
        kundeId: vb.kundeId,
        datum: vb.lieferdatum ?? new Date(),
        status: "geplant",
        notiz: `Aus Vorbestellung ${vb.nummer} (${vb.saison})`,
        positionen: {
          create: vb.positionen.map((p) => ({
            artikelId: p.artikelId,
            menge: p.menge,
            verkaufspreis: p.preis ?? p.artikel.standardpreis ?? 0,
            einkaufspreis: 0,
            rabattProzent: rabatt,
          })),
        },
      },
      include: { positionen: true },
    });
    await tx.vorbestellung.update({
      where: { id: vid },
      data: { status: "UMGEWANDELT", lieferungId: created.id },
    });
    return created;
  });
  return NextResponse.json({ ok: true, lieferungId: lieferung.id });
}
