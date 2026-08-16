import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { markiereAlsBezahlt, macheBezahltRueckgaengig, type ZielTyp } from "@/lib/bankabgleich-zuordnung";
import { ladeZielFuerDifferenz } from "@/lib/bankabgleich-differenz";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Weitere Rechnung zu einem bereits zugeordneten Kontoumsatz hinzufügen — für den Fall, dass ein
 * Kunde mehrere offene Rechnungen in EINER Überweisung begleicht. Die Haupt-Rechnung bleibt über
 * Kontoumsatz.lieferungId/sammelrechnungId zugeordnet (unverändert), jede weitere landet in
 * KontoumsatzWeitereZuordnung und wird hier genauso wie die Haupt-Rechnung als bezahlt markiert.
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const { id: idStr } = await ctx.params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const body = await req.json();
    const { lieferungId, sammelrechnungId, alsBezahltMarkieren = true } = body as {
      lieferungId?: number | null;
      sammelrechnungId?: number | null;
      alsBezahltMarkieren?: boolean;
    };

    if (!lieferungId && !sammelrechnungId) {
      return NextResponse.json({ error: "lieferungId oder sammelrechnungId ist erforderlich" }, { status: 400 });
    }
    if (lieferungId && sammelrechnungId) {
      return NextResponse.json({ error: "Nur lieferungId ODER sammelrechnungId angeben" }, { status: 400 });
    }

    const umsatz = await prisma.kontoumsatz.findUnique({ where: { id } });
    if (!umsatz) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    if (!umsatz.zugeordnet) {
      return NextResponse.json({ error: "Kontoumsatz muss zuerst einer Haupt-Rechnung zugeordnet werden" }, { status: 400 });
    }

    const zielTyp: "lieferung" | "sammelrechnung" = lieferungId ? "lieferung" : "sammelrechnung";
    const zielId = (lieferungId ?? sammelrechnungId) as number;

    // Gleicher Kunde wie die Haupt-Rechnung? Eine Überweisung kommt von einem Zahlenden — es
    // wäre ein Bedienfehler, hier eine fremde Rechnung anzuhängen.
    const hauptZielTyp: "lieferung" | "sammelrechnung" = umsatz.lieferungId ? "lieferung" : "sammelrechnung";
    const [hauptZiel, neuesZiel] = await Promise.all([
      ladeZielFuerDifferenz(prisma, hauptZielTyp, (umsatz.lieferungId ?? umsatz.sammelrechnungId) as number),
      ladeZielFuerDifferenz(prisma, zielTyp, zielId),
    ]);
    if (!neuesZiel) return NextResponse.json({ error: "Rechnung nicht gefunden" }, { status: 404 });
    if (hauptZiel && hauptZiel.kundeId !== neuesZiel.kundeId) {
      return NextResponse.json({ error: "Diese Rechnung gehört zu einem anderen Kunden als die Haupt-Zuordnung" }, { status: 400 });
    }

    const bereitsVorhanden = await prisma.kontoumsatzWeitereZuordnung.findFirst({
      where: { kontoumsatzId: id, lieferungId: lieferungId ?? null, sammelrechnungId: sammelrechnungId ?? null },
    });
    if (bereitsVorhanden || (zielTyp === "lieferung" && umsatz.lieferungId === zielId) || (zielTyp === "sammelrechnung" && umsatz.sammelrechnungId === zielId)) {
      return NextResponse.json({ error: "Diese Rechnung ist diesem Kontoumsatz bereits zugeordnet" }, { status: 400 });
    }

    const eintrag = await prisma.$transaction(async (tx) => {
      const neu = await tx.kontoumsatzWeitereZuordnung.create({
        data: { kontoumsatzId: id, lieferungId: lieferungId ?? null, sammelrechnungId: sammelrechnungId ?? null },
      });
      if (alsBezahltMarkieren) {
        await markiereAlsBezahlt(zielTyp, zielId, umsatz.buchungsdatum, tx);
      }
      return neu;
    });

    return NextResponse.json({ id: eintrag.id, typ: zielTyp, zielId, bezeichnung: neuesZiel.bezeichnung, betrag: neuesZiel.betrag, kundeId: neuesZiel.kundeId });
  } catch (err) {
    Sentry.captureException(err);
    console.error(err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

/** Eine einzelne weitere Zuordnung wieder entfernen — macht auch deren Bezahlt-Markierung rückgängig. */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { id: idStr } = await ctx.params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const zuordnungId = parseInt(searchParams.get("zuordnungId") ?? "", 10);
  if (isNaN(zuordnungId)) return NextResponse.json({ error: "zuordnungId fehlt oder ungültig" }, { status: 400 });

  try {
    const eintrag = await prisma.kontoumsatzWeitereZuordnung.findUnique({ where: { id: zuordnungId } });
    if (!eintrag || eintrag.kontoumsatzId !== id) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    const umsatz = await prisma.kontoumsatz.findUnique({ where: { id } });
    if (!umsatz) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    const zielTyp: ZielTyp = eintrag.lieferungId ? "lieferung" : "sammelrechnung";
    const zielId = (eintrag.lieferungId ?? eintrag.sammelrechnungId) as number;

    await macheBezahltRueckgaengig(zielTyp, zielId, umsatz.buchungsdatum);
    await prisma.kontoumsatzWeitereZuordnung.delete({ where: { id: zuordnungId } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err);
    console.error(err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
