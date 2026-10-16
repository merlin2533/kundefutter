"use client";
import { useState } from "react";
import Link from "next/link";
import { Card, KpiCard } from "@/components/Card";
import { formatDatum } from "@/lib/utils";
import { useModulAktiv } from "@/lib/modul-context";
import * as Sentry from "@sentry/nextjs";

interface Sortierung {
  positionId: number;
  sortierungId: number;
  datum: string;
  artikel: string;
  gueteklasse: string;
  gewichtsklasse: string;
  menge: number;
  chargeNr: string | null;
  erzeugercode: string | null;
  legedatum: string | null;
}
interface Lieferung {
  positionId: number;
  lieferungId: number;
  datum: string;
  status: string;
  rechnungNr: string | null;
  kundeId: number;
  kundeName: string;
  kundeOrt: string | null;
  artikel: string;
  menge: number;
  einheit: string;
  chargeNr: string | null;
  erzeugercode: string | null;
}
interface Kunde {
  kundeId: number;
  kundeName: string;
  kundeOrt: string | null;
  lieferungen: number;
  menge: number;
}
interface Ergebnis {
  sortierungen: Sortierung[];
  lieferungen: Lieferung[];
  kunden: Kunde[];
  mengeSortiert: number;
  mengeAusgeliefert: number;
  abgeschnitten: boolean;
}

