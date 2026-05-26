import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchCurrentMeasurement } from "@/lib/pegelonline";

// GET /api/cron          — führt alle Jobs aus (Docker-Hintergrundprozess, 30 min)
// GET /api/cron?status=1 — gibt nur den letzten gespeicherten Status zurück (kein Run)
// Absicherung: CRON_SECRET env-var als Bearer-Header; ohne Secret sind alle Aufrufe erlaubt.
// /api/cron ist in middleware PUBLIC_PATHS — Middleware-Auth wird nicht erzwungen.

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

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // Kein Secret → offen (für Docker-intern; in Produktion CRON_SECRET setzen)
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

async function saveStatus(ok: boolean, startedAt: string, results: JobResult[]) {
  const payload = JSON.stringify({ ok, startedAt, jobs: results });
  await prisma.einstellung.upsert({
    where: { key: "cron.letzterLauf" },
    create: { key: "cron.letzterLauf", value: payload },
    update: { value: payload },
  }).catch(() => {});
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Status-only — kein Run
  if (req.nextUrl.searchParams.get("status") === "1") {
    const row = await prisma.einstellung.findUnique({ where: { key: "cron.letzterLauf" } }).catch(() => null);
    if (!row) return NextResponse.json({ ok: null, startedAt: null, jobs: [] });
    try { return NextResponse.json(JSON.parse(row.value)); }
    catch { return NextResponse.json({ ok: null, startedAt: null, jobs: [] }); }
  }

  const startedAt = new Date().toISOString();
  const results: JobResult[] = [];
  results.push(await jobPegelstaende());

  const allOk = results.every((r) => r.ok);
  await saveStatus(allOk, startedAt, results);

  return NextResponse.json(
    { ok: allOk, startedAt, jobs: results },
    { status: allOk ? 200 : 207 }
  );
}
