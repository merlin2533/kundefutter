"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { formatDatum } from "@/lib/utils";

interface Position {
  id: number; sorte: string; saatstaerke?: number | null; ertragDtHa?: number | null;
  feuchteProzent?: number | null; proteinProzent?: number | null;
  hektolitergew?: number | null; bonitur?: number | null; reife?: string | null;
  notiz?: string | null;
}
interface Versuch {
  id: number; name: string; jahr: number; kultur: string; standort?: string | null;
  flaeche?: number | null; status: string; notiz?: string | null;
  startDatum?: string | null; endeDatum?: string | null;
  kunde?: { id: number; name: string; firma?: string | null } | null;
  schlag?: { id: number; name: string } | null;
  positionen: Position[];
}

export default function SortenversuchDruckPage() {
  const { id } = useParams<{ id: string }>();
  const [v, setV] = useState<Versuch | null>(null);
  const [firma, setFirma] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/sortenversuche/${id}`).then((r) => (r.ok ? r.json() : null)),
      fetch("/api/einstellungen?prefix=firma.").then((r) => (r.ok ? r.json() : {})),
    ])
      .then(([versuch, firmaData]) => {
        setV(versuch);
        setFirma(firmaData || {});
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (v) {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [v]);

  if (loading) return <div className="p-6 text-sm text-gray-500">Lade…</div>;
  if (!v) return <div className="p-6 text-sm text-gray-600">Versuch nicht gefunden.</div>;

  const sortiert = [...v.positionen].sort((a, b) => (b.ertragDtHa ?? 0) - (a.ertragDtHa ?? 0));
  const firmenname = firma["firma.name"] || firma["firma.firmenname"] || "";
  const heute = formatDatum(new Date().toISOString());

  return (
    <div className="mx-auto max-w-3xl p-8 text-sm text-gray-900 print:p-0">
      <style>{`@media print { @page { margin: 1.5cm; size: A4; } }`}</style>

      {/* Kopf */}
      <div className="flex justify-between items-start border-b border-gray-300 pb-3 mb-5">
        <div>
          {firmenname && <p className="font-bold text-base">{firmenname}</p>}
          <p className="text-xs text-gray-500">Sortenversuch / Demofläche</p>
        </div>
        <div className="text-right text-xs text-gray-500">Gedruckt: {heute}</div>
      </div>

      <h1 className="text-xl font-bold mb-1">{v.name}</h1>
      <p className="text-gray-600 mb-4">
        {v.jahr} · {v.kultur}
        {v.standort ? ` · ${v.standort}` : ""}
        {v.flaeche ? ` · ${v.flaeche} ha` : ""} · {v.status}
      </p>

      {/* Stammdaten */}
      <table className="w-full mb-5">
        <tbody>
          <tr>
            <td className="py-0.5 pr-4 text-gray-500 w-40">Aussaat</td>
            <td className="py-0.5">{v.startDatum ? formatDatum(v.startDatum) : "–"}</td>
            <td className="py-0.5 pr-4 text-gray-500 w-32">Ernte</td>
            <td className="py-0.5">{v.endeDatum ? formatDatum(v.endeDatum) : "–"}</td>
          </tr>
          <tr>
            <td className="py-0.5 pr-4 text-gray-500">Kunde</td>
            <td className="py-0.5">{v.kunde?.name ?? "–"}</td>
            <td className="py-0.5 pr-4 text-gray-500">Schlag</td>
            <td className="py-0.5">{v.schlag?.name ?? "–"}</td>
          </tr>
        </tbody>
      </table>

      {/* Ergebnis-Tabelle */}
      <h2 className="font-semibold mb-2">Ergebnisse (nach Ertrag sortiert)</h2>
      <table className="w-full border-collapse mb-5">
        <thead>
          <tr className="border-y border-gray-400 text-left">
            <th className="py-1 pr-2">#</th>
            <th className="py-1 pr-2">Sorte</th>
            <th className="py-1 pr-2">Saatstärke</th>
            <th className="py-1 pr-2">Ertrag dt/ha</th>
            <th className="py-1 pr-2">Feuchte</th>
            <th className="py-1 pr-2">Protein</th>
            <th className="py-1 pr-2">hl-Gew</th>
            <th className="py-1 pr-2">Bonitur</th>
            <th className="py-1">Reife</th>
          </tr>
        </thead>
        <tbody>
          {sortiert.map((p, i) => (
            <tr key={p.id} className="border-b border-gray-200 align-top">
              <td className="py-1 pr-2">{i + 1}</td>
              <td className="py-1 pr-2 font-medium">
                {p.sorte}
                {p.notiz ? <div className="text-xs text-gray-500 font-normal">{p.notiz}</div> : null}
              </td>
              <td className="py-1 pr-2">{p.saatstaerke ?? "–"}</td>
              <td className="py-1 pr-2">{p.ertragDtHa ?? "–"}</td>
              <td className="py-1 pr-2">{p.feuchteProzent != null ? `${p.feuchteProzent}%` : "–"}</td>
              <td className="py-1 pr-2">{p.proteinProzent != null ? `${p.proteinProzent}%` : "–"}</td>
              <td className="py-1 pr-2">{p.hektolitergew ?? "–"}</td>
              <td className="py-1 pr-2">{p.bonitur ?? "–"}</td>
              <td className="py-1">{p.reife ?? "–"}</td>
            </tr>
          ))}
          {sortiert.length === 0 && (
            <tr><td colSpan={9} className="py-2 text-gray-400">Keine Sorten erfasst.</td></tr>
          )}
        </tbody>
      </table>

      {/* Notizen */}
      {v.notiz && (
        <div className="mb-5">
          <h2 className="font-semibold mb-1">Notizen / Kommentare</h2>
          <p className="whitespace-pre-line text-gray-700">{v.notiz}</p>
        </div>
      )}

      <p className="text-xs text-gray-400 border-t border-gray-200 pt-2 mt-8 print:hidden">
        Dieses Fenster zum Drucken nutzen oder schließen.
      </p>
    </div>
  );
}
