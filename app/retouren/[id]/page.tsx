"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { formatEuro, formatDatum } from "@/lib/utils";
import * as Sentry from "@sentry/nextjs";

interface RetourePosition {
  id: number;
  menge: number;
  einkaufspreis: number;
  chargeNr?: string | null;
  artikel: { id: number; name: string; einheit: string; artikelnummer?: string };
}

interface Retoure {
  id: number;
  nummer: string;
  datum: string;
  grund: string;
  status: string;
  notiz?: string | null;
  gutschriftBetrag?: number | null;
  lieferant: { id: number; name: string };
  eingangsRechnung?: { id: number; nummer: string | null; betrag: number; status: string } | null;
  positionen: RetourePosition[];
}

export default function RetoureDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [retoure, setRetoure] = useState<Retoure | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/retouren/${id}`, { cache: "no-store" });
    if (!res.ok) { setLoading(false); setError("Retoure nicht gefunden."); return; }
    const data = await res.json();
    setRetoure(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function stornieren() {
    if (!confirm("Retoure stornieren? Der Lagerbestand wird zurückgebucht und die Lieferantengutschrift aufgehoben.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/retouren/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aktion: "stornieren" }),
      });
      if (!res.ok) {
        const d = await res.json().catch((err) => {
          Sentry.captureException(err);
          return ({});
        });
        throw new Error((d as { error?: string }).error || "Storno fehlgeschlagen");
      }
      await load();
    } catch (e) {
      Sentry.captureException(e);
      alert(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="text-gray-400 text-sm p-6">Lade Retoure…</div>;
  if (error || !retoure) return <div className="text-red-600 text-sm p-6">{error || "Nicht gefunden"}</div>;

  const summe = typeof retoure.gutschriftBetrag === "number"
    ? retoure.gutschriftBetrag
    : retoure.positionen.reduce((s, p) => s + p.menge * p.einkaufspreis, 0);

  return (
    <div className="max-w-3xl">
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/retouren" className="hover:text-green-700">Retouren</Link>
        <span>›</span>
        <span className="text-gray-900 font-medium">{retoure.nummer}</span>
      </nav>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold mb-1">Retoure {retoure.nummer}</h1>
            <div className="flex items-center gap-3 flex-wrap text-sm text-gray-600">
              <Link href={`/lieferanten/${retoure.lieferant.id}`} className="font-medium text-gray-800 hover:text-green-700">
                {retoure.lieferant.name}
              </Link>
              <span>·</span>
              <span>{formatDatum(retoure.datum)}</span>
              <span>·</span>
              <span>{retoure.grund}</span>
              <span>·</span>
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${retoure.status === "STORNIERT" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-800"}`}>
                {retoure.status === "STORNIERT" ? "Storniert" : "Gebucht"}
              </span>
            </div>
            {retoure.notiz && <p className="mt-2 text-sm text-gray-500 italic">{retoure.notiz}</p>}
            {retoure.eingangsRechnung && (
              <p className="mt-2 text-sm text-gray-700">
                Lieferantengutschrift:{" "}
                <Link href={`/eingangsrechnungen/${retoure.eingangsRechnung.id}`} className="font-mono text-green-700 hover:underline">
                  {retoure.eingangsRechnung.nummer ?? `ER #${retoure.eingangsRechnung.id}`}
                </Link>{" "}
                <span className="text-gray-500">({formatEuro(retoure.eingangsRechnung.betrag)})</span>
              </p>
            )}
          </div>
          {retoure.status === "GEBUCHT" && (
            <button
              onClick={stornieren}
              disabled={busy}
              className="px-3 py-1.5 border border-red-300 text-red-700 text-xs font-semibold rounded-lg hover:bg-red-50 transition-colors disabled:opacity-60"
            >
              {busy ? "…" : "Stornieren"}
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Artikel</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Charge</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Menge</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">EK-Preis</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Summe</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {retoure.positionen.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3">
                  <Link href={`/artikel/${p.artikel.id}`} className="font-medium text-gray-900 hover:text-green-700">
                    {p.artikel.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{p.chargeNr ?? "—"}</td>
                <td className="px-4 py-3 text-right">{p.menge} {p.artikel.einheit}</td>
                <td className="px-4 py-3 text-right">{formatEuro(p.einkaufspreis)}</td>
                <td className="px-4 py-3 text-right font-medium">{formatEuro(p.menge * p.einkaufspreis)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-gray-200">
            <tr>
              <td colSpan={4} className="px-4 py-3 text-right text-sm text-gray-600">Gesamt Lieferantengutschrift:</td>
              <td className="px-4 py-3 text-right font-bold">{formatEuro(summe)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
