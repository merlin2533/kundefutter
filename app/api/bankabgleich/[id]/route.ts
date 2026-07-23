import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { markiereAlsBezahlt, macheBezahltRueckgaengig, type ZielTyp } from "@/lib/bankabgleich-zuordnung";
import { Sentry } from "@/lib/sentry";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, ctx: Ctx) {
  const { id: idStr } = await ctx.params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const body = await req.json();
    const {
      lieferungId,
      sammelrechnungId,
      ausgabeId,
      eingangsRechnungId,
      alsBezahltMarkieren = true,
      zuordnungsArt,
      kiKonfidenz,
    } = body as {
      lieferungId?: number | null;
      sammelrechnungId?: number | null;
      ausgabeId?: number | null;
      eingangsRechnungId?: number | null;
      alsBezahltMarkieren?: boolean;
      zuordnungsArt?: "manuell" | "automatisch" | "ki" | null;
      kiKonfidenz?: number | null;
    };

    const umsatz = await prisma.kontoumsatz.findUnique({ where: { id } });
    if (!umsatz) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    const updateData: {
      zugeordnet: boolean;
      lieferungId?: number | null;
      sammelrechnungId?: number | null;
      ausgabeId?: number | null;
      eingangsRechnungId?: number | null;
      zuordnungsArt?: string | null;
      kiKonfidenz?: number | null;
    } = { zugeordnet: true };
    if (lieferungId !== undefined) updateData.lieferungId = lieferungId ?? null;
    if (sammelrechnungId !== undefined) updateData.sammelrechnungId = sammelrechnungId ?? null;
    if (ausgabeId !== undefined) updateData.ausgabeId = ausgabeId ?? null;
    if (eingangsRechnungId !== undefined) updateData.eingangsRechnungId = eingangsRechnungId ?? null;
    if (zuordnungsArt !== undefined) updateData.zuordnungsArt = zuordnungsArt ?? null;
    if (kiKonfidenz !== undefined) updateData.kiKonfidenz = kiKonfidenz ?? null;

    const aktualisiert = await prisma.kontoumsatz.update({
      where: { id },
      data: updateData,
    });

    // "Als bezahlt markieren" ist ein eigener, expliziter Schritt (Default an) — kein
    // impliziter Nebeneffekt der reinen Zuordnung. Bei false bleibt das Zielobjekt offen
    // (z.B. Teilzahlung/Anzahlung).
    if (alsBezahltMarkieren) {
      const ziele: [ZielTyp, number | null | undefined][] = [
        ["lieferung", lieferungId],
        ["sammelrechnung", sammelrechnungId],
        ["ausgabe", ausgabeId],
        ["eingangsrechnung", eingangsRechnungId],
      ];
      for (const [zielTyp, zielId] of ziele) {
        if (zielId) await markiereAlsBezahlt(zielTyp, zielId, umsatz.buchungsdatum);
      }
    }

    return NextResponse.json(aktualisiert);
  } catch (err: unknown) {
    Sentry.captureException(err);
    if ((err as { code?: string }).code === "P2025") return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    console.error(err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id: idStr } = await ctx.params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const bestehend = await prisma.kontoumsatz.findUnique({ where: { id } });
    if (!bestehend) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    // Bugfix: Aufheben der Zuordnung muss auch eine zuvor gesetzte Bezahlt-Markierung
    // zurücknehmen (nur wenn sie exakt durch diesen Umsatz gesetzt wurde), sonst bleibt das
    // Zielobjekt fälschlich als bezahlt stehen.
    const ziele: [ZielTyp, number | null][] = [
      ["lieferung", bestehend.lieferungId],
      ["sammelrechnung", bestehend.sammelrechnungId],
      ["ausgabe", bestehend.ausgabeId],
      ["eingangsrechnung", bestehend.eingangsRechnungId],
    ];
    for (const [zielTyp, zielId] of ziele) {
      if (zielId) await macheBezahltRueckgaengig(zielTyp, zielId, bestehend.buchungsdatum);
    }

    const aktualisiert = await prisma.kontoumsatz.update({
      where: { id },
      data: {
        zugeordnet: false,
        lieferungId: null,
        sammelrechnungId: null,
        ausgabeId: null,
        eingangsRechnungId: null,
        zuordnungsArt: null,
        kiKonfidenz: null,
      },
    });
    return NextResponse.json(aktualisiert);
  } catch (err: unknown) {
    Sentry.captureException(err);
    if ((err as { code?: string }).code === "P2025") return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    console.error(err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
