"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { sollStundenFuerDatum, bevorzugtesZeitfensterFuerDatum, stundenZwischenUhrzeiten } from "@/lib/utils";
import * as Sentry from "@sentry/nextjs";

const ARTEN = [
  { value: "arbeit", label: "Arbeit" },
  { value: "urlaub", label: "Urlaub" },
  { value: "krank", label: "Krank" },
  { value: "feiertag", label: "Feiertag" },
];

interface Mitarbeiter {
  id: number;
  vorname: string;
  nachname: string;
  wochenstunden: number | null;
  bevorzugteArbeitszeiten: string | null;
}

interface Arbeitsstunde {
  id: number;
  stunden: number;
  art: string;
  von: string | null;
  bis: string | null;
  notiz: string | null;
  mitarbeiter: { id: number };
}

interface RowState {
  stunden: string;
  art: string;
  von: string;
  bis: string;
  notiz: string;
  bestehendId: number | null;
  saving: boolean;
  veraendert: boolean;
}

export default function ArbeitszeiterfassungPage() {
  const [datum, setDatum] = useState(new Date().toISOString().split("T")[0]);
  const [mitarbeiterListe, setMitarbeiterListe] = useState<Mitarbeiter[]>([]);
  const [rows, setRows] = useState<Record<number, RowState>>({});
  const [loading, setLoading] = useState(true);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [error, setError] = useState("");

  const loadTag = useCallback(async (targetDatum: string) => {
    setLoading(true);
    setError("");
    try {
      const [maRes, stdRes] = await Promise.all([
        fetch("/api/personal/mitarbeiter?aktiv=true"),
        fetch(`/api/personal/arbeitsstunden?von=${targetDatum}&bis=${targetDatum}`),
      ]);
      const maList: Mitarbeiter[] = maRes.ok ? await maRes.json() : [];
      const eintraege: Arbeitsstunde[] = stdRes.ok ? await stdRes.json() : [];
      const maArr = Array.isArray(maList) ? maList : [];
      setMitarbeiterListe(maArr);

      const neueRows: Record<number, RowState> = {};
      for (const ma of maArr) {
        const bestehend = (Array.isArray(eintraege) ? eintraege : []).find((e) => e.mitarbeiter.id === ma.id);
        if (bestehend) {
          neueRows[ma.id] = {
            stunden: String(bestehend.stunden),
            art: bestehend.art,
            von: bestehend.von ?? "",
            bis: bestehend.bis ?? "",
            notiz: bestehend.notiz ?? "",
            bestehendId: bestehend.id,
            saving: false,
            veraendert: false,
          };
        } else {
          const soll = sollStundenFuerDatum(targetDatum, ma.bevorzugteArbeitszeiten, ma.wochenstunden);
          const zeitVorschlag = bevorzugtesZeitfensterFuerDatum(targetDatum, ma.bevorzugteArbeitszeiten);
          neueRows[ma.id] = {
            stunden: String(soll),
            art: "arbeit",
            von: zeitVorschlag?.von ?? "",
            bis: zeitVorschlag?.bis ?? "",
            notiz: "",
            bestehendId: null,
            saving: false,
            veraendert: false,
          };
        }
      }
      setRows(neueRows);
    } catch (err) {
      Sentry.captureException(err);
      setError("Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTag(datum); }, [datum, loadTag]);

  function setRow(maId: number, patch: Partial<RowState>) {
    setRows((prev) => ({ ...prev, [maId]: { ...prev[maId], ...patch } }));
  }

  // Tatsächliches Kommen/Gehen hat Vorrang: sobald beide Zeiten gültig sind, wird die
  // Stundenzahl daraus berechnet und in dieselbe Row-Änderung mit übernommen.
  function setZeit(maId: number, patch: { von?: string; bis?: string }, row: RowState) {
    const von = patch.von ?? row.von;
    const bis = patch.bis ?? row.bis;
    const berechnet = stundenZwischenUhrzeiten(von, bis);
    setRow(maId, { ...patch, veraendert: true, ...(berechnet != null ? { stunden: String(berechnet) } : {}) });
  }

  async function bestaetigeZeile(ma: Mitarbeiter, row: RowState) {
    const std = parseFloat(row.stunden);
    if (isNaN(std) || std <= 0 || std > 24) {
      setError(`${ma.vorname} ${ma.nachname}: Stunden müssen zwischen 0,5 und 24 liegen`);
      return;
    }
    setRow(ma.id, { saving: true });
    setError("");
    try {
      const body = {
        stunden: std,
        art: row.art,
        von: row.art === "arbeit" && row.von ? row.von : null,
        bis: row.art === "arbeit" && row.bis ? row.bis : null,
        notiz: row.notiz || null,
      };
      const res = row.bestehendId
        ? await fetch(`/api/personal/arbeitsstunden/${row.bestehendId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch("/api/personal/arbeitsstunden", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mitarbeiterId: ma.id, datum, ...body }),
          });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(`${ma.vorname} ${ma.nachname}: ${d.error ?? "Fehler beim Speichern"}`);
        setRow(ma.id, { saving: false });
        return;
      }
      const data = await res.json();
      setRow(ma.id, { saving: false, veraendert: false, bestehendId: data.id ?? row.bestehendId });
    } catch (err) {
      Sentry.captureException(err);
      setError(`${ma.vorname} ${ma.nachname}: Fehler beim Speichern`);
      setRow(ma.id, { saving: false });
    }
  }

  async function alleBestaetigen() {
    const offen = mitarbeiterListe.filter((ma) => !rows[ma.id]?.bestehendId);
    if (offen.length === 0) return;
    if (!confirm(`${offen.length} Mitarbeiter mit den vorgeschlagenen Stunden bestätigen?`)) return;
    setBulkSaving(true);
    for (const ma of offen) {
      const row = rows[ma.id];
      if (row) await bestaetigeZeile(ma, row);
    }
    setBulkSaving(false);
  }

  const offenCount = mitarbeiterListe.filter((ma) => !rows[ma.id]?.bestehendId).length;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <div>
          <Link href="/personal" className="text-gray-400 hover:text-gray-600 text-sm">← Personal</Link>
          <h1 className="text-2xl font-bold mt-1">Arbeitszeiterfassung</h1>
        </div>
        <input
          type="date"
          value={datum}
          onChange={(e) => setDatum(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Uhrzeit und Stunden sind aus den bevorzugten Arbeitszeiten der Stammdaten vorbelegt — bei Bedarf anpassen und bestätigen.
      </p>

      {error && <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

      {loading ? (
        <div className="p-8 text-center text-gray-500">Lade…</div>
      ) : mitarbeiterListe.length === 0 ? (
        <div className="bg-white border rounded-lg p-8 text-center text-gray-400">Keine aktiven Mitarbeiter</div>
      ) : (
        <>
          {offenCount > 0 && (
            <div className="flex justify-end mb-3">
              <button
                onClick={alleBestaetigen}
                disabled={bulkSaving}
                className="bg-green-700 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-green-800 disabled:opacity-50"
              >
                {bulkSaving ? "Bestätige…" : `Alle ${offenCount} mit Vorschlag bestätigen`}
              </button>
            </div>
          )}
          <div className="bg-white border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <th className="px-4 py-2 text-left">Mitarbeiter</th>
                  <th className="px-4 py-2 text-left">Art</th>
                  <th className="px-4 py-2 text-left">Von</th>
                  <th className="px-4 py-2 text-left">Bis</th>
                  <th className="px-4 py-2 text-right">Stunden</th>
                  <th className="px-4 py-2 text-left hidden md:table-cell">Notiz</th>
                  <th className="px-4 py-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {mitarbeiterListe.map((ma) => {
                  const row = rows[ma.id];
                  if (!row) return null;
                  return (
                    <tr key={ma.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium whitespace-nowrap">
                        <Link href={`/personal/${ma.id}?tab=stunden`} className="hover:underline">
                          {ma.vorname} {ma.nachname}
                        </Link>
                      </td>
                      <td className="px-4 py-2">
                        <select
                          value={row.art}
                          onChange={(e) => setRow(ma.id, { art: e.target.value, veraendert: true })}
                          className="border rounded px-2 py-1 text-xs"
                        >
                          {ARTEN.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        {row.art === "arbeit" && (
                          <input
                            type="time"
                            value={row.von}
                            onChange={(e) => setZeit(ma.id, { von: e.target.value }, row)}
                            className="border rounded px-2 py-1 text-xs"
                          />
                        )}
                      </td>
                      <td className="px-4 py-2">
                        {row.art === "arbeit" && (
                          <input
                            type="time"
                            value={row.bis}
                            onChange={(e) => setZeit(ma.id, { bis: e.target.value }, row)}
                            className="border rounded px-2 py-1 text-xs"
                          />
                        )}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <input
                          type="number"
                          step="0.5"
                          min="0.5"
                          max="24"
                          value={row.stunden}
                          disabled={stundenZwischenUhrzeiten(row.von, row.bis) != null}
                          onChange={(e) => setRow(ma.id, { stunden: e.target.value, veraendert: true })}
                          className="w-20 border rounded px-2 py-1 text-right font-mono text-xs disabled:bg-gray-50 disabled:text-gray-500"
                        />
                      </td>
                      <td className="px-4 py-2 hidden md:table-cell">
                        <input
                          value={row.notiz}
                          onChange={(e) => setRow(ma.id, { notiz: e.target.value, veraendert: true })}
                          className="w-full border rounded px-2 py-1 text-xs"
                        />
                      </td>
                      <td className="px-4 py-2 text-right whitespace-nowrap">
                        {row.bestehendId === null || row.veraendert ? (
                          <button
                            onClick={() => bestaetigeZeile(ma, row)}
                            disabled={row.saving}
                            className={row.bestehendId === null
                              ? "bg-green-700 text-white px-3 py-1 rounded text-xs font-medium hover:bg-green-800 disabled:opacity-50"
                              : "text-xs text-blue-600 hover:underline disabled:opacity-50"}
                          >
                            {row.saving ? "…" : row.bestehendId === null ? "Bestätigen" : "Aktualisieren"}
                          </button>
                        ) : (
                          <span className="text-xs text-green-700 font-medium">✓ erfasst</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
