import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { markiereAlsBezahlt, macheBezahltRueckgaengig, type ZielTyp } from "@/lib/bankabgleich-zuordnung";
import { ladeZielFuerDifferenz } from "@/lib/bankabgleich-differenz";
import { verbucheGutschriftGegenLieferung, GutschriftVerrechnungFehler } from "@/lib/gutschrift";
import { Sentry } from "@/lib/sentry";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission, P } from "@/lib/permissions";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Weitere Rechnung zu einem bereits zugeordneten Kontoumsatz hinzufügen — für den Fall, dass ein
 * Kunde mehrere offene Rechnungen in EINER Überweisung begleicht. Die Haupt-Rechnung bleibt über
 * Kontoumsatz.lieferungId/sammelrechnungId zugeordnet (unverändert), jede weitere landet in
 * KontoumsatzWeitereZuordnung und wird hier genauso wie die Haupt-Rechnung als bezahlt markiert.
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const me = await getCurrentUser();
  const deny = requirePermission(me, P.BANKABGLEICH_BEARBEITEN);
  if (deny) return deny;

  const { id: idStr } = await ctx.params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const body = await req.json();
    const { lieferungId, sammelrechnungId, alsBezahltMarkieren = true, gutschriftIdsFuerVerrechnung } = body as {
      lieferungId?: number | null;
      sammelrechnungId?: number | null;
      alsBezahltMarkieren?: boolean;
      /** Manuelle Mehrfachauswahl im Bankabgleich-Panel (siehe PUT /api/bankabgleich/[id]): deckt
       * eine Zahlung mehrere Rechnungen UND mehrere Gutschriften desselben Kunden gleichzeitig ab,
       * werden hier die der Übersicht halber dieser weiteren Lieferung zugeordneten Gutschriften
       * verbucht. Nur bei lieferungId wirksam — Sammelrechnung kennt keine Gutschrift-Verrechnung. */
      gutschriftIdsFuerVerrechnung?: number[] | null;
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
      if (zielTyp === "lieferung" && gutschriftIdsFuerVerrechnung?.length) {
        for (const gid of gutschriftIdsFuerVerrechnung) {
          await verbucheGutschriftGegenLieferung(tx, { gutschriftId: gid, lieferungId: zielId });
        }
      }
      return neu;
    });

    return NextResponse.json({ id: eintrag.id, typ: zielTyp, zielId, bezeichnung: neuesZiel.bezeichnung, betrag: neuesZiel.betrag, kundeId: neuesZiel.kundeId });
  } catch (err) {
    if (err instanceof GutschriftVerrechnungFehler) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    Sentry.captureException(err);
    console.error(err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

/** Eine einzelne weitere Zuordnung wieder entfernen — macht auch deren Bezahlt-Markierung rückgängig. */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const me = await getCurrentUser();
  const deny = requirePermission(me, P.BANKABGLEICH_BEARBEITEN);
  if (deny) return deny;

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
