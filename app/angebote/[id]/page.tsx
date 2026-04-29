"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { formatEuro, formatDatum } from "@/lib/utils";

interface ArtikelInfo {
  id: number;
  name: string;
  einheit: string;
  mwstSatz: number;
}

interface AngebotPosition {
  id: number;
  artikelId: number;
  menge: number;
  preis: number;
  rabatt: number;
  einheit: string;
  notiz: string | null;
  artikel: ArtikelInfo;
}

interface Angebot {
  id: number;
  nummer: string;
  datum: string;
  gueltigBis: string | null;
  status: string;
  notiz: string | null;
  erstellt: string;
  aktualisiert: string;
  kunde: {
    id: number;
    name: string;
    firma: string | null;
    strasse: string | null;
    plz: string | null;
    ort: string | null;
  };
  positionen: AngebotPosition[];
}

const STATUS_LABELS: Record<string, string> = {
  OFFEN: "Offen",
  ANGENOMMEN: "Angenommen",
  ABGELEHNT: "Abgelehnt",
  ABGELAUFEN: "Abgelaufen",
};

const STATUS_FARBEN: Record<string, string> = {
  OFFEN: "bg-yellow-100 text-yellow-800",
  ANGENOMMEN: "bg-green-100 text-green-800",
  ABGELEHNT: "bg-red-100 text-red-800",
  ABGELAUFEN: "bg-gray-100 text-gray-600",
};

