"use client";
import { bestaetige } from "@/lib/dialog";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { formatDatum } from "@/lib/utils";
import { berechneEierMhd } from "@/lib/eier-mhd";
import { haltungsformLabel } from "@/lib/auswahllisten";
import * as Sentry from "@sentry/nextjs";

interface Position {
  id: number;
  gueteklasse: string;
  gewichtsklasse: string;
  menge: number;
  chargeNr: string | null;
  legedatum: string | null;
  erzeugercode: string | null;
  artikel: { id: number; name: string; einheit: string };
}

interface Sortierung {
  id: number;
  datum: string;
  notiz: string | null;
  erstelltVon: string | null;
  anlieferung: {
    id: number;
    nummer: string;
    kunde: { id: number; name: string; firma: string | null; erzeugercode: string | null; haltungsform: number | null };
  } | null;
  positionen: Position[];
}

interface EditPos {
  id: number;
  artikelId: number;
  gueteklasse: string;
  gewichtsklasse: string;
  artikelName: string;
  einheit: string;
  menge: string;
  chargeNr: string;
  legedatum: string;
  erzeugercode: string;
}

function mhdVon(legedatum: string | null): string | null {
  if (!legedatum) return null;
  return berechneEierMhd(new Date(legedatum)).toLocaleDateString("de-DE");
}

