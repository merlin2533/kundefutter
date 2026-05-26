import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchCurrentMeasurement } from "@/lib/pegelonline";

// GET /api/cron/pegelstaende
// Wird vom Docker-Hintergrundprozess alle 30 Minuten aufgerufen.
// Optional: CRON_SECRET in .env setzen und als Bearer-Header senden.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const stationen = await prisma.pegelstandCache.findMany({
    select: { stationUuid: true },
  });

  let updated = 0;
  const errors: string[] = [];

  for (const s of stationen) {
    try {
      const messung = await fetchCurrentMeasurement(s.stationUuid);
      if (messung) {
        await prisma.pegelstandCache.update({
          where: { stationUuid: s.stationUuid },
          data: {
            wert: messung.value ?? null,
            trend: messung.trend ?? null,
            messung: messung.timestamp ? new Date(messung.timestamp) : null,
            fetchedAt: new Date(),
          },
        });
        updated++;
      }
    } catch (err) {
      errors.push(s.stationUuid);
    }
  }

  return NextResponse.json({
    ok: true,
    updated,
    errors,
    timestamp: new Date().toISOString(),
  });
}
