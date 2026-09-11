import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generiereAuftragsbestaetigungPdf } from "@/lib/pdfGenerator";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission, P } from "@/lib/permissions";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";

// GET /api/exporte/auftragsbestaetigung?lieferungId= — PDF-Download der Auftragsbestätigung
// zu einer noch nicht gelieferten Lieferung (siehe generiereAuftragsbestaetigungPdf())
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  const deny = requirePermission(me, P.EXPORT_LIEFERSCHEIN);
  if (deny) return deny;

  const { searchParams } = new URL(req.url);
  const lieferungId = Number(searchParams.get("lieferungId"));

  if (!Number.isInteger(lieferungId) || lieferungId <= 0) {
    return NextResponse.json({ error: "lieferungId fehlt oder ungültig" }, { status: 400 });
  }

  try {
    const lieferung = await prisma.lieferung.findUnique({ where: { id: lieferungId } });
    if (!lieferung) {
      return NextResponse.json({ error: "Lieferung nicht gefunden" }, { status: 404 });
    }

    const pdfBuffer = await generiereAuftragsbestaetigungPdf(lieferungId);
    const filename = `auftragsbestaetigung-${lieferungId}-${new Date().toISOString().slice(0, 10)}.pdf`;

    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Fehler beim Erstellen der Auftragsbestätigung" }, { status: 500 });
  }
}
