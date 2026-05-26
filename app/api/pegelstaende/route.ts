import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchCurrentMeasurement, fetchStationByUuid } from "@/lib/pegelonline";

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 Minuten

// GET /api/pegelstaende — gibt gecachte Werte aller konfigurierten Stationen zurück
// POST /api/pegelstaende — Station hinzufügen (uuid in body)
// DELETE /api/pegelstaende?uuid=... — Station entfernen

async function refreshStation(uuid: string) {
  const messung = await fetchCurrentMeasurement(uuid);
  if (!messung) return;
  await prisma.pegelstandCache.update({
    where: { stationUuid: uuid },
    data: {
      wert: messung.value ?? null,
      trend: messung.trend ?? null,
      messung: messung.timestamp ? new Date(messung.timestamp) : null,
      fetchedAt: new Date(),
    },
  });
}

export async function GET() {
  try {
    const stationen = await prisma.pegelstandCache.findMany({
      orderBy: { stationKurz: "asc" },
    });

    // Veraltete Daten nachziehen (älter als 30 min) — fire and forget
    const stale = stationen.filter(
      (s) => Date.now() - s.fetchedAt.getTime() > CACHE_TTL_MS
    );
    if (stale.length > 0) {
      Promise.all(stale.map((s) => refreshStation(s.stationUuid))).catch(() => {});
    }

    return NextResponse.json(stationen);
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { uuid } = await req.json() as { uuid?: string };
    if (!uuid) return NextResponse.json({ error: "uuid fehlt" }, { status: 400 });

    // Bereits vorhanden?
    const existing = await prisma.pegelstandCache.findUnique({ where: { stationUuid: uuid } });
    if (existing) return NextResponse.json(existing);

    // Stammdaten von API laden
    const station = await fetchStationByUuid(uuid);
    if (!station) return NextResponse.json({ error: "Station nicht gefunden" }, { status: 404 });

    const messung = await fetchCurrentMeasurement(uuid);

    const neu = await prisma.pegelstandCache.create({
      data: {
        stationUuid: uuid,
        stationKurz: station.shortname,
        stationLang: station.longname,
        gewaesser: station.water?.shortname ?? "",
        einheit: "cm",
        wert: messung?.value ?? null,
        trend: messung?.trend ?? null,
        messung: messung?.timestamp ? new Date(messung.timestamp) : null,
        fetchedAt: new Date(),
      },
    });
    return NextResponse.json(neu, { status: 201 });
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const uuid = req.nextUrl.searchParams.get("uuid");
  if (!uuid) return NextResponse.json({ error: "uuid fehlt" }, { status: 400 });
  try {
    await prisma.pegelstandCache.delete({ where: { stationUuid: uuid } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }
}
