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
  const [notizEdit, setNotizEdit] = useState("");
  const [notizSaving, setNotizSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/sortenversuche/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setV(d); setNotizEdit(d?.notiz ?? ""); })
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
      setV((prev) => prev ? { ...prev, status: data.status } : data);
      toast.success("Status geändert");
    }
  }

  async function speichereNotiz() {
    setNotizSaving(true);
    try {
      const r = await fetch(`/api/sortenversuche/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notiz: notizEdit }),
      });
      if (!r.ok) throw new Error();
      setV((prev) => prev ? { ...prev, notiz: notizEdit.trim() || null } : prev);
      toast.success("Notiz gespeichert");
    } catch {
      toast.error("Notiz konnte nicht gespeichert werden");
    } finally {
      setNotizSaving(false);
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
          <Link
            href={`/sortenversuche/${v.id}/druck`}
            target="_blank"
            rel="noreferrer"
            className="border px-3 py-1 rounded hover:bg-gray-50"
          >
            🖨 Drucken
          </Link>
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
        </div>
      </Card>

      <Card className="mb-4">
        <h2 className="font-semibold mb-1">Notizen / Kommentare</h2>
        <p className="text-xs text-gray-500 mb-3">
          Beobachtungen zum Versuch festhalten – z. B. Witterung, Krankheitsdruck, Auffälligkeiten je Sorte.
        </p>
        <textarea
          value={notizEdit}
          onChange={(e) => setNotizEdit(e.target.value)}
          rows={5}
          placeholder="Notiz erfassen…"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-y"
        />
        <div className="flex items-center gap-3 mt-2">
          <button
            onClick={speichereNotiz}
            disabled={notizSaving || notizEdit === (v.notiz ?? "")}
            className="bg-green-700 hover:bg-green-800 text-white px-4 py-1.5 rounded text-sm font-medium disabled:opacity-50"
          >
            {notizSaving ? "Speichern…" : "Notiz speichern"}
          </button>
          {notizEdit !== (v.notiz ?? "") && (
            <button
              onClick={() => setNotizEdit(v.notiz ?? "")}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Verwerfen
            </button>
          )}
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
