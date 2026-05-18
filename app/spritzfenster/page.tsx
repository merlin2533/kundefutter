"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

interface KundeOption {
  id: number;
  name: string;
  firma: string | null;
  lat: number | null;
  lng: number | null;
}

interface SpritzStunde {
  datetime: string;
  temp: number;
  wind: number;
  precipitation: number;
  humidity: number;
  ampel: "gruen" | "gelb" | "rot";
  gruende: string[];
}

interface TagDaten {
  datum: string;
  tag: string;
  stunden: SpritzStunde[];
  optimaleZeitraeume: string;
}

const AMPEL_ICON: Record<string, string> = { gruen: "🟢", gelb: "🟡", rot: "🔴" };
const AMPEL_BG: Record<string, string> = {
  gruen: "bg-green-50",
  gelb: "bg-amber-50",
  rot: "bg-red-50",
};
const AMPEL_TEXT: Record<string, string> = {
  gruen: "text-green-700",
  gelb: "text-amber-700",
  rot: "text-red-600",
};

function tagName(dateStr: string): string {
  const d = new Date(dateStr);
  const heute = new Date();
  const morgen = new Date(heute);
  morgen.setDate(morgen.getDate() + 1);
  if (d.toDateString() === heute.toDateString()) return "Heute";
  if (d.toDateString() === morgen.toDateString()) return "Morgen";
  return d.toLocaleDateString("de-DE", { weekday: "long" });
}

function gruppiereNachTag(stunden: SpritzStunde[]): TagDaten[] {
  const map = new Map<string, SpritzStunde[]>();
  for (const s of stunden) {
    const datum = s.datetime.slice(0, 10);
    if (!map.has(datum)) map.set(datum, []);
    map.get(datum)!.push(s);
  }

  return Array.from(map.entries()).map(([datum, tagStunden]) => {
    // Optimale Zeiträume berechnen
    const optimalStunden = tagStunden.filter((s) => s.ampel === "gruen");
    let optimaleZeitraeume = "Kein optimales Fenster";
    if (optimalStunden.length > 0) {
      // Zusammenhängende Blöcke finden
      const ranges: string[] = [];
      let start: string | null = null;
      let prev: string | null = null;
      for (const s of optimalStunden) {
        const h = s.datetime.slice(11, 16);
        if (!start) { start = h; prev = h; }
        else {
          const prevH = parseInt(prev!.slice(0, 2), 10);
          const currH = parseInt(h.slice(0, 2), 10);
          if (currH - prevH > 1) {
            ranges.push(`${start}–${prev}`);
            start = h;
          }
          prev = h;
        }
      }
      if (start && prev) ranges.push(`${start}–${prev}`);
      optimaleZeitraeume = ranges.join(", ");
    }

    return { datum, tag: tagName(datum), stunden: tagStunden, optimaleZeitraeume };
  });
}

function SpritzfensterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [kundeSearch, setKundeSearch] = useState("");
  const [kundeOptions, setKundeOptions] = useState<KundeOption[]>([]);
  const [selectedKunde, setSelectedKunde] = useState<KundeOption | null>(null);
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");
  const [loading, setLoading] = useState(false);
  const [tage, setTage] = useState<TagDaten[]>([]);
  const [error, setError] = useState("");

  // Load kunde options on search
  useEffect(() => {
    if (kundeSearch.length < 2) { setKundeOptions([]); return; }
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/kunden?search=${encodeURIComponent(kundeSearch)}&limit=10`);
      if (!res.ok) return;
      const d = await res.json();
      const list: KundeOption[] = Array.isArray(d) ? d : (d.kunden ?? []);
      setKundeOptions(list.filter((k) => k.lat && k.lng));
    }, 200);
    return () => clearTimeout(timer);
  }, [kundeSearch]);

  async function laden(lat: number, lng: number) {
    setLoading(true);
    setError("");
    setTage([]);
    try {
      const res = await fetch(`/api/psm/spritzfenster?lat=${lat}&lng=${lng}`);
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Fehler beim Laden");
        return;
      }
      const stunden: SpritzStunde[] = await res.json();
      setTage(gruppiereNachTag(stunden));
    } finally {
      setLoading(false);
    }
  }

  function handleKundeSelect(k: KundeOption) {
    setSelectedKunde(k);
    setKundeSearch(k.firma ?? k.name);
    setKundeOptions([]);
    if (k.lat && k.lng) {
      laden(k.lat, k.lng);
    }
  }

  function handleManualSearch() {
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);
    if (isNaN(lat) || isNaN(lng)) {
      setError("Ungültige Koordinaten");
      return;
    }
    setSelectedKunde(null);
    laden(lat, lng);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">Spritzfenster-Prognose</h1>
          <p className="text-sm text-gray-500 mt-0.5">3-Tage-Vorhersage für PSM-Ausbringung</p>
        </div>
      </div>

      {/* Hinweis */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5 text-sm text-amber-800">
        Orientierungswerte. Aktuelle Windrichtung, lokale Gegebenheiten und geltende Pflanzenschutz-Vorschriften beachten.
        Kein Ersatz für fachliche Beratung.
      </div>

      {/* Eingabe */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Kundenauswahl */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Kunde (Geocoordinaten aus Kundenstamm)
            </label>
            <div className="relative">
              <input
                type="text"
                value={kundeSearch}
                onChange={(e) => { setKundeSearch(e.target.value); setSelectedKunde(null); }}
                placeholder="Kundenname suchen…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              {kundeOptions.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10 mt-1 max-h-40 overflow-y-auto">
                  {kundeOptions.map((k) => (
                    <button
                      key={k.id}
                      onClick={() => handleKundeSelect(k)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-green-50 border-b border-gray-50 last:border-0"
                    >
                      {k.firma ?? k.name}
                      <span className="text-gray-400 ml-2 text-xs">{k.lat?.toFixed(4)}, {k.lng?.toFixed(4)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Manuelle Koordinaten */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Oder manuelle Koordinaten
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={manualLat}
                onChange={(e) => setManualLat(e.target.value)}
                placeholder="Breite (z.B. 51.5)"
                step="0.0001"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <input
                type="number"
                value={manualLng}
                onChange={(e) => setManualLng(e.target.value)}
                placeholder="Länge (z.B. 9.8)"
                step="0.0001"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <button
                onClick={handleManualSearch}
                className="px-4 py-2 bg-green-700 hover:bg-green-800 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
              >
                Laden
              </button>
            </div>
          </div>
        </div>
      </div>

      {loading && (
        <p className="text-center text-gray-400 text-sm mt-8">Lade Wetterdaten…</p>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>
      )}

      {/* Tages-Cards */}
      <div className="space-y-6">
        {tage.map((tag) => (
          <div key={tag.datum} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between">
              <div>
                <span className="font-semibold text-gray-800">{tag.tag}</span>
                <span className="text-gray-500 ml-2 text-sm">
                  {new Date(tag.datum).toLocaleDateString("de-DE", { weekday: undefined, day: "2-digit", month: "2-digit", year: "numeric" })}
                </span>
              </div>
              <div className="text-sm">
                <span className="text-gray-500">Optimal: </span>
                <span className={`font-medium ${tag.optimaleZeitraeume === "Kein optimales Fenster" ? "text-red-600" : "text-green-700"}`}>
                  {tag.optimaleZeitraeume}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-3 py-2 font-semibold text-gray-500 w-14">Uhr</th>
                    <th className="text-right px-3 py-2 font-semibold text-gray-500">Temp</th>
                    <th className="text-right px-3 py-2 font-semibold text-gray-500">Wind</th>
                    <th className="text-right px-3 py-2 font-semibold text-gray-500">Regen</th>
                    <th className="text-right px-3 py-2 font-semibold text-gray-500">Feuchte</th>
                    <th className="px-3 py-2 font-semibold text-gray-500 text-center">Prognose</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-500 hidden sm:table-cell">Hinweis</th>
                  </tr>
                </thead>
                <tbody>
                  {tag.stunden.map((s) => (
                    <tr key={s.datetime} className={`border-b border-gray-50 ${AMPEL_BG[s.ampel]}`}>
                      <td className="px-3 py-2 font-mono text-gray-700 font-medium">
                        {s.datetime.slice(11, 16)}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-700">{s.temp}°C</td>
                      <td className="px-3 py-2 text-right text-gray-700">{s.wind} m/s</td>
                      <td className="px-3 py-2 text-right text-gray-700">{s.precipitation} mm</td>
                      <td className="px-3 py-2 text-right text-gray-700">{s.humidity}%</td>
                      <td className="px-3 py-2 text-center">
                        <span title={s.gruende.join(", ")}>{AMPEL_ICON[s.ampel]}</span>
                      </td>
                      <td className={`px-3 py-2 hidden sm:table-cell ${AMPEL_TEXT[s.ampel]}`}>
                        {s.gruende.join(" · ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {tage.length > 0 && (
        <div className="flex items-center gap-4 mt-4 text-xs text-gray-500 justify-center">
          <span>{AMPEL_ICON.gruen} Ausbringbar</span>
          <span>{AMPEL_ICON.gelb} Bedingt ausbringbar</span>
          <span>{AMPEL_ICON.rot} Nicht ausbringbar</span>
        </div>
      )}
    </div>
  );
}

export default function SpritzfensterPage() {
  return (
    <Suspense fallback={<p className="text-gray-400 text-sm mt-8">Lade…</p>}>
      <SpritzfensterContent />
    </Suspense>
  );
}
