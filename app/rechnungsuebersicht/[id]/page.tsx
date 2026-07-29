"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { formatEuro, formatDatum } from "@/lib/utils";
import * as Sentry from "@sentry/nextjs";

interface Lieferung {
  id: number;
  rechnungNr: string | null;
  rechnungDatum: string | null;
  datum: string;
  bezahltAm: string | null;
  rechnungStorniert: string | null;
  positionen: { menge: number; verkaufspreis: number; rabattProzent: number }[];
}

interface Rechnungsuebersicht {
  id: number;
  titel: string | null;
  notiz: string | null;
  createdAt: string;
  kunde: { id: number; name: string; firma: string | null; strasse: string | null; plz: string | null; ort: string | null };
  eintraege: { id: number; lieferung: Lieferung }[];
}

function nettoBetrag(positionen: Lieferung["positionen"]) {
  return positionen.reduce((s, p) => s + p.menge * p.verkaufspreis * (1 - p.rabattProzent / 100), 0);
}

function StatusBadge({ l }: { l: Lieferung }) {
  if (l.rechnungStorniert) return <span className="text-xs px-2 py-0.5 bg-red-100 text-red-800 rounded-full font-medium line-through">Storniert</span>;
  if (l.bezahltAm) return <span className="text-xs px-2 py-0.5 bg-green-100 text-green-800 rounded-full font-medium">Bezahlt</span>;
  return <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-full font-medium">Offen</span>;
}

export default function RechnungsuebersichtDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [uebersicht, setUebersicht] = useState<Rechnungsuebersicht | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/rechnungsuebersicht/${id}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setUebersicht)
      .catch((err) => {
        Sentry.captureException(err);
        setError("Rechnungsübersicht konnte nicht geladen werden.");
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function loeschen() {
    if (!uebersicht) return;
    if (!confirm("Diese Rechnungsübersicht löschen? Die zugrundeliegenden Rechnungen bleiben unverändert erhalten.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/rechnungsuebersicht/${uebersicht.id}`, { method: "DELETE" });
      if (res.ok) router.push("/rechnungsuebersicht");
      else setError("Löschen fehlgeschlagen.");
    } catch (err) {
      Sentry.captureException(err);
      setError("Netzwerkfehler beim Löschen.");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <p className="text-gray-400 text-sm p-6">Lade Rechnungsübersicht…</p>;
  if (error || !uebersicht) {
    return (
      <div className="p-6">
        <p className="text-red-600 mb-4">{error || "Nicht gefunden."}</p>
        <button onClick={() => router.push("/rechnungsuebersicht")} className="text-green-700 underline text-sm">← Zurück</button>
      </div>
    );
  }

  const k = uebersicht.kunde;
  const lieferungen = [...uebersicht.eintraege]
    .map((e) => e.lieferung)
    .sort((a, b) => new Date(a.rechnungDatum ?? a.datum).getTime() - new Date(b.rechnungDatum ?? b.datum).getTime());
  const gesamtsumme = lieferungen.reduce((s, l) => s + nettoBetrag(l.positionen), 0);

  return (
    <div className="max-w-3xl mx-auto">
      <button
        onClick={() => router.push("/rechnungsuebersicht")}
        className="text-sm text-green-700 hover:text-green-900 mb-3 inline-flex items-center gap-1"
      >
        ← Rechnungsübersichten
      </button>

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{uebersicht.titel ?? `Übersicht #${uebersicht.id}`}</h1>
          <p className="text-sm text-gray-500 mt-0.5">Erstellt am {formatDatum(uebersicht.createdAt)}</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/api/exporte/rechnungsuebersicht?id=${uebersicht.id}`}
            download
            className="px-3 py-2 bg-green-50 hover:bg-green-100 text-green-700 border border-green-300 text-sm font-medium rounded-lg transition-colors"
          >
            PDF herunterladen
          </a>
          <button
            onClick={loeschen}
            disabled={deleting}
            title="Löschen"
            className="p-2 rounded-lg border border-red-300 hover:bg-red-50 text-red-400 hover:text-red-600 disabled:opacity-60"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 mb-6">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Kunde</h3>
        <Link href={`/kunden/${k.id}`} className="text-lg font-semibold text-green-800 hover:underline">
          {k.firma ?? k.name}
        </Link>
        {k.firma && <p className="text-sm text-gray-500">{k.name}</p>}
        {(k.strasse || k.plz || k.ort) && (
          <p className="text-sm text-gray-500 mt-1">
            {[k.strasse, [k.plz, k.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ")}
          </p>
        )}
        {uebersicht.notiz && <p className="text-sm text-gray-600 mt-3 italic">{uebersicht.notiz}</p>}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Rechnungsnr.</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Datum</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Status</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Nettobetrag</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {lieferungen.map((l) => (
              <tr key={l.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link href={`/lieferungen/${l.id}/rechnung`} className="font-mono font-semibold text-green-800 hover:text-green-600 hover:underline">
                    {l.rechnungNr}
                  </Link>
                  <div className="sm:hidden text-xs text-gray-400 mt-0.5">{formatDatum(l.rechnungDatum ?? l.datum)}</div>
                  <div className="sm:hidden mt-1"><StatusBadge l={l} /></div>
                </td>
                <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{formatDatum(l.rechnungDatum ?? l.datum)}</td>
                <td className="px-4 py-3 hidden sm:table-cell"><StatusBadge l={l} /></td>
                <td className="px-4 py-3 text-right font-mono">{formatEuro(nettoBetrag(l.positionen))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 border-t-2 border-gray-200">
              <td colSpan={3} className="px-4 py-3 font-semibold text-gray-700">
                {lieferungen.length} Rechnung{lieferungen.length !== 1 ? "en" : ""}
              </td>
              <td className="px-4 py-3 text-right font-bold text-gray-900 font-mono">{formatEuro(gesamtsumme)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
