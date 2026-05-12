"use client";
import { useEffect, useState, useCallback, useRef } from "react";

interface FahrerPosition {
  benutzerId: number;
  lat: number;
  lng: number;
  genauigkeit: number | null;
  zeitpunkt: string;
  name: string;
  tourname: string | null;
}

function minutenVor(zeitpunkt: string): string {
  const diff = Math.floor((Date.now() - new Date(zeitpunkt).getTime()) / 1000);
  if (diff < 60) return `vor ${diff} Sek.`;
  if (diff < 3600) return `vor ${Math.floor(diff / 60)} Min.`;
  return `vor ${Math.floor(diff / 3600)} Std. ${Math.floor((diff % 3600) / 60)} Min.`;
}

export default function FahrerStandortePage() {
  const [positionen, setPositionen] = useState<FahrerPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [fehler, setFehler] = useState("");
  const [letzteAktualisierung, setLetzteAktualisierung] = useState<Date | null>(null);
  const [, setTick] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const laden = useCallback(async () => {
    setFehler("");
    try {
      const res = await fetch("/api/fahrer/position");
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Fehler beim Laden der Fahrer-Positionen");
      }
      const data = await res.json();
      setPositionen(Array.isArray(data) ? data : []);
      setLetzteAktualisierung(new Date());
    } catch (err) {
      setFehler(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    laden();
    // Auto-Refresh alle 60 Sekunden
    intervalRef.current = setInterval(laden, 60 * 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [laden]);

  // Sekundenweises Tick-Update für relative Zeitanzeige
  useEffect(() => {
    const tick = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(tick);
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Fahrer-Standorte</h1>
            {letzteAktualisierung && (
              <p className="text-xs text-gray-500 mt-0.5">
                Aktualisiert: {letzteAktualisierung.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} Uhr &middot; Auto-Refresh alle 60 Sek.
              </p>
            )}
          </div>
        </div>
        <button
          onClick={laden}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <svg className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Aktualisieren
        </button>
      </div>

      {fehler && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl text-sm flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {fehler}
        </div>
      )}

      {loading && !fehler && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <svg className="w-8 h-8 animate-spin text-green-600 mb-3" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span className="text-sm">Lade Fahrer-Standorte…</span>
        </div>
      )}

      {!loading && !fehler && positionen.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <svg className="w-16 h-16 text-gray-200 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-lg font-semibold text-gray-600 mb-1">Keine aktiven Fahrer</p>
          <p className="text-sm text-gray-400 text-center max-w-xs">
            Es sind derzeit keine Fahrer-Positionen gemeldet (oder alle Positionen sind &auml;lter als 4 Stunden).
          </p>
        </div>
      )}

      {!loading && positionen.length > 0 && (
        <>
          <div className="mb-4 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 bg-green-100 text-green-800 font-semibold px-3 py-1 rounded-full text-sm">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              {positionen.length} {positionen.length === 1 ? "aktiver Fahrer" : "aktive Fahrer"}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {positionen.map((pos) => {
              const mapsUrl = `https://www.google.com/maps?q=${pos.lat},${pos.lng}`;
              const alterMin = Math.floor((Date.now() - new Date(pos.zeitpunkt).getTime()) / 60000);
              const istFrisch = alterMin < 10;

              return (
                <div
                  key={pos.benutzerId}
                  className="bg-white rounded-2xl shadow-sm border-2 border-gray-100 p-5 flex flex-col gap-3"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-700 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {pos.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900 leading-tight">{pos.name}</div>
                        {pos.tourname && (
                          <div className="text-xs text-green-700 font-medium mt-0.5">{pos.tourname}</div>
                        )}
                      </div>
                    </div>
                    <span
                      className={`flex-shrink-0 flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
                        istFrisch
                          ? "bg-green-50 text-green-700 border border-green-200"
                          : "bg-amber-50 text-amber-700 border border-amber-200"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${istFrisch ? "bg-green-500" : "bg-amber-500"}`} />
                      {istFrisch ? "Aktuell" : "Alt"}
                    </span>
                  </div>

                  {/* Koordinaten */}
                  <div className="bg-gray-50 rounded-xl px-4 py-3 text-xs font-mono text-gray-600">
                    <div className="flex items-center justify-between">
                      <span>
                        {pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}
                      </span>
                      {pos.genauigkeit !== null && (
                        <span className="text-gray-400">±{Math.round(pos.genauigkeit)} m</span>
                      )}
                    </div>
                  </div>

                  {/* Zeitstempel */}
                  <div className="text-xs text-gray-500 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>
                      {new Date(pos.zeitpunkt).toLocaleTimeString("de-DE", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}{" "}
                      Uhr &middot; {minutenVor(pos.zeitpunkt)}
                    </span>
                  </div>

                  {/* Google Maps Link */}
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    In Google Maps &ouml;ffnen
                  </a>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Hinweis */}
      <div className="mt-8 p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-700">
        <div className="flex items-start gap-2">
          <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <strong>Hinweis:</strong> Fahrer k&ouml;nnen ihre Position im{" "}
            <a href="/fahrer" className="underline hover:text-blue-900 font-medium">
              Fahrer-Cockpit
            </a>{" "}
            manuell oder automatisch (alle 5 Minuten) senden. Positionen &auml;lter als 4 Stunden werden automatisch ausgeblendet.
          </div>
        </div>
      </div>
    </div>
  );
}
