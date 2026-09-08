import { NextRequest, NextResponse } from "next/server";
import { sammleKatMeldung, buildKatMeldungCsv } from "@/lib/kat-meldung";
import { getModulConfig, requireModul } from "@/lib/modul-config";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const modul = await getModulConfig();
    const denyModul = requireModul(modul, "eierhandel");
    if (denyModul) return denyModul;

    const { searchParams } = new URL(req.url);
    const vonStr = searchParams.get("von");
    const bisStr = searchParams.get("bis");

    const today = new Date();
    const von = vonStr ? new Date(vonStr) : new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7);
    von.setHours(0, 0, 0, 0);
    const bis = bisStr ? new Date(bisStr) : today;
    bis.setHours(23, 59, 59, 999);

    const zeilen = await sammleKatMeldung(von, bis);
    const csv = buildKatMeldungCsv(zeilen);
    const filename = `kat-meldung_${von.toISOString().slice(0, 10)}_${bis.toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "KAT-Meldungs-Export fehlgeschlagen" }, { status: 500 });
  }
}
