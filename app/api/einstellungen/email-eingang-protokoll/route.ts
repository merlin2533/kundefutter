import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission, P } from "@/lib/permissions";
import { Sentry } from "@/lib/sentry";

export const dynamic = "force-dynamic";

// Protokoll-Tabelle der Settings-Seite: die letzten verarbeiteten Mails inkl. Verweis auf den
// dabei angelegten KiEingangsrechnungBatch (falls einer entstand).
export async function GET() {
  const me = await getCurrentUser();
  const deny = requirePermission(me, P.EINSTELLUNGEN_BEARBEITEN);
  if (deny) return deny;

  try {
    const eintraege = await prisma.eingangsRechnungMailImport.findMany({
      orderBy: { empfangenAm: "desc" },
      take: 100,
    });
    return NextResponse.json(eintraege);
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
