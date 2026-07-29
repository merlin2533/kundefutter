"use client";
import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatEuro, formatDatum } from "@/lib/utils";
import SearchableSelect from "@/components/SearchableSelect";
import * as Sentry from "@sentry/nextjs";

interface Kunde {
  id: number;
  name: string;
  firma: string | null;
}

interface Lieferung {
  id: number;
  rechnungNr: string | null;
  rechnungDatum: string | null;
  datum: string;
  bezahltAm: string | null;
  rechnungStorniert: string | null;
  positionen: { menge: number; verkaufspreis: number; rabattProzent: number }[];
}

function nettoBetrag(positionen: Lieferung["positionen"]) {
  return positionen.reduce((s, p) => s + p.menge * p.verkaufspreis * (1 - p.rabattProzent / 100), 0);
}

function NeueRechnungsuebersichtForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [kunden, setKunden] = useState<Kunde[]>([]);
  const [kundeId, setKundeId] = useState(searchParams.get("kundeId") ?? "");
  const [rechnungen, setRechnungen] = useState<Lieferung[]>([]);
  const [ausgewaehlt, setAusgewaehlt] = useState<Set<number>>(new Set());
  const [titel, setTitel] = useState("");
  const [notiz, setNotiz] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingRechnungen, setLoadingRechnungen] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Vollständig paginiert laden statt fixem Limit: bei mehr als 1000 Kunden würde ein
    // einzelner Request sonst still einen Teil verschweigen — dann fehlten Kunden in der
    // Auswahl/Suche, ohne dass ein Fehler sichtbar wird.
    async function ladeAlleKunden() {
      const alle: Kunde[] = [];
      let page = 1;
      const limit = 1000;
      for (;;) {
        const res = await fetch(`/api/kunden?page=${page}&limit=${limit}&kontakte=false`);
        if (!res.ok) break;
        const d = await res.json() as { data?: Kunde[]; total?: number };
        const batch = Array.isArray(d.data) ? d.data : [];
        alle.push(...batch);
        if (batch.length < limit || alle.length >= (d.total ?? 0)) break;
        page += 1;
      }
      setKunden(alle);
    }
    ladeAlleKunden().catch((err) => {
      Sentry.captureException(err);
    });
  }, []);

  useEffect(() => {
    if (!kundeId) { setRechnungen([]); setAusgewaehlt(new Set()); return; }
    setLoadingRechnungen(true);
    fetch(`/api/lieferungen?kundeId=${kundeId}&hatRechnung=true&limit=500`)
      .then((r) => r.ok ? r.json() : [])
      .then((data: Lieferung[]) => {
        const list = Array.isArray(data) ? data : [];
        // Stornierte Rechnungen ergeben in einer Gesamtsummen-Übersicht keinen Sinn
        const verfuegbar = list.filter((l) => !l.rechnungStorniert);
        setRechnungen(verfuegbar);
        setAusgewaehlt(new Set());
      })
      .catch((err) => Sentry.captureException(err))
      .finally(() => setLoadingRechnungen(false));
  }, [kundeId]);

  function toggle(id: number) {
    setAusgewaehlt((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function alleUmschalten() {
    setAusgewaehlt((prev) => (prev.size === rechnungen.length ? new Set() : new Set(rechnungen.map((r) => r.id))));
  }

  const gesamtsumme = rechnungen
    .filter((r) => ausgewaehlt.has(r.id))
    .reduce((s, r) => s + nettoBetrag(r.positionen), 0);

  async function speichern() {
    if (!kundeId || ausgewaehlt.size === 0) {
      setError("Bitte Kunde und mindestens eine Rechnung auswählen.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/rechnungsuebersicht", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kundeId: Number(kundeId),
          titel: titel.trim() || undefined,
          notiz: notiz.trim() || undefined,
          lieferungIds: Array.from(ausgewaehlt),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Fehler beim Erstellen.");
        return;
      }
      router.push(`/rechnungsuebersicht/${data.id}`);
    } catch (err) {
      Sentry.captureException(err);
      setError("Netzwerkfehler beim Erstellen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Neue Rechnungsübersicht</h1>
      <p className="text-sm text-gray-500 mb-6">
        Mehrere bereits ausgestellte Rechnungen eines Kunden zu einer Übersicht mit Gesamtsumme zusammenfassen.
        Die ausgewählten Rechnungen bleiben unverändert eigenständige Rechnungen.
      </p>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Kunde <span className="text-red-500">*</span>
          </label>
          <SearchableSelect
            options={kunden.map((k) => ({ value: k.id, label: k.firma ?? k.name, sub: k.firma ? k.name : undefined }))}
            value={kundeId}
            onChange={setKundeId}
            placeholder="— Kunde wählen —"
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Titel <span className="text-gray-400 text-xs">(optional)</span>
            </label>
            <input
              type="text"
              value={titel}
              onChange={(e) => setTitel(e.target.value)}
              placeholder="z.B. Übersicht Juli 2026"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notiz <span className="text-gray-400 text-xs">(optional)</span>
            </label>
            <input
              type="text"
              value={notiz}
              onChange={(e) => setNotiz(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        {kundeId && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Rechnungen auswählen <span className="text-red-500">*</span>
              </label>
              {rechnungen.length > 0 && (
                <button type="button" onClick={alleUmschalten} className="text-xs text-green-700 hover:text-green-900 font-medium">
                  {ausgewaehlt.size === rechnungen.length ? "Alle abwählen" : "Alle auswählen"}
                </button>
              )}
            </div>

            {loadingRechnungen ? (
              <p className="text-sm text-gray-400">Lade Rechnungen…</p>
            ) : rechnungen.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Dieser Kunde hat noch keine ausgestellten Rechnungen.</p>
            ) : (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="w-8 px-3 py-2"></th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">Rechnungsnr.</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600 hidden sm:table-cell">Datum</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600 hidden sm:table-cell">Status</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-600">Nettobetrag</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rechnungen.map((r) => (
                      <tr
                        key={r.id}
                        onClick={() => toggle(r.id)}
                        className={`cursor-pointer transition-colors ${ausgewaehlt.has(r.id) ? "bg-green-50" : "hover:bg-gray-50"}`}
                      >
                        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={ausgewaehlt.has(r.id)}
                            onChange={() => toggle(r.id)}
                            className="rounded"
                          />
                        </td>
                        <td className="px-3 py-2 font-mono">
                          {r.rechnungNr}
                          <div className="sm:hidden text-xs text-gray-400 mt-0.5">{formatDatum(r.rechnungDatum ?? r.datum)}</div>
                        </td>
                        <td className="px-3 py-2 text-gray-600 hidden sm:table-cell">{formatDatum(r.rechnungDatum ?? r.datum)}</td>
                        <td className="px-3 py-2 hidden sm:table-cell">
                          {r.bezahltAm ? (
                            <span className="text-xs px-2 py-0.5 bg-green-100 text-green-800 rounded-full font-medium">Bezahlt</span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-full font-medium">Offen</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">{formatEuro(nettoBetrag(r.positionen))}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 border-t-2 border-gray-200">
                      <td colSpan={4} className="px-3 py-2.5 font-semibold text-gray-700">
                        {ausgewaehlt.size} von {rechnungen.length} ausgewählt
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-gray-900 font-mono">{formatEuro(gesamtsumme)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.push("/rechnungsuebersicht")}
            className="px-4 py-2.5 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 w-full sm:w-auto"
          >
            Abbrechen
          </button>
          <button
            onClick={speichern}
            disabled={loading || !kundeId || ausgewaehlt.size === 0}
            className="px-4 py-2.5 text-sm rounded-lg bg-green-700 hover:bg-green-800 text-white font-medium disabled:opacity-60 w-full sm:w-auto"
          >
            {loading ? "Speichern…" : "Übersicht erstellen"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function NeueRechnungsuebersichtPage() {
  return (
    <Suspense fallback={<p className="text-gray-400 text-sm p-6">Lade…</p>}>
      <NeueRechnungsuebersichtForm />
    </Suspense>
  );
}
