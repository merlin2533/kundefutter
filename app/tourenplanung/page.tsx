"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Card } from "@/components/Card";
import { formatDatum } from "@/lib/utils";
import SearchableSelect from "@/components/SearchableSelect";

interface Kontakt { typ: string; wert: string; }
interface Artikel { id: number; name: string; einheit: string; standardpreis: number; einkaufspreis?: number; }
interface Position { menge: number; artikel: { name: string; einheit: string } }
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

interface KundeOption {
  id: number;
  name: string;
  firma?: string;
}

interface BesuchKunde {
  id: number;
  name: string;
  firma: string | null;
  plz: string | null;
  ort: string | null;
  strasse: string | null;
  lat: number | null;
  lng: number | null;
}

interface Besuchstermin {
  id: number;
  kundeId: number;
  datum: string;
  betreff: string;
  inhalt: string | null;
  kunde: BesuchKunde;
}

function heuteISO() { return new Date().toISOString().slice(0, 10); }

interface TourStop {
  id: number;
  kundeName: string;
  adresse: string;
  artikel: string;
  menge: string;
  einheit: string;
  notiz: string;
}

const thStyle: React.CSSProperties = { border: '1px solid #ccc', padding: '6px 8px', textAlign: 'left', background: '#f0fdf4' };
const tdStyle: React.CSSProperties = { border: '1px solid #ddd', padding: '6px 8px', verticalAlign: 'top' };

