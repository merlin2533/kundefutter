import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchFarmlandAround } from "@/lib/overpass";

/**
 * Calculate the Haversine distance between two coordinates in kilometers.
 */
function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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

  const radiusKm = radius / 1000;

  // Round lat/lng to 2 decimal places for cache key
  const cacheLat = Math.round(lat * 100) / 100;
  const cacheLng = Math.round(lng * 100) / 100;

  try {
    // 1. Get farmland data (with caching)
    let flaecheHa: number;
    let polygonCount: number;
    let geojson: any; // eslint-disable-line @typescript-eslint/no-explicit-any

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const cached = await prisma.agrarflaechenCache.findUnique({
      where: {
        lat_lng_radius: {
          lat: cacheLat,
          lng: cacheLng,
          radius,
        },
      },
    });

    if (cached && cached.abgerufenAm > thirtyDaysAgo) {
      flaecheHa = cached.flaecheHa;
      polygonCount = cached.polygonCount;
      geojson = JSON.parse(cached.geojson);
    } else {
      const result = await fetchFarmlandAround(cacheLat, cacheLng, radius);
      flaecheHa = result.flaecheHa;
      polygonCount = result.polygonCount;
      geojson = result.geojson;

      // Upsert cache
      await prisma.agrarflaechenCache.upsert({
        where: {
          lat_lng_radius: {
            lat: cacheLat,
            lng: cacheLng,
            radius,
          },
        },
        update: {
          flaecheHa,
          polygonCount,
          geojson: JSON.stringify(geojson),
          abgerufenAm: new Date(),
        },
        create: {
          lat: cacheLat,
          lng: cacheLng,
          radius,
          flaecheHa,
          polygonCount,
          geojson: JSON.stringify(geojson),
          abgerufenAm: new Date(),
        },
      });
    }

    // 2. Query customers within the bounding box
    // Approximate bounding box from radius
    const latDelta = radiusKm / 111.32;
    const lngDelta = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));

    const kundenInBox = await prisma.kunde.findMany({
      where: {
        aktiv: true,
        lat: {
          not: null,
          gte: lat - latDelta,
          lte: lat + latDelta,
        },
        lng: {
          not: null,
          gte: lng - lngDelta,
          lte: lng + lngDelta,
        },
      },
      select: {
        id: true,
        name: true,
        firma: true,
        kategorie: true,
        lat: true,
        lng: true,
        ort: true,
      },
    });

    // 3. Filter by actual Haversine distance and calculate distance
    const kundenImRadius = kundenInBox
      .filter((k) => k.lat !== null && k.lng !== null)
      .map((k) => {
        const entfernungKm = haversineKm(lat, lng, k.lat!, k.lng!);
        return {
          id: k.id,
          name: k.firma ? `${k.name} (${k.firma})` : k.name,
          entfernungKm: Math.round(entfernungKm * 10) / 10,
          kategorie: k.kategorie,
          ort: k.ort,
          lat: k.lat,
          lng: k.lng,
        };
      })
      .filter((k) => k.entfernungKm <= radiusKm)
      .sort((a, b) => a.entfernungKm - b.entfernungKm);

    // 4. Calculate density and rating
    const kundenAnzahl = kundenImRadius.length;
    const kundeDichte =
      flaecheHa > 0
        ? Math.round((kundenAnzahl / (flaecheHa / 1000)) * 100) / 100
        : 0;

    let bewertung: string;
    if (kundeDichte > 3) {
      bewertung = "Gut abgedeckt";
    } else if (kundeDichte < 1.5) {
      bewertung = "Unterversorgt";
    } else {
      bewertung = "Normal";
    }

    return NextResponse.json({
      flaecheHa,
      polygonCount,
      kunden: kundenImRadius,
      kundenAnzahl,
      kundeDichte,
      bewertung,
      geojson,
    });
  } catch (error) {
    console.error("Agrarflächen-Analyse Fehler:", error);
    return NextResponse.json(
      {
        error: "Fehler bei der Agrarflächen-Analyse",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
