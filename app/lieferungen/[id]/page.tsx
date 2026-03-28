"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { StatusBadge, MargeBadge } from "@/components/Badge";
import { formatEuro, formatDatum } from "@/lib/utils";

interface Position {
  id: number;
  menge: number;
  einheit: string;
  verkaufspreis: number;
  einkaufspreis: number;
  chargeNr?: string | null;
  rabattProzent?: number;
  artikel: { id: number; name: string; einheit: string };
}

interface Lieferung {
  id: number;
  datum: string;
  status: string;
  notiz?: string;
  rechnungNr?: string;
  bezahltAm?: string | null;
  zahlungsziel?: number | null;
  kunde: { id: number; name: string; firma?: string };
  positionen: Position[];
}

export default function LieferungDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [lieferung, setLieferung] = useState<Lieferung | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  const [showStornoModal, setShowStornoModal] = useState(false);
  const [stornoBegründung, setStornoBegrundung] = useState("");
  const [stornoError, setStornoError] = useState("");
  const [zahlungszielEdit, setZahlungszielEdit] = useState<string>("");

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/lieferungen/${id}`);
    if (!res.ok) { setLoading(false); setError("Lieferung nicht gefunden."); return; }
    const data = await res.json();
    setLieferung(data);
    setZahlungszielEdit(String(data.zahlungsziel ?? 30));
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function markiereGeliefert() {
    setActionLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/lieferungen/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "geliefert" }),
      });
      if (!res.ok) throw new Error("Fehler beim Aktualisieren");
      await load();
    } catch {
      setError("Fehler beim Aktualisieren des Status.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleStorno(e: React.FormEvent) {
    e.preventDefault();
    if (!stornoBegründung.trim()) { setStornoError("Bitte eine Begründung angeben."); return; }
    setActionLoading(true);
    setStornoError("");
    try {
      const res = await fetch(`/api/lieferungen/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "storniert", stornoBegründung: stornoBegründung.trim() }),
      });
      if (!res.ok) throw new Error("Fehler beim Stornieren");
      setShowStornoModal(false);
      setStornoBegrundung("");
      await load();
    } catch {
      setStornoError("Fehler beim Stornieren.");
    } finally {
      setActionLoading(false);
    }
  }

  async function rechnungErstellen() {
    setActionLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/lieferungen/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aktion: "rechnung_erstellen" }),
      });
      if (!res.ok) throw new Error("Fehler beim Erstellen der Rechnung");
      await load();
    } catch {
      setError("Fehler beim Erstellen der Rechnung.");
    } finally {
      setActionLoading(false);
    }
  }

  async function markiereBezahlt() {
    setActionLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/lieferungen/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bezahltAm: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error("Fehler beim Aktualisieren");
      await load();
    } catch {
      setError("Fehler beim Markieren als bezahlt.");
    } finally {
      setActionLoading(false);
    }
  }

  async function speichereZahlungsziel() {
    const tage = parseInt(zahlungszielEdit, 10);
    if (isNaN(tage) || tage < 0) return;
    setActionLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/lieferungen/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zahlungsziel: tage }),
      });
      if (!res.ok) throw new Error("Fehler beim Speichern");
      await load();
    } catch {
      setError("Fehler beim Speichern des Zahlungsziels.");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return <div className="text-gray-400 text-sm p-6">Lade Lieferung…</div>;
  }

  if (!lieferung) {
    return (
      <div>
        <p className="text-red-600 mb-4">{error || "Lieferung nicht gefunden."}</p>
        <Link href="/lieferungen" className="text-green-700 hover:underline text-sm">
          ← Zurück zu Lieferungen
        </Link>
      </div>
    );
  }

  const gesamtUmsatz = lieferung.positionen.reduce((s, p) => s + p.menge * p.verkaufspreis, 0);
  const gesamtEinkauf = lieferung.positionen.reduce((s, p) => s + p.menge * p.einkaufspreis, 0);
  const gesamtMarge = gesamtUmsatz - gesamtEinkauf;
  const gesamtMargePct = gesamtUmsatz > 0 ? (gesamtMarge / gesamtUmsatz) * 100 : 0;

  const heute = new Date();
  heute.setHours(0, 0, 0, 0);
  const zahlungszielTage = lieferung.zahlungsziel ?? 30;
  const lieferDatum = new Date(lieferung.datum);
  const faelligkeitsDatum = new Date(lieferDatum.getTime() + zahlungszielTage * 24 * 60 * 60 * 1000);
  const istGeliefert = lieferung.status === "geliefert";
  const istBezahlt = !!lieferung.bezahltAm;
  const istUeberfaellig = istGeliefert && !istBezahlt && heute > faelligkeitsDatum;
  const faelligSeitTagen = istUeberfaellig
    ? Math.floor((heute.getTime() - faelligkeitsDatum.getTime()) / (24 * 60 * 60 * 1000))
    : 0;

  function ZahlungsstatusBadge() {
    if (!istGeliefert) return null;
    if (istBezahlt)
      return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-800">Bezahlt</span>;
    if (istUeberfaellig)
      return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-700">Überfällig ({faelligSeitTagen} Tage)</span>;
    return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">Offen</span>;
  }

  return (
    <div>
      {/* Back link */}
      <Link href="/lieferungen" className="text-sm text-green-700 hover:text-green-900 hover:underline mb-4 inline-block">
        ← Zurück zu Lieferungen
      </Link>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* Header card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold mb-1">
              Lieferung #{lieferung.id}
            </h1>
            <div className="flex items-center gap-3 flex-wrap text-sm text-gray-600">
              <span className="font-medium text-gray-800">
                {lieferung.kunde.firma
                  ? `${lieferung.kunde.firma} (${lieferung.kunde.name})`
                  : lieferung.kunde.name}
              </span>
              <span>·</span>
              <span>{formatDatum(lieferung.datum)}</span>
              <span>·</span>
              <StatusBadge status={lieferung.status} />
            </div>
            {lieferung.notiz && (
              <p className="mt-2 text-sm text-gray-500 italic">{lieferung.notiz}</p>
            )}
            {lieferung.rechnungNr && (
              <p className="mt-2 text-sm text-gray-700">
                Rechnung: <span className="font-mono font-medium">{lieferung.rechnungNr}</span>
              </p>
            )}
            {istGeliefert && (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <ZahlungsstatusBadge />
                {istBezahlt && lieferung.bezahltAm && (
                  <span className="text-xs text-gray-500">
                    bezahlt am {formatDatum(lieferung.bezahltAm)}
                  </span>
                )}
                {!istBezahlt && (
                  <span className="text-xs text-gray-500">
                    Fällig: {formatDatum(faelligkeitsDatum.toISOString())}
                  </span>
                )}
              </div>
            )}
            {istGeliefert && (
              <div className="mt-2 flex items-center gap-2 text-sm">
                <label className="text-gray-600 whitespace-nowrap">Zahlungsziel:</label>
                <input
                  type="number"
                  min={0}
                  value={zahlungszielEdit}
                  onChange={(e) => setZahlungszielEdit(e.target.value)}
                  className="w-20 border border-gray-300 rounded px-2 py-0.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-green-700"
                />
                <span className="text-gray-500">Tage</span>
                <button
                  onClick={speichereZahlungsziel}
                  disabled={actionLoading}
                  className="px-2 py-0.5 text-xs bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded transition-colors disabled:opacity-60"
                >
                  Speichern
                </button>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            {lieferung.status === "geplant" && (
              <button
                onClick={markiereGeliefert}
                disabled={actionLoading}
                className="px-4 py-2 text-sm bg-green-700 hover:bg-green-800 text-white rounded-lg font-medium transition-colors disabled:opacity-60"
              >
                {actionLoading ? "…" : "Als geliefert markieren"}
              </button>
            )}

            {lieferung.status === "geliefert" && (
              <>
                {!istBezahlt && (
                  <button
                    onClick={markiereBezahlt}
                    disabled={actionLoading}
                    className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-60"
                  >
                    {actionLoading ? "…" : "Als bezahlt markieren"}
                  </button>
                )}
                <button
                  onClick={() => { setShowStornoModal(true); setStornoBegrundung(""); setStornoError(""); }}
                  disabled={actionLoading}
                  className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 rounded-lg font-medium transition-colors disabled:opacity-60"
                >
                  Stornieren
                </button>
                {!lieferung.rechnungNr && (
                  <button
                    onClick={rechnungErstellen}
                    disabled={actionLoading}
                    className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-60"
                  >
                    {actionLoading ? "…" : "Rechnung erstellen"}
                  </button>
                )}
              </>
            )}

            {lieferung.rechnungNr && (
              <button
                onClick={() => window.open(`/api/exporte/rechnung/${id}`, "_blank")}
                className="px-4 py-2 text-sm bg-green-800 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
              >
                Rechnung als PDF
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Positions table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {["Artikel", "Charge", "Menge", "Einheit", "Verkaufspreis", "Rabatt", "Einkaufspreis", "Marge €", "Marge %"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lieferung.positionen.map((pos) => {
              const margeEuro = pos.menge * (pos.verkaufspreis - pos.einkaufspreis);
              const margePct =
                pos.verkaufspreis > 0
                  ? ((pos.verkaufspreis - pos.einkaufspreis) / pos.verkaufspreis) * 100
                  : 0;
              return (
                <tr key={pos.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium">{pos.artikel.name}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs font-mono">{pos.chargeNr ?? "—"}</td>
                  <td className="px-4 py-3 font-mono">{pos.menge}</td>
                  <td className="px-4 py-3 text-gray-600">{pos.artikel.einheit}</td>
                  <td className="px-4 py-3 font-mono">{formatEuro(pos.verkaufspreis)}</td>
                  <td className="px-4 py-3 text-xs">
                    {pos.rabattProzent && pos.rabattProzent > 0 ? (
                      <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium">{pos.rabattProzent}%</span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 font-mono">{formatEuro(pos.einkaufspreis)}</td>
                  <td className="px-4 py-3 font-mono">{formatEuro(margeEuro)}</td>
                  <td className="px-4 py-3">
                    <MargeBadge pct={margePct} />
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-gray-50 border-t-2 border-gray-200">
            <tr>
              <td colSpan={5} className="px-4 py-3 font-semibold text-gray-700">Gesamt</td>
              <td className="px-4 py-3 font-mono font-semibold">{formatEuro(gesamtUmsatz)}</td>
              <td className="px-4 py-3 font-mono font-semibold">{formatEuro(gesamtEinkauf)}</td>
              <td className="px-4 py-3 font-mono font-semibold">{formatEuro(gesamtMarge)}</td>
              <td className="px-4 py-3">
                <MargeBadge pct={gesamtMargePct} />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Storno Modal */}
      {showStornoModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h2 className="text-lg font-semibold">Lieferung stornieren</h2>
              <button
                onClick={() => setShowStornoModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleStorno} className="p-5 space-y-4">
              {stornoError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {stornoError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Begründung <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={stornoBegründung}
                  onChange={(e) => setStornoBegrundung(e.target.value)}
                  placeholder="Grund für die Stornierung…"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700 resize-none"
                  required
                />
              </div>
              <div className="flex justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowStornoModal(false)}
                  className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-60"
                >
                  {actionLoading ? "Stornieren…" : "Stornieren bestätigen"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