function TourHandzettel({
  tourname,
  datum,
  stops,
}: {
  tourname: string;
  datum: string;
  stops: TourStop[];
}) {
  return (
    <div className="tour-handzettel">
      {/* Header */}
      <div style={{ borderBottom: '2px solid #16a34a', paddingBottom: 8, marginBottom: 16 }}>
        <h1 style={{ fontSize: 18, fontWeight: 'bold', margin: 0 }}>
          Tourenplan: {tourname || 'Ohne Name'}
        </h1>
        <p style={{ margin: '4px 0 0', color: '#666' }}>
          Datum: {datum} | Erstellt: {new Date().toLocaleDateString('de-DE')}
        </p>
      </div>

      {/* Stops table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr style={{ background: '#f0fdf4' }}>
            <th style={thStyle}>Nr</th>
            <th style={thStyle}>Kunde / Adresse</th>
            <th style={thStyle}>Artikel</th>
            <th style={thStyle}>Menge</th>
            <th style={thStyle}>Notiz</th>
            <th style={{ ...thStyle, width: 60 }}>&#10003; &Uuml;bergabe</th>
          </tr>
        </thead>
        <tbody>
          {stops.map((stop, i) => (
            <tr key={stop.id} style={{ borderBottom: '1px solid #ddd' }}>
              <td style={tdStyle}>{i + 1}</td>
              <td style={tdStyle}>
                <strong>{stop.kundeName}</strong><br />
                <small style={{ color: '#666' }}>{stop.adresse}</small>
              </td>
              <td style={tdStyle}>{stop.artikel}</td>
              <td style={{ ...tdStyle, textAlign: 'center' }}>{stop.menge} {stop.einheit}</td>
              <td style={tdStyle}>{stop.notiz || ''}</td>
              <td style={{ ...tdStyle, borderLeft: '1px solid #999' }}>&nbsp;</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Summary */}
      <div style={{ marginTop: 16, fontSize: 11, color: '#666' }}>
        Gesamt: {stops.length} Stopp{stops.length !== 1 ? 's' : ''}
      </div>

      {/* Signature line */}
      <div style={{ marginTop: 32, display: 'flex', gap: 48 }}>
        <div>
          <div style={{ borderTop: '1px solid #000', paddingTop: 4, width: 200 }}>Fahrer</div>
        </div>
        <div>
          <div style={{ borderTop: '1px solid #000', paddingTop: 4, width: 200 }}>Datum</div>
        </div>
      </div>
    </div>
  );
}

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

  // Tourname
  const [tourname, setTourname] = useState("");
  const [gespeicherteTournamen, setGespeicherteTournamen] = useState<string[]>([]);

  // Schnellerfassung
  const [showSchnell, setShowSchnell] = useState(false);
  const [kunden, setKunden] = useState<KundeOption[]>([]);
  const [artikelList, setArtikelList] = useState<Artikel[]>([]);
  const [schnellKundeId, setSchnellKundeId] = useState<number | "">("");
  const [schnellArtikelId, setSchnellArtikelId] = useState<number | "">("");
  const [schnellMenge, setSchnellMenge] = useState(1);
  const [schnellNotiz, setSchnellNotiz] = useState("");
  const [schnellSaving, setSchnellSaving] = useState(false);
  const [schnellSuccess, setSchnellSuccess] = useState(false);

  // Optimierung
  const [optimizing, setOptimizing] = useState(false);
  const [optimierungErgebnis, setOptimierungErgebnis] = useState<{ savedDistanceKm: number; savedPercent: number } | null>(null);

  // Besuchsplanung
  const [besuchstermine, setBesuchstermine] = useState<Besuchstermin[]>([]);
  const [besuchLoading, setBesuchLoading] = useState(false);
  const [showBesuchForm, setShowBesuchForm] = useState(false);
  const [besuchKundeId, setBesuchKundeId] = useState<number | "">("");
  const [besuchDatum, setBesuchDatum] = useState(heuteISO());
  const [besuchBetreff, setBesuchBetreff] = useState("");
  const [besuchNotiz, setBesuchNotiz] = useState("");
  const [besuchSaving, setBesuchSaving] = useState(false);
  const [besuchDeleting, setBesuchDeleting] = useState<number | null>(null);

  // Load firm address + tour names
  useEffect(() => {
    fetch("/api/einstellungen?prefix=firma.")
      .then((r) => r.json())
      .then((d) => {
        const teile = [d["firma.strasse"], d["firma.plz"], d["firma.ort"]].filter(Boolean);
        if (teile.length > 0) setStartOrt(teile.join(", "));
      });
    fetch("/api/einstellungen?prefix=system.")
      .then((r) => r.json())
      .then((d) => {
        if (d["system.tournamen"]) {
          try { setGespeicherteTournamen(JSON.parse(d["system.tournamen"])); } catch { /* ignore */ }
        }
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

  // Load geplante Besuche on mount
  const ladenBesuchstermine = useCallback(async () => {
    setBesuchLoading(true);
    try {
      const res = await fetch("/api/besuchstermine");
      if (res.ok) setBesuchstermine(await res.json());
    } finally {
      setBesuchLoading(false);
    }
  }, []);

  useEffect(() => { ladenBesuchstermine(); }, [ladenBesuchstermine]);

  // Load kunden for Schnellerfassung and Besuchsplanung (lazy)
  useEffect(() => {
    if ((showSchnell || showBesuchForm) && kunden.length === 0) {
      Promise.all([
        fetch("/api/kunden?aktiv=true").then((r) => r.json()),
        fetch("/api/artikel?limit=500").then((r) => r.json()),
      ]).then(([k, a]) => {
        setKunden(Array.isArray(k) ? k : []);
        setArtikelList(Array.isArray(a) ? a : []);
      });
    }
  }, [showSchnell, showBesuchForm, kunden.length]);

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

  async function optimiereRoute() {
    if (!startLat || !startLng) {
      setFehler("Bitte erst den Startpunkt geocodieren, bevor die Route optimiert werden kann.");
      return;
    }
    const stops = lieferungen
      .filter((l) => l.kunde.lat && l.kunde.lng)
      .map((l) => ({ id: l.id, lat: l.kunde.lat as number, lng: l.kunde.lng as number }));
    if (stops.length === 0) {
      setFehler("Keine Lieferungen mit Koordinaten für Optimierung verfügbar.");
      return;
    }
    setOptimizing(true);
    setFehler("");
    setOptimierungErgebnis(null);
    try {
      const res = await fetch("/api/tourenplanung/optimieren", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start: { lat: startLat, lng: startLng }, stops }),
      });
      if (!res.ok) {
        setFehler("Fehler bei der Routenoptimierung.");
        return;
      }
      const data = await res.json();
      const { optimizedOrder, savedDistanceKm, savedPercent } = data as {
        optimizedOrder: number[];
        savedDistanceKm: number;
        savedPercent: number;
      };
      // Reorder lieferungen: optimized first, then any without coords
      const idToLieferung = new Map(lieferungen.map((l) => [l.id, l]));
      const optimized = optimizedOrder.map((id) => idToLieferung.get(id)).filter(Boolean) as typeof lieferungen;
      const rest = lieferungen.filter((l) => !optimizedOrder.includes(l.id));
      setLieferungen([...optimized, ...rest]);
      setOptimierungErgebnis({ savedDistanceKm, savedPercent });
      setRouteLegs([]);
      // Auto-recalculate OSRM route with new order
      const waypoints: { lat: number; lng: number }[] = [];
      waypoints.push({ lat: startLat, lng: startLng });
      for (const l of [...optimized, ...rest]) {
        if (l.kunde.lat && l.kunde.lng) {
          waypoints.push({ lat: l.kunde.lat, lng: l.kunde.lng });
        }
      }
      if (waypoints.length >= 2) {
        setRouteLoading(true);
        const legs = await fetchRouteLegs(waypoints);
        setRouteLegs(legs);
        setRouteLoading(false);
      }
    } finally {
      setOptimizing(false);
    }
  }

  async function saveTourname() {
    if (!tourname.trim()) return;
    const name = tourname.trim();
    if (!gespeicherteTournamen.includes(name)) {
      const updated = [...gespeicherteTournamen, name];
      setGespeicherteTournamen(updated);
      await fetch("/api/einstellungen", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "system.tournamen", value: JSON.stringify(updated) }),
      });
    }
  }

  async function handleSchnellerfassung(e: React.FormEvent) {
    e.preventDefault();
    if (!schnellKundeId || !schnellArtikelId) return;
    setSchnellSaving(true);
    try {
      const art = artikelList.find((a) => a.id === Number(schnellArtikelId));
      const res = await fetch("/api/lieferungen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kundeId: schnellKundeId,
          datum,
          notiz: schnellNotiz || undefined,
          positionen: [{
            artikelId: schnellArtikelId,
            menge: Number(schnellMenge),
            verkaufspreis: art?.standardpreis ?? 0,
            einkaufspreis: art?.einkaufspreis ?? 0,
          }],
        }),
      });
      if (res.ok) {
        setSchnellKundeId("");
        setSchnellArtikelId("");
        setSchnellMenge(1);
        setSchnellNotiz("");
        setSchnellSuccess(true);
        setTimeout(() => setSchnellSuccess(false), 2000);
        laden(datum);
      }
    } finally {
      setSchnellSaving(false);
    }
  }

  async function handleBesuchSpeichern(e: React.FormEvent) {
    e.preventDefault();
    if (!besuchKundeId || !besuchDatum || !besuchBetreff.trim()) return;
    setBesuchSaving(true);
    try {
      const res = await fetch("/api/besuchstermine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kundeId: besuchKundeId,
          datum: besuchDatum,
          betreff: besuchBetreff,
          notiz: besuchNotiz || undefined,
        }),
      });
      if (res.ok) {
        setBesuchKundeId("");
        setBesuchDatum(heuteISO());
        setBesuchBetreff("");
        setBesuchNotiz("");
        setShowBesuchForm(false);
        ladenBesuchstermine();
      }
    } finally {
      setBesuchSaving(false);
    }
  }

  async function handleBesuchLoeschen(id: number) {
    setBesuchDeleting(id);
    try {
      await fetch(`/api/besuchstermine?id=${id}`, { method: "DELETE" });
      ladenBesuchstermine();
    } finally {
      setBesuchDeleting(null);
    }
  }

  function addBesuchZurTour(besuch: Besuchstermin) {
    if (!besuch.kunde.lat || !besuch.kunde.lng) {
      setFehler(`Kunde "${besuch.kunde.firma ?? besuch.kunde.name}" hat keine Koordinaten – Routenberechnung nicht möglich.`);
      return;
    }
    // Add as a synthetic entry to the lieferungen list for route display purposes
    // We scroll to the route section
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function artikelZusammenfassung(positionen: Position[]) {
    return positionen.map((p) => `${p.artikel.name} (${p.menge} ${p.artikel.einheit})`).join(", ");
  }

  // Set of kundeIds that have upcoming planned visits
  const kundeIdsWithBesuch = new Set(besuchstermine.map((b) => b.kundeId));

  const gesamtKm = routeLegs.reduce((s, l) => s + l.distanceKm, 0);
  const gesamtMin = routeLegs.reduce((s, l) => s + l.durationMin, 0);
  const mitKoords = lieferungen.filter((l) => l.kunde.lat && l.kunde.lng).length;

  const pdfUrl = `/api/exporte/tour?datum=${datum}${tourname ? `&tourname=${encodeURIComponent(tourname)}` : ""}`;

  return (
    <div>
      <span className="flex items-center gap-2 mb-6">
        <h1 className="text-2xl font-bold">Tourenplanung</h1>
        <Link href="/hilfe#tourenplanung" title="Hilfe: Tourenplanung" className="text-gray-400 hover:text-green-700 transition-colors" tabIndex={-1}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </Link>
      </span>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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
          <h2 className="font-semibold mb-3">Tourname</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={tourname}
              onChange={(e) => setTourname(e.target.value)}
              list="tournamen-list"
              placeholder="z.B. Montag Nord, Freitag Süd"
              className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
            />
            <button
              onClick={saveTourname}
              disabled={!tourname.trim()}
              className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg disabled:opacity-50 transition-colors"
              title="Tourname speichern"
            >
              Speichern
            </button>
          </div>
          <datalist id="tournamen-list">
            {gespeicherteTournamen.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          {gespeicherteTournamen.length > 0 && (
            <div className="flex gap-1 mt-2 flex-wrap">
              {gespeicherteTournamen.map((n) => (
                <button
                  key={n}
                  onClick={() => setTourname(n)}
                  className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                    tourname === n
                      ? "bg-green-100 border-green-300 text-green-800"
                      : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h2 className="font-semibold mb-3">Startpunkt (Routenberechnung)</h2>
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

      {/* Schnellerfassung */}
      <Card className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Schnellerfassung Lieferung</h2>
          <button
            onClick={() => setShowSchnell(!showSchnell)}
            className="text-sm text-green-700 hover:text-green-900 font-medium"
          >
            {showSchnell ? "Ausblenden" : "Einblenden"}
          </button>
        </div>
        {showSchnell && (
          <form onSubmit={handleSchnellerfassung} className="flex flex-col sm:flex-row gap-3 items-end flex-wrap">
            <div className="w-full sm:w-52">
              <label className="block text-xs text-gray-500 mb-1">Kunde</label>
              <SearchableSelect
                options={kunden.map((k) => ({
                  value: k.id,
                  label: k.firma ? `${k.firma} (${k.name})` : k.name,
                }))}
                value={schnellKundeId}
                onChange={(v) => setSchnellKundeId(v ? Number(v) : "")}
                placeholder="Kunde wählen…"
                required
              />
            </div>
            <div className="w-full sm:w-52">
              <label className="block text-xs text-gray-500 mb-1">Artikel</label>
              <SearchableSelect
                options={artikelList.map((a) => ({
                  value: a.id,
                  label: a.name,
                  sub: a.einheit,
                }))}
                value={schnellArtikelId}
                onChange={(v) => setSchnellArtikelId(v ? Number(v) : "")}
                placeholder="Artikel wählen…"
                required
              />
            </div>
            <div className="w-24">
              <label className="block text-xs text-gray-500 mb-1">Menge</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={schnellMenge}
                onChange={(e) => setSchnellMenge(parseFloat(e.target.value) || 1)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="block text-xs text-gray-500 mb-1">Notiz</label>
              <input
                type="text"
                value={schnellNotiz}
                onChange={(e) => setSchnellNotiz(e.target.value)}
                placeholder="Optional…"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>
            <button
              type="submit"
              disabled={schnellSaving || !schnellKundeId || !schnellArtikelId}
              className="px-4 py-2 text-sm bg-green-700 hover:bg-green-800 text-white rounded-lg font-medium transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {schnellSaving ? "…" : schnellSuccess ? "✓ Hinzugefügt" : "+ Lieferung"}
            </button>
          </form>
        )}
      </Card>

      <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
        <h2 className="font-semibold text-base sm:text-lg">
          {loading
            ? "Lade…"
            : `${lieferungen.length} Lieferung${lieferungen.length !== 1 ? "en" : ""} am ${formatDatum(datum)}`}
          {mitKoords < lieferungen.length && lieferungen.length > 0 && (
            <span className="ml-2 text-xs text-yellow-600 font-normal">{mitKoords}/{lieferungen.length} mit Koordinaten</span>
          )}
        </h2>
        <div className="flex gap-2 flex-wrap w-full sm:w-auto">
          {lieferungen.length > 0 && (
            <>
              <button
                onClick={optimiereRoute}
                disabled={optimizing || mitKoords === 0 || !startLat}
                className="w-full sm:w-auto px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {optimizing ? "Optimiere…" : "Route optimieren"}
              </button>
              <button
                onClick={berechneRoute}
                disabled={routeLoading || mitKoords === 0}
                className="w-full sm:w-auto px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {routeLoading ? "Berechne…" : "Route berechnen (OSRM)"}
              </button>
              <button
                onClick={() => window.open(pdfUrl, "_blank")}
                className="w-full sm:w-auto px-4 py-2 text-sm bg-green-700 hover:bg-green-800 text-white rounded-lg transition-colors"
              >
                Touren-PDF
              </button>
              <button
                onClick={() => window.print()}
                className="w-full sm:w-auto px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-1.5"
              >
                🖨 Ausdruck / Handzettel
              </button>
            </>
          )}
        </div>
      </div>

      {fehler && <p className="text-red-600 text-sm mb-4">{fehler}</p>}

      {optimierungErgebnis && (
        <Card className="mb-5 bg-green-50 border-green-200">
          <h3 className="font-semibold text-green-800 mb-1">Route optimiert</h3>
          <p className="text-sm text-green-700">
            Eingespart: <strong>{optimierungErgebnis.savedDistanceKm.toFixed(1)} km</strong> ({optimierungErgebnis.savedPercent.toFixed(0)}%)
          </p>
        </Card>
      )}

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
                  <th className="pb-2 hidden sm:table-cell">PLZ</th>
                  <th className="pb-2 hidden sm:table-cell">Ort</th>
                  <th className="pb-2">Kunde</th>
                  <th className="pb-2 hidden md:table-cell">Artikel</th>
                  <th className="pb-2 text-right hidden sm:table-cell">Km</th>
                  <th className="pb-2 text-right hidden sm:table-cell">Fahrzeit</th>
                </tr>
              </thead>
              <tbody>
                {lieferungen.map((l, i) => {
                  const leg = routeLegs[i] ?? null;
                  const hatKoords = l.kunde.lat && l.kunde.lng;
                  const hatBesuch = kundeIdsWithBesuch.has(l.kunde.id);
                  return (
                    <tr key={l.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-2.5 text-gray-400">{i + 1}</td>
                      <td className="py-2.5 font-mono text-xs hidden sm:table-cell">{l.kunde.plz ?? "–"}</td>
                      <td className="py-2.5 hidden sm:table-cell">{l.kunde.ort ?? "–"}</td>
                      <td className="py-2.5">
                        <div className="font-medium flex items-center gap-1.5">
                          {l.kunde.firma ?? l.kunde.name}
                          {hatBesuch && (
                            <span title="Geplanter Besuch vorhanden" className="text-blue-500 text-base leading-none">📅</span>
                          )}
                        </div>
                        {l.kunde.firma && <div className="text-xs text-gray-500">{l.kunde.name}</div>}
                        {l.kunde.strasse && <div className="text-xs text-gray-400">{l.kunde.strasse}</div>}
                        {!hatKoords && (
                          <span className="text-xs text-yellow-600">⚠ Keine Koordinaten</span>
                        )}
                        <div className="sm:hidden text-xs text-gray-500 mt-0.5">
                          {[l.kunde.plz, l.kunde.ort].filter(Boolean).join(" ") || "–"}
                          {leg ? ` · ${leg.distanceKm.toFixed(1)} km` : ""}
                        </div>
                        <div className="md:hidden text-xs text-gray-400 mt-0.5 truncate">
                          {artikelZusammenfassung(l.positionen)}
                        </div>
                      </td>
                      <td className="py-2.5 text-gray-600 max-w-[220px] hidden md:table-cell">
                        <div className="truncate">{artikelZusammenfassung(l.positionen)}</div>
                        {l.notiz && <div className="text-xs text-gray-400 mt-0.5">{l.notiz}</div>}
                      </td>
                      <td className="py-2.5 text-right text-blue-700 font-medium whitespace-nowrap hidden sm:table-cell">
                        {leg ? `${leg.distanceKm.toFixed(1)} km` : "—"}
                      </td>
                      <td className="py-2.5 text-right text-blue-600 whitespace-nowrap hidden sm:table-cell">
                        {leg ? formatMin(leg.durationMin) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {routeLegs.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-gray-300 font-semibold">
                    <td colSpan={2} className="pt-2 text-right text-sm text-gray-600 sm:hidden">Gesamt:</td>
                    <td colSpan={5} className="pt-2 text-right text-sm text-gray-600 hidden sm:table-cell">Gesamt:</td>
                    <td className="pt-2 text-right text-blue-700 hidden sm:table-cell">{gesamtKm.toFixed(1)} km</td>
                    <td className="pt-2 text-right text-blue-600 hidden sm:table-cell">{formatMin(gesamtMin)}</td>
                    <td className="pt-2 text-right text-blue-700 text-xs sm:hidden">
                      {gesamtKm.toFixed(1)} km · {formatMin(gesamtMin)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </Card>
      )}

      {/* Handzettel – only visible when printing */}
      <div className="hidden print:block">
        <TourHandzettel
          tourname={tourname}
          datum={new Date(datum).toLocaleDateString('de-DE')}
          stops={lieferungen.map((l) => ({
            id: l.id,
            kundeName: l.kunde.firma ?? l.kunde.name,
            adresse: [l.kunde.strasse, l.kunde.plz, l.kunde.ort].filter(Boolean).join(', '),
            artikel: l.positionen.map((p) => p.artikel.name).join(', '),
            menge: l.positionen.map((p) => p.menge).join(' / '),
            einheit: l.positionen.map((p) => p.artikel.einheit).join(' / '),
            notiz: l.notiz ?? '',
          }))}
        />
      </div>

      {/* Besuchsplanung */}
      <Card className="mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-lg">Geplante Besuche dieser Tour</h2>
          <button
            onClick={() => {
              setShowBesuchForm(!showBesuchForm);
              if (!showBesuchForm && kunden.length === 0) {
                Promise.all([
                  fetch("/api/kunden?aktiv=true").then((r) => r.json()),
                  fetch("/api/artikel?limit=500").then((r) => r.json()),
                ]).then(([k, a]) => {
                  setKunden(Array.isArray(k) ? k : []);
                  setArtikelList(Array.isArray(a) ? a : []);
                });
              }
            }}
            className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            {showBesuchForm ? "Abbrechen" : "+ Besuch planen"}
          </button>
        </div>

        {showBesuchForm && (
          <form onSubmit={handleBesuchSpeichern} className="mb-5 p-4 border border-blue-100 rounded-xl bg-blue-50">
            <h3 className="text-sm font-semibold text-blue-800 mb-3">Neuen Besuch planen</h3>
            <div className="flex flex-col sm:flex-row gap-3 items-end flex-wrap">
              <div className="w-full sm:w-40">
                <label className="block text-xs text-gray-600 mb-1">Datum <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  value={besuchDatum}
                  onChange={(e) => setBesuchDatum(e.target.value)}
                  required
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="w-full sm:w-56">
                <label className="block text-xs text-gray-600 mb-1">Kunde <span className="text-red-500">*</span></label>
                <SearchableSelect
                  options={kunden.map((k) => ({
                    value: k.id,
                    label: k.firma ? `${k.firma} (${k.name})` : k.name,
                  }))}
                  value={besuchKundeId}
                  onChange={(v) => setBesuchKundeId(v ? Number(v) : "")}
                  placeholder="Kunde wählen…"
                  required
                />
              </div>
              <div className="flex-1 min-w-[160px]">
                <label className="block text-xs text-gray-600 mb-1">Betreff <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={besuchBetreff}
                  onChange={(e) => setBesuchBetreff(e.target.value)}
                  placeholder="z.B. Jahresgespräch, Angebotspräsentation"
                  required
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex-1 min-w-[120px]">
                <label className="block text-xs text-gray-600 mb-1">Notiz</label>
                <input
                  type="text"
                  value={besuchNotiz}
                  onChange={(e) => setBesuchNotiz(e.target.value)}
                  placeholder="Optional…"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                type="submit"
                disabled={besuchSaving || !besuchKundeId || !besuchBetreff.trim()}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {besuchSaving ? "Speichern…" : "Speichern"}
              </button>
            </div>
          </form>
        )}

        {besuchLoading ? (
          <p className="text-sm text-gray-400">Lade geplante Besuche…</p>
        ) : besuchstermine.length === 0 ? (
          <p className="text-sm text-gray-400">Keine geplanten Besuche vorhanden.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b text-xs uppercase">
                  <th className="pb-2">Datum</th>
                  <th className="pb-2">Kundenname</th>
                  <th className="pb-2 hidden sm:table-cell">Adresse</th>
                  <th className="pb-2 hidden md:table-cell">Betreff</th>
                  <th className="pb-2 text-right">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {besuchstermine.map((b) => (
                  <tr key={b.id} className="border-b last:border-0 hover:bg-blue-50 transition-colors">
                    <td className="py-2.5 whitespace-nowrap font-medium text-blue-800">
                      {new Date(b.datum).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}
                    </td>
                    <td className="py-2.5">
                      <div className="font-medium">{b.kunde.firma ?? b.kunde.name}</div>
                      {b.kunde.firma && <div className="text-xs text-gray-500">{b.kunde.name}</div>}
                      <div className="sm:hidden text-xs text-gray-500 mt-0.5">
                        {[b.kunde.plz, b.kunde.ort].filter(Boolean).join(" ") || "–"}
                      </div>
                      <div className="md:hidden text-xs text-gray-400 mt-0.5">{b.betreff}</div>
                    </td>
                    <td className="py-2.5 text-gray-600 hidden sm:table-cell">
                      {[b.kunde.plz, b.kunde.ort].filter(Boolean).join(" ") || "–"}
                      {b.kunde.strasse && <div className="text-xs text-gray-400">{b.kunde.strasse}</div>}
                    </td>
                    <td className="py-2.5 text-gray-700 hidden md:table-cell">
                      {b.betreff}
                      {b.inhalt && <div className="text-xs text-gray-400 mt-0.5">{b.inhalt}</div>}
                    </td>
                    <td className="py-2.5 text-right">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => addBesuchZurTour(b)}
                          title="Zur aktuellen Route hinzufügen"
                          className="text-xs px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded border border-blue-200 transition-colors whitespace-nowrap"
                        >
                          Karte ▶
                        </button>
                        <button
                          onClick={() => handleBesuchLoeschen(b.id)}
                          disabled={besuchDeleting === b.id}
                          className="text-xs px-2 py-1 text-red-400 hover:text-red-600 disabled:opacity-40 transition-colors"
                          title="Besuch löschen"
                        >
                          {besuchDeleting === b.id ? "…" : "✕"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
