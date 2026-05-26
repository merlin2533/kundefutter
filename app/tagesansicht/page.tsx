"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface PegelstandEintrag {
  id: number;
  stationUuid: string;
  stationKurz: string;
  gewaesser: string;
  lat: number | null;
  lng: number | null;
  einheit: string;
  wert: number | null;
  trend: number | null;
  messung: string | null;
  fetchedAt: string;
}

interface KundeRef {
  id: number;
  name: string;
  firma: string | null;
}

interface Aufgabe {
  id: number;
  betreff: string;
  beschreibung: string | null;
  faelligAm: string | null;
  erledigt: boolean;
  prioritaet: string;
  kunde: KundeRef | null;
}

interface Aktivitaet {
  id: number;
  typ: string;
  betreff: string;
  inhalt: string | null;
  datum: string;
  faelligAm: string | null;
  erledigt: boolean;
  kunde: KundeRef | null;
}

interface KeinKontakt {
  id: number;
  name: string;
  firma: string | null;
  letzteAktivitaet: string | null;
}

interface Tour {
  id: number;
  datum: string;
  status: string;
  kunde: KundeRef | null;
}

interface TagesansichtData {
  offeneAufgaben: Aufgabe[];
  faelligeAnrufe: Aktivitaet[];
  keinKontakt30: KeinKontakt[];
  heutigeTouren: Tour[];
  offeneLieferungen: number;
}

const PRIO_BADGE: Record<string, string> = {
  kritisch: "bg-red-100 text-red-800",
  hoch: "bg-orange-100 text-orange-800",
  normal: "bg-blue-100 text-blue-700",
  niedrig: "bg-gray-100 text-gray-600",
};

const STATUS_BADGE: Record<string, string> = {
  geplant: "bg-yellow-100 text-yellow-800",
  geliefert: "bg-green-100 text-green-800",
  storniert: "bg-red-100 text-red-800",
};

function formatDatum(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("de-DE");
}

