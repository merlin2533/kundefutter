"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { formatDatum } from "@/lib/utils";
import { berechneEierMhd } from "@/lib/eier-mhd";
import * as Sentry from "@sentry/nextjs";

interface Position {
  id: number;
  gueteklasse: string;
  gewichtsklasse: string;
  menge: number;
  chargeNr: string | null;
  legedatum: string | null;
  erzeugercode: string | null;
  artikel: { id: number; name: string; einheit: string };
}

interface Sortierung {
  id: number;
  datum: string;
  notiz: string | null;
  erstelltVon: string | null;
  anlieferung: {
    id: number;
    nummer: string;
    kunde: { id: number; name: string; firma: string | null; erzeugercode: string | null; haltungsform: number | null };
  } | null;
  positionen: Position[];
}

function mhdVon(legedatum: string | null): string | null {
  if (!legedatum) return null;
  return berechneEierMhd(new Date(legedatum)).toLocaleDateString("de-DE");
}

export default function EiersortierungDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [sortierung, setSortierung] = useState<Sortierung | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetch(`/api/eiersortierung/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setSortierung)
      .catch((err) => Sentry.captureException(err))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleDelete() {
    if (!confirm("Diese Sortierung wirklich löschen? Der gebuchte Lagerzugang wird zurückgebucht.")) return;
    setDeleting(true);
    const res = await fetch(`/api/eiersortierung/${id}`, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) router.push("/eiersortierung");
  }

  if (loading) return <p className="text-sm text-gray-400">Lade…</p>;
  if (!sortierung) return <p className="text-sm text-red-600">Nicht gefunden.</p>;

  const gesamtMenge = sortierung.positionen.reduce((sum, p) => sum + p.menge, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Ei-Sortierung #{sortierung.id}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{formatDatum(sortierung.datum)}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/eiersortierung" className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 font-medium">
            Zurück
          </Link>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-4 py-2 text-sm rounded-lg border border-red-300 text-red-700 hover:bg-red-50 font-medium disabled:opacity-60"
          >
            {deleting ? "Lösche…" : "Löschen"}
          </button>
        </div>
      </div>

      {sortierung.anlieferung && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Herkunft</h2>
          <p className="text-sm text-gray-800">
            Anlieferung {sortierung.anlieferung.nummer} von {sortierung.anlieferung.kunde.firma || sortierung.anlieferung.kunde.name}
          </p>
          {sortierung.anlieferung.kunde.erzeugercode && (
            <p className="text-xs text-gray-500 mt-1">Erzeugercode: {sortierung.anlieferung.kunde.erzeugercode}</p>
          )}
        </div>
      )}

      {sortierung.notiz && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-1">Notiz</h2>
          <p className="text-sm text-gray-600">{sortierung.notiz}</p>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Ausgangschargen ({sortierung.positionen.length})</h2>
          <span className="text-xs text-gray-500">Gesamt: {gesamtMenge}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="text-left px-4 py-2">Artikel</th>
                <th className="text-left px-4 py-2">Güte</th>
                <th className="text-left px-4 py-2">Gewicht</th>
                <th className="text-right px-4 py-2">Menge</th>
                <th className="text-left px-4 py-2">Charge</th>
                <th className="text-left px-4 py-2">Legedatum</th>
                <th className="text-left px-4 py-2">MHD</th>
                <th className="text-left px-4 py-2">Erzeugercode</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortierung.positionen.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2">{p.artikel.name}</td>
                  <td className="px-4 py-2">{p.gueteklasse}</td>
                  <td className="px-4 py-2">{p.gewichtsklasse}</td>
                  <td className="px-4 py-2 text-right">{p.menge} {p.artikel.einheit}</td>
                  <td className="px-4 py-2">{p.chargeNr || "—"}</td>
                  <td className="px-4 py-2">{p.legedatum ? formatDatum(p.legedatum) : "—"}</td>
                  <td className="px-4 py-2">{mhdVon(p.legedatum) ?? "—"}</td>
                  <td className="px-4 py-2">{p.erzeugercode || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
