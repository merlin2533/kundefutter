import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission, P } from "@/lib/permissions";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";

/**
 * Setzt den kompletten Bankabgleich-Zustand für Verkaufsrechnungen zurück, damit ein neuer
 * Abgleichsdurchgang von vorne beginnen kann: bezahlt-Markierung auf Lieferungen und
 * Sammelrechnungen, Kontoumsatz-Zuordnungen und die dabei automatisch verbuchten
 * Gutschriften/Forderungen. Betrifft NICHT Ausgaben/EingangsRechnungen (Einkaufsseite) und
 * löscht keine Gutschriften/Forderungen — nur bereits verbuchte werden wieder auf offen gesetzt.
 */
async function zaehleBetroffene() {
  const [lieferung, sammelrechnung, kontoumsatz, gutschrift, forderung] = await Promise.all([
    prisma.lieferung.count({ where: { bezahltAm: { not: null } } }),
    prisma.sammelrechnung.count({ where: { bezahltAm: { not: null } } }),
    prisma.kontoumsatz.count({
      where: { zugeordnet: true, OR: [{ lieferungId: { not: null } }, { sammelrechnungId: { not: null } }] },
    }),
    prisma.gutschrift.count({ where: { status: "VERBUCHT", verbuchtBeiLieferungId: { not: null } } }),
    prisma.kundeForderung.count({ where: { erledigt: true, erledigtBeiLieferungId: { not: null } } }),
  ]);
  return { lieferung, sammelrechnung, kontoumsatz, gutschrift, forderung };
}

/** GET – Vorschau: wie viele Datensätze wären betroffen? */
export async function GET() {
  try {
    const counts = await zaehleBetroffene();
    return NextResponse.json(counts);
  } catch (e) {
    Sentry.captureException(e);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

/** POST – Reset ausführen. Body: { confirm: true } */
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  const deny = requirePermission(me, P.EINSTELLUNGEN_BEARBEITEN);
  if (deny) return deny;

  let body: { confirm?: boolean } = {};
  try {
    body = await req.json();
  } catch (err) {
    Sentry.captureException(err);
    /* ignore */
  }
  if (!body.confirm) {
    return NextResponse.json({ error: "confirm: true erforderlich" }, { status: 400 });
  }

  try {
    const vorher = await zaehleBetroffene();
    await prisma.$transaction([
      prisma.gutschrift.updateMany({
        where: { status: "VERBUCHT", verbuchtBeiLieferungId: { not: null } },
        data: { status: "OFFEN", verbuchtBeiLieferungId: null },
      }),
      prisma.kundeForderung.updateMany({
        where: { erledigt: true, erledigtBeiLieferungId: { not: null } },
        data: { erledigt: false, erledigtBeiLieferungId: null },
      }),
      prisma.kontoumsatz.updateMany({
        where: { zugeordnet: true, OR: [{ lieferungId: { not: null } }, { sammelrechnungId: { not: null } }] },
        data: { zugeordnet: false, lieferungId: null, sammelrechnungId: null, zuordnungsArt: null, kiKonfidenz: null },
      }),
      prisma.lieferung.updateMany({ where: { bezahltAm: { not: null } }, data: { bezahltAm: null } }),
      prisma.sammelrechnung.updateMany({ where: { bezahltAm: { not: null } }, data: { bezahltAm: null } }),
    ]);
    return NextResponse.json(vorher);
  } catch (e) {
    Sentry.captureException(e);
    return NextResponse.json({ error: "Zurücksetzen fehlgeschlagen" }, { status: 500 });
  }
}