export default function TagesansichtPage() {
  const [data, setData] = useState<TagesansichtData | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<number | null>(null);
  const [erfasst, setErfasst] = useState<Record<number, boolean>>({});
  const [pegel, setPegel] = useState<PegelstandEintrag[]>([]);
  const [aktualisiert, setAktualisiert] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [tagesRes, pegelRes] = await Promise.all([
        fetch("/api/tagesansicht"),
        fetch("/api/pegelstaende"),
      ]);
      if (!tagesRes.ok) throw new Error("Tagesansicht konnte nicht geladen werden");
      const json = await tagesRes.json();
      setData(json);
      if (pegelRes.ok) {
        const p = await pegelRes.json();
        setPegel(Array.isArray(p) ? p : []);
      }
      setAktualisiert(new Date());
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function toggleAufgabe(a: Aufgabe) {
    setToggling(a.id);
    await fetch(`/api/aufgaben/${a.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ erledigt: !a.erledigt }),
    });
    await fetchData();
    setToggling(null);
  }

  async function erledigeAnruf(aktivitaetId: number) {
    await fetch(`/api/kunden/aktivitaeten?id=${aktivitaetId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ erledigt: true }),
    });
    await fetchData();
  }

  async function erfasseAnruf(kundeId: number) {
    try {
      await fetch("/api/kunden/aktivitaeten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kundeId,
          typ: "anruf",
          betreff: "Anruf",
          datum: new Date().toISOString(),
          erledigt: true,
        }),
      });
      setErfasst((prev) => ({ ...prev, [kundeId]: true }));
      setTimeout(() => {
        setErfasst((prev) => { const n = { ...prev }; delete n[kundeId]; return n; });
      }, 2000);
    } catch {
      // ignore
    }
  }

  if (loading) {
    return (
      <div className="text-center py-20 text-gray-400">
        <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        Lade Tagesübersicht…
      </div>
    );
  }

  if (!data) {
    return <p className="text-center text-red-600 py-20">Fehler beim Laden der Daten.</p>;
  }

  const today = new Date().toLocaleDateString("de-DE", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  const aktualisiertStr = aktualisiert
    ? aktualisiert.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) + " Uhr"
    : "—";

  const trendIcon = (t: number | null) =>
    t === 1 ? "▲" : t === -1 ? "▼" : "—";

  return (
    <>
      <style>{`
        @media print {
          @page { margin: 1.5cm; size: A4; }
          .print\\:hidden { display: none !important; }
          .print-section { break-inside: avoid; }
          body { font-size: 11pt; }
        }
      `}</style>

    <div className="px-4 sm:px-6 py-4 sm:py-0">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Tages-Übersicht</h1>
          <p className="text-sm text-gray-500 mt-0.5">{today}</p>
          <p className="text-xs text-gray-400 mt-0.5">Aktualisiert: {aktualisiertStr}</p>
        </div>
        <button
          onClick={() => window.print()}
          className="print:hidden shrink-0 flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-lg border border-gray-200 transition-colors"
        >
          🖨️ Drucken / PDF
        </button>
      </div>

      {/* Print-Kopf (nur im Druck sichtbar) */}
      <div className="hidden print:block mb-4 pb-3 border-b border-gray-300">
        <p className="text-xs text-gray-500">Tages-Übersicht — Erstellt: {today}, {aktualisiertStr}</p>
      </div>

      {/* Summary badges */}
      <div className="flex flex-wrap gap-2 mb-6 print:hidden">
        <span className="px-3 py-1 text-sm rounded-full bg-yellow-100 text-yellow-800 font-medium">
          {data.offeneAufgaben.length} Aufgaben offen
        </span>
        <span className="px-3 py-1 text-sm rounded-full bg-blue-100 text-blue-800 font-medium">
          {data.faelligeAnrufe.length} Anrufe fällig
        </span>
        <span className="px-3 py-1 text-sm rounded-full bg-orange-100 text-orange-800 font-medium">
          {data.keinKontakt30.length} Kunden ohne Kontakt
        </span>
        <span className="px-3 py-1 text-sm rounded-full bg-green-100 text-green-800 font-medium">
          {data.heutigeTouren.length} heutige Touren / {data.offeneLieferungen} offen gesamt
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
        {/* Card 1: Offene Aufgaben */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">Offene Aufgaben</h2>
            <Link href="/aufgaben" className="text-xs text-green-700 hover:underline">Alle &rarr;</Link>
          </div>
          {data.offeneAufgaben.length === 0 ? (
            <p className="px-4 sm:px-5 py-6 text-sm text-gray-400">Keine offenen Aufgaben.</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {data.offeneAufgaben.map((a) => (
                <li key={a.id} className="px-4 sm:px-5 py-3 flex items-start gap-3">
                  <button
                    onClick={() => toggleAufgabe(a)}
                    disabled={toggling === a.id}
                    className={`mt-0.5 w-6 h-6 sm:w-5 sm:h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors disabled:opacity-40 ${
                      a.erledigt ? "bg-green-500 border-green-500" : "border-gray-400 hover:border-green-500"
                    }`}
                  >
                    {a.erledigt && (
                      <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M2 6l3 3 5-5" />
                      </svg>
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-800 truncate">{a.betreff}</span>
                      <span className={`px-1.5 py-0.5 text-xs rounded-full font-medium ${PRIO_BADGE[a.prioritaet] ?? "bg-gray-100 text-gray-600"}`}>
                        {a.prioritaet}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-2">
                      {a.faelligAm && (
                        <span className={new Date(a.faelligAm) < new Date() ? "text-red-600 font-medium" : ""}>
                          Fällig: {formatDatum(a.faelligAm)}
                        </span>
                      )}
                      {a.kunde && (
                        <Link href={`/kunden/${a.kunde.id}`} className="text-green-700 hover:underline">
                          {a.kunde.name}
                        </Link>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Card 2: Fällige Anrufe */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">Fällige Anrufe</h2>
            <Link href="/crm" className="text-xs text-green-700 hover:underline">CRM &rarr;</Link>
          </div>
          {data.faelligeAnrufe.length === 0 ? (
            <p className="px-4 sm:px-5 py-6 text-sm text-gray-400">Keine fälligen Anrufe.</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {data.faelligeAnrufe.map((ak) => (
                <li key={ak.id} className="px-4 sm:px-5 py-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800">{ak.betreff}</div>
                    <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-2">
                      {ak.faelligAm && (
                        <span className={new Date(ak.faelligAm) < new Date() ? "text-red-600 font-medium" : ""}>
                          Fällig: {formatDatum(ak.faelligAm)}
                        </span>
                      )}
                      {ak.kunde && (
                        <Link href={`/kunden/${ak.kunde.id}`} className="text-green-700 hover:underline">
                          {ak.kunde.name}
                        </Link>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => erledigeAnruf(ak.id)}
                    className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors shrink-0"
                  >
                    Erledigt
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Card 3: Kein Kontakt 30 Tage */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Kein Kontakt (30 Tage)</h2>
            <p className="text-xs text-gray-500 mt-0.5">Aktive Kunden ohne Aktivität seit 30 Tagen</p>
          </div>
          {data.keinKontakt30.length === 0 ? (
            <p className="px-4 sm:px-5 py-6 text-sm text-gray-400">Alle Kunden wurden zuletzt kontaktiert.</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {data.keinKontakt30.map((k) => (
                <li key={k.id} className="px-4 sm:px-5 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <Link href={`/kunden/${k.id}`} className="text-sm font-medium text-gray-800 hover:text-green-700">
                      {k.name}
                      {k.firma && <span className="text-gray-400 text-xs ml-1">({k.firma})</span>}
                    </Link>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {k.letzteAktivitaet
                        ? `Letzter Kontakt: ${formatDatum(k.letzteAktivitaet)}`
                        : "Noch kein Kontakt erfasst"}
                    </div>
                  </div>
                  {erfasst[k.id] ? (
                    <span className="text-xs text-green-600 font-medium bg-green-50 px-2 py-1 rounded-lg border border-green-200 shrink-0">
                      Erfasst
                    </span>
                  ) : (
                    <button
                      onClick={() => erfasseAnruf(k.id)}
                      className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors shrink-0"
                    >
                      Anruf erfassen
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Card 4: Heutige Touren */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">Heutige Touren</h2>
            <Link href="/lieferungen" className="text-xs text-green-700 hover:underline">Alle &rarr;</Link>
          </div>
          {data.heutigeTouren.length === 0 ? (
            <p className="px-4 sm:px-5 py-6 text-sm text-gray-400">Keine Touren für heute geplant.</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {data.heutigeTouren.map((t) => (
                <li key={t.id} className="px-4 sm:px-5 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <Link href={`/lieferungen/${t.id}`} className="text-sm font-medium text-gray-800 hover:text-green-700">
                      {t.kunde?.name ?? `Lieferung #${t.id}`}
                      {t.kunde?.firma && (
                        <span className="text-gray-400 text-xs ml-1">({t.kunde.firma})</span>
                      )}
                    </Link>
                  </div>
                  <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${STATUS_BADGE[t.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {t.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Pegelstände */}
      {pegel.length > 0 && (
        <div className="mt-6 print-section">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-blue-400">≋</span>
                <h2 className="font-semibold text-gray-800">Pegelstände</h2>
                <span className="text-xs text-gray-400">
                  Stand: {pegel[0]?.messung
                    ? new Date(pegel[0].messung).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) + " Uhr"
                    : aktualisiertStr}
                </span>
              </div>
            </div>

            {/* Karte (nur wenn Koordinaten vorhanden, nur im Browser) */}
            <PegelKarte stationen={pegel} />

            {/* Tabelle aller Stationen */}
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase">
                  <th className="px-4 sm:px-5 py-2 text-left font-medium">Station</th>
                  <th className="px-4 sm:px-5 py-2 text-left font-medium hidden sm:table-cell">Gewässer</th>
                  <th className="px-4 sm:px-5 py-2 text-right font-medium">Pegel</th>
                  <th className="px-4 sm:px-5 py-2 text-center font-medium">Trend</th>
                  <th className="px-4 sm:px-5 py-2 text-right font-medium hidden sm:table-cell">Messung</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {pegel.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 sm:px-5 py-3">
                      <span className="font-medium text-gray-800">{s.stationKurz}</span>
                      <span className="sm:hidden text-xs text-green-700 block">{s.gewaesser}</span>
                    </td>
                    <td className="px-4 sm:px-5 py-3 text-gray-500 hidden sm:table-cell">{s.gewaesser}</td>
                    <td className="px-4 sm:px-5 py-3 text-right font-mono font-semibold">
                      {s.wert != null ? `${s.wert} ${s.einheit}` : <span className="text-gray-300">— {s.einheit}</span>}
                    </td>
                    <td className="px-4 sm:px-5 py-3 text-center">
                      <span className={s.trend === 1 ? "text-blue-500" : s.trend === -1 ? "text-green-600" : "text-gray-300"}>
                        {trendIcon(s.trend)}
                      </span>
                    </td>
                    <td className="px-4 sm:px-5 py-3 text-right text-xs text-gray-400 hidden sm:table-cell">
                      {s.messung
                        ? new Date(s.messung).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) + " Uhr"
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Print-Footer */}
      <div className="hidden print:block mt-6 pt-3 border-t border-gray-300 text-xs text-gray-400 text-center">
        AgrarOffice — Tages-Übersicht — {today}
      </div>
    </div>
    </>
  );
}

// Leaflet-Karte der Pegelstationen (dynamisch, kein SSR)
function PegelKarte({ stationen }: { stationen: PegelstandEintrag[] }) {
  const mitKoords = stationen.filter((s) => s.lat != null && s.lng != null);
  if (mitKoords.length === 0) return null;

  return (
    <div className="print:hidden h-48 border-b border-gray-100">
      <PegelKarteInner stationen={mitKoords} />
    </div>
  );
}

function PegelKarteInner({ stationen }: { stationen: PegelstandEintrag[] }) {
  const mapRef = useCallback((node: HTMLDivElement | null) => {
    if (!node || typeof window === "undefined") return;
    // Dynamisch laden um SSR-Fehler zu vermeiden
    import("leaflet").then((L) => {
      // Leaflet CSS
      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }
      // Existing map check
      if ((node as HTMLDivElement & { _leaflet_id?: number })._leaflet_id) return;

      const center: [number, number] = [
        stationen.reduce((s, p) => s + (p.lat ?? 0), 0) / stationen.length,
        stationen.reduce((s, p) => s + (p.lng ?? 0), 0) / stationen.length,
      ];
      const map = L.map(node, { zoomControl: true, attributionControl: false }).setView(center, stationen.length === 1 ? 12 : 8);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

      const icon = L.divIcon({
        className: "",
        html: `<div style="background:#3b82f6;color:#fff;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 1px 4px rgba(0,0,0,0.3)">≋</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      stationen.forEach((s) => {
        if (s.lat == null || s.lng == null) return;
        const wertLabel = s.wert != null ? `<b>${s.wert} ${s.einheit}</b>` : "— cm";
        L.marker([s.lat, s.lng], { icon })
          .bindPopup(`<strong>${s.stationKurz}</strong><br>${s.gewaesser}<br>${wertLabel}`)
          .addTo(map);
      });
    }).catch(() => {});
  }, [stationen]);

  return <div ref={mapRef} className="w-full h-full" />;
}
