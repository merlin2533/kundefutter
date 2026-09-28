import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission, P } from "@/lib/permissions";
import { Sentry } from "@/lib/sentry";

export const dynamic = "force-dynamic";

// Zähler für das Dashboard-Widget und das "📧 Aus E-Mail-Eingang"-Panel auf /eingangsrechnungen.
// Bewusst aggregiert (count/aggregate) statt findMany — vermeidet den im Projekt mehrfach
// dokumentierten "500er-Deckel"-Bug-Typ, bei dem eine gedeckelte Liste für eine reine Zählung
// missbraucht wird und ab einer bestimmten Datenmenge einfach falsche Zahlen liefert.
export async function GET() {
  const me = await getCurrentUser();
  const deny = requirePermission(me, P.EINGANGSRECHNUNGEN);
  if (deny) return deny;

  try {
    const [zuPruefen, offen] = await Promise.all([
      prisma.kiEingangsrechnungBatchItem.count({
        where: { eingangsRechnungId: null, batch: { quelle: "email", status: { not: "verworfen" } } },
      }),
      prisma.eingangsRechnung.aggregate({
        where: { status: "OFFEN" },
        _count: true,
        _sum: { betrag: true },
      }),
    ]);

    return NextResponse.json({
      zuPruefen,
      offenAnzahl: offen._count,
      offenSummeNetto: offen._sum.betrag ?? 0,
    });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
