import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/kunden/adress-validierung  — einzelnen Kunden validieren
// GET  /api/kunden/adress-validierung?batch=1  — bis zu 50 Kunden ohne Koordinaten per Batch validieren
// GET  /api/kunden/adress-validierung?kundeId=X — Status eines Kunden

const OSM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "AgrarOffice-Roethemeier/1.0";

async function geocodeAdresse(strasse: string, plz: string, ort: string): Promise<{ lat: number; lng: number } | null> {
  const q = [strasse, plz, ort, "Deutschland"].filter(Boolean).join(", ");
  const url = `${OSM_URL}?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=de&addressdetails=0`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

// GET: Einzelner Kunde oder Batch
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const batch = searchParams.get("batch");
  const kundeId = searchParams.get("kundeId");

  if (kundeId) {
    const k = await prisma.kunde.findUnique({ where: { id: Number(kundeId) }, select: { id: true, lat: true, lng: true, strasse: true, plz: true, ort: true } });
    if (!k) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json({ id: k.id, lat: k.lat, lng: k.lng, hatAdresse: !!(k.strasse && k.ort) });
  }

  if (!batch) {
    // Return stats
    const total = await prisma.kunde.count({ where: { aktiv: true } });
    const mitKoordinaten = await prisma.kunde.count({ where: { aktiv: true, lat: { not: null }, lng: { not: null } } });
    const ohneAdresse = await prisma.kunde.count({ where: { aktiv: true, OR: [{ strasse: null }, { ort: null }] } });
    return NextResponse.json({ total, mitKoordinaten, ohneAdresse, ausstehend: total - mitKoordinaten - ohneAdresse });
  }

  // Batch: Kunden mit Adresse aber ohne Koordinaten
  const kunden = await prisma.kunde.findMany({
    where: {
      aktiv: true,
      lat: null,
      strasse: { not: null },
      ort: { not: null },
    },
    select: { id: true, strasse: true, plz: true, ort: true },
    take: 50,
  });

  if (kunden.length === 0) {
    return NextResponse.json({ validiert: 0, message: "Alle Adressen bereits validiert" });
  }

  let validiert = 0;
  let fehler = 0;

  for (const k of kunden) {
    // Rate limit: Nominatim erlaubt max 1 Request/Sekunde
    await new Promise((r) => setTimeout(r, 1100));
    const coords = await geocodeAdresse(k.strasse ?? "", k.plz ?? "", k.ort ?? "");
    if (coords) {
      await prisma.kunde.update({ where: { id: k.id }, data: { lat: coords.lat, lng: coords.lng } });
      validiert++;
    } else {
      // Setze lat/lng auf 0 als Markierung "versucht aber nicht gefunden"
      // (damit wir es nicht immer wieder versuchen — wir nutzen null = "noch nicht versucht")
      fehler++;
    }
  }

  return NextResponse.json({
    validiert,
    fehler,
    verarbeitet: kunden.length,
    message: `${validiert} von ${kunden.length} Adressen geocodiert`,
  });
}

// POST: Einzelnen Kunden sofort validieren
export async function POST(req: NextRequest) {
  const body = await req.json();
  const kundeId = Number(body.kundeId);
  if (!kundeId) return NextResponse.json({ error: "kundeId fehlt" }, { status: 400 });

  const k = await prisma.kunde.findUnique({ where: { id: kundeId } });
  if (!k) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  if (!k.strasse || !k.ort) {
    return NextResponse.json({ error: "Keine vollständige Adresse vorhanden" }, { status: 422 });
  }

  const coords = await geocodeAdresse(k.strasse, k.plz ?? "", k.ort);
  if (!coords) {
    return NextResponse.json({ error: "Adresse konnte nicht gefunden werden (Nominatim/OSM)" }, { status: 422 });
  }

  await prisma.kunde.update({ where: { id: kundeId }, data: { lat: coords.lat, lng: coords.lng } });
  return NextResponse.json({ ok: true, lat: coords.lat, lng: coords.lng });
}
