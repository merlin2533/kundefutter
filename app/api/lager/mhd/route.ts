import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Sentry } from "@/lib/sentry";

// Ohne Untergrenze sortiert `mhd asc` die ÄLTESTEN (am längsten abgelaufenen) Einträge zuerst —
// bei mehr als `take` insgesamt vorhandenen Einträgen würde ein reiner take-Deckel dann genau die
// eigentlich dringenden, bald fälligen/kürzlich abgelaufenen Chargen hinter einem Wall uralter
// Historie verstecken (identischer 500er-Deckel-Mechanismus wie an anderer Stelle im Projekt,
// hier aber umgekehrt: die Untergrenze fehlte, nicht die Obergrenze). Fenster analog
// app/api/eierkontrolle/route.ts (CHARGEN_FENSTER_TAGE) großzügig auf 90 Tage in die
// Vergangenheit bemessen, damit auch kürzlich abgelaufene Ware noch im "Abgelaufen"-Filter
// auftaucht; nach unten offen für alle noch nicht abgelaufenen/zukünftigen MHDs.
const MHD_FENSTER_TAGE = 90;

export async function GET() {

  try {
    const mhdAb = new Date();
    mhdAb.setDate(mhdAb.getDate() - MHD_FENSTER_TAGE);

    const positionen = await prisma.wareineingangPosition.findMany({
      where: { mhd: { not: null, gte: mhdAb } },
      select: {
        id: true,
        mhd: true,
        menge: true,
        chargeNr: true,
        artikel: { select: { id: true, name: true, einheit: true } },
        wareneingang: { select: { datum: true } },
      },
      orderBy: { mhd: "asc" },
      take: 5000,
    });

    return NextResponse.json(positionen);
  } catch (err) {
    Sentry.captureException(err);
    const isDev = process.env.NODE_ENV === "development";
    return NextResponse.json(
      { error: isDev && err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 }
    );
  }
}
