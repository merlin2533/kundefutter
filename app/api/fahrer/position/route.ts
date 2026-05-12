import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const isDev = process.env.NODE_ENV === "development";

// POST — Fahrer sendet seine aktuelle Position
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  let body: { lat?: unknown; lng?: unknown; genauigkeit?: unknown; tourname?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body" }, { status: 400 });
  }

  const lat = typeof body.lat === "number" ? body.lat : parseFloat(String(body.lat ?? ""));
  const lng = typeof body.lng === "number" ? body.lng : parseFloat(String(body.lng ?? ""));

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: "lat und lng sind erforderlich" }, { status: 400 });
  }

  const genauigkeit = typeof body.genauigkeit === "number" ? body.genauigkeit : undefined;
  const tourname = typeof body.tourname === "string" ? body.tourname.trim() : undefined;

  const key = `fahrer.position.${user.id}`;
  const value = JSON.stringify({
    lat,
    lng,
    genauigkeit: genauigkeit ?? null,
    zeitpunkt: new Date().toISOString(),
    name: user.name || user.benutzername,
    tourname: tourname ?? null,
  });

  try {
    await prisma.einstellung.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// GET — Alle aktiven Fahrer-Positionen (< 4 Stunden alt)
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  try {
    const einstellungen = await prisma.einstellung.findMany({
      where: { key: { startsWith: "fahrer.position." } },
      take: 100,
    });

    const vierStundenAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);

    const positionen = einstellungen
      .map((e) => {
        try {
          const data = JSON.parse(e.value) as {
            lat: number;
            lng: number;
            genauigkeit: number | null;
            zeitpunkt: string;
            name: string;
            tourname: string | null;
          };
          const benutzerId = parseInt(e.key.replace("fahrer.position.", ""), 10);
          return { benutzerId, ...data };
        } catch {
          return null;
        }
      })
      .filter((p): p is NonNullable<typeof p> => {
        if (!p) return false;
        const zeitpunkt = new Date(p.zeitpunkt);
        return zeitpunkt > vierStundenAgo;
      });

    return NextResponse.json(positionen);
  } catch (err) {
    const msg = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE — Fahrer meldet sich ab (löscht seine Position)
export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  const key = `fahrer.position.${user.id}`;
  try {
    await prisma.einstellung.deleteMany({ where: { key } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