export default function EiersortierungDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [sortierung, setSortierung] = useState<Sortierung | null>(null);
  const [loading, setLoading] = useState(true);
  const [ladeFehler, setLadeFehler] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [hinweis, setHinweis] = useState("");
  const [editDatum, setEditDatum] = useState("");
  const [editNotiz, setEditNotiz] = useState("");
  const [editPos, setEditPos] = useState<EditPos[]>([]);

  useEffect(() => {
    fetch(`/api/eiersortierung/${id}`)
      .then((r) => {
        if (r.status === 404) return null;
        if (!r.ok) {
          setLadeFehler("Sortierung konnte nicht geladen werden.");
          return null;
        }
        return r.json();
      })
      .then(setSortierung)
      .catch((err) => {
        Sentry.captureException(err);
        setLadeFehler("Sortierung konnte nicht geladen werden (Netzwerkfehler).");
      })
      .finally(() => setLoading(false));
  }, [id]);

  function startEdit() {
    if (!sortierung) return;
    setEditDatum(sortierung.datum.slice(0, 10));
    setEditNotiz(sortierung.notiz ?? "");
    setEditPos(
      sortierung.positionen.map((p) => ({
        id: p.id,
        artikelId: p.artikel.id,
        gueteklasse: p.gueteklasse,
        gewichtsklasse: p.gewichtsklasse,
        artikelName: p.artikel.name,
        einheit: p.artikel.einheit,
        menge: String(p.menge),
        chargeNr: p.chargeNr ?? "",
        legedatum: p.legedatum ? p.legedatum.slice(0, 10) : "",
        erzeugercode: p.erzeugercode ?? "",
      })),
    );
    setEditError("");
    setHinweis("");
    setEditing(true);
  }

  function setPos(i: number, patch: Partial<EditPos>) {
    setEditPos((list) => list.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }

  async function handleSave() {
    setEditError("");
    if (editPos.length === 0) {
      setEditError("Mindestens eine Position nötig — zum Entfernen der ganzen Sortierung bitte „Löschen“ nutzen.");
      return;
    }
    for (const p of editPos) {
      const m = Number(p.menge.replace(",", "."));
      if (!Number.isFinite(m) || m <= 0) {
        setEditError(`Ungültige Menge bei ${p.artikelName}`);
        return;
      }
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/eiersortierung/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datum: editDatum,
          notiz: editNotiz,
          positionen: editPos.map((p) => ({
            artikelId: p.artikelId,
            gueteklasse: p.gueteklasse,
            gewichtsklasse: p.gewichtsklasse,
            menge: Number(p.menge.replace(",", ".")),
            chargeNr: p.chargeNr,
            legedatum: p.legedatum,
            erzeugercode: p.erzeugercode,
          })),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEditError(d.error ?? "Speichern fehlgeschlagen.");
        return;
      }
      setSortierung(d.sortierung);
      setHinweis(d.warnung ?? "");
      setEditing(false);
    } catch (err) {
      Sentry.captureException(err);
      setEditError("Speichern fehlgeschlagen — bitte erneut versuchen.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (
      !await bestaetige(
        "Diese Sortierung wirklich löschen? Der gebuchte Lagerzugang wird zurückgebucht — falls die Ware bereits weiterverkauft wurde, kann der Bestand dadurch negativ werden.",
      )
    ) {
      return;
    }
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await fetch(`/api/eiersortierung/${id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/eiersortierung");
        return;
      }
      if (res.status === 404) {
        setDeleteError("Diese Sortierung wurde bereits gelöscht.");
      } else {
        const d = await res.json().catch(() => ({}));
        setDeleteError(d.error ?? "Löschen fehlgeschlagen.");
      }
    } catch (err) {
      Sentry.captureException(err);
      setDeleteError("Löschen fehlgeschlagen — bitte erneut versuchen.");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <p className="text-sm text-gray-400">Lade…</p>;
  if (!sortierung) return <p className="text-sm text-red-600">{ladeFehler || "Nicht gefunden."}</p>;

  const gesamtMenge = sortierung.positionen.reduce((sum, p) => sum + p.menge, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Ei-Sortierung #{sortierung.id}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{formatDatum(sortierung.datum)}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/eiersortierung" className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 font-medium">
            Zurück
          </Link>
          <Link href="/eiersortierung/etiketten" className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 font-medium">
            Etiketten drucken
          </Link>
          {!editing && (
            <button onClick={startEdit} className="px-4 py-2 text-sm rounded-lg border border-blue-300 text-blue-700 hover:bg-blue-50 font-medium">
              Bearbeiten
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-4 py-2 text-sm rounded-lg border border-red-300 text-red-700 hover:bg-red-50 font-medium disabled:opacity-60"
          >
            {deleting ? "Lösche…" : "Löschen"}
          </button>
        </div>
      </div>

      {hinweis && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-6">{hinweis}</p>
      )}

      {editing && (
        <div className="bg-white rounded-xl shadow-sm border border-blue-200 p-4 sm:p-6 mb-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">Sortierung bearbeiten</h2>
          <p className="text-xs text-gray-500">
            Mengenänderungen werden als Differenz im Lagerbestand gebucht. Artikel und Güte-/Gewichtsklasse sind
            fest (die Klasse steckt im Artikel) — für andere Klassen bitte ein neues Protokoll anlegen. Eine
            bereits erstellte Erzeuger-Gutschrift wird nicht automatisch angepasst (Button „aktualisieren“ auf der Anlieferung).
          </p>
          <div className="flex flex-wrap gap-3">
            <label className="text-sm w-full sm:w-48">
              <span className="block text-gray-600 mb-1">Datum</span>
              <input type="date" value={editDatum} onChange={(e) => setEditDatum(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </label>
            <label className="text-sm flex-1 min-w-[12rem]">
              <span className="block text-gray-600 mb-1">Notiz</span>
              <input value={editNotiz} onChange={(e) => setEditNotiz(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </label>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500 uppercase">
                <tr>
                  <th className="text-left py-2 pr-3">Artikel</th>
                  <th className="text-left py-2 pr-3">Menge</th>
                  <th className="text-left py-2 pr-3">Charge</th>
                  <th className="text-left py-2 pr-3">Legedatum</th>
                  <th className="text-left py-2 pr-3">Erzeugercode</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {editPos.map((p, i) => (
                  <tr key={p.id}>
                    <td className="py-2 pr-3 whitespace-nowrap">{p.artikelName}</td>
                    <td className="py-2 pr-3"><input inputMode="decimal" value={p.menge} onChange={(e) => setPos(i, { menge: e.target.value })} className="w-24 border border-gray-300 rounded px-2 py-1" /> <span className="text-xs text-gray-400">{p.einheit}</span></td>
                    <td className="py-2 pr-3"><input value={p.chargeNr} onChange={(e) => setPos(i, { chargeNr: e.target.value })} className="w-32 border border-gray-300 rounded px-2 py-1" /></td>
                    <td className="py-2 pr-3"><input type="date" value={p.legedatum} onChange={(e) => setPos(i, { legedatum: e.target.value })} className="border border-gray-300 rounded px-2 py-1" /></td>
                    <td className="py-2 pr-3"><input value={p.erzeugercode} onChange={(e) => setPos(i, { erzeugercode: e.target.value })} className="w-36 border border-gray-300 rounded px-2 py-1" /></td>
                    <td className="py-2"><button type="button" onClick={() => setEditPos((l) => l.filter((_, idx) => idx !== i))} className="text-xs text-red-600 hover:underline">entfernen</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {editError && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{editError}</p>}
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-green-700 hover:bg-green-800 disabled:opacity-60 text-white rounded-lg font-medium">
              {saving ? "Speichere…" : "Speichern"}
            </button>
            <button onClick={() => setEditing(false)} disabled={saving} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 font-medium">
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {deleteError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2 mb-6">{deleteError}</p>
      )}

      {sortierung.anlieferung && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Herkunft</h2>
          <p className="text-sm text-gray-800">
            Anlieferung {sortierung.anlieferung.nummer} von {sortierung.anlieferung.kunde.firma || sortierung.anlieferung.kunde.name}
          </p>
          {sortierung.anlieferung.kunde.erzeugercode && (
            <p className="text-xs text-gray-500 mt-1">Erzeugercode: {sortierung.anlieferung.kunde.erzeugercode}</p>
          )}
          {haltungsformLabel(sortierung.anlieferung.kunde.haltungsform) && (
            <p className="text-xs text-gray-500 mt-1">
              Haltungsform: {haltungsformLabel(sortierung.anlieferung.kunde.haltungsform)}
            </p>
          )}
        </div>
      )}

      {sortierung.erstelltVon && (
        <p className="text-xs text-gray-400 mb-6">Erfasst von {sortierung.erstelltVon}</p>
      )}

      {sortierung.notiz && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-1">Notiz</h2>
          <p className="text-sm text-gray-600">{sortierung.notiz}</p>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Ausgangschargen ({sortierung.positionen.length})</h2>
          <span className="text-xs text-gray-500">Gesamt: {gesamtMenge}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="text-left px-4 py-2">Artikel</th>
                <th className="text-left px-4 py-2">Güte</th>
                <th className="text-left px-4 py-2 hidden sm:table-cell">Gewicht</th>
                <th className="text-right px-4 py-2">Menge</th>
                <th className="text-left px-4 py-2 hidden md:table-cell">Charge</th>
                <th className="text-left px-4 py-2 hidden sm:table-cell">Legedatum</th>
                <th className="text-left px-4 py-2">MHD</th>
                <th className="text-left px-4 py-2 hidden md:table-cell">Erzeugercode</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortierung.positionen.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2">
                    {p.artikel.name}
                    <div className="sm:hidden text-xs text-gray-400 mt-0.5">
                      {p.gewichtsklasse}
                      {p.chargeNr ? ` · Charge ${p.chargeNr}` : ""}
                      {p.erzeugercode ? ` · ${p.erzeugercode}` : ""}
                    </div>
                  </td>
                  <td className="px-4 py-2">{p.gueteklasse}</td>
                  <td className="px-4 py-2 hidden sm:table-cell">{p.gewichtsklasse}</td>
                  <td className="px-4 py-2 text-right">{p.menge} {p.artikel.einheit}</td>
                  <td className="px-4 py-2 hidden md:table-cell">{p.chargeNr || "—"}</td>
                  <td className="px-4 py-2 hidden sm:table-cell">{p.legedatum ? formatDatum(p.legedatum) : "—"}</td>
                  <td className="px-4 py-2">{mhdVon(p.legedatum) ?? "—"}</td>
                  <td className="px-4 py-2 hidden md:table-cell">{p.erzeugercode || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
