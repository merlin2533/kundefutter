"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

interface KontraktPosition {
  id: number;
  artikelId: number;
  menge: number;
  mengeAbgerufen: number;
  einheit: string;
  preis: number | null;
  artikel: { id: number; name: string; artikelnummer: string | null } | null;
}

interface Kontrakt {
  id: number;
  nummer: string;
  gueltigVon: string;
  gueltigBis: string;
  status: string;
  notiz: string | null;
  kundeId: number;
  kunde: { id: number; name: string; firma: string | null } | null;
  positionen: KontraktPosition[];
}

const STATUS_COLORS: Record<string, string> = {
  AKTIV: "bg-green-100 text-green-800",
  ABGESCHLOSSEN: "bg-gray-100 text-gray-600",
  STORNIERT: "bg-red-100 text-red-700",
};

const STATUS_LABELS: Record<string, string> = {
  AKTIV: "Aktiv",
  ABGESCHLOSSEN: "Abgeschlossen",
  STORNIERT: "Storniert",
};

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? "bg-gray-100 text-gray-600";
  const label = STATUS_LABELS[status] ?? status;
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>{label}</span>;
}

function Fortschrittsbalken({ menge, abgerufen, einheit }: { menge: number; abgerufen: number; einheit: string }) {
  const pct = menge > 0 ? Math.min(100, Math.round((abgerufen / menge) * 100)) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-500">
        <span>{abgerufen.toLocaleString("de-DE")} {einheit} abgerufen</span>
        <span>{menge.toLocaleString("de-DE")} {einheit} gesamt</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all ${pct >= 100 ? "bg-green-500" : pct > 50 ? "bg-blue-500" : "bg-orange-400"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-right text-xs font-medium text-gray-600">{pct}%</div>
    </div>
  );
}

export default function KontraktDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState<string | null>(null);
  const [data, setData] = useState<Kontrakt | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    params.then((p) => setId(p.id));
  }, [params]);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/kontrakte/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("not found");
        return r.json();
      })
      .then((d: Kontrakt) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  async function handleAktion(aktion: string) {
    if (!id) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/kontrakte/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aktion }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Fehler.");
        return;
      }
      const updated: Kontrakt = await res.json();
      setData(updated);
    } catch {
      setError("Fehler beim Aktualisieren.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="container mx-auto px-4 py-8 text-gray-400">Lade…</div>;
  if (!data) return <div className="container mx-auto px-4 py-8 text-red-600">Kontrakt nicht gefunden.</div>;

  const bis = new Date(data.gueltigBis);
  const now = new Date();
  const diffDays = Math.ceil((bis.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const showAblaufWarnung = data.status === "AKTIV" && diffDays <= 30;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/kontrakte" className="hover:text-green-700">Kontrakte</Link>
        <span>›</span>
        <span className="text-gray-900 font-medium">{data.nummer}</span>
      </nav>

      <div className="flex items-start justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{data.nummer}</h1>
          <div className="flex items-center gap-2 mt-1">
            <StatusBadge status={data.status} />
            <span className="text-sm text-gray-500">
              {new Date(data.gueltigVon).toLocaleDateString("de-DE")} –{" "}
              {new Date(data.gueltigBis).toLocaleDateString("de-DE")}
            </span>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {data.status === "AKTIV" && (
            <>
              <button
                onClick={() => { if (confirm("Kontrakt abschließen?")) handleAktion("abschliessen"); }}
                disabled={saving}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                Abschließen
              </button>
              <button
                onClick={() => { if (confirm("Kontrakt wirklich stornieren?")) handleAktion("stornieren"); }}
                disabled={saving}
                className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                Stornieren
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {showAblaufWarnung && (
        <div className="bg-orange-50 border border-orange-200 text-orange-700 text-sm rounded-lg px-4 py-3 mb-4">
          {diffDays < 0
            ? "Dieser Kontrakt ist abgelaufen."
            : `Dieser Kontrakt läuft in ${diffDays} Tag${diffDays === 1 ? "" : "en"} ab.`}
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Kontraktdetails</p>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Kunde</span>
              <span className="font-medium text-gray-900">
                {data.kunde ? (
                  <Link href={`/kunden/${data.kunde.id}`} className="text-green-700 hover:underline">
                    {data.kunde.firma ?? data.kunde.name}
                  </Link>
                ) : "—"}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Gültig von</span>
              <span className="text-gray-900">{new Date(data.gueltigVon).toLocaleDateString("de-DE")}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Gültig bis</span>
              <span className="text-gray-900">{new Date(data.gueltigBis).toLocaleDateString("de-DE")}</span>
            </div>
          </div>
        </div>
        {data.notiz && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Notiz</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{data.notiz}</p>
          </div>
        )}
      </div>

      {/* Positionen mit Fortschrittsbalken */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Positionen & Abruf-Fortschritt</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {data.positionen.length === 0 ? (
            <p className="px-4 py-6 text-gray-400 text-sm">Keine Positionen vorhanden.</p>
          ) : (
            data.positionen.map((pos) => (
              <div key={pos.id} className="px-4 py-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {pos.artikel ? (
                        <Link href={`/artikel/${pos.artikel.id}`} className="text-green-700 hover:underline">
                          {pos.artikel.name}
                        </Link>
                      ) : "—"}
                    </p>
                    {pos.artikel?.artikelnummer && (
                      <p className="text-xs text-gray-400">{pos.artikel.artikelnummer}</p>
                    )}
                  </div>
                  {pos.preis != null && (
                    <span className="text-sm text-gray-600 whitespace-nowrap">
                      {pos.preis.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
                    </span>
                  )}
                </div>
                <Fortschrittsbalken menge={pos.menge} abgerufen={pos.mengeAbgerufen} einheit={pos.einheit} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
