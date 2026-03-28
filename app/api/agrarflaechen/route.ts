import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchFarmlandAround } from "@/lib/overpass";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const latStr = searchParams.get("lat");
  const lngStr = searchParams.get("lng");
  const radiusStr = searchParams.get("radius");

  if (!latStr || !lngStr) {
    return NextResponse.json(
      { error: "Parameter 'lat' und 'lng' sind erforderlich" },
      { status: 400 }
    );
  }

  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json(
      { error: "Parameter 'lat' und 'lng' müssen Zahlen sein" },
      { status: 400 }
    );
  }

  let radius = radiusStr ? parseInt(radiusStr, 10) : 10000;
  if (isNaN(radius) || radius <= 0) radius = 10000;
  if (radius > 25000) radius = 25000;

  // Round lat/lng to 2 decimal places for cache key
  const cacheLat = Math.round(lat * 100) / 100;
  const cacheLng = Math.round(lng * 100) / 100;

  try {
    // Check cache
    const cached = await prisma.agrarflaechenCache.findUnique({
      where: {
        lat_lng_radius: {
          lat: cacheLat,
          lng: cacheLng,
          radius,
        },
      },
    });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    if (cached && cached.abgerufenAm > thirtyDaysAgo) {
      return NextResponse.json({
        lat: cacheLat,
        lng: cacheLng,
        radius,
        flaecheHa: cached.flaecheHa,
        polygonCount: cached.polygonCount,
        geojson: JSON.parse(cached.geojson),
        quelle: "OpenStreetMap Overpass API",
        abgerufenAm: cached.abgerufenAm.toISOString(),
      });
    }

    // Fetch fresh data from Overpass
    const result = await fetchFarmlandAround(cacheLat, cacheLng, radius);

    // Upsert cache
    const upserted = await prisma.agrarflaechenCache.upsert({
      where: {
        lat_lng_radius: {
          lat: cacheLat,
          lng: cacheLng,
          radius,
        },
      },
      update: {
        flaecheHa: result.flaecheHa,
        polygonCount: result.polygonCount,
        geojson: JSON.stringify(result.geojson),
        abgerufenAm: new Date(),
      },
      create: {
        lat: cacheLat,
        lng: cacheLng,
        radius,
        flaecheHa: result.flaecheHa,
        polygonCount: result.polygonCount,
        geojson: JSON.stringify(result.geojson),
        abgerufenAm: new Date(),
      },
    });

    return NextResponse.json({
      lat: cacheLat,
      lng: cacheLng,
      radius,
      flaecheHa: result.flaecheHa,
      polygonCount: result.polygonCount,
      geojson: result.geojson,
      quelle: "OpenStreetMap Overpass API",
      abgerufenAm: upserted.abgerufenAm.toISOString(),
    });
  } catch (error) {
    console.error("Agrarflächen-API Fehler:", error);
    return NextResponse.json(
      {
        error: "Fehler beim Abrufen der Agrarflächen-Daten",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
