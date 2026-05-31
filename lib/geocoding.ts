import { getAppName } from "@/lib/appinfo";

const OSM_URL = "https://nominatim.openstreetmap.org/search";

export async function geocodeAdresse(
  strasse: string,
  plz: string,
  ort: string
): Promise<{ lat: number; lng: number } | null> {
  const q = [strasse, plz, ort, "Deutschland"].filter(Boolean).join(", ");
  const url = `${OSM_URL}?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=de&addressdetails=0`;
  const userAgent = `${await getAppName()}/1.0`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": userAgent },
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

/**
 * Auto-geocodiert einen Kunden im Hintergrund (fire-and-forget).
 * Wird nach CREATE/UPDATE aufgerufen wenn Adresse vorhanden aber keine Koordinaten.
 * Bricht nach 2 Fehlversuchen ab (geocodeVersuche >= 2).
 */
export async function autoGeocodeKunde(
  prisma: import("@prisma/client").PrismaClient,
  kundeId: number
): Promise<void> {
  try {
    const k = await prisma.kunde.findUnique({
      where: { id: kundeId },
      select: { strasse: true, plz: true, ort: true, lat: true, geocodeVersuche: true },
    });
    if (!k || !k.strasse || !k.ort) return;
    if (k.lat != null) return; // bereits geocodiert
    if (k.geocodeVersuche >= 2) return; // max. Versuche erreicht

    const coords = await geocodeAdresse(k.strasse, k.plz ?? "", k.ort);
    if (coords) {
      await prisma.kunde.update({
        where: { id: kundeId },
        data: { lat: coords.lat, lng: coords.lng, geocodeVersuche: 0 },
      });
    } else {
      await prisma.kunde.update({
        where: { id: kundeId },
        data: { geocodeVersuche: { increment: 1 } },
      });
    }
  } catch {
    // fire-and-forget: Fehler still ignorieren
  }
}
