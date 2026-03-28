"use client";

import { MapContainer, TileLayer, Marker, Popup, Circle, GeoJSON, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default icon
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const KATEGORIE_COLORS: Record<string, string> = {
  Landwirt: "#16a34a",
  Pferdehof: "#2563eb",
  Kleintierhalter: "#ea580c",
  Großhändler: "#7c3aed",
  Sonstige: "#6b7280",
};

function makeIcon(color: string) {
  return L.divIcon({
    className: "",
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

function makeCenterIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="width:18px;height:18px;border-radius:50%;background:#dc2626;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.5);"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

export interface KundeMarker {
  id: number;
  name: string;
  entfernungKm: number;
  kategorie: string;
  lat?: number | null;
  lng?: number | null;
}

interface Props {
  center: [number, number] | null;
  radiusKm: number;
  kunden: KundeMarker[];
  geojson: GeoJSON.FeatureCollection | null;
  onMapClick: (lat: number, lng: number) => void;
}

function ClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function GebietsMap({ center, radiusKm, kunden, geojson, onMapClick }: Props) {
  const kundenMitKoords = kunden.filter((k) => k.lat != null && k.lng != null);

  return (
    <MapContainer
      center={center ?? [51.5, 10.0]}
      zoom={center ? 11 : 6}
      style={{ height: "100%", width: "100%" }}
      className="rounded-xl"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickHandler onClick={onMapClick} />

      {geojson && geojson.features.length > 0 && (
        <GeoJSON
          key={JSON.stringify(center) + radiusKm}
          data={geojson}
          style={{
            fillColor: "#22c55e",
            fillOpacity: 0.25,
            color: "#16a34a",
            weight: 1,
          }}
        />
      )}

      {center && (
        <>
          <Circle
            center={center}
            radius={radiusKm * 1000}
            pathOptions={{
              color: "#2563eb",
              weight: 2,
              dashArray: "8 4",
              fillColor: "#2563eb",
              fillOpacity: 0.05,
            }}
          />
          <Marker position={center} icon={makeCenterIcon()}>
            <Popup>
              <div className="text-sm">
                <p className="font-semibold text-gray-800">Analysezentrum</p>
                <p className="text-xs text-gray-500">
                  {center[0].toFixed(5)}, {center[1].toFixed(5)}
                </p>
              </div>
            </Popup>
          </Marker>
        </>
      )}

      {kundenMitKoords.map((k) => (
        <Marker
          key={k.id}
          position={[k.lat!, k.lng!]}
          icon={makeIcon(KATEGORIE_COLORS[k.kategorie] ?? KATEGORIE_COLORS.Sonstige)}
        >
          <Popup>
            <div className="text-sm min-w-[160px]">
              <p className="font-semibold text-gray-800">{k.name}</p>
              <p className="text-xs text-gray-500 mt-1">{k.entfernungKm.toFixed(1)} km entfernt</p>
              <p className="text-xs mt-1">
                <span
                  className="inline-block px-1.5 py-0.5 rounded-full text-white text-xs"
                  style={{ background: KATEGORIE_COLORS[k.kategorie] ?? "#6b7280" }}
                >
                  {k.kategorie}
                </span>
              </p>
              <a
                href={`/kunden/${k.id}`}
                className="text-green-700 hover:underline text-xs mt-2 inline-block font-medium"
              >
                Details →
              </a>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
