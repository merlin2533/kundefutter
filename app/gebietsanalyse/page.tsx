"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Card } from "@/components/Card";
import type { KundeMarker } from "./GebietsMap";

// ─── Dynamic import (ssr: false) — leaflet requires browser APIs ─────────────

const DynamicGebietsMap = dynamic(() => import("./GebietsMap"), { ssr: false });

// ─── Types ───────────────────────────────────────────────────────────────────

interface AnalyseResult {
  flaecheHa: number;
  polygonCount: number;
  kunden: KundeMarker[];
  kundenAnzahl: number;
  kundeDichte: number;
  bewertung: "Gut abgedeckt" | "Normal" | "Unterversorgt";
  geojson: GeoJSON.FeatureCollection;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const RADIUS_OPTIONS = [5, 10, 15, 25] as const;

const BEWERTUNG_STYLES: Record<string, string> = {
  "Gut abgedeckt": "bg-green-100 text-green-800",
  Normal: "bg-yellow-100 text-yellow-800",
  Unterversorgt: "bg-red-100 text-red-800",
};

const KATEGORIE_BADGE_STYLES: Record<string, string> = {
  Landwirt: "bg-green-100 text-green-800",
  Pferdehof: "bg-blue-100 text-blue-800",
  Kleintierhalter: "bg-orange-100 text-orange-800",
  Großhändler: "bg-purple-100 text-purple-800",
  Sonstige: "bg-gray-100 text-gray-700",
};

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function GebietsanalysePage() {
  const [adresse, setAdresse] = useState("");
  const [center, setCenter] = useState<[number, number] | null>(null);
  const [radius, setRadius] = useState<number>(10);
  const [result, setResult] = useState<AnalyseResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Geocode address via Nominatim ────────────────────────────────────────

  const handleGeocode = useCallback(async () => {
    if (!adresse.trim()) return;
    setGeocoding(true);
    setError(null);
    try {
      const q = encodeURIComponent(adresse.trim());
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`,
        { headers: { "Accept-Language": "de", "User-Agent": "AgrarOffice/1.0" } },
      );
      const data = await res.json();
      if (data.length === 0) {
        setError("Adresse nicht gefunden");
        return;
      }
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      setCenter([lat, lng]);
    } catch {
      setError("Fehler bei der Adresssuche");
    } finally {
      setGeocoding(false);
    }
  }, [adresse]);

  // ── Map click handler ────────────────────────────────────────────────────

  const handleMapClick = useCallback((lat: number, lng: number) => {
    setCenter([lat, lng]);
    setError(null);
  }, []);

  // ── Run analysis ─────────────────────────────────────────────────────────

  const handleAnalyse = useCallback(async () => {
    if (!center) {
      setError("Bitte zuerst einen Mittelpunkt setzen");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/agrarflaechen/analyse?lat=${center[0]}&lng=${center[1]}&radius=${radius * 1000}`,
      );
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data: AnalyseResult = await res.json();
      setResult(data);
    } catch {
      setError("Fehler beim Laden der Analyse");
    } finally {
      setLoading(false);
    }
  }, [center, radius]);

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">
          Gebietsanalyse — Agrarflächen &amp; Kundenpotenzial
        </h1>
      </div>

      {/* Two-column layout */}
      <div className="flex gap-4">
        {/* Map (left 2/3) */}
        <div className="w-2/3 min-w-0">
          <div
            className="rounded-xl overflow-hidden border border-gray-200 shadow-sm"
            style={{ height: "600px" }}
          >
            <DynamicGebietsMap
              center={center}
              radiusKm={radius}
              kunden={result?.kunden ?? []}
              geojson={result?.geojson ?? null}
              onMapClick={handleMapClick}
            />
          </div>
        </div>

        {/* Controls + Results (right 1/3) */}
        <div className="w-1/3 space-y-4">
          {/* Controls */}
          <Card>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Mittelpunkt bestimmen</h2>

            {/* Address input */}
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={adresse}
                onChange={(e) => setAdresse(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleGeocode()}
                placeholder="Adresse eingeben..."
                className="flex-1 text-sm px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <button
                onClick={handleGeocode}
                disabled={geocoding || !adresse.trim()}
                className="text-sm px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
              >
                {geocoding ? "..." : "Suchen"}
              </button>
            </div>

            <p className="text-xs text-gray-400 mb-4">
              Oder: <span className="font-medium">Auf Karte klicken</span> um den Mittelpunkt zu setzen
            </p>

            {center && (
              <p className="text-xs text-gray-500 mb-3">
                Gewählt: {center[0].toFixed(5)}, {center[1].toFixed(5)}
              </p>
            )}

            {/* Radius selector */}
            <h2 className="text-sm font-semibold text-gray-700 mb-2">Radius</h2>
            <div className="flex flex-wrap gap-2 mb-4">
              {RADIUS_OPTIONS.map((r) => (
                <label key={r} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="radius"
                    value={r}
                    checked={radius === r}
                    onChange={() => setRadius(r)}
                    className="text-green-600"
                  />
                  <span className="text-sm text-gray-700">{r} km</span>
                </label>
              ))}
            </div>

            {/* Analyse button */}
            <button
              onClick={handleAnalyse}
              disabled={loading || !center}
              className="w-full text-sm px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Analyse läuft..." : "Analysieren"}
            </button>

            {error && (
              <p className="text-xs text-red-500 mt-2">{error}</p>
            )}
          </Card>

          {/* Results */}
          {result && (
            <Card>
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Ergebnis</h2>

              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Agrarfläche</span>
                  <span className="font-medium">{result.flaecheHa.toLocaleString("de-DE")} ha</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Kunden im Radius</span>
                  <span className="font-medium">{result.kundenAnzahl}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Kundendichte</span>
                  <span className="font-medium">{result.kundeDichte.toFixed(2)} / 1.000 ha</span>
                </div>
                <div className="flex justify-between items-center text-sm pt-1">
                  <span className="text-gray-500">Bewertung</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${BEWERTUNG_STYLES[result.bewertung] ?? "bg-gray-100 text-gray-700"}`}
                  >
                    {result.bewertung}
                  </span>
                </div>
              </div>

              {/* Customer list */}
              {result.kunden.length > 0 && (
                <>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Kunden ({result.kunden.length})
                  </h3>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {result.kunden.map((k) => (
                      <div
                        key={k.id}
                        className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0"
                      >
                        <div className="min-w-0">
                          <a
                            href={`/kunden/${k.id}`}
                            className="text-sm font-medium text-green-700 hover:underline truncate block"
                          >
                            {k.name}
                          </a>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span
                              className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${KATEGORIE_BADGE_STYLES[k.kategorie] ?? "bg-gray-100 text-gray-700"}`}
                            >
                              {k.kategorie}
                            </span>
                          </div>
                        </div>
                        <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                          {k.entfernungKm.toFixed(1)} km
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