export default function AngebotDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [angebot, setAngebot] = useState<Angebot | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [lieferungId, setLieferungId] = useState<number | null>(null);
  const [sammelrechnungId, setSammelrechnungId] = useState<number | null>(null);
  const [rechnungNr, setRechnungNr] = useState<string | null>(null);

  // Editable fields
  const [notiz, setNotiz] = useState("");
  const [gueltigBis, setGueltigBis] = useState("");

  useEffect(() => {
    fetchAngebot();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function fetchAngebot() {
    setLoading(true);
    fetch(`/api/angebote/${id}`)
      .then((r) => { if (!r.ok) throw new Error("Angebot nicht gefunden"); return r.json(); })
      .then((d) => {
        setAngebot(d);
        setNotiz(d.notiz ?? "");
        setGueltigBis(d.gueltigBis ? d.gueltigBis.split("T")[0] : "");
        setLoading(false);
      })
      .catch((e: unknown) => { setError(e instanceof Error ? e.message : "Ladefehler"); setLoading(false); });
  }

  async function handleUpdate(data: Record<string, unknown>) {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/angebote/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Fehler");
      if (json.angebot) {
        setAngebot(json.angebot);
        if (json.lieferungId) setLieferungId(json.lieferungId);
        if (json.sammelrechnungId) setSammelrechnungId(json.sammelrechnungId);
        if (json.rechnungNr) setRechnungNr(json.rechnungNr);
      } else {
        setAngebot(json);
      }
      setSuccess("Gespeichert.");
      setTimeout(() => setSuccess(""), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setSaving(false);
    }
  }

  async function handleAnnehmen() {
    if (!confirm("Angebot annehmen? Lieferung, Rechnung und Bestellpositionen werden automatisch erstellt.")) return;
    await handleUpdate({ aktion: "annehmen" });
  }

  async function handleAblehnen() {
    if (!confirm("Angebot als abgelehnt markieren?")) return;
    await handleUpdate({ status: "ABGELEHNT" });
  }

  async function handleAbgelaufen() {
    if (!confirm("Angebot als abgelaufen markieren?")) return;
    await handleUpdate({ status: "ABGELAUFEN" });
  }

  async function handleSaveNotiz() {
    await handleUpdate({ notiz: notiz.trim() || null, gueltigBis: gueltigBis || null });
  }

  async function handleDelete() {
    if (!confirm("Angebot unwiderruflich löschen?")) return;
    try {
      const res = await fetch(`/api/angebote/${id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/angebote");
      } else {
        setError("Fehler beim Löschen");
      }
    } catch {
      setError("Netzwerkfehler beim Löschen");
    }
  }

  if (loading) {
    return <div className="text-center py-16 text-gray-400">Lade…</div>;
  }

  if (!angebot) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center text-gray-500">
        Angebot nicht gefunden.{" "}
        <Link href="/angebote" className="text-green-700 hover:underline">Zurück zur Liste</Link>
      </div>
    );
  }

  // Computed values
  const gesamtNetto = angebot.positionen.reduce((sum, pos) => {
    return sum + pos.menge * pos.preis * (1 - pos.rabatt / 100);
  }, 0);

  // Group MwSt
  const mwstMap: Record<number, number> = {};
  for (const pos of angebot.positionen) {
    const netto = pos.menge * pos.preis * (1 - pos.rabatt / 100);
    const satz = pos.artikel.mwstSatz;
    mwstMap[satz] = (mwstMap[satz] ?? 0) + netto * (satz / 100);
  }
  const gesamtMwst = Object.values(mwstMap).reduce((a, b) => a + b, 0);
  const gesamtBrutto = gesamtNetto + gesamtMwst;

  const isOffen = angebot.status === "OFFEN";

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/angebote" className="hover:text-green-700">Angebote</Link>
        <span>›</span>
        <span className="text-gray-900 font-medium">{angebot.nummer}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-6 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{angebot.nummer}</h1>
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_FARBEN[angebot.status] ?? "bg-gray-100 text-gray-600"}`}>
              {STATUS_LABELS[angebot.status] ?? angebot.status}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Erstellt {formatDatum(angebot.datum)}
            {angebot.gueltigBis && ` · Gültig bis ${formatDatum(angebot.gueltigBis)}`}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link
            href={`/angebote/${id}/druck`}
            target="_blank"
            className="w-full sm:w-auto text-center px-3 py-2 sm:py-1.5 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors"
          >
            Drucken / PDF
          </Link>
          {isOffen && (
            <>
              <button
                onClick={handleAnnehmen}
                disabled={saving}
                className="w-full sm:w-auto px-3 py-2 sm:py-1.5 bg-green-700 text-white text-sm rounded-lg hover:bg-green-800 disabled:opacity-50 transition-colors"
              >
                Annehmen (Lieferung + Rechnung)
              </button>
              <button
                onClick={handleAblehnen}
                disabled={saving}
                className="w-full sm:w-auto px-3 py-2 sm:py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                Ablehnen
              </button>
              <button
                onClick={handleAbgelaufen}
                disabled={saving}
                className="w-full sm:w-auto px-3 py-2 sm:py-1.5 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Als abgelaufen markieren
              </button>
            </>
          )}
          <button
            onClick={handleDelete}
            className="w-full sm:w-auto px-3 py-2 sm:py-1.5 border border-red-200 text-red-600 text-sm rounded-lg hover:bg-red-50 transition-colors"
          >
            Löschen
          </button>
        </div>
      </div>

      {/* Lieferung + Rechnung links if angenommen */}
      {(lieferungId || angebot.status === "ANGENOMMEN") && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800 flex flex-wrap items-center justify-between gap-3">
          <span>
            Angebot wurde angenommen — Lieferung, Rechnung und Bestellpositionen wurden erstellt.
          </span>
          <div className="flex gap-2 flex-wrap">
            {lieferungId && (
              <Link href={`/lieferungen/${lieferungId}`} className="px-3 py-1.5 bg-green-700 text-white text-xs font-semibold rounded-lg hover:bg-green-800 transition-colors whitespace-nowrap">
                Lieferung #{lieferungId} →
              </Link>
            )}
            {sammelrechnungId && (
              <Link href={`/sammelrechnungen/${sammelrechnungId}`} className="px-3 py-1.5 bg-blue-700 text-white text-xs font-semibold rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap">
                Rechnung {rechnungNr} →
              </Link>
            )}
            <Link href="/bestellliste" className="px-3 py-1.5 border border-green-600 text-green-700 text-xs font-semibold rounded-lg hover:bg-green-100 transition-colors whitespace-nowrap">
              Bestellliste →
            </Link>
          </div>
        </div>
      )}

      {/* Messages */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
      )}
      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">{success}</div>
      )}

      <div className="space-y-6">
        {/* Kunde */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Kunde</h2>
          <div>
            <Link href={`/kunden/${angebot.kunde.id}`} className="text-base font-semibold text-green-700 hover:underline">
              {angebot.kunde.name}
            </Link>
            {angebot.kunde.firma && <p className="text-sm text-gray-600">{angebot.kunde.firma}</p>}
            {(angebot.kunde.strasse || angebot.kunde.ort) && (
              <p className="text-sm text-gray-500 mt-1">
                {[angebot.kunde.strasse, [angebot.kunde.plz, angebot.kunde.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ")}
              </p>
            )}
          </div>
        </div>

        {/* Notiz & Gültig bis edit */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Angebotsdaten</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gültig bis</label>
              <input
                type="date"
                value={gueltigBis}
                onChange={(e) => setGueltigBis(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notiz</label>
            <textarea
              value={notiz}
              onChange={(e) => setNotiz(e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 resize-none"
            />
          </div>
          <div className="text-right">
            <button
              onClick={handleSaveNotiz}
              disabled={saving}
              className="px-4 py-2 bg-green-700 text-white text-sm rounded-lg hover:bg-green-800 disabled:opacity-50 transition-colors"
            >
              {saving ? "Speichere…" : "Speichern"}
            </button>
          </div>
        </div>

        {/* Positionen */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Positionen</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-3 sm:px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Artikel</th>
                  <th className="hidden sm:table-cell text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Menge</th>
                  <th className="hidden md:table-cell text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Einheit</th>
                  <th className="hidden sm:table-cell text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Einzelpreis</th>
                  <th className="hidden lg:table-cell text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Rabatt</th>
                  <th className="text-right px-3 sm:px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Gesamt netto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {angebot.positionen.map((pos) => {
                  const netto = pos.menge * pos.preis * (1 - pos.rabatt / 100);
                  return (
                    <tr key={pos.id} className="hover:bg-gray-50">
                      <td className="px-3 sm:px-4 py-3">
                        <div className="font-medium text-gray-900">{pos.artikel.name}</div>
                        {pos.notiz && <div className="text-xs text-gray-400 mt-0.5">{pos.notiz}</div>}
                        <div className="sm:hidden text-xs text-gray-500 mt-0.5">
                          {pos.menge.toLocaleString("de-DE")} {pos.einheit} x {formatEuro(pos.preis)}
                          {pos.rabatt > 0 && ` · ${pos.rabatt.toLocaleString("de-DE")} % Rabatt`}
                        </div>
                      </td>
                      <td className="hidden sm:table-cell px-4 py-3 text-right text-gray-700">
                        {pos.menge.toLocaleString("de-DE")}
                      </td>
                      <td className="hidden md:table-cell px-4 py-3 text-gray-600">{pos.einheit}</td>
                      <td className="hidden sm:table-cell px-4 py-3 text-right text-gray-700">
                        {formatEuro(pos.preis)}
                      </td>
                      <td className="hidden lg:table-cell px-4 py-3 text-right text-gray-600">
                        {pos.rabatt > 0 ? `${pos.rabatt.toLocaleString("de-DE")} %` : "—"}
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-right font-medium text-gray-900">
                        {formatEuro(netto)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Summen */}
          <div className="border-t border-gray-200 px-4 sm:px-6 py-4 space-y-1.5 bg-gray-50">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Netto gesamt</span>
              <span>{formatEuro(gesamtNetto)}</span>
            </div>
            {Object.entries(mwstMap).map(([satz, betrag]) => (
              <div key={satz} className="flex justify-between text-sm text-gray-600">
                <span>MwSt. {satz} %</span>
                <span>{formatEuro(betrag)}</span>
              </div>
            ))}
            <div className="flex justify-between text-base font-bold text-gray-900 border-t border-gray-300 pt-2 mt-2">
              <span>Brutto gesamt</span>
              <span>{formatEuro(gesamtBrutto)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
