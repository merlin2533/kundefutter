"use client";
import { useEffect, useState } from "react";
import { WetterTag } from "@/lib/weather";

interface Props {
  lat: number;
  lng: number;
  compact?: boolean;
}

type AusbringungStatus = "geeignet" | "bedingt" | "ungeeignet";

interface CurrentWetter {
  temperatur: number;
  wind: number; // m/s
  niederschlag: number; // mm
  wetterCode: number;
  icon: string;
  beschreibung: string;
}

function berechneAusbringung(tag: WetterTag, wind?: number): AusbringungStatus {
  const regen = tag.niederschlag;
  const maxTemp = tag.maxTemp;
  const minTemp = tag.minTemp;
  const windMs = wind ?? 0;

  if (windMs > 5 || regen > 0) return "ungeeignet";
  if (windMs > 3 || maxTemp > 25 || minTemp < 10) return "bedingt";
  return "geeignet";
}

function AusbringungAmpel({ status }: { status: AusbringungStatus }) {
  if (status === "geeignet") {
    return (
      <div className="flex items-center gap-1.5 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
        <span className="text-base">✅</span>
        <span>Ausbringung geeignet</span>
      </div>
    );
  }
  if (status === "bedingt") {
    return (
      <div className="flex items-center gap-1.5 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        <span className="text-base">⚠️</span>
        <span>Ausbringung bedingt geeignet</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
      <span className="text-base">❌</span>
      <span>Ausbringung nicht geeignet</span>
    </div>
  );
}

function formatDatum(datum: string): string {
  const d = new Date(datum + "T12:00:00");
  return d.toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" });
}

export default function WetterWidget({ lat, lng, compact = false }: Props) {
  const [tage, setTage] = useState<WetterTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetch(`/api/wetter?lat=${lat}&lng=${lng}`)
      .then((r) => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        setTage(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [lat, lng]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
        <span className="animate-spin inline-block w-4 h-4 border-2 border-gray-300 border-t-green-600 rounded-full" />
        Wetterdaten laden…
      </div>
    );
  }

  if (error || tage.length === 0) {
    return (
      <p className="text-sm text-gray-400 italic">Wetter nicht verfügbar</p>
    );
  }

  const heute = tage[0];

  if (compact) {
    // Compact view for PSM: current conditions + suitability badge
    const ausbringung = berechneAusbringung(heute);
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{heute.icon}</span>
            <div>
              <p className="text-sm font-medium text-gray-800">
                {heute.beschreibung} · {heute.maxTemp}°C / {heute.minTemp}°C
              </p>
              <p className="text-xs text-gray-500">
                Niederschlag: {heute.niederschlag} mm
              </p>
            </div>
          </div>
          <AusbringungAmpel status={ausbringung} />
        </div>
      </div>
    );
  }

  // Full view: 3-day preview
  const vorschau = tage.slice(0, 3);

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
      <p className="text-xs font-semibold text-blue-700 mb-2 uppercase tracking-wide">Wetter (3-Tage-Vorschau)</p>
      <div className="grid grid-cols-3 gap-2">
        {vorschau.map((tag) => (
          <div
            key={tag.datum}
            className="bg-white border border-blue-100 rounded-lg p-2 text-center space-y-1"
          >
            <p className="text-xs text-gray-500 font-medium">{formatDatum(tag.datum)}</p>
            <p className="text-2xl">{tag.icon}</p>
            <p className="text-xs text-gray-700 leading-tight">{tag.beschreibung}</p>
            <p className="text-xs font-semibold text-gray-800">
              {tag.maxTemp}° / {tag.minTemp}°
            </p>
            {tag.niederschlag > 0 && (
              <p className="text-xs text-blue-600">{tag.niederschlag} mm</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
