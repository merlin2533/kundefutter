"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import SearchableSelect from "@/components/SearchableSelect";
import { Kunde, Artikel, KundeSchlag } from "../_shared";

interface AbgeleiteterBedarf {
  fruchtart: string;
  schlagName: string;
  flaeche: number;
  nBedarf: number; // kg N-Dünger gesamt
  pBedarf: number; // kg P-Dünger gesamt
}

function berechneBedarfFuerFruchtart(fruchtart: string | null | undefined, flaeche: number): { nKgHa: number; pKgHa: number } {
  const f = (fruchtart ?? "").toLowerCase();
  if (f.includes("mais")) return { nKgHa: 200, pKgHa: 50 };
  if (f.includes("raps")) return { nKgHa: 190, pKgHa: 60 };
  if (f.includes("weizen") || f.includes("gerste") || f.includes("roggen") || f.includes("getreide") || f.includes("triticale") || f.includes("hafer")) return { nKgHa: 180, pKgHa: 40 };
  if (f.includes("gras") || f.includes("grünland") || f.includes("grunland") || f.includes("wiese") || f.includes("weide")) return { nKgHa: 150, pKgHa: 0 };
  return { nKgHa: 160, pKgHa: 30 };
}

export default function BedarfeTab({ kunde, onRefresh }: { kunde: Kunde; onRefresh: () => void }) {
  const [artikel, setArtikel] = useState<Artikel[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ artikelId: "", menge: "", intervallTage: "30", notiz: "" });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  // Schlagkartei-Ableitung
  const [showAbleitung, setShowAbleitung] = useState(false);
  const [schlaegte, setSchlaegte] = useState<KundeSchlag[]>([]);
  const [loadingSchlaegte, setLoadingSchlaegte] = useState(false);
  const [abgeleiteteBedarfe, setAbgeleiteteBedarfe] = useState<AbgeleiteterBedarf[]>([]);
  const [uebernehmen, setUebernehmen] = useState(false);
  // Per-row artikel selection for N and P
  const [nArtikelId, setNArtikelId] = useState("");
  const [pArtikelId, setPArtikelId] = useState("");

  useEffect(() => {
    fetch("/api/artikel?aktiv=true")
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setArtikel(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  async function handleLadeSchlaegte() {
    setLoadingSchlaegte(true);
    setShowAbleitung(true);
    try {
      const res = await fetch(`/api/kunden/${kunde.id}/schlaegte`);
      const data = await res.json();
      const list: KundeSchlag[] = Array.isArray(data) ? data : [];
      setSchlaegte(list);
      const bedarfe: AbgeleiteterBedarf[] = list
        .filter((s) => s.flaeche > 0)
        .map((s) => {
          const { nKgHa, pKgHa } = berechneBedarfFuerFruchtart(s.fruchtart, s.flaeche);
          return {
            fruchtart: s.fruchtart ?? "Sonstige",
            schlagName: s.name,
            flaeche: s.flaeche,
            nBedarf: Math.round(nKgHa * s.flaeche),
            pBedarf: Math.round(pKgHa * s.flaeche),
          };
        });
      setAbgeleiteteBedarfe(bedarfe);
    } catch {
      // ignore
    } finally {
      setLoadingSchlaegte(false);
    }
  }

  async function handleBedarfeUebernehmen() {
    if (!nArtikelId && !pArtikelId) return;
    setUebernehmen(true);
    try {
      const totalN = abgeleiteteBedarfe.reduce((s, b) => s + b.nBedarf, 0);
      const totalP = abgeleiteteBedarfe.reduce((s, b) => s + b.pBedarf, 0);

      const promises: Promise<Response>[] = [];
      if (nArtikelId && totalN > 0) {
        promises.push(fetch(`/api/kunden/${kunde.id}/bedarfe`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ artikelId: Number(nArtikelId), menge: totalN, intervallTage: 365, notiz: "Aus Schlagkartei abgeleitet (N-Dünger)" }),
        }));
      }
      if (pArtikelId && totalP > 0) {
        promises.push(fetch(`/api/kunden/${kunde.id}/bedarfe`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ artikelId: Number(pArtikelId), menge: totalP, intervallTage: 365, notiz: "Aus Schlagkartei abgeleitet (P-Dünger)" }),
        }));
      }
      await Promise.all(promises);
      setShowAbleitung(false);
      setAbgeleiteteBedarfe([]);
      setSchlaegte([]);
      setNArtikelId("");
      setPArtikelId("");
      onRefresh();
    } catch {
      // ignore
    } finally {
      setUebernehmen(false);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.artikelId || !form.menge) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/kunden/${kunde.id}/bedarfe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artikelId: Number(form.artikelId),
          menge: Number(form.menge),
          intervallTage: Number(form.intervallTage) || 30,
          notiz: form.notiz || undefined,
        }),
      });
      if (!res.ok) throw new Error();
      setShowAdd(false);
      setForm({ artikelId: "", menge: "", intervallTage: "30", notiz: "" });
      onRefresh();
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(artikelId: number) {
    setDeleting(artikelId);
    try {
      await fetch(`/api/kunden/${kunde.id}/bedarfe`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artikelId }),
      });
      onRefresh();
    } finally {
      setDeleting(null);
    }
  }

  const totalN = abgeleiteteBedarfe.reduce((s, b) => s + b.nBedarf, 0);
  const totalP = abgeleiteteBedarfe.reduce((s, b) => s + b.pBedarf, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 justify-between items-center">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleLadeSchlaegte}
            className="text-sm px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Bedarf aus Schlagkartei ableiten
          </button>
          {kunde.bedarfe.length > 0 && (
            <Link
              href={`/angebote/neu?kundeId=${kunde.id}&ausBedarfen=true`}
              className="text-sm px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors inline-block"
            >
              Angebot aus Bedarfen erstellen
            </Link>
          )}
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="text-sm px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
        >
          + Bedarf hinzufügen
        </button>
      </div>

      {/* Schlagkartei-Ableitung Panel */}
      {showAbleitung && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-blue-900">Bedarfsableitung aus Schlagkartei</h3>
            <button
              onClick={() => setShowAbleitung(false)}
              className="text-blue-400 hover:text-blue-700 text-xs"
            >
              Schließen
            </button>
          </div>

          {loadingSchlaegte ? (
            <p className="text-sm text-blue-600">Lade Schlagdaten…</p>
          ) : schlaegte.length === 0 ? (
            <p className="text-sm text-blue-600">Keine Schlagdaten vorhanden. Bitte zuerst Schläge in der Schlagkartei anlegen.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm bg-white rounded-lg overflow-hidden border border-blue-100">
                  <thead className="bg-blue-100 text-blue-800">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Schlag</th>
                      <th className="hidden sm:table-cell text-left px-3 py-2 font-medium">Fruchtart</th>
                      <th className="text-right px-3 py-2 font-medium">Fläche (ha)</th>
                      <th className="text-right px-3 py-2 font-medium">N-Bedarf (kg)</th>
                      <th className="text-right px-3 py-2 font-medium hidden sm:table-cell">P-Bedarf (kg)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-50">
                    {abgeleiteteBedarfe.map((b, i) => (
                      <tr key={i} className="hover:bg-blue-50">
                        <td className="px-3 py-2 font-medium">
                          {b.schlagName}
                          <div className="sm:hidden text-xs text-gray-500">{b.fruchtart}</div>
                        </td>
                        <td className="hidden sm:table-cell px-3 py-2 text-gray-600">{b.fruchtart}</td>
                        <td className="px-3 py-2 text-right">{b.flaeche.toLocaleString("de-DE")}</td>
                        <td className="px-3 py-2 text-right font-medium">{b.nBedarf.toLocaleString("de-DE")}</td>
                        <td className="px-3 py-2 text-right hidden sm:table-cell">{b.pBedarf > 0 ? b.pBedarf.toLocaleString("de-DE") : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-blue-100 font-semibold text-blue-900">
                    <tr>
                      <td className="px-3 py-2" colSpan={2}>Gesamt</td>
                      <td className="px-3 py-2 text-right">
                        {abgeleiteteBedarfe.reduce((s, b) => s + b.flaeche, 0).toLocaleString("de-DE")} ha
                      </td>
                      <td className="px-3 py-2 text-right">{totalN.toLocaleString("de-DE")} kg</td>
                      <td className="px-3 py-2 text-right hidden sm:table-cell">{totalP > 0 ? `${totalP.toLocaleString("de-DE")} kg` : "—"}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="bg-white border border-blue-200 rounded-lg p-4 space-y-3">
                <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Als Bedarfe übernehmen</p>
                <p className="text-xs text-gray-500">Wähle die Artikel für N-Dünger und P-Dünger. Der Gesamtbedarf wird als Jahresbedarf (365 Tage Intervall) gespeichert.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {totalN > 0 && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        N-Dünger-Artikel ({totalN.toLocaleString("de-DE")} kg gesamt)
                      </label>
                      <SearchableSelect
                        options={artikel.map((a) => ({ value: String(a.id), label: a.name, sub: a.artikelnummer }))}
                        value={nArtikelId}
                        onChange={setNArtikelId}
                        placeholder="— N-Dünger wählen —"
                      />
                    </div>
                  )}
                  {totalP > 0 && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        P-Dünger-Artikel ({totalP.toLocaleString("de-DE")} kg gesamt)
                      </label>
                      <SearchableSelect
                        options={artikel.map((a) => ({ value: String(a.id), label: a.name, sub: a.artikelnummer }))}
                        value={pArtikelId}
                        onChange={setPArtikelId}
                        placeholder="— P-Dünger wählen —"
                      />
                    </div>
                  )}
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowAbleitung(false)}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="button"
                    onClick={handleBedarfeUebernehmen}
                    disabled={uebernehmen || (!nArtikelId && !pArtikelId)}
                    className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uebernehmen ? "Speichere…" : "Als Bedarfe übernehmen"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {kunde.bedarfe.length === 0 ? (
        <p className="text-sm text-gray-400">Keine Bedarfe erfasst.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Artikel</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Menge</th>
                <th className="hidden sm:table-cell text-left px-4 py-2 font-medium text-gray-600">Intervall</th>
                <th className="hidden md:table-cell text-left px-4 py-2 font-medium text-gray-600">Notiz</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {kunde.bedarfe.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5">
                    <p className="font-medium">{b.artikel.name}</p>
                    <p className="text-xs text-gray-400">{b.artikel.artikelnummer}</p>
                    <div className="sm:hidden text-xs text-gray-500 mt-0.5">alle {b.intervallTage} Tage</div>
                  </td>
                  <td className="px-4 py-2.5">{b.menge} {b.artikel.einheit}</td>
                  <td className="hidden sm:table-cell px-4 py-2.5">alle {b.intervallTage} Tage</td>
                  <td className="hidden md:table-cell px-4 py-2.5 text-gray-500">{b.notiz ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => handleDelete(b.artikelId)}
                      disabled={deleting === b.artikelId}
                      className="text-red-500 hover:text-red-700 text-xs disabled:opacity-50"
                    >
                      {deleting === b.artikelId ? "…" : "Löschen"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <h3 className="text-sm font-semibold mb-3">Neuer Bedarf</h3>
          <form onSubmit={handleAdd} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Artikel <span className="text-red-500">*</span></label>
              <SearchableSelect
                options={artikel.map((a) => ({ value: a.id, label: a.name, sub: a.artikelnummer }))}
                value={form.artikelId}
                onChange={(v) => setForm({ ...form, artikelId: v })}
                placeholder="— Bitte wählen —"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Menge <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={form.menge}
                  onChange={(e) => setForm({ ...form, menge: e.target.value })}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Intervall (Tage)</label>
                <input
                  type="number"
                  min="1"
                  value={form.intervallTage}
                  onChange={(e) => setForm({ ...form, intervallTage: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notiz</label>
              <input
                type="text"
                value={form.notiz}
                onChange={(e) => setForm({ ...form, notiz: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-60"
              >
                {saving ? "…" : "Speichern"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
