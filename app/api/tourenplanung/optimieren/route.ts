import { NextRequest, NextResponse } from "next/server";

interface Point {
  lat: number;
  lng: number;
}

interface Stop extends Point {
  id: number;
}

interface OptimierungRequest {
  start: Point;
  stops: Stop[];
}

/** Haversine distance in km between two lat/lng points */
function haversineKm(a: Point, b: Point): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      sinDLng *
      sinDLng;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Total route distance: start -> stops[order[0]] -> ... -> stops[order[n-1]] */
function totalDistance(start: Point, stops: Stop[], order: number[]): number {
  let dist = 0;
  let prev: Point = start;
  for (const idx of order) {
    dist += haversineKm(prev, stops[idx]);
    prev = stops[idx];
  }
  return dist;
}

/** Nearest-neighbor heuristic starting from `start` */
function nearestNeighbor(start: Point, stops: Stop[]): number[] {
  const n = stops.length;
  const visited = new Array<boolean>(n).fill(false);
  const order: number[] = [];
  let current: Point = start;

  for (let step = 0; step < n; step++) {
    let bestIdx = -1;
    let bestDist = Infinity;
    for (let i = 0; i < n; i++) {
      if (!visited[i]) {
        const d = haversineKm(current, stops[i]);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
    }
    visited[bestIdx] = true;
    order.push(bestIdx);
    current = stops[bestIdx];
  }
  return order;
}

/** 2-opt improvement: swap edges until no improvement is found */
function twoOpt(start: Point, stops: Stop[], order: number[]): number[] {
  const n = order.length;
  let improved = true;
  let best = [...order];
  let bestDist = totalDistance(start, stops, best);

  while (improved) {
    improved = false;
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        // Reverse the segment between i and j
        const candidate = [...best];
        let lo = i;
        let hi = j;
        while (lo < hi) {
          const tmp = candidate[lo];
          candidate[lo] = candidate[hi];
          candidate[hi] = tmp;
          lo++;
          hi--;
        }
        const candidateDist = totalDistance(start, stops, candidate);
        if (candidateDist < bestDist - 1e-9) {
          bestDist = candidateDist;
          best = candidate;
          improved = true;
        }
      }
    }
  }
  return best;
}

export async function POST(req: NextRequest) {
  let body: OptimierungRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const { start, stops } = body;

  if (
    !start ||
    typeof start.lat !== "number" ||
    typeof start.lng !== "number"
  ) {
    return NextResponse.json(
      { error: "start mit lat/lng erforderlich" },
      { status: 400 }
    );
  }

  if (!Array.isArray(stops) || stops.length === 0) {
    return NextResponse.json(
      { error: "stops darf nicht leer sein" },
      { status: 400 }
    );
  }

  for (const s of stops) {
    if (
      typeof s.id !== "number" ||
      typeof s.lat !== "number" ||
      typeof s.lng !== "number"
    ) {
      return NextResponse.json(
        { error: "Jeder Stop benötigt id, lat und lng als Zahlen" },
        { status: 400 }
      );
    }
  }

  // Calculate baseline distance (original order 0, 1, 2, …)
  const originalOrder = stops.map((_, i) => i);
  const originalDistanceKm = totalDistance(start, stops, originalOrder);

  // Nearest-neighbor heuristic
  const nnOrder = nearestNeighbor(start, stops);

  // 2-opt improvement
  const optimizedOrder = twoOpt(start, stops, nnOrder);
  const optimizedDistanceKm = totalDistance(start, stops, optimizedOrder);

  const savedDistanceKm = Math.max(0, originalDistanceKm - optimizedDistanceKm);
  const savedPercent =
    originalDistanceKm > 0
      ? (savedDistanceKm / originalDistanceKm) * 100
      : 0;

  return NextResponse.json({
    optimizedOrder: optimizedOrder.map((i) => stops[i].id),
    totalDistanceKm: optimizedDistanceKm,
    savedDistanceKm,
    savedPercent,
  });
}
