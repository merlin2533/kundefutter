"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/Card";
import { useToast } from "@/components/ToastProvider";
import { formatDatum } from "@/lib/utils";

interface Position {
  id: number; sorte: string; saatstaerke?: number | null; ertragDtHa?: number | null;
  feuchteProzent?: number | null; proteinProzent?: number | null;
  hektolitergew?: number | null; bonitur?: number | null; reife?: string | null;
}
interface Versuch {
  id: number; name: string; jahr: number; kultur: string; standort?: string | null;
  flaeche?: number | null; status: string; notiz?: string | null;
  startDatum?: string | null; endeDatum?: string | null;
  kunde?: { id: number; name: string } | null;
  positionen: Position[];
}

export default function DetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const [v, setV] = useState<Versuch | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/sortenversuche/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setV(d))
      .finally(() => setLoading(false));
  }, [id]);

  async function setzeStatus(s: string) {
    const r = await fetch(`/api/sortenversuche/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: s }),
    });
    if (r.ok) {
      const data = await r.json();
      setV(data);
      toast.success("Status geändert");
    }
  }

  async function loeschen() {
    if (!confirm("Versuch wirklich löschen?")) return;
    const r = await fetch(`/api/sortenversuche/${id}`, { method: "DELETE" });
    if (r.ok) {
      toast.success("Gelöscht");
      router.push("/sortenversuche");
    }
  }

  if (loading) return <div className="p-6">Lade…</div>;
  if (!v) return <div className="p-6">Versuch nicht gefunden.</div>;

  const sortiert = [...v.positionen].sort((a, b) => (b.ertragDtHa ?? 0) - (a.ertragDtHa ?? 0));

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex flex-wrap justify-between items-start mb-4 gap-3">
        <div>
          <Link href="/sortenversuche" className="text-sm text-gray-500 hover:underline">← Versuche</Link>
          <h1 className="text-2xl font-bold mt-1">{v.name}</h1>
          <div className="text-sm text-gray-600 mt-1">
            {v.jahr} · {v.kultur}{v.standort ? ` · ${v.standort}` : ""}{v.flaeche ? ` · ${v.flaeche} ha` : ""} · {v.status}
          </div>
        </div>
        <div className="flex gap-2">
          {v.status === "LAUFEND" ? (
            <button onClick={() => setzeStatus("ABGESCHLOSSEN")} className="bg-green-700 text-white px-3 py-1 rounded">Abschließen</button>
          ) : (
            <button onClick={() => setzeStatus("LAUFEND")} className="border px-3 py-1 rounded">Wieder öffnen</button>
          )}
          <button onClick={loeschen} className="border text-red-600 px-3 py-1 rounded">Löschen</button>
        </div>
      </div>

      <Card className="mb-4">
        <h2 className="font-semibold mb-3">Stammdaten</h2>
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <div><strong>Aussaat:</strong> {v.startDatum ? formatDatum(v.startDatum) : "–"}</div>
          <div><strong>Ernte:</strong> {v.endeDatum ? formatDatum(v.endeDatum) : "–"}</div>
          <div><strong>Kunde:</strong> {v.kunde ? <Link href={`/kunden/${v.kunde.id}`} className="text-green-700 hover:underline">{v.kunde.name}</Link> : "–"}</div>
          <div className="sm:col-span-2"><strong>Notiz:</strong> {v.notiz ?? "–"}</div>
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold mb-3">Ergebnis-Tabelle (nach Ertrag sortiert)</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th>#</th><th>Sorte</th><th>Saatstärke</th>
                <th>Ertrag (dt/ha)</th><th>Feuchte</th><th>Protein</th>
                <th>hl-Gew</th><th>Bonitur</th><th>Reife</th>
              </tr>
            </thead>
            <tbody>
              {sortiert.map((p, i) => (
                <tr key={p.id} className="border-b">
                  <td className="py-1">{i + 1}</td>
                  <td className="py-1 font-medium">{p.sorte}</td>
                  <td className="py-1">{p.saatstaerke ?? "–"}</td>
                  <td className="py-1">{p.ertragDtHa ?? "–"}</td>
                  <td className="py-1">{p.feuchteProzent != null ? `${p.feuchteProzent}%` : "–"}</td>
                  <td className="py-1">{p.proteinProzent != null ? `${p.proteinProzent}%` : "–"}</td>
                  <td className="py-1">{p.hektolitergew ?? "–"}</td>
                  <td className="py-1">{p.bonitur ?? "–"}</td>
                  <td className="py-1">{p.reife ?? "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
