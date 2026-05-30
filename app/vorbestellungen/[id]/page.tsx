"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/Card";
import { useToast } from "@/components/ToastProvider";
import { formatDatum, formatEuro } from "@/lib/utils";

interface Position {
  id: number; menge: number; preis?: number | null; einheit: string;
  reserviert: boolean; notiz?: string | null;
  artikel: { id: number; name: string; einheit: string; standardpreis: number };
}
interface Vorbestellung {
  id: number; nummer: string; saison: string; status: string;
  bestelldatum: string; bestellfrist?: string | null; lieferdatum?: string | null;
  rabattProzent?: number | null; notiz?: string | null; lieferungId?: number | null;
  kunde: { id: number; name: string; firma?: string | null };
  positionen: Position[];
}

export default function DetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const [v, setV] = useState<Vorbestellung | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/vorbestellungen/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setV(d))
      .finally(() => setLoading(false));
  }, [id]);

  async function setzeStatus(status: string) {
    const r = await fetch(`/api/vorbestellungen/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (r.ok) { setV(await r.json()); toast.success("Status aktualisiert"); }
  }

  async function umwandeln() {
    if (!confirm("In Lieferung umwandeln?")) return;
    const r = await fetch(`/api/vorbestellungen/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aktion: "umwandeln" }),
    });
    if (r.ok) {
      const data = await r.json();
      toast.success("Lieferung erstellt");
      router.push(`/lieferungen/${data.lieferungId}`);
    } else {
      const err = await r.json().catch(() => ({}));
      toast.error(err.error ?? "Fehler");
    }
  }

  async function loeschen() {
    if (!confirm("Vorbestellung löschen?")) return;
    const r = await fetch(`/api/vorbestellungen/${id}`, { method: "DELETE" });
    if (r.ok) { toast.success("Gelöscht"); router.push("/vorbestellungen"); }
  }

  if (loading) return <div className="p-6">Lade…</div>;
  if (!v) return <div className="p-6">Vorbestellung nicht gefunden.</div>;

  const summe = v.positionen.reduce((s, p) => s + p.menge * (p.preis ?? p.artikel.standardpreis), 0);
  const rabatt = v.rabattProzent ? summe * (v.rabattProzent / 100) : 0;
  const total = summe - rabatt;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-wrap justify-between items-start mb-4 gap-3">
        <div>
          <Link href="/vorbestellungen" className="text-sm text-gray-500 hover:underline">← Vorbestellungen</Link>
          <h1 className="text-2xl font-bold mt-1">{v.nummer}</h1>
          <div className="text-sm text-gray-600 mt-1">
            <Link href={`/kunden/${v.kunde.id}`} className="hover:underline">{v.kunde.firma ?? v.kunde.name}</Link>
            {" · "}{v.saison}{" · "}<span className={`px-2 py-0.5 rounded text-xs ${v.status === "OFFEN" ? "bg-yellow-50 text-yellow-800" : v.status === "BESTAETIGT" ? "bg-green-50 text-green-800" : v.status === "UMGEWANDELT" ? "bg-blue-50 text-blue-800" : "bg-gray-100 text-gray-600"}`}>{v.status}</span>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {v.status === "OFFEN" && <button onClick={() => setzeStatus("BESTAETIGT")} className="bg-green-700 text-white px-3 py-1 rounded">Bestätigen</button>}
          {(v.status === "OFFEN" || v.status === "BESTAETIGT") && <button onClick={umwandeln} className="bg-blue-700 text-white px-3 py-1 rounded">→ Lieferung</button>}
          <Link href={`/vorbestellungen/${id}/auftragsbestaetigung`} className="border px-3 py-1 rounded flex items-center gap-1 hover:bg-gray-50">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
            Auftragsbestätigung
          </Link>
          {v.status !== "STORNIERT" && v.status !== "UMGEWANDELT" && <button onClick={() => setzeStatus("STORNIERT")} className="border px-3 py-1 rounded">Stornieren</button>}
          <button onClick={loeschen} className="border text-red-600 px-3 py-1 rounded">Löschen</button>
        </div>
      </div>

      <Card className="mb-4">
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <div><strong>Bestelldatum:</strong> {formatDatum(v.bestelldatum)}</div>
          <div><strong>Bestellfrist:</strong> {v.bestellfrist ? formatDatum(v.bestellfrist) : "–"}</div>
          <div><strong>Lieferdatum:</strong> {v.lieferdatum ? formatDatum(v.lieferdatum) : "–"}</div>
          <div><strong>Rabatt:</strong> {v.rabattProzent != null ? `${v.rabattProzent}%` : "–"}</div>
          {v.lieferungId && <div><strong>Lieferung:</strong> <Link href={`/lieferungen/${v.lieferungId}`} className="text-green-700 hover:underline">#{v.lieferungId}</Link></div>}
          {v.notiz && <div className="sm:col-span-2"><strong>Notiz:</strong> {v.notiz}</div>}
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold mb-3">Positionen</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead><tr className="text-left border-b"><th>Artikel</th><th>Menge</th><th>Einheit</th><th>Preis</th><th>Summe</th><th>Reserviert</th></tr></thead>
            <tbody>
              {v.positionen.map(p => {
                const preis = p.preis ?? p.artikel.standardpreis;
                return (
                  <tr key={p.id} className="border-b">
                    <td className="py-1">{p.artikel.name}</td>
                    <td className="py-1">{p.menge}</td>
                    <td className="py-1">{p.einheit}</td>
                    <td className="py-1">{formatEuro(preis)}</td>
                    <td className="py-1">{formatEuro(p.menge * preis)}</td>
                    <td className="py-1">{p.reserviert ? "✓" : "–"}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr><td colSpan={4} className="text-right py-2">Zwischensumme</td><td className="py-2">{formatEuro(summe)}</td><td></td></tr>
              {rabatt > 0 && <tr className="text-green-700"><td colSpan={4} className="text-right">− {v.rabattProzent}% Rabatt</td><td>−{formatEuro(rabatt)}</td><td></td></tr>}
              <tr className="font-bold text-lg"><td colSpan={4} className="text-right py-2">Total netto</td><td className="py-2">{formatEuro(total)}</td><td></td></tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  );
}
