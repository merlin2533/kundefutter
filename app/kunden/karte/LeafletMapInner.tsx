"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
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

interface Kunde {
  id: number;
  name: string;
  firma?: string;
  kategorie: string;
  plz?: string;
  ort?: string;
  land: string;
  lat?: number | null;
  lng?: number | null;
}

interface Props {
  kunden: Kunde[];
  visibleKategorien: Set<string>;
  onGeocoded: () => void;
}

export default function LeafletMapInner({ kunden, visibleKategorien }: Props) {
  const visible = kunden.filter(
    (k) => k.lat != null && k.lng != null && visibleKategorien.has(k.kategorie)
  );

  return (
    <MapContainer
      center={[51.5, 10.0]}
      zoom={6}
      style={{ height: "100%", width: "100%" }}
      className="rounded-xl"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {visible.map((k) => (
        <Marker
          key={k.id}
          position={[k.lat!, k.lng!]}
          icon={makeIcon(KATEGORIE_COLORS[k.kategorie] ?? KATEGORIE_COLORS.Sonstige)}
        >
          <Popup>
            <div className="text-sm min-w-[160px]">
              <p className="font-semibold text-gray-800">{k.name}</p>
              {k.firma && <p className="text-gray-500 text-xs">{k.firma}</p>}
              <p className="text-gray-500 text-xs mt-1">
                {[k.plz, k.ort].filter(Boolean).join(" ") || k.land}
              </p>
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
