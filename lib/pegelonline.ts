// WSV Pegelonline REST API v2
const BASE = "https://pegelonline.wsv.de/webservices/rest-api/v2";

export interface PegelStation {
  uuid: string;
  shortname: string;
  longname: string;
  water: { shortname: string; longname: string };
  agency?: string;
  km?: number;
  latitude?: number;
  longitude?: number;
}

export interface PegelMessung {
  timestamp: string;
  value: number | null;
  trend: number | null; // -1 | 0 | 1
  stateMnwMhw?: string;
}

export interface PegelstandWert {
  stationUuid: string;
  stationKurz: string;
  stationLang: string;
  gewaesser: string;
  einheit: string;
  wert: number | null;
  trend: number | null;
  messung: string | null;
  fetchedAt: string;
}

export async function searchStations(query: string): Promise<PegelStation[]> {
  const url = `${BASE}/stations.json?longname=${encodeURIComponent(query.toUpperCase() + "*")}&includeTimeseries=false`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return [];
  const data = await res.json() as PegelStation[];
  return Array.isArray(data) ? data.slice(0, 20) : [];
}

export async function fetchCurrentMeasurement(uuid: string): Promise<PegelMessung | null> {
  const url = `${BASE}/stations/${encodeURIComponent(uuid)}/W/currentmeasurement.json`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return await res.json() as PegelMessung;
  } catch {
    return null;
  }
}

export async function fetchStationByUuid(uuid: string): Promise<PegelStation | null> {
  const url = `${BASE}/stations/${encodeURIComponent(uuid)}.json`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return await res.json() as PegelStation;
  } catch {
    return null;
  }
}
