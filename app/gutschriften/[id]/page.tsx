"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { formatEuro, formatDatum } from "@/lib/utils";

interface GutschriftPosition {
  id: number;
  menge: number;
  preis: number;
  ruecknahme: boolean;
  artikel: { id: number; name: string; einheit: string; artikelnummer: string };
}

interface Gutschrift {
  id: number;
  nummer: string;
  datum: string;
  grund: string;
  status: string;
  notiz?: string | null;
  createdAt: string;
  kunde: { id: number; name: string; firma?: string | null };
  lieferung?: {
    id: number;
    datum: string;
    rechnungNr?: string | null;
  } | null;
  positionen: GutschriftPosition[];
}

function GutschriftStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    OFFEN: "bg-yellow-100 text-yellow-800 border border-yellow-200",
    VERBUCHT: "bg-green-100 text-green-800 border border-green-200",
    STORNIERT: "bg-red-100 text-red-600 border border-red-200",
  };
  const labels: Record<string, string> = {
    OFFEN: "Offen",
    VERBUCHT: "Verbucht",
    STORNIERT: "Storniert",
  };
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${map[status] ?? "bg-gray-100 text-gray-800"}`}>
      {labels[status] ?? status}
    </span>
  );
}

export default function GutschriftDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [gutschrift, setGutschrift] = useState<Gutschrift | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/gutschriften/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setGutschrift(d);
      })
      .catch(() => setError("Fehler beim Laden"))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleStatusChange(newStatus: string) {
    if (!gutschrift) return;
    const confirm_msg =
      newStatus === "VERBUCHT"
        ? "Gutschrift als verbucht markieren?"
        : "Gutschrift stornieren?";
    if (!confirm(confirm_msg)) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/gutschriften/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Fehler");
      setGutschrift(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Gutschrift wirklich löschen?")) return;
    setSaving(true);
    const res = await fetch(`/api/gutschriften/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/gutschriften");
    } else {
      const data = await res.json();
      setError(data.error ?? "Fehler beim Löschen");
      setSaving(false);
    }
  }

  function betrag(): number {
    if (!gutschrift) return 0;
    return gutschrift.positionen.reduce((sum, p) => sum + p.menge * p.preis, 0);
  }

  if (loading) return <div className="text-center py-16 text-gray-400">Lade…</div>;
  if (!gutschrift && error) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center text-red-600">{error}</div>
    );
  }
  if (!gutschrift) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/gutschriften" className="hover:text-green-700">
          Gutschriften
        </Link>
        <span>›</span>
        <span className="text-gray-900 font-medium">{gutschrift.nummer}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{gutschrift.nummer}</h1>
          <p className="text-sm text-gray-500 mt-1">
            Erstellt am {formatDatum(gutschrift.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <GutschriftStatusBadge status={gutschrift.status} />
          {gutschrift.status === "OFFEN" && (
            <>
              <button
                onClick={() => handleStatusChange("VERBUCHT")}
                disabled={saving}
                className="px-3 py-1.5 bg-green-700 text-white text-sm rounded-lg hover:bg-green-800 disabled:opacity-50 transition-colors"
              >
                Als verbucht markieren
              </button>
              <button
                onClick={() => handleStatusChange("STORNIERT")}
                disabled={saving}
                className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                Stornieren
              </button>
              <button
                onClick={handleDelete}
                disabled={saving}
                className="px-3 py-1.5 border border-red-300 text-red-600 text-sm rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                Löschen
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Info card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="block text-xs font-medium text-gray-500 mb-1">Kunde</span>
            <Link href={`/kunden/${gutschrift.kunde.id}`} className="font-medium text-green-700 hover:underline">
              {gutschrift.kunde.name}
            </Link>
            {gutschrift.kunde.firma && (
              <div className="text-gray-500 text-xs">{gutschrift.kunde.firma}</div>
            )}
          </div>
          <div>
            <span className="block text-xs font-medium text-gray-500 mb-1">Datum</span>
            <span className="text-gray-900">{formatDatum(gutschrift.datum)}</span>
          </div>
          <div>
            <span className="block text-xs font-medium text-gray-500 mb-1">Grund</span>
            <span className="text-gray-900">{gutschrift.grund}</span>
          </div>
          {gutschrift.lieferung && (
            <div>
              <span className="block text-xs font-medium text-gray-500 mb-1">Bezug: Lieferung</span>
              <Link href={`/lieferungen/${gutschrift.lieferung.id}`} className="text-green-700 hover:underline">
                {gutschrift.lieferung.rechnungNr
                  ? `${gutschrift.lieferung.rechnungNr}`
                  : `#${gutschrift.lieferung.id}`}{" "}
                ({formatDatum(gutschrift.lieferung.datum)})
              </Link>
            </div>
          )}
          {gutschrift.notiz && (
            <div className="sm:col-span-2">
              <span className="block text-xs font-medium text-gray-500 mb-1">Notiz</span>
              <span className="text-gray-700 whitespace-pre-wrap">{gutschrift.notiz}</span>
            </div>
          )}
        </div>
      </div>

      {/* Positionen */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Positionen</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Artikel</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Menge</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Preis</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Betrag</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Rücknahme</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {gutschrift.positionen.map((pos) => (
              <tr key={pos.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{pos.artikel.name}</div>
                  <div className="text-xs text-gray-400">{pos.artikel.artikelnummer}</div>
                  {pos.ruecknahme && (
                    <span className="sm:hidden inline-block mt-0.5 text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
                      Rücknahme
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-gray-700">
                  {pos.menge.toLocaleString("de-DE")} {pos.artikel.einheit}
                </td>
                <td className="px-4 py-3 text-right text-gray-700">
                  {formatEuro(pos.preis)}
                </td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">
                  {formatEuro(pos.menge * pos.preis)}
                </td>
                <td className="px-4 py-3 text-center hidden sm:table-cell">
                  {pos.ruecknahme ? (
                    <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">Ja</span>
                  ) : (
                    <span className="text-xs text-gray-400">Nein</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-gray-200">
            <tr>
              <td colSpan={3} className="px-4 py-3 text-right font-semibold text-gray-700">
                Gesamt Gutschrift:
              </td>
              <td className="px-4 py-3 text-right font-bold text-lg text-gray-900">
                {formatEuro(betrag())}
              </td>
              <td className="hidden sm:table-cell"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex justify-end">
        <Link
          href="/gutschriften"
          className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors"
        >
          Zur Übersicht
        </Link>
      </div>
    </div>
  );
}
