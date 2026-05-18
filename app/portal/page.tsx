"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Kontostand {
  offen: number;
  ueberfaellig: number;
}

interface Rechnung {
  id: number;
  datum: string;
  rechnungNr: string | null;
  rechnungDatum: string | null;
  status: string;
  bezahlt: boolean;
  gesamtBetrag: number;
}

interface Lieferung {
  id: number;
  datum: string;
  status: string;
  notiz: string | null;
  positionenAnzahl: number;
}

function formatEuro(n: number) {
  return n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

function formatDatum(s: string) {
  return new Date(s).toLocaleDateString("de-DE");
}

export default function PortalDashboard() {
  const [kontostand, setKontostand] = useState<Kontostand | null>(null);
  const [rechnungen, setRechnungen] = useState<Rechnung[]>([]);
  const [lieferungen, setLieferungen] = useState<Lieferung[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [k, r, l] = await Promise.all([
          fetch("/api/portal/kontostand").then((res) => res.ok ? res.json() : null),
          fetch("/api/portal/rechnungen").then((res) => res.ok ? res.json() : []),
          fetch("/api/portal/lieferscheine").then((res) => res.ok ? res.json() : []),
        ]);
        setKontostand(k);
        setRechnungen(Array.isArray(r) ? r.slice(0, 5) : []);
        setLieferungen(Array.isArray(l) ? l.slice(0, 3) : []);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return <p className="text-gray-400 text-sm mt-8 text-center">Lade Daten…</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Mein Konto</h1>

      {/* Kontostand */}
      {kontostand && (
        <div className="grid grid-cols-2 gap-4">
          <div className={`rounded-xl p-4 border ${kontostand.offen > 0 ? "bg-amber-50 border-amber-200" : "bg-white border-gray-200"}`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Offener Betrag</p>
            <p className={`text-2xl font-bold ${kontostand.offen > 0 ? "text-amber-700" : "text-gray-700"}`}>
              {formatEuro(kontostand.offen)}
            </p>
          </div>
          <div className={`rounded-xl p-4 border ${kontostand.ueberfaellig > 0 ? "bg-red-50 border-red-200" : "bg-white border-gray-200"}`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Überfällig</p>
            <p className={`text-2xl font-bold ${kontostand.ueberfaellig > 0 ? "text-red-700" : "text-gray-700"}`}>
              {formatEuro(kontostand.ueberfaellig)}
            </p>
          </div>
        </div>
      )}

      {/* Letzte Rechnungen */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-800">Letzte Rechnungen</h2>
          <Link href="/portal/rechnungen" className="text-sm text-green-700 hover:underline">
            Alle anzeigen →
          </Link>
        </div>
        {rechnungen.length === 0 ? (
          <p className="text-sm text-gray-400">Keine Rechnungen vorhanden.</p>
        ) : (
          <div className="space-y-2">
            {rechnungen.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-sm py-1 border-b border-gray-50 last:border-0">
                <div>
                  <span className="font-medium text-gray-700">{r.rechnungNr ?? `#${r.id}`}</span>
                  <span className="text-gray-400 ml-2">{formatDatum(r.rechnungDatum ?? r.datum)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold">{formatEuro(r.gesamtBetrag)}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.bezahlt ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                    {r.bezahlt ? "Bezahlt" : "Offen"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Letzte Lieferungen */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-800">Letzte Lieferungen</h2>
          <Link href="/portal/lieferscheine" className="text-sm text-green-700 hover:underline">
            Alle anzeigen →
          </Link>
        </div>
        {lieferungen.length === 0 ? (
          <p className="text-sm text-gray-400">Keine Lieferungen vorhanden.</p>
        ) : (
          <div className="space-y-2">
            {lieferungen.map((l) => (
              <div key={l.id} className="flex items-center justify-between text-sm py-1 border-b border-gray-50 last:border-0">
                <div>
                  <span className="font-medium text-gray-700">{formatDatum(l.datum)}</span>
                  {l.notiz && <span className="text-gray-400 ml-2 text-xs truncate max-w-[120px]">{l.notiz}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">{l.positionenAnzahl} Pos.</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${l.status === "geliefert" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                    {l.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Schnellzugriff */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link href="/portal/rechnungen" className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-4 hover:border-green-400 hover:shadow-sm transition-all">
          <span className="text-2xl">🧾</span>
          <div>
            <p className="font-medium text-gray-800">Rechnungen</p>
            <p className="text-xs text-gray-500">Alle Rechnungen einsehen</p>
          </div>
        </Link>
        <Link href="/portal/lieferscheine" className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-4 hover:border-green-400 hover:shadow-sm transition-all">
          <span className="text-2xl">📦</span>
          <div>
            <p className="font-medium text-gray-800">Lieferscheine</p>
            <p className="text-xs text-gray-500">Lieferhistorie anzeigen</p>
          </div>
        </Link>
        <Link href="/portal/bestellung" className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-4 hover:border-green-400 hover:shadow-sm transition-all">
          <span className="text-2xl">🛒</span>
          <div>
            <p className="font-medium text-gray-800">Bestellung aufgeben</p>
            <p className="text-xs text-gray-500">Neue Bestellung anfragen</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
