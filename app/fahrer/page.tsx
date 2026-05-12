"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { formatDatum } from "@/lib/utils";

interface Artikel {
  name: string;
  einheit: string;
  kategorie?: string | null;
}

interface Position {
  id: number;
  menge: number;
  chargeNr?: string | null;
  artikel: Artikel;
}

interface Kunde {
  id: number;
  name: string;
  firma?: string | null;
  strasse?: string | null;
  plz?: string | null;
  ort?: string | null;
}

interface Lieferung {
  id: number;
  datum: string;
  status: string;
  notiz?: string | null;
  lieferadresse?: string | null;
  kunde: Kunde;
  positionen: Position[];
}

function adresse(l: Lieferung): string {
  if (l.lieferadresse) return l.lieferadresse;
  const k = l.kunde;
  return [k.strasse, [k.plz, k.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ");
}

function mapsUrl(l: Lieferung): string {
  const addr = adresse(l);
  return `https://maps.google.com/?q=${encodeURIComponent(addr)}`;
}

interface GpsPosition {
  lat: number;
  lng: number;
  genauigkeit: number | null;
  zeitpunkt: string;
}

export default function FahrerCockpit() {
  const [lieferungen, setLieferungen] = useState<Lieferung[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [successId, setSuccessId] = useState<number | null>(null);

  // GPS-Tracking
  const [gpsAktiv, setGpsAktiv] = useState(false);
  const [letztePosition, setLetztePosition] = useState<GpsPosition | null>(null);
  const [gpsFehler, setGpsFehler] = useState("");
  const [gpsSending, setGpsSending] = useState(false);
  const [gpsAutoAktiv, setGpsAutoAktiv] = useState(false);
  const gpsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const geolocationVerfuegbar =
    typeof navigator !== "undefined" && !!navigator.geolocation;

  const lade = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const heute = new Date();
      const vonStr = new Date(heute.getFullYear(), heute.getMonth(), heute.getDate()).toISOString();
      const bisStr = new Date(heute.getFullYear(), heute.getMonth(), heute.getDate(), 23, 59, 59, 999).toISOString();
      const res = await fetch(`/api/lieferungen?status=geplant&von=${encodeURIComponent(vonStr)}&bis=${encodeURIComponent(bisStr)}&limit=100`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Fehler beim Laden der Lieferungen");
      }
      const data: Lieferung[] = await res.json();
      setLieferungen(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    lade();
  }, [lade]);

  async function markiereGeliefert(id: number) {
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/lieferungen/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "geliefert" }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error ?? "Fehler beim Aktualisieren des Status");
        return;
      }
      setSuccessId(id);
      setTimeout(() => {
        setSuccessId(null);
        lade();
      }, 1200);
    } catch {
      alert("Netzwerkfehler – bitte nochmal versuchen");
    } finally {
      setUpdatingId(null);
    }
  }

  // GPS: Position einmalig senden
  const sendPosition = useCallback(async (tourname?: string) => {
    if (!geolocationVerfuegbar) return;
    setGpsSending(true);
    setGpsFehler("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng, accuracy: genauigkeit } = pos.coords;
        setLetztePosition({ lat, lng, genauigkeit, zeitpunkt: new Date().toISOString() });
        setGpsAktiv(true);
        try {
          const res = await fetch("/api/fahrer/position", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lat, lng, genauigkeit, tourname }),
          });
          if (!res.ok) {
            const d = await res.json().catch(() => ({}));
            setGpsFehler(d.error ?? "Fehler beim Senden der Position");
          }
        } catch {
          setGpsFehler("Netzwerkfehler beim Senden der Position");
        } finally {
          setGpsSending(false);
        }
      },
      (err) => {
        setGpsFehler(`GPS-Fehler: ${err.message}`);
        setGpsSending(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  }, [geolocationVerfuegbar]);

  // GPS: Auto-Intervall (5 Minuten)
  const toggleAutoGps = useCallback(() => {
    if (gpsAutoAktiv) {
      if (gpsIntervalRef.current) clearInterval(gpsIntervalRef.current);
      gpsIntervalRef.current = null;
      setGpsAutoAktiv(false);
    } else {
      setGpsAutoAktiv(true);
      sendPosition();
      gpsIntervalRef.current = setInterval(() => sendPosition(), 5 * 60 * 1000);
    }
  }, [gpsAutoAktiv, sendPosition]);

  // GPS: Abmelden
  const gpsDeaktivieren = useCallback(async () => {
    if (gpsIntervalRef.current) clearInterval(gpsIntervalRef.current);
    gpsIntervalRef.current = null;
    setGpsAutoAktiv(false);
    setGpsAktiv(false);
    setLetztePosition(null);
    try {
      await fetch("/api/fahrer/position", { method: "DELETE" });
    } catch { /* ignore */ }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (gpsIntervalRef.current) clearInterval(gpsIntervalRef.current);
    };
  }, []);

  const heute = new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Kompakter Header */}
      <div className="bg-green-800 text-white px-4 py-4 shadow-md sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <svg className="w-6 h-6 text-green-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l3.293-.293A1 1 0 017 15h6m0 0v1m0-1h3l3-3V9a1 1 0 00-1-1h-3M7 16H4m9 0h3" />
              </svg>
              <h1 className="text-xl font-bold">Fahrer-Cockpit</h1>
            </div>
            <p className="text-green-200 text-sm mt-0.5">{heute}</p>
          </div>
          <button
            onClick={lade}
            disabled={loading}
            className="p-2.5 bg-green-700 hover:bg-green-600 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
            title="Aktualisieren"
          >
            <svg className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4">

        {/* GPS-Status-Card */}
        <div className="mb-4 bg-white rounded-2xl shadow-sm border-2 border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              GPS-Tracking
            </h2>
            <span className={`text-sm font-semibold flex items-center gap-1.5 ${gpsAktiv ? "text-green-600" : "text-gray-400"}`}>
              <span className={`inline-block w-2 h-2 rounded-full ${gpsAktiv ? "bg-green-500" : "bg-gray-300"}`} />
              {gpsAktiv ? "GPS aktiv" : "GPS inaktiv"}
            </span>
          </div>

          {!geolocationVerfuegbar ? (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              GPS nicht verfügbar in diesem Browser.
            </p>
          ) : (
            <>
              {letztePosition && (
                <div className="mb-3 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                  <div>
                    <span className="font-medium text-gray-700">Letzter Standort:</span>{" "}
                    {letztePosition.lat.toFixed(5)}, {letztePosition.lng.toFixed(5)}
                    {letztePosition.genauigkeit !== null && (
                      <span className="text-gray-400"> (±{Math.round(letztePosition.genauigkeit)} m)</span>
                    )}
                  </div>
                  <div className="mt-0.5 text-gray-400">
                    {new Date(letztePosition.zeitpunkt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} Uhr
                  </div>
                </div>
              )}

              {gpsFehler && (
                <p className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {gpsFehler}
                </p>
              )}

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => sendPosition()}
                  disabled={gpsSending}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-medium rounded-xl transition-colors text-sm"
                >
                  {gpsSending ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Wird gesendet…
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Position senden
                    </>
                  )}
                </button>

                <button
                  onClick={toggleAutoGps}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 font-medium rounded-xl transition-colors text-sm border-2 ${
                    gpsAutoAktiv
                      ? "bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100"
                      : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {gpsAutoAktiv ? "Auto: An (5 Min.)" : "Automatisch alle 5 Min."}
                </button>

                {gpsAktiv && (
                  <button
                    onClick={gpsDeaktivieren}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-red-50 hover:bg-red-100 border-2 border-red-200 text-red-700 font-medium rounded-xl transition-colors text-sm"
                    title="GPS deaktivieren und Schicht beenden"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Schicht beenden
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Fehlerhinweis */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl text-sm">
            {error}
            <button onClick={lade} className="ml-3 underline font-medium">Nochmal laden</button>
          </div>
        )}

        {/* Ladeindikator */}
        {loading && !error && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <svg className="w-8 h-8 animate-spin text-green-600 mb-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span>Lade heutige Lieferungen…</span>
          </div>
        )}

        {/* Keine Lieferungen */}
        {!loading && !error && lieferungen.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <svg className="w-14 h-14 text-green-200 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-lg font-semibold text-gray-700">Alle erledigt!</p>
            <p className="text-sm mt-1">Keine offenen Lieferungen für heute.</p>
          </div>
        )}

        {/* Zähler */}
        {!loading && lieferungen.length > 0 && (
          <div className="mb-3 flex items-center gap-2 text-sm text-gray-600">
            <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-800 font-semibold px-3 py-1 rounded-full">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {lieferungen.length} {lieferungen.length === 1 ? "Lieferung" : "Lieferungen"} ausstehend
            </span>
          </div>
        )}

        {/* Lieferungs-Karten */}
        {!loading && !error && (
          <div className="flex flex-col gap-4">
            {lieferungen.map((l) => {
              const istErfolgreich = successId === l.id;
              const wirdAktualisiert = updatingId === l.id;
              const addr = adresse(l);

              return (
                <div
                  key={l.id}
                  className={`bg-white rounded-2xl shadow-sm border-2 transition-all duration-300 overflow-hidden ${
                    istErfolgreich
                      ? "border-green-400 bg-green-50"
                      : "border-gray-200"
                  }`}
                >
                  {/* Kopfzeile */}
                  <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                          #{l.id}
                        </span>
                        <span className="text-xs text-gray-500">{formatDatum(l.datum)}</span>
                      </div>
                      <h2 className="text-lg font-bold text-gray-900 mt-1 leading-tight">
                        {l.kunde.firma ?? l.kunde.name}
                      </h2>
                      {l.kunde.firma && l.kunde.firma !== l.kunde.name && (
                        <p className="text-sm text-gray-500">{l.kunde.name}</p>
                      )}
                    </div>
                  </div>

                  {/* Adresse */}
                  {addr && (
                    <div className="px-4 pb-2">
                      <a
                        href={mapsUrl(l)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-start gap-2 text-sm text-blue-700 hover:text-blue-800 hover:underline"
                      >
                        <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="whitespace-pre-line">{addr}</span>
                      </a>
                    </div>
                  )}

                  {/* Artikel-Positionen */}
                  <div className="px-4 pb-3">
                    <div className="bg-gray-50 rounded-xl divide-y divide-gray-100 border border-gray-100">
                      {l.positionen.length === 0 && (
                        <div className="px-3 py-2 text-sm text-gray-400 italic">Keine Positionen</div>
                      )}
                      {l.positionen.map((pos) => (
                        <div key={pos.id} className="flex items-center justify-between gap-2 px-3 py-2.5">
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-gray-800 leading-tight block truncate">
                              {pos.artikel.name}
                            </span>
                            {pos.chargeNr && (
                              <span className="text-xs text-gray-400 font-mono">Charge: {pos.chargeNr}</span>
                            )}
                          </div>
                          <div className="flex-shrink-0 text-right">
                            <span className="text-base font-bold text-gray-900">
                              {pos.menge.toLocaleString("de-DE")}
                            </span>
                            <span className="text-sm text-gray-500 ml-1">{pos.artikel.einheit}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Notiz */}
                  {l.notiz && (
                    <div className="px-4 pb-3">
                      <div className="text-xs text-gray-500 uppercase tracking-wide mb-1 font-medium">Hinweis</div>
                      <p className="text-sm text-gray-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 whitespace-pre-line">
                        {l.notiz}
                      </p>
                    </div>
                  )}

                  {/* Aktions-Zeile */}
                  <div className="px-4 pb-4 flex gap-3">
                    <a
                      href={`/lieferungen/${l.id}/lieferschein`}
                      className="flex-1 flex items-center justify-center gap-2 min-h-[52px] px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors text-sm"
                    >
                      <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Lieferschein
                    </a>

                    {istErfolgreich ? (
                      <div className="flex-1 flex items-center justify-center gap-2 min-h-[52px] px-4 py-3 bg-green-600 text-white font-semibold rounded-xl text-sm">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Geliefert!
                      </div>
                    ) : (
                      <button
                        onClick={() => markiereGeliefert(l.id)}
                        disabled={wirdAktualisiert}
                        className="flex-1 flex items-center justify-center gap-2 min-h-[52px] px-4 py-3 bg-green-700 hover:bg-green-600 active:bg-green-800 disabled:opacity-60 text-white font-semibold rounded-xl transition-colors text-sm"
                      >
                        {wirdAktualisiert ? (
                          <>
                            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                            </svg>
                            Wird gesetzt…
                          </>
                        ) : (
                          <>
                            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Als geliefert markieren
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