export default function RueckverfolgungPage() {
  const eierhandelAn = useModulAktiv("eierhandel");
  const [charge, setCharge] = useState("");
  const [erzeugercode, setErzeugercode] = useState("");
  const [loading, setLoading] = useState(false);
  const [fehler, setFehler] = useState("");
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null);

  async function suchen(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setFehler("");
    try {
      const p = new URLSearchParams();
      if (charge.trim()) p.set("charge", charge.trim());
      if (erzeugercode.trim()) p.set("erzeugercode", erzeugercode.trim());
      const res = await fetch(`/api/eierkontrolle/rueckverfolgung?${p.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErgebnis(null);
        setFehler(data.error ?? "Rückverfolgung fehlgeschlagen");
        return;
      }
      setErgebnis(data as Ergebnis);
    } catch (err) {
      Sentry.captureException(err);
      setErgebnis(null);
      setFehler("Rückverfolgung fehlgeschlagen (Netzwerkfehler)");
    } finally {
      setLoading(false);
    }
  }

  if (!eierhandelAn) {
    return (
      <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-4 py-3">
        Das Modul „Eierhandel“ ist deaktiviert — unter{" "}
        <Link href="/einstellungen/module" className="underline font-medium">Einstellungen → Module</Link> aktivieren.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/eierkontrolle" className="text-sm text-green-700 hover:underline">← Eier-Kontrolle</Link>
        <h1 className="text-2xl font-bold mt-1">Chargen-Rückverfolgung</h1>
        <p className="text-sm text-gray-500">
          Rückruf-Fall: Zu einer Chargennummer oder einem Erzeugercode zeigen, wann sortiert wurde und
          welche Kunden die Ware erhalten haben.
        </p>
      </div>

      <form onSubmit={suchen} className="flex flex-wrap gap-3 items-end mb-6">
        <label className="text-sm w-full sm:w-64">
          <span className="block text-gray-600 mb-1">Chargennummer</span>
          <input value={charge} onChange={(e) => setCharge(e.target.value)} placeholder="z.B. CH-2026-09"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </label>
        <label className="text-sm w-full sm:w-64">
          <span className="block text-gray-600 mb-1">Erzeugercode</span>
          <input value={erzeugercode} onChange={(e) => setErzeugercode(e.target.value)} placeholder="z.B. 1-DE-0123451"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </label>
        <button type="submit" disabled={loading || (!charge.trim() && !erzeugercode.trim())}
          className="w-full sm:w-auto px-4 py-2 text-sm bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white rounded-lg font-medium">
          {loading ? "Suche…" : "Rückverfolgen"}
        </button>
      </form>

      {fehler && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-4 py-3 mb-4">{fehler}</p>}

      {ergebnis && (
        <div className="space-y-6">
          {ergebnis.abgeschnitten && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded px-4 py-3">
              Sehr viele Treffer — die Liste ist auf 1000 je Bereich begrenzt. Suche bitte genauer eingrenzen.
            </p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard label="Sortierte Menge" value={String(ergebnis.mengeSortiert)} color="green" />
            <KpiCard label="Ausgeliefert" value={String(ergebnis.mengeAusgeliefert)} color="blue" />
            <KpiCard label="Betroffene Kunden" value={String(ergebnis.kunden.length)} color="orange" />
            <KpiCard label="Lieferungen" value={String(new Set(ergebnis.lieferungen.map((l) => l.lieferungId)).size)} color="yellow" />
          </div>

          <Card>
            <h2 className="font-semibold mb-3">Betroffene Kunden</h2>
            {ergebnis.kunden.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Keine Lieferung mit dieser Charge / diesem Erzeugercode.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-gray-500 uppercase">
                    <tr>
                      <th className="text-left py-2 pr-4">Kunde</th>
                      <th className="text-left py-2 pr-4 hidden sm:table-cell">Ort</th>
                      <th className="text-right py-2 pr-4">Lieferungen</th>
                      <th className="text-right py-2">Menge</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {ergebnis.kunden.map((k) => (
                      <tr key={k.kundeId}>
                        <td className="py-2 pr-4"><Link href={`/kunden/${k.kundeId}`} className="text-green-700 hover:underline">{k.kundeName}</Link></td>
                        <td className="py-2 pr-4 hidden sm:table-cell text-gray-500">{k.kundeOrt ?? "—"}</td>
                        <td className="py-2 pr-4 text-right">{k.lieferungen}</td>
                        <td className="py-2 text-right">{k.menge}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <h2 className="font-semibold mb-3">Ausgang — Lieferungen</h2>
            {ergebnis.lieferungen.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Keine Treffer.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-gray-500 uppercase">
                    <tr>
                      <th className="text-left py-2 pr-4">Datum</th>
                      <th className="text-left py-2 pr-4">Kunde</th>
                      <th className="text-left py-2 pr-4 hidden md:table-cell">Artikel</th>
                      <th className="text-left py-2 pr-4 hidden sm:table-cell">Charge</th>
                      <th className="text-left py-2 pr-4 hidden lg:table-cell">Rechnung</th>
                      <th className="text-right py-2 pr-4">Menge</th>
                      <th className="text-left py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {ergebnis.lieferungen.map((l) => (
                      <tr key={l.positionId}>
                        <td className="py-2 pr-4 whitespace-nowrap"><Link href={`/lieferungen/${l.lieferungId}`} className="text-green-700 hover:underline">{formatDatum(l.datum)}</Link></td>
                        <td className="py-2 pr-4">{l.kundeName}</td>
                        <td className="py-2 pr-4 hidden md:table-cell">{l.artikel}</td>
                        <td className="py-2 pr-4 hidden sm:table-cell font-mono text-xs">{l.chargeNr ?? "—"}</td>
                        <td className="py-2 pr-4 hidden lg:table-cell">{l.rechnungNr ?? "—"}</td>
                        <td className="py-2 pr-4 text-right">{l.menge} {l.einheit}</td>
                        <td className="py-2">{l.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <h2 className="font-semibold mb-3">Eingang — Sortierungen</h2>
            {ergebnis.sortierungen.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Keine Treffer.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-gray-500 uppercase">
                    <tr>
                      <th className="text-left py-2 pr-4">Datum</th>
                      <th className="text-left py-2 pr-4">Artikel</th>
                      <th className="text-left py-2 pr-4">Klasse</th>
                      <th className="text-left py-2 pr-4 hidden sm:table-cell">Charge</th>
                      <th className="text-left py-2 pr-4 hidden md:table-cell">Erzeugercode</th>
                      <th className="text-right py-2">Menge</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {ergebnis.sortierungen.map((s) => (
                      <tr key={s.positionId}>
                        <td className="py-2 pr-4 whitespace-nowrap"><Link href={`/eiersortierung/${s.sortierungId}`} className="text-green-700 hover:underline">{formatDatum(s.datum)}</Link></td>
                        <td className="py-2 pr-4">{s.artikel}</td>
                        <td className="py-2 pr-4">{s.gueteklasse}/{s.gewichtsklasse}</td>
                        <td className="py-2 pr-4 hidden sm:table-cell font-mono text-xs">{s.chargeNr ?? "—"}</td>
                        <td className="py-2 pr-4 hidden md:table-cell font-mono text-xs">{s.erzeugercode ?? "—"}</td>
                        <td className="py-2 text-right">{s.menge}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
