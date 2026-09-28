"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { formatDatum, formatMenge } from "@/lib/utils";
import * as Sentry from "@sentry/nextjs";

interface Anlieferung {
  id: number;
  nummer: string;
  datum: string;
  kunde: { id: number; name: string; firma?: string | null };
  artikel: { id: number; name: string; einheit: string };
  menge: number;
  einheit: string;
  feuchte?: number | null;
  qualitaet?: string | null;
  preisProEinheit?: number | null;
  gesamtBetrag?: number | null;
  notiz?: string | null;
  gutschrift?: {
    id: number;
    nummer: string;
    status: string;
    positionen: { artikelId: number; menge: number; preis: number; artikel: { id: number; name: string } }[];
  } | null;
}

interface GradierteMenge {
  artikelId: number;
  artikelName: string;
  gueteklasse: string;
  gewichtsklasse: string;
  menge: number;
  vorschlagPreis: number | null;
}

interface EierSortierungKurz {
  id: number;
  datum: string;
  notiz?: string | null;
}

function euro(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

export default function AnlieferungDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);

  const [anlieferung, setAnlieferung] = useState<Anlieferung | null>(null);
  const [gradiert, setGradiert] = useState<GradierteMenge[]>([]);
  const [sortierungen, setSortierungen] = useState<EierSortierungKurz[]>([]);
  const [preise, setPreise] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [speichern, setSpeichern] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [gRes, sortRes] = await Promise.all([
        fetch(`/api/anlieferungen/${id}/gutschrift`),
        fetch(`/api/eiersortierung?anlieferungId=${id}`),
      ]);
      if (!gRes.ok) {
        const data = await gRes.json().catch(() => ({}));
        throw new Error(data.error ?? "Fehler beim Laden");
      }
      const data = await gRes.json();
      setAnlieferung(data.anlieferung);
      setGradiert(Array.isArray(data.gradiert) ? data.gradiert : []);

      if (sortRes.ok) {
        const sortData = await sortRes.json();
        setSortierungen(Array.isArray(sortData) ? sortData : []);
      }

      // Preise vorbefüllen: aus bereits bestehender OFFENER Gutschrift, sonst aus dem
      // Preisvorschlag (letzte Erzeugerabrechnung desselben Erzeugers+Artikels) — nie einen vom
      // Nutzer bereits geänderten Wert überschreiben (nur beim initialen Laden gesetzt).
      const bestehendeGutschrift = data.anlieferung?.gutschrift;
      const initial: Record<number, string> = {};
      for (const g of (Array.isArray(data.gradiert) ? data.gradiert : []) as GradierteMenge[]) {
        const bestehendePos = bestehendeGutschrift?.status === "OFFEN"
          ? bestehendeGutschrift.positionen.find((p: { artikelId: number }) => p.artikelId === g.artikelId)
          : null;
        const wert = bestehendePos?.preis ?? g.vorschlagPreis;
        if (wert != null) initial[g.artikelId] = String(wert);
      }
      setPreise(initial);
    } catch (e) {
      Sentry.captureException(e);
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function erzeugerabrechnungSpeichern() {
    if (!anlieferung) return;
    setSpeichern(true);
    setError("");
    try {
      const body = gradiert.length > 0
        ? { preise: Object.fromEntries(gradiert.map((g) => [String(g.artikelId), Number(preise[g.artikelId])])) }
        : {};
      const res = await fetch(`/api/anlieferungen/${id}/gutschrift`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Fehler beim Speichern");
        return;
      }
      await load();
    } catch (e) {
      Sentry.captureException(e);
      setError("Netzwerkfehler");
    } finally {
      setSpeichern(false);
    }
  }

  async function einfacheGutschriftErstellen() {
    if (!confirm("Gutschrift für diese Anlieferung erstellen?")) return;
    await erzeugerabrechnungSpeichern();
  }

  async function gutschriftEntfernen() {
    if (!confirm("Erzeuger-Gutschrift von dieser Anlieferung entfernen?")) return;
    try {
      const res = await fetch(`/api/anlieferungen/${id}/gutschrift`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Fehler beim Entfernen");
        return;
      }
      await load();
    } catch (e) {
      Sentry.captureException(e);
      alert("Netzwerkfehler");
    }
  }

  if (loading) return <div className="text-sm text-gray-400 py-8 text-center">Lade…</div>;
  if (!anlieferung) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center text-gray-400">
        {error || "Anlieferung nicht gefunden."}
      </div>
    );
  }

  const gutschrift = anlieferung.gutschrift;
  const kannBearbeiten = !gutschrift || gutschrift.status === "OFFEN";
  const gradiertModus = gradiert.length > 0;
  const alleGradiertePreiseGueltig = gradiert.every((g) => {
    const w = Number(preise[g.artikelId]);
    return Number.isFinite(w) && w > 0;
  });
  const summeGradiert = gradiert.reduce((sum, g) => {
    const w = Number(preise[g.artikelId]);
    return sum + (Number.isFinite(w) ? w * g.menge : 0);
  }, 0);

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Anlieferung {anlieferung.nummer}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{formatDatum(anlieferung.datum)}</p>
        </div>
        <button
          onClick={() => router.push("/anlieferungen")}
          className="text-sm text-gray-600 hover:text-green-700 hover:underline"
        >
          ← Zur Liste
        </button>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-xs text-gray-500 mb-1">Kunde</div>
            <Link href={`/kunden/${anlieferung.kunde.id}`} className="font-medium text-gray-900 hover:text-green-700 hover:underline">
              {anlieferung.kunde.firma ?? anlieferung.kunde.name}
            </Link>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Artikel</div>
            <div className="font-medium text-gray-900">{anlieferung.artikel.name}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Menge</div>
            <div className="font-mono text-gray-900">{formatMenge(anlieferung.menge)} {anlieferung.einheit}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Qualität</div>
            <div className="text-gray-900">{anlieferung.qualitaet ?? "—"}</div>
          </div>
        </div>
        {anlieferung.notiz && (
          <div className="mt-3 text-sm text-gray-600 border-t border-gray-100 pt-3">{anlieferung.notiz}</div>
        )}
      </div>

      {sortierungen.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-5">
          <div className="text-sm font-semibold text-gray-700 mb-3">Verknüpfte Ei-Sortierungen</div>
          <ul className="space-y-1">
            {sortierungen.map((s) => (
              <li key={s.id} className="text-sm">
                <Link href={`/eiersortierung/${s.id}`} className="text-green-700 hover:underline">
                  Sortierung vom {formatDatum(s.datum)}
                </Link>
                {s.notiz && <span className="text-gray-400 ml-2">{s.notiz}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Erzeugerabrechnung</h2>
          {gutschrift && (
            <Link href={`/gutschriften/${gutschrift.id}`} className="text-sm text-green-700 hover:underline font-mono">
              {gutschrift.nummer} · {gutschrift.status}
            </Link>
          )}
        </div>

        {!kannBearbeiten && (
          <div className="mb-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Diese Gutschrift ist bereits {gutschrift?.status.toLowerCase()} — eine automatische Aktualisierung ist
            nicht mehr möglich, manuelle Prüfung nötig.
          </div>
        )}

        {gradiertModus ? (
          <>
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Artikel</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Güte</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Gewicht</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Menge</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Preis/Stück</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Summe</th>
                  </tr>
                </thead>
                <tbody>
                  {gradiert.map((g) => {
                    const wert = preise[g.artikelId] ?? "";
                    const zahl = Number(wert);
                    const gueltig = Number.isFinite(zahl) && zahl > 0;
                    return (
                      <tr key={g.artikelId} className="border-b last:border-0">
                        <td className="px-3 py-2">{g.artikelName}</td>
                        <td className="px-3 py-2">{g.gueteklasse}</td>
                        <td className="px-3 py-2">{g.gewichtsklasse}</td>
                        <td className="px-3 py-2 text-right font-mono">{formatMenge(g.menge)}</td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            step="0.0001"
                            min="0"
                            disabled={!kannBearbeiten}
                            value={wert}
                            onChange={(e) => setPreise((prev) => ({ ...prev, [g.artikelId]: e.target.value }))}
                            className={`w-24 text-right border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-700 disabled:bg-gray-50 disabled:text-gray-400 ${
                              !gueltig ? "border-red-300" : "border-gray-300"
                            }`}
                          />
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {gueltig ? euro(zahl * g.menge) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                  <tr>
                    <td colSpan={5} className="px-3 py-2 text-right font-semibold text-gray-700">Gesamt</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold text-green-700">{euro(summeGradiert)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {kannBearbeiten && (
              <div className="flex items-center gap-3">
                <button
                  onClick={erzeugerabrechnungSpeichern}
                  disabled={speichern || !alleGradiertePreiseGueltig}
                  className="px-4 py-2 bg-green-700 hover:bg-green-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {speichern ? "Speichern…" : gutschrift ? "Erzeugerabrechnung aktualisieren" : "Erzeugerabrechnung erstellen"}
                </button>
                {!alleGradiertePreiseGueltig && (
                  <span className="text-xs text-gray-500">Bitte für jede Zeile einen gültigen Preis eintragen.</span>
                )}
                {gutschrift && (
                  <button
                    onClick={gutschriftEntfernen}
                    className="text-xs px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg font-medium transition-colors"
                  >
                    Gutschrift entfernen
                  </button>
                )}
              </div>
            )}
          </>
        ) : (
          <div>
            <p className="text-sm text-gray-500 mb-3">
              Keine Sortierung verknüpft — die Erzeugerabrechnung wird direkt aus der Anlieferung
              (Menge × Preis) gebildet.
            </p>
            <div className="text-sm mb-3">
              <span className="text-gray-500">Preis/Einheit: </span>
              <span className="font-mono">{euro(anlieferung.preisProEinheit)}</span>
              <span className="text-gray-500 ml-4">Gesamtbetrag: </span>
              <span className="font-mono font-semibold text-green-700">{euro(anlieferung.gesamtBetrag)}</span>
            </div>
            {kannBearbeiten && anlieferung.preisProEinheit ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={einfacheGutschriftErstellen}
                  disabled={speichern}
                  className="px-4 py-2 bg-green-700 hover:bg-green-800 disabled:bg-gray-300 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {speichern ? "Speichern…" : gutschrift ? "Gutschrift aktualisieren" : "Gutschrift erstellen"}
                </button>
                {gutschrift && (
                  <button
                    onClick={gutschriftEntfernen}
                    className="text-xs px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg font-medium transition-colors"
                  >
                    Gutschrift entfernen
                  </button>
                )}
              </div>
            ) : kannBearbeiten ? (
              <div className="text-xs text-gray-400">Kein Preis hinterlegt — bitte zuerst Preis erfassen.</div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
