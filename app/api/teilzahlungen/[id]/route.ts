import { getCurrentUser } from "@/lib/auth";
import { P, requirePermission, requireAnyPermission } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Sentry } from "@/lib/sentry";
import { berechneOffenenBetrag, berechneSammelrechnungBrutto, sollBezahltZurueckgenommenWerden } from "@/lib/lieferung-brutto";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const __me = await getCurrentUser();
  const __deny = requireAnyPermission(__me, [P.EXPORT_RECHNUNG, P.BANKABGLEICH_BEARBEITEN, P.LIEFERUNGEN_ERSTELLEN]);
  if (__deny) return __deny;
  const { id } = await params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const POS = { menge: true, verkaufspreis: true, rabattProzent: true, mwstSatz: true, artikel: { select: { mwstSatz: true } } } as const;
    await prisma.$transaction(async (tx) => {
      const tz = await tx.teilzahlung.delete({ where: { id: numId } });
      // Hat diese Teilzahlung die Rechnung als bezahlt markiert (POST), wird das zurückgenommen.
      if (tz.lieferungId) {
        const l = await tx.lieferung.findUnique({
          where: { id: tz.lieferungId },
          select: { bezahltAm: true, teilzahlungen: { select: { betrag: true } }, positionen: { select: POS } },
        });
        if (l) {
          const hatKontoumsatz =
            (await tx.kontoumsatz.count({ where: { lieferungId: tz.lieferungId } })) +
              (await tx.kontoumsatzWeitereZuordnung.count({ where: { lieferungId: tz.lieferungId } })) > 0;
          if (sollBezahltZurueckgenommenWerden({ bezahltAm: l.bezahltAm, geloeschtDatum: tz.datum, hatKontoumsatz, offenerBetrag: berechneOffenenBetrag(l) })) {
            await tx.lieferung.update({ where: { id: tz.lieferungId }, data: { bezahltAm: null } });
          }
        }
      } else if (tz.sammelrechnungId) {
        const sr = await tx.sammelrechnung.findUnique({
          where: { id: tz.sammelrechnungId },
          select: { bezahltAm: true, teilzahlungen: { select: { betrag: true } }, lieferungen: { select: { positionen: { select: POS } } } },
        });
        if (sr) {
          const hatKontoumsatz =
            (await tx.kontoumsatz.count({ where: { sammelrechnungId: tz.sammelrechnungId } })) +
              (await tx.kontoumsatzWeitereZuordnung.count({ where: { sammelrechnungId: tz.sammelrechnungId } })) > 0;
          const offen = berechneSammelrechnungBrutto(sr) - sr.teilzahlungen.reduce((a, t) => a + t.betrag, 0);
          if (sollBezahltZurueckgenommenWerden({ bezahltAm: sr.bezahltAm, geloeschtDatum: tz.datum, hatKontoumsatz, offenerBetrag: offen })) {
            await tx.sammelrechnung.update({ where: { id: tz.sammelrechnungId }, data: { bezahltAm: null } });
          }
        }
      }
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err);
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("P2025")) {
      return NextResponse.json({ error: "Teilzahlung nicht gefunden" }, { status: 404 });
    }
    console.error("Teilzahlung DELETE error:", err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
