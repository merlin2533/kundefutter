import { NextRequest, NextResponse } from "next/server";
import { getWetter5Tage } from "@/lib/weather";

export const dynamic = "force-dynamic";

// Standardkoordinaten: Deutschland-Mitte (Kassel)
const DEFAULT_LAT = 51.1657;
const DEFAULT_LNG = 10.4515;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const latRaw = searchParams.get("lat");
  const lngRaw = searchParams.get("lng");

  const lat = latRaw ? parseFloat(latRaw) : DEFAULT_LAT;
  const lng = lngRaw ? parseFloat(lngRaw) : DEFAULT_LNG;

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: "Ungültige Koordinaten" }, { status: 400 });
  }

  const isDev = process.env.NODE_ENV === "development";

  try {
    const wetter = await getWetter5Tage(lat, lng);
    return NextResponse.json(wetter, {
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (err) {
    const msg = isDev && err instanceof Error ? err.message : "Wetterdaten nicht verfügbar";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
