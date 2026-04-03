"use client";
import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { formatEuro, formatDatum } from "@/lib/utils";
import SearchableSelect from "@/components/SearchableSelect";

interface Kunde {
  id: number;
  name: string;
  firma: string | null;
}

interface Lieferung {
  id: number;
  datum: string;
  status: string;
  rechnungNr: string | null;
  sammelrechnungId: number | null;
  positionen: { menge: number; verkaufspreis: number; rabattProzent: number }[];
}

function berechneBetrag(positionen: Lieferung["positionen"]) {
  return positionen.reduce((s, p) => s + p.menge * p.verkaufspreis * (1 - p.rabattProzent / 100), 0);
}

function NeueSammelrechnungForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [kunden, setKunden] = useState<Kunde[]>([]);
  const [kundeId, setKundeId] = useState(searchParams.get("kundeId") ?? "");
  const [lieferungen, setLieferungen] = useState<Lieferung[]>([]);
  const [ausgewaehlt, setAusgewaehlt] = useState<Set<number>>(new Set());
  const [zahlungsziel, setZahlungsziel] = useState("30");
  const [notiz, setNotiz] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingLieferungen, setLoadingLieferungen] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/kunden?limit=500")
      .then((r) => r.json())
      .then((data) => setKunden(Array.isArray(data) ? data : (data.kunden ?? [])));
  }, []);

  useEffect(() => {
    if (!kundeId) { setLieferungen([]); setAusgewaehlt(new Set()); return; }
    setLoadingLieferungen(true);
    fetch(`/api/lieferungen?kundeId=${kundeId}&status=geliefert`)
      .then((r) => r.json())
      .then((data: Lieferung[]) => {
        // Nur Lieferungen ohne bestehende Einzel-Rechnung und ohne Sammelrechnung
        const verfuegbar = data.filter((l) => !l.rechnungNr && !l.sammelrechnungId);
        setLieferungen(verfuegbar);
        setAusgewaehlt(new Set(verfuegbar.map((l) => l.id)));
      })
      .finally(() => setLoadingLieferungen(false));
  }, [kundeId]);

  async function speichern() {
    if (!kundeId || ausgewaehlt.size === 0) {
      setError("Bitte Kunde und mindestens eine Lieferung auswählen.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/sammelrechnungen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kundeId: parseInt(kundeId, 10),
          lieferungIds: [...ausgewaehlt],
          zahlungsziel: parseInt(zahlungsziel, 10) || 30,
          notiz: notiz.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Fehler");
      }
      router.push("/sammelrechnungen");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Erstellen");
    } finally {
      setLoading(false);
    }
  }

  const gesamtbetrag = lieferungen
    .filter((l) => ausgewaehlt.has(l.id))
    .reduce((s, l) => s + berechneBetrag(l.positionen), 0);

  const kundenOptionen = kunden.map((k) => ({
    value: String(k.id),
    label: k.firma ? `${k.firma} (${k.name})` : k.name,
  }));

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/sammelrechnungen" className="text-gray-400 hover:text-gray-600 text-sm">
          ← Zurück
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Neue Sammelrechnung</h1>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
        {/* Kunde */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Kunde *</label>
          <SearchableSelect
            options={kundenOptionen}
            value={kundeId}
            onChange={setKundeId}
            placeholder="Kunde suchen…"
          />
        </div>

        {/* Lieferungen */}
        {kundeId && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                Lieferungen auswählen
                {lieferungen.length > 0 && (
                  <span className="ml-1.5 text-xs text-gray-400">({lieferungen.length} verfügbar)</span>
                )}
              </label>
              {lieferungen.length > 0 && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAusgewaehlt(new Set(lieferungen.map((l) => l.id)))}
                    className="text-xs text-green-700 hover:underline"
                  >
                    Alle
                  </button>
                  <button
                    type="button"
                    onClick={() => setAusgewaehlt(new Set())}
                    className="text-xs text-gray-500 hover:underline"
                  >
                    Keine
                  </button>
                </div>
              )}
            </div>

            {loadingLieferungen ? (
              <p className="text-sm text-gray-400">Lade Lieferungen…</p>
            ) : lieferungen.length === 0 ? (
              <p className="text-sm text-gray-400 bg-gray-50 border border-gray-200 rounded-lg px-3 py-3">
                Keine offenen Lieferungen ohne Rechnung gefunden.
              </p>
            ) : (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                {lieferungen.map((l, i) => {
                  const betrag = berechneBetrag(l.positionen);
                  const checked = ausgewaehlt.has(l.id);
                  return (
                    <label
                      key={l.id}
                      className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                        i > 0 ? "border-t border-gray-100" : ""
                      } ${checked ? "bg-green-50" : "hover:bg-gray-50"}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const next = new Set(ausgewaehlt);
                          if (e.target.checked) next.add(l.id);
                          else next.delete(l.id);
                          setAusgewaehlt(next);
                        }}
                        className="w-4 h-4 accent-green-600"
                      />
                      <span className="flex-1 text-sm">
                        Lieferung #{l.id} · {formatDatum(l.datum)}
                      </span>
                      <span className="text-sm font-mono font-medium text-gray-700">{formatEuro(betrag)}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Zahlungsziel */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Zahlungsziel (Tage)</label>
          <input
            type="number"
            min={0}
            value={zahlungsziel}
            onChange={(e) => setZahlungsziel(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {/* Notiz */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Notiz</label>
          <textarea
            value={notiz}
            onChange={(e) => setNotiz(e.target.value)}
            rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="Optionale Notiz…"
          />
        </div>

        {/* Gesamtbetrag */}
        {ausgewaehlt.size > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex items-center justify-between">
            <span className="text-sm font-medium text-green-800">
              {ausgewaehlt.size} Lieferung{ausgewaehlt.size !== 1 ? "en" : ""} ausgewählt
            </span>
            <span className="text-lg font-bold text-green-900 font-mono">{formatEuro(gesamtbetrag)}</span>
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={speichern}
            disabled={loading || !kundeId || ausgewaehlt.size === 0}
            className="flex-1 sm:flex-none px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
          >
            {loading ? "Erstelle…" : "Sammelrechnung erstellen"}
          </button>
          <Link
            href="/sammelrechnungen"
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Abbrechen
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function NeueSammelrechnungPage() {
  return (
    <Suspense>
      <NeueSammelrechnungForm />
    </Suspense>
  );
}
