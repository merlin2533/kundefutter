import { NextRequest, NextResponse } from "next/server";
import { sammleDatevBuchungen } from "@/lib/datev";
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

    const { rows, kontenrahmen } = await sammleDatevBuchungen(von, bis, baseUrl);

    const buchungen = rows
      .map((r) => ({
        datum: r.datum.toISOString(),
        herkunft: r.herkunft,
        belegNr: r.belegfeld1,
        buchungstext: r.buchungstext,
        konto: r.konto,
        gegenkonto: r.gegenkonto,
        umsatz: r.umsatz,
        sollHaben: r.sollHaben,
        steuersatz: r.steuersatz,
      }))
      .sort((a, b) => a.datum.localeCompare(b.datum));

    const summeProKonto = new Map<string, number>();
    for (const b of buchungen) {
      const vorzeichen = b.sollHaben === "S" ? 1 : -1;
      summeProKonto.set(b.konto, (summeProKonto.get(b.konto) ?? 0) + vorzeichen * b.umsatz);
    }

    return NextResponse.json({
      kontenrahmen,
      anzahl: buchungen.length,
      buchungen,
      summeProKonto: Array.from(summeProKonto.entries())
        .map(([konto, saldo]) => ({ konto, saldo: Math.round(saldo * 100) / 100 }))
        .sort((a, b) => a.konto.localeCompare(b.konto)),
    });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "DATEV-Buchungsvorschau fehlgeschlagen" }, { status: 500 });
  }
}
