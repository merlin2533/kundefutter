import { NextRequest, NextResponse } from "next/server";
import { buildDatevCsv } from "@/lib/datev";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission, P } from "@/lib/permissions";
import { isNextcloudKonfiguriert, uploadZuBuchhaltung } from "@/lib/nextcloud";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";

/**
 * POST /api/exporte/datev/archivieren
 * Body: { von, bis } (gleiche Semantik wie GET /api/exporte/datev)
 * Erzeugt denselben DATEV-Export und archiviert ihn zusätzlich in Nextcloud
 * unter Buchhaltung/{Jahr}/{MM}/DATEV-Exporte/.
 */
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  const deny = requirePermission(me, P.EXPORT_DATEV);
  if (deny) return deny;

  try {
    const konfiguriert = await isNextcloudKonfiguriert();
    if (!konfiguriert) {
      return NextResponse.json({ error: "Nextcloud nicht konfiguriert", nichtKonfiguriert: true }, { status: 503 });
    }

    const body = await req.json().catch((err) => {
      Sentry.captureException(err);
      return ({});
    });
    const { von: vonStr, bis: bisStr } = body as { von?: string; bis?: string };

    const today = new Date();
    const von = vonStr ? new Date(vonStr) : new Date(today.getFullYear(), today.getMonth(), 1);
    von.setHours(0, 0, 0, 0);
    const bis = bisStr ? new Date(bisStr) : today;
    bis.setHours(23, 59, 59, 999);

    const proto = req.headers.get("x-forwarded-proto") ?? "http";
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
    const baseUrl = host ? `${proto}://${host}` : "";

    const { csv, filename } = await buildDatevCsv(von, bis, baseUrl);
    const buffer = Buffer.from(csv, "utf-8");

    const datei = await uploadZuBuchhaltung(von.getFullYear(), von.getMonth() + 1, "DATEV-Exporte", filename, buffer, "text/csv");

    return NextResponse.json({ success: true, nextcloudLink: datei.webViewLink, filename });
  } catch (err) {
    Sentry.captureException(err);
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Archivierung fehlgeschlagen";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
