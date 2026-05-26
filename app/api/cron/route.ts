import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchCurrentMeasurement } from "@/lib/pegelonline";

// GET /api/cron          — führt alle Jobs aus (Docker-Hintergrundprozess, 30 min)
// GET /api/cron?status=1 — gibt nur den letzten gespeicherten Status zurück (kein Run)
// Optional: CRON_SECRET als Bearer-Header absichern.

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

async function saveStatus(startedAt: string, results: JobResult[]) {
  const payload = JSON.stringify({ startedAt, jobs: results });
  await prisma.einstellung.upsert({
    where: { key: "cron.letzterLauf" },
    create: { key: "cron.letzterLauf", value: payload },
    update: { value: payload },
  }).catch(() => {});
}

async function isAuthorized(req: NextRequest): Promise<boolean> {
  // 1. CRON_SECRET Bearer-Token (Docker-Hintergrundprozess)
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth === `Bearer ${secret}`) return true;
  } else {
    // Kein Secret konfiguriert → externe Aufrufe ohne Token erlaubt
    const auth = req.headers.get("authorization") ?? "";
    if (!auth) return true;
  }
  // 2. Gültige Browser-Session (Nutzung aus einstellungen/cron)
  const { cookies } = await import("next/headers");
  const { verifySession } = await import("@/lib/auth");
  const jar = await cookies();
  const token = jar.get("kundefutter_session")?.value;
  if (token) {
    const session = await verifySession(token);
    if (session) return true;
  }
  return false;
}

export async function GET(req: NextRequest) {
  if (!(await isAuthorized(req))) {
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

  await saveStatus(startedAt, results);

  const allOk = results.every((r) => r.ok);
  return NextResponse.json(
    { ok: allOk, startedAt, jobs: results },
    { status: allOk ? 200 : 207 }
  );
}
