import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { geocodeAdresse } from "@/lib/geocoding";
export const dynamic = "force-dynamic";


// POST /api/kunden/adress-validierung  — einzelnen Kunden validieren (manuell, ignoriert Versuchszähler)
// GET  /api/kunden/adress-validierung?batch=1  — bis zu 50 Kunden ohne Koordinaten und < 2 Fehlversuchen
// GET  /api/kunden/adress-validierung  — Statistik

// GET: Einzelner Kunde oder Batch
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const batch = searchParams.get("batch");
  const kundeId = searchParams.get("kundeId");

  if (kundeId) {
    const k = await prisma.kunde.findUnique({
      where: { id: Number(kundeId) },
      select: { id: true, lat: true, lng: true, strasse: true, plz: true, ort: true, geocodeVersuche: true },
    });
    if (!k) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json({
      id: k.id,
      lat: k.lat,
      lng: k.lng,
      geocodeVersuche: k.geocodeVersuche,
      hatAdresse: !!(k.strasse && k.ort),
    });
  }

  if (!batch) {
    // Statistik
    const total = await prisma.kunde.count({ where: { aktiv: true } });
    const mitKoordinaten = await prisma.kunde.count({ where: { aktiv: true, lat: { not: null }, lng: { not: null } } });
    const ohneAdresse = await prisma.kunde.count({ where: { aktiv: true, OR: [{ strasse: null }, { ort: null }] } });
    const geocodeFailed = await prisma.kunde.count({
      where: { aktiv: true, lat: null, geocodeVersuche: { gte: 2 }, strasse: { not: null }, ort: { not: null } },
    });
    const ohneKoords = total - mitKoordinaten;
    return NextResponse.json({ total, mitKoordinaten, ohneAdresse, geocodeFailed, ohneKoords, ausstehend: ohneKoords - ohneAdresse - geocodeFailed });
  }

  // Batch: Kunden mit Adresse, ohne Koordinaten, max. 1 Fehlversuch
  const kunden = await prisma.kunde.findMany({
    where: {
      aktiv: true,
      lat: null,
      strasse: { not: null },
      ort: { not: null },
      geocodeVersuche: { lt: 2 },
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
      await prisma.kunde.update({
        where: { id: k.id },
        data: { lat: coords.lat, lng: coords.lng, geocodeVersuche: 0 },
      });
      validiert++;
    } else {
      await prisma.kunde.update({
        where: { id: k.id },
        data: { geocodeVersuche: { increment: 1 } },
      });
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

// POST: Einzelnen Kunden manuell validieren (ignoriert Versuchszähler — manueller Override)
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
    // Versuchszähler hochsetzen, aber manuell darf man auch über 2 hinaus versuchen
    await prisma.kunde.update({ where: { id: kundeId }, data: { geocodeVersuche: { increment: 1 } } });
    return NextResponse.json({ error: "Adresse konnte nicht gefunden werden (Nominatim/OSM)" }, { status: 422 });
  }

  await prisma.kunde.update({ where: { id: kundeId }, data: { lat: coords.lat, lng: coords.lng, geocodeVersuche: 0 } });
  return NextResponse.json({ ok: true, lat: coords.lat, lng: coords.lng });
}
