// Utility to query OpenStreetMap Overpass API for farmland data

export interface FarmlandResult {
  flaecheHa: number;
  polygonCount: number;
  geojson: GeoJSON.FeatureCollection;
}

/**
 * Calculate the area of a polygon using the Shoelace formula,
 * converted to hectares.
 * Uses the approximation: 1 degree lat ~ 111320m,
 * 1 degree lng ~ 111320 * cos(lat_center).
 */
export function calculatePolygonArea(coords: [number, number][]): number {
  if (coords.length < 3) return 0;

  // coords are [lng, lat] in GeoJSON convention
  const latCenter =
    coords.reduce((sum, c) => sum + c[1], 0) / coords.length;
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * Math.cos((latCenter * Math.PI) / 180);

  let area = 0;
  for (let i = 0; i < coords.length; i++) {
    const j = (i + 1) % coords.length;
    const xi = coords[i][0] * mPerDegLng;
    const yi = coords[i][1] * mPerDegLat;
    const xj = coords[j][0] * mPerDegLng;
    const yj = coords[j][1] * mPerDegLat;
    area += xi * yj - xj * yi;
  }

  const areaM2 = Math.abs(area) / 2;
  return areaM2 / 10000; // m2 -> hectares
}

/**
 * Convert Overpass JSON elements to a GeoJSON FeatureCollection.
 *
 * Overpass returns `node` elements with lat/lon and `way` elements with a list
 * of node references (`nodes: [id1, id2, ...]`). We first build a node lookup
 * map, then reconstruct way geometries by resolving node references to
 * coordinates. Each way becomes a GeoJSON Polygon feature.
 */
export function overpassToGeoJSON(
  elements: any[] // eslint-disable-line @typescript-eslint/no-explicit-any
): GeoJSON.FeatureCollection {
  // Build node lookup: id -> [lng, lat]
  const nodeLookup = new Map<number, [number, number]>();
  for (const el of elements) {
    if (el.type === "node" && el.lat !== undefined && el.lon !== undefined) {
      nodeLookup.set(el.id, [el.lon, el.lat]);
    }
  }

  const features: GeoJSON.Feature[] = [];

  for (const el of elements) {
    if (el.type === "way" && Array.isArray(el.nodes)) {
      const coords: [number, number][] = [];
      let valid = true;
      for (const nodeId of el.nodes) {
        const coord = nodeLookup.get(nodeId);
        if (coord) {
          coords.push(coord);
        } else {
          valid = false;
          break;
        }
      }
      if (!valid || coords.length < 3) continue;

      // Ensure the ring is closed
      const first = coords[0];
      const last = coords[coords.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        coords.push([first[0], first[1]]);
      }

      const area = calculatePolygonArea(coords);

      features.push({
        type: "Feature",
        properties: {
          osmId: el.id,
          areaHa: Math.round(area * 100) / 100,
          ...(el.tags || {}),
        },
        geometry: {
          type: "Polygon",
          coordinates: [coords],
        },
      });
    }
  }

  return {
    type: "FeatureCollection",
    features,
  };
}

/**
 * Fetch farmland polygons around a given coordinate using the Overpass API.
 */
export async function fetchFarmlandAround(
  lat: number,
  lng: number,
  radiusMeters: number
): Promise<FarmlandResult> {
  const query = `[out:json][timeout:60];
(
  way["landuse"="farmland"](around:${radiusMeters},${lat},${lng});
  relation["landuse"="farmland"](around:${radiusMeters},${lat},${lng});
);
out body;
>;
out skel qt;`;

  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!response.ok) {
    throw new Error(
      `Overpass API error: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  const elements: any[] = data.elements || []; // eslint-disable-line @typescript-eslint/no-explicit-any

  const geojson = overpassToGeoJSON(elements);

  const flaecheHa = geojson.features.reduce((sum, f) => {
    const area = (f.properties as any)?.areaHa ?? 0; // eslint-disable-line @typescript-eslint/no-explicit-any
    return sum + area;
  }, 0);

  return {
    flaecheHa: Math.round(flaecheHa * 10) / 10,
    polygonCount: geojson.features.length,
    geojson,
  };
}
