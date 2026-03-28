"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

interface KundeKontakt {
  id: number;
  typ: string;
  wert: string;
  label?: string;
}

interface Kunde {
  id: number;
  name: string;
  firma?: string;
  kategorie: string;
  strasse?: string;
  plz?: string;
  ort?: string;
  land: string;
  lat?: number | null;
  lng?: number | null;
  aktiv: boolean;
  kontakte: KundeKontakt[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const KATEGORIEN = ["Landwirt", "Pferdehof", "Kleintierhalter", "Großhändler", "Sonstige"] as const;

const KATEGORIE_COLORS: Record<string, string> = {
  Landwirt: "#16a34a",
  Pferdehof: "#2563eb",
  Kleintierhalter: "#ea580c",
  Großhändler: "#7c3aed",
  Sonstige: "#6b7280",
};

// Dynamic import with ssr: false — leaflet/react-leaflet require browser APIs
// Must import from a separate file (not inline require()) for Turbopack compatibility
const DynamicMap = dynamic(() => import("./LeafletMapInner"), { ssr: false });

// ─── Geocoding helpers ────────────────────────────────────────────────────────

async function geocodeAddress(kunde: Kunde): Promise<{ lat: number; lng: number } | null> {
  const parts = [kunde.strasse, kunde.plz, kunde.ort, kunde.land].filter(Boolean);
  if (parts.length === 0) return null;
  const q = encodeURIComponent(parts.join(", "));
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`,
      { headers: { "Accept-Language": "de" } }
    );
    const data = await res.json();
    if (data.length === 0) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

async function saveCoords(kundeId: number, lat: number, lng: number) {
  await fetch(`/api/kunden/${kundeId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lat, lng }),
  });
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function KundenKartePage() {
  const [alleKunden, setAlleKunden] = useState<Kunde[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleKategorien, setVisibleKategorien] = useState<Set<string>>(
    new Set(KATEGORIEN)
  );
  const [geocodingId, setGeocodingId] = useState<number | null>(null);
  const [geocodeError, setGeocodeError] = useState<Record<number, string>>({});

  const fetchKunden = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/kunden");
      const data: Kunde[] = await res.json();
      setAlleKunden(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKunden();
  }, [fetchKunden]);

  function toggleKategorie(k: string) {
    setVisibleKategorien((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  async function handleGeocode(kunde: Kunde) {
    setGeocodingId(kunde.id);
    setGeocodeError((prev) => { const n = { ...prev }; delete n[kunde.id]; return n; });
    const coords = await geocodeAddress(kunde);
    if (!coords) {
      setGeocodeError((prev) => ({ ...prev, [kunde.id]: "Adresse nicht gefunden" }));
      setGeocodingId(null);
      return;
    }
    await saveCoords(kunde.id, coords.lat, coords.lng);
    setGeocodingId(null);
    await fetchKunden();
  }

  const mitKoordinaten = alleKunden.filter((k) => k.lat != null && k.lng != null);
  const ohneKoordinaten = alleKunden.filter((k) => k.lat == null || k.lng == null);

  const countByKategorie = KATEGORIEN.reduce<Record<string, number>>((acc, k) => {
    acc[k] = mitKoordinaten.filter((c) => c.kategorie === k).length;
    return acc;
  }, {});

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/kunden" className="text-sm text-gray-500 hover:text-gray-700">Kunden</Link>
            <span className="text-gray-400">/</span>
            <span className="text-sm text-gray-700">Karte</span>
          </div>
          <h1 className="text-2xl font-bold">Kundenkarte</h1>
        </div>
        <Link
          href="/kunden"
          className="text-sm px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          ← Zurück zur Liste
        </Link>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Lade Kunden…</p>
      ) : (
        <div className="flex gap-4">
          {/* Sidebar */}
          <div className="w-56 flex-shrink-0 space-y-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Kategorien</h2>
              <div className="space-y-2">
                {KATEGORIEN.map((k) => (
                  <label key={k} className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={visibleKategorien.has(k)}
                      onChange={() => toggleKategorie(k)}
                      className="rounded"
                    />
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ background: KATEGORIE_COLORS[k] }}
                    />
                    <span className="text-sm text-gray-700 group-hover:text-gray-900">
                      {k}
                    </span>
                    <span className="ml-auto text-xs text-gray-400">{countByKategorie[k] ?? 0}</span>
                  </label>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
                {mitKoordinaten.length} von {alleKunden.length} Kunden auf der Karte
              </div>
            </div>
          </div>

          {/* Map */}
          <div className="flex-1 min-w-0 space-y-4">
            <div
              className="rounded-xl overflow-hidden border border-gray-200 shadow-sm"
              style={{ height: "520px" }}
            >
              <DynamicMap
                kunden={alleKunden}
                visibleKategorien={visibleKategorien}
                onGeocoded={fetchKunden}
              />
            </div>

            {/* Customers without coordinates */}
            {ohneKoordinaten.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">
                  Kunden ohne Koordinaten ({ohneKoordinaten.length})
                </h2>
                <div className="space-y-2">
                  {ohneKoordinaten.map((k) => {
                    const adresse = [k.strasse, k.plz, k.ort].filter(Boolean).join(", ");
                    return (
                      <div
                        key={k.id}
                        className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/kunden/${k.id}`}
                              className="text-sm font-medium text-green-700 hover:underline"
                            >
                              {k.name}
                            </Link>
                            <KategorieBadge kategorie={k.kategorie} />
                          </div>
                          {adresse ? (
                            <p className="text-xs text-gray-500 mt-0.5">{adresse}</p>
                          ) : (
                            <p className="text-xs text-red-400 mt-0.5">Keine Adresse erfasst</p>
                          )}
                          {geocodeError[k.id] && (
                            <p className="text-xs text-red-500 mt-0.5">{geocodeError[k.id]}</p>
                          )}
                        </div>
                        <button
                          onClick={() => handleGeocode(k)}
                          disabled={geocodingId === k.id || !adresse}
                          className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ml-4 flex-shrink-0"
                          title={!adresse ? "Keine Adresse zum Geocodieren vorhanden" : "Adresse geocodieren"}
                        >
                          {geocodingId === k.id ? "Suche…" : "Adresse geocodieren"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function KategorieBadge({ kategorie }: { kategorie: string }) {
  const styles: Record<string, string> = {
    Landwirt: "bg-green-100 text-green-800",
    Pferdehof: "bg-blue-100 text-blue-800",
    Kleintierhalter: "bg-orange-100 text-orange-800",
    Großhändler: "bg-purple-100 text-purple-800",
    Sonstige: "bg-gray-100 text-gray-700",
  };
  const cls = styles[kategorie] ?? "bg-gray-100 text-gray-700";
  return (
    <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {kategorie}
    </span>
  );
}
