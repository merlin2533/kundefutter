"use client";
import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/Card";
import { formatDatum } from "@/lib/utils";

interface Kontakt { typ: string; wert: string; }
interface Artikel { name: string; einheit: string; }
interface Position { menge: number; artikel: Artikel; }
interface Kunde {
  id: number;
  name: string;
  firma: string | null;
  plz: string | null;
  ort: string | null;
  strasse: string | null;
  lat: number | null;
  lng: number | null;
  kontakte: Kontakt[];
}
interface Lieferung {
  id: number;
  datum: string;
  notiz: string | null;
  kunde: Kunde;
  positionen: Position[];
}

interface RouteLeg {
  distanceKm: number;
  durationMin: number;
}

function heuteISO() { return new Date().toISOString().slice(0, 10); }

function formatMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

async function fetchRouteLegs(waypoints: { lat: number; lng: number }[]): Promise<RouteLeg[]> {
  if (waypoints.length < 2) return [];
  const coords = waypoints.map((w) => `${w.lng},${w.lat}`).join(";");
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=false&steps=false&annotations=false`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    const data = await res.json();
    if (data.code !== "Ok" || !data.routes?.[0]?.legs) return [];
    return data.routes[0].legs.map((leg: { distance: number; duration: number }) => ({
      distanceKm: leg.distance / 1000,
      durationMin: leg.duration / 60,
    }));
  } catch {
    return [];
  }
}

export default function TourenplanungPage() {
  const [datum, setDatum] = useState(heuteISO());
  const [lieferungen, setLieferungen] = useState<Lieferung[]>([]);
  const [loading, setLoading] = useState(false);
  const [fehler, setFehler] = useState("");
  const [routeLegs, setRouteLegs] = useState<RouteLeg[]>([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const [startOrt, setStartOrt] = useState("");
  const [startLat, setStartLat] = useState<number | null>(null);
  const [startLng, setStartLng] = useState<number | null>(null);
  const [geocoding, setGeocoding] = useState(false);

  // Load firm address from settings as default start
  useEffect(() => {
    fetch("/api/einstellungen?prefix=firma.")
      .then((r) => r.json())
      .then((d) => {
        const teile = [d["firma.strasse"], d["firma.plz"], d["firma.ort"]].filter(Boolean);
        if (teile.length > 0) setStartOrt(teile.join(", "));
      });
  }, []);

  const laden = useCallback(async (d: string) => {
    setLoading(true);
    setFehler("");
    setRouteLegs([]);
    try {
      const res = await fetch(`/api/tourenplanung?datum=${d}`);
      if (!res.ok) { setFehler("Fehler beim Laden der Lieferungen"); return; }
      setLieferungen(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { laden(datum); }, [datum, laden]);

  async function geocodeStartOrt() {
    if (!startOrt.trim()) return;
    setGeocoding(true);
    try {
      const q = encodeURIComponent(startOrt + ", Deutschland");
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=de`, {
        headers: { "User-Agent": "AgrarOffice-Roethemeier/1.0" },
        signal: AbortSignal.timeout(8000),
      });
      const data = await res.json();
      if (data?.[0]) {
        setStartLat(parseFloat(data[0].lat));
        setStartLng(parseFloat(data[0].lon));
      }
    } finally {
      setGeocoding(false);
    }
  }

  async function berechneRoute() {
    const waypoints: { lat: number; lng: number }[] = [];
    if (startLat && startLng) waypoints.push({ lat: startLat, lng: startLng });
    for (const l of lieferungen) {
      if (l.kunde.lat && l.kunde.lng) {
        waypoints.push({ lat: l.kunde.lat, lng: l.kunde.lng });
      }
    }
    if (waypoints.length < 2) {
      setFehler("Nicht genügend Kunden mit Koordinaten für Routenberechnung. Bitte Adressen über OSM prüfen.");
      return;
    }
    setRouteLoading(true);
    setRouteLegs([]);
    const legs = await fetchRouteLegs(waypoints);
    setRouteLegs(legs);
    setRouteLoading(false);
  }

  function artikelZusammenfassung(positionen: Position[]) {
    return positionen.map((p) => `${p.artikel.name} (${p.menge} ${p.artikel.einheit})`).join(", ");
  }

  const gesamtKm = routeLegs.reduce((s, l) => s + l.distanceKm, 0);
  const gesamtMin = routeLegs.reduce((s, l) => s + l.durationMin, 0);
  const mitKoords = lieferungen.filter((l) => l.kunde.lat && l.kunde.lng).length;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Tourenplanung</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card>
          <h2 className="font-semibold mb-3">Lieferdatum</h2>
          <input
            type="date"
            value={datum}
            onChange={(e) => setDatum(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
          />
        </Card>

        <Card>
          <h2 className="font-semibold mb-3">Startpunkt (für Routenberechnung)</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={startOrt}
              onChange={(e) => { setStartOrt(e.target.value); setStartLat(null); setStartLng(null); }}
              placeholder="z.B. Firmenadresse, PLZ Ort"
              className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
            />
            <button
              onClick={geocodeStartOrt}
              disabled={geocoding || !startOrt.trim()}
              className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg disabled:opacity-50 transition-colors"
            >
              {geocoding ? "…" : "Geocode"}
            </button>
          </div>
          {startLat && <p className="text-xs text-green-700 mt-1">✓ {startLat.toFixed(4)}, {startLng?.toFixed(4)}</p>}
        </Card>
      </div>

      <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
        <h2 className="font-semibold text-lg">
          {loading
            ? "Lade…"
            : `${lieferungen.length} Lieferung${lieferungen.length !== 1 ? "en" : ""} am ${formatDatum(datum)}`}
          {mitKoords < lieferungen.length && lieferungen.length > 0 && (
            <span className="ml-2 text-xs text-yellow-600 font-normal">{mitKoords}/{lieferungen.length} mit Koordinaten</span>
          )}
        </h2>
        <div className="flex gap-2 flex-wrap">
          {lieferungen.length > 0 && (
            <>
              <button
                onClick={berechneRoute}
                disabled={routeLoading || mitKoords === 0}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {routeLoading ? "Berechne…" : "Route berechnen (OSRM)"}
              </button>
              <button
                onClick={() => window.open(`/api/exporte/tour?datum=${datum}`, "_blank")}
                className="px-4 py-2 text-sm bg-green-700 hover:bg-green-800 text-white rounded-lg transition-colors"
              >
                Touren-PDF
              </button>
            </>
          )}
        </div>
      </div>

      {fehler && <p className="text-red-600 text-sm mb-4">{fehler}</p>}

      {routeLegs.length > 0 && (
        <Card className="mb-5 bg-blue-50 border-blue-200">
          <h3 className="font-semibold text-blue-800 mb-2">Routenübersicht</h3>
          <p className="text-sm text-blue-700">
            Gesamtdistanz: <strong>{gesamtKm.toFixed(1)} km</strong> · Fahrzeit: <strong>{formatMin(gesamtMin)}</strong>
            {startLat ? " (ab Startpunkt)" : ""}
          </p>
        </Card>
      )}

      {!loading && lieferungen.length === 0 && !fehler && (
        <Card>
          <p className="text-gray-500 text-sm">Keine geplanten Lieferungen für diesen Tag.</p>
        </Card>
      )}

      {lieferungen.length > 0 && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b text-xs uppercase">
                  <th className="pb-2 w-8">Nr.</th>
                  <th className="pb-2">PLZ</th>
                  <th className="pb-2">Ort</th>
                  <th className="pb-2">Kunde</th>
                  <th className="pb-2">Artikel</th>
                  <th className="pb-2 text-right">Km</th>
                  <th className="pb-2 text-right">Fahrzeit</th>
                </tr>
              </thead>
              <tbody>
                {lieferungen.map((l, i) => {
                  const leg = routeLegs[i] ?? null;
                  const hatKoords = l.kunde.lat && l.kunde.lng;
                  return (
                    <tr key={l.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-2.5 text-gray-400">{i + 1}</td>
                      <td className="py-2.5 font-mono text-xs">{l.kunde.plz ?? "–"}</td>
                      <td className="py-2.5">{l.kunde.ort ?? "–"}</td>
                      <td className="py-2.5">
                        <div className="font-medium">{l.kunde.firma ?? l.kunde.name}</div>
                        {l.kunde.firma && <div className="text-xs text-gray-500">{l.kunde.name}</div>}
                        {l.kunde.strasse && <div className="text-xs text-gray-400">{l.kunde.strasse}</div>}
                        {!hatKoords && (
                          <span className="text-xs text-yellow-600">⚠ Keine Koordinaten</span>
                        )}
                      </td>
                      <td className="py-2.5 text-gray-600 max-w-[220px]">
                        <div className="truncate">{artikelZusammenfassung(l.positionen)}</div>
                        {l.notiz && <div className="text-xs text-gray-400 mt-0.5">{l.notiz}</div>}
                      </td>
                      <td className="py-2.5 text-right text-blue-700 font-medium whitespace-nowrap">
                        {leg ? `${leg.distanceKm.toFixed(1)} km` : "—"}
                      </td>
                      <td className="py-2.5 text-right text-blue-600 whitespace-nowrap">
                        {leg ? formatMin(leg.durationMin) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {routeLegs.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-gray-300 font-semibold">
                    <td colSpan={5} className="pt-2 text-right text-sm text-gray-600">Gesamt:</td>
                    <td className="pt-2 text-right text-blue-700">{gesamtKm.toFixed(1)} km</td>
                    <td className="pt-2 text-right text-blue-600">{formatMin(gesamtMin)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
