import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tage = Math.min(Math.max(parseInt(searchParams.get("tage") || "30", 10) || 30, 1), 365);

  const seit = new Date();
  seit.setDate(seit.getDate() - tage);

  try {
    const nutzungen = await prisma.kiNutzung.findMany({
      where: { zeitpunkt: { gte: seit } },
      orderBy: { zeitpunkt: "desc" },
      take: 500,
    });

    const gesamt = {
      requests: nutzungen.length,
      tokensIn: nutzungen.reduce((s, n) => s + n.tokensIn, 0),
      tokensOut: nutzungen.reduce((s, n) => s + n.tokensOut, 0),
      kostenCent: nutzungen.reduce((s, n) => s + n.kostenCent, 0),
      fehler: nutzungen.filter((n) => !n.erfolgreich).length,
    };

    const proFeature: Record<string, { requests: number; tokensIn: number; tokensOut: number; kostenCent: number }> = {};
    for (const n of nutzungen) {
      if (!proFeature[n.feature]) {
        proFeature[n.feature] = { requests: 0, tokensIn: 0, tokensOut: 0, kostenCent: 0 };
      }
      proFeature[n.feature].requests++;
      proFeature[n.feature].tokensIn += n.tokensIn;
      proFeature[n.feature].tokensOut += n.tokensOut;
      proFeature[n.feature].kostenCent += n.kostenCent;
    }

    const letzteRequests = nutzungen.slice(0, 20);

    return NextResponse.json({ gesamt, proFeature, letzteRequests });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Fehler" }, { status: 500 });
  }
}
