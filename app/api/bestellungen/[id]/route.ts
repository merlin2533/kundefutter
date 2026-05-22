import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const GUELTIGE_STATUS = ["OFFEN", "BESTAETIGT", "TEILGELIEFERT", "ABGESCHLOSSEN", "STORNIERT"];

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const nId = parseInt(id, 10);
  if (isNaN(nId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const record = await prisma.bestellung.findUnique({
      where: { id: nId },
      include: {
        lieferant: { select: { id: true, name: true, email: true, telefon: true } },
        positionen: {
          include: {
            artikel: { select: { id: true, name: true, artikelnummer: true, einheit: true, standardpreis: true } },
          },
        },
      },
    });
    if (!record) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json(record);
  } catch (err) {
    console.error("Bestellungen GET [id] error:", err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const nId = parseInt(id, 10);
  if (isNaN(nId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};

  if (body.aktion === "abschliessen") {
    data.status = "ABGESCHLOSSEN";
  } else if (body.aktion === "stornieren") {
    data.status = "STORNIERT";
  } else if (body.aktion === "bestätigen" || body.aktion === "bestaetigen") {
    data.status = "BESTAETIGT";
  } else {
    if (body.status !== undefined) {
      if (!GUELTIGE_STATUS.includes(body.status)) return NextResponse.json({ error: "Ungültiger Status" }, { status: 400 });
      data.status = body.status;
    }
    if (body.notiz !== undefined) data.notiz = body.notiz || null;
    if (body.lieferdatum !== undefined) data.lieferdatum = body.lieferdatum ? new Date(body.lieferdatum) : null;
  }

  try {
    const positionenUpdates = Array.isArray(body.positionen) ? body.positionen : null;

    const record = await prisma.$transaction(async (tx) => {
      if (positionenUpdates) {
        for (const p of positionenUpdates as { id: unknown; mengeGeliefert?: unknown; preis?: unknown }[]) {
          const posId = parseInt(String(p.id), 10);
          if (isNaN(posId)) continue;
          const updates: Record<string, unknown> = {};
          if (p.mengeGeliefert !== undefined) updates.mengeGeliefert = p.mengeGeliefert != null ? Number(p.mengeGeliefert) : 0;
          if (p.preis !== undefined) updates.preis = p.preis != null ? Number(p.preis) : null;
          if (Object.keys(updates).length > 0) {
            await tx.bestellungPosition.update({ where: { id: posId }, data: updates });
          }
        }
        // auto-detect TEILGELIEFERT
        if (!data.status) {
          const bestellung = await tx.bestellung.findUnique({
            where: { id: nId },
            include: { positionen: true },
          });
          if (bestellung && bestellung.status === "BESTAETIGT") {
            const delivered = bestellung.positionen.filter((p) => (p.mengeGeliefert ?? 0) > 0);
            if (delivered.length > 0 && delivered.length < bestellung.positionen.length) {
              data.status = "TEILGELIEFERT";
            }
          }
        }
      }

      return tx.bestellung.update({
        where: { id: nId },
        data,
        include: {
          lieferant: { select: { id: true, name: true, firma: true } },
          positionen: {
            include: { artikel: { select: { id: true, name: true, artikelnummer: true, einheit: true } } },
          },
        },
      });
    });
    return NextResponse.json(record);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "P2025") return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    console.error("Bestellungen PUT error:", err);
    const isDev = process.env.NODE_ENV === "development";
    const message = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const nId = parseInt(id, 10);
  if (isNaN(nId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const record = await prisma.bestellung.findUnique({ where: { id: nId }, select: { status: true } });
    if (!record) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    if (record.status !== "OFFEN") {
      return NextResponse.json({ error: "Nur Bestellungen mit Status OFFEN können gelöscht werden" }, { status: 400 });
    }
    await prisma.bestellung.delete({ where: { id: nId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "P2025") return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    console.error("Bestellungen DELETE error:", err);
    return NextResponse.json({ error: "Interner Fehler" }, { status: 500 });
  }
}
