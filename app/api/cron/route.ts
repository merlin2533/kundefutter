import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchCurrentMeasurement } from "@/lib/pegelonline";

// GET /api/cron
// Zentraler Cron-Dispatcher — wird von docker-entrypoint.sh alle 30 Minuten aufgerufen.
// Optional: CRON_SECRET als Bearer-Header absichern.
//
// Enthaltene Jobs:
//   pegelstaende — Wasserstandsmessungen von Pegelonline aktualisieren

interface JobResult {
  job: string;
  ok: boolean;
  detail?: Record<string, unknown>;
  error?: string;
  durationMs: number;
}

async function jobPegelstaende(): Promise<JobResult> {
  const t0 = Date.now();
  try {
    const stationen = await prisma.pegelstandCache.findMany({
      select: { stationUuid: true },
    });
    let updated = 0;
    const fehler: string[] = [];
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
      } catch {
        fehler.push(s.stationUuid);
      }
    }
    return {
      job: "pegelstaende",
      ok: fehler.length === 0,
      detail: { stationen: stationen.length, updated, fehler },
      durationMs: Date.now() - t0,
    };
  } catch (err) {
    return {
      job: "pegelstaende",
      ok: false,
      error: err instanceof Error ? err.message : "Unbekannter Fehler",
      durationMs: Date.now() - t0,
    };
  }
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const startedAt = new Date().toISOString();
  const results: JobResult[] = [];

  results.push(await jobPegelstaende());

  const allOk = results.every((r) => r.ok);
  return NextResponse.json(
    { ok: allOk, startedAt, jobs: results },
    { status: allOk ? 200 : 207 }
  );
}
