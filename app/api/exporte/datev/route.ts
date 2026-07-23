import { NextRequest, NextResponse } from "next/server";
import { buildDatevCsv } from "@/lib/datev";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission, P } from "@/lib/permissions";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  const deny = requirePermission(me, P.EXPORT_DATEV);
  if (deny) return deny;

  const { searchParams } = new URL(req.url);
  const vonStr = searchParams.get("von");
  const bisStr = searchParams.get("bis");

  try {
    const today = new Date();
    const von = vonStr ? new Date(vonStr) : new Date(today.getFullYear(), today.getMonth(), 1);
    von.setHours(0, 0, 0, 0);
    const bis = bisStr ? new Date(bisStr) : today;
    bis.setHours(23, 59, 59, 999);

    const proto = req.headers.get("x-forwarded-proto") ?? "http";
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
    const baseUrl = host ? `${proto}://${host}` : "";

    const { csv, filename } = await buildDatevCsv(von, bis, baseUrl);

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "DATEV-Export fehlgeschlagen" }, { status: 500 });
  }
}
