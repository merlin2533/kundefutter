"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";
import {
  DEFAULT_ARTIKEL_KATEGORIEN,
  DEFAULT_UNTERKATEGORIEN,
  getUnterkategorienKey,
  parseListSetting,
} from "@/lib/auswahllisten";

interface Eintrag {
  jahr: number;
  artikelId: number;
  artikelName: string;
  unterkategorie: string | null;
  menge: number;
  einheit: string | null;
}

interface KundeVerlauf {
  kundeId: number;
  kundeName: string;
  kundeOrt: string | null;
  eintraege: Eintrag[];
}

interface Data {
  kunden: KundeVerlauf[];
  jahre: number[];
}

export default function KategorieVerlaufPage() {
  const now = new Date();
  const [kategorie, setKategorie] = useState("Saatgut");
  const [unterkategorie, setUnterkategorie] = useState("alle");
  const [jahrVon, setJahrVon] = useState(String(now.getFullYear() - 2));
  const [jahrBis, setJahrBis] = useState(String(now.getFullYear()));
  const [kundeSuche, setKundeSuche] = useState("");

  const [kategorien, setKategorien] = useState<string[]>(DEFAULT_ARTIKEL_KATEGORIEN);
  const [kategorienMap, setKategorienMap] = useState<Record<string, string[]>>({});
  const [systemSettings, setSystemSettings] = useState<Record<string, string> | null>(null);

  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/einstellungen?prefix=system.")
      .then((r) => (r.ok ? r.json() : {}))
      .then((d: Record<string, string>) => {
        setKategorien(parseListSetting(d, "system.artikelkategorien", DEFAULT_ARTIKEL_KATEGORIEN));
        setSystemSettings(d);
      })
      .catch((err) => {
        Sentry.captureException(err);
      });
    fetch("/api/artikel/kategorien")
      .then((r) => (r.ok ? r.json() : {}))
      .then((d: Record<string, string[]>) => setKategorienMap(d))
      .catch((err) => {
        Sentry.captureException(err);
      });
  }, []);

  const aktuelleUnterkategorien = (() => {
    if (kategorie === "alle") return [];
    const fromSettings = systemSettings !== null
      ? parseListSetting(systemSettings, getUnterkategorienKey(kategorie), DEFAULT_UNTERKATEGORIEN[kategorie] ?? [])
      : DEFAULT_UNTERKATEGORIEN[kategorie] ?? [];
    const fromDb = kategorienMap[kategorie] ?? [];
    return [...new Set([...fromSettings, ...fromDb])].sort();
  })();

  const laden = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ kategorie, unterkategorie, jahrVon, jahrBis });
      const res = await fetch(`/api/statistik/kategorie-verlauf?${params}`);
      if (!res.ok) { setError("Auswertung konnte nicht geladen werden."); return; }
      setData(await res.json());
    } catch (err) {
      Sentry.captureException(err);
      setError("Netzwerkfehler beim Laden.");
    } finally {
      setLoading(false);
    }
  }, [kategorie, unterkategorie, jahrVon, jahrBis]);

  useEffect(() => { laden(); }, [laden]);

  const jahrOptionen: number[] = [];
  for (let j = now.getFullYear() + 1; j >= now.getFullYear() - 8; j--) jahrOptionen.push(j);

  const suche = kundeSuche.trim().toLowerCase();
  const kunden = (data?.kunden ?? []).filter((k) =>
    !suche || k.kundeName.toLowerCase().includes(suche) || (k.kundeOrt ?? "").toLowerCase().includes(suche)
  );
  const jahre = data?.jahre ?? [];

  const exportParams = new URLSearchParams({ kategorie, unterkategorie, jahrVon, jahrBis });
  if (kundeSuche.trim()) exportParams.set("kundeSuche", kundeSuche.trim());

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link href="/statistik" className="hover:text-green-700">Statistik</Link>
            <span>›</span>
            <span className="text-gray-800 font-medium">Kategorie-Verlauf</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Kategorie-Verlauf je Kunde</h1>
          <p className="text-sm text-gray-500 mt-1">
            Welcher Kunde hat in welchem Jahr welchen Artikel einer Kategorie erhalten — z.&nbsp;B. für die
            Fruchtfolgeplanung (Zwischenfrucht, Getreide, …) im nächsten Jahr.
          </p>
        </div>
        {kunden.length > 0 && (
          <div className="flex items-center gap-2 flex-none">
            <a
              href={`/api/statistik/kategorie-verlauf/export?${exportParams}`}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Excel-Export
            </a>
            <a
              href={`/api/statistik/kategorie-verlauf/pdf?${exportParams}`}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              PDF-Export
            </a>
          </div>
        )}
      </div>

      {/* Filter */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Kategorie</label>
          <select
            value={kategorie}
            onChange={(e) => { setKategorie(e.target.value); setUnterkategorie("alle"); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="alle">Alle</option>
            {kategorien.map((k) => <option key={k} value={k}>{k === "Duenger" ? "Dünger" : k}</option>)}
          </select>
        </div>
        {aktuelleUnterkategorien.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Unterkategorie</label>
            <select
              value={unterkategorie}
              onChange={(e) => setUnterkategorie(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="alle">Alle</option>
              {aktuelleUnterkategorien.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Von Jahr</label>
          <select
            value={jahrVon}
            onChange={(e) => setJahrVon(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            {jahrOptionen.map((j) => <option key={j} value={j}>{j}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Bis Jahr</label>
          <select
            value={jahrBis}
            onChange={(e) => setJahrBis(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            {jahrOptionen.map((j) => <option key={j} value={j}>{j}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-medium text-gray-600 mb-1">Kunde suchen</label>
          <input
            type="text"
            value={kundeSuche}
            onChange={(e) => setKundeSuche(e.target.value)}
            placeholder="Name oder Ort…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        {loading && <span className="text-xs text-gray-400">Lädt…</span>}
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {kunden.length === 0 ? (
          <p className="p-6 text-sm text-gray-400">
            Keine Lieferungen im gewählten Zeitraum{kategorie !== "alle" ? " für diese Kategorie" : ""}.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide sticky left-0 bg-gray-50">
                    Kunde
                  </th>
                  {jahre.map((j) => (
                    <th key={j} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      {j}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {kunden.map((k) => (
                  <tr key={k.kundeId} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 sticky left-0 bg-white">
                      <Link href={`/kunden/${k.kundeId}`} className="text-green-700 hover:underline font-medium">
                        {k.kundeName}
                      </Link>
                      {k.kundeOrt && <span className="text-xs text-gray-400 ml-1">({k.kundeOrt})</span>}
                    </td>
                    {jahre.map((j) => {
                      const einträgeJahr = k.eintraege.filter((e) => e.jahr === j);
                      return (
                        <td key={j} className="px-4 py-2.5 align-top">
                          {einträgeJahr.length === 0 ? (
                            <span className="text-gray-300">—</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {einträgeJahr.map((e) => (
                                <span
                                  key={e.artikelId}
                                  className="inline-block text-xs px-1.5 py-0.5 rounded-full bg-green-50 text-green-800 border border-green-200 whitespace-nowrap"
                                >
                                  {e.artikelName}
                                  <span className="text-green-600">
                                    {" · "}{e.menge.toLocaleString("de-DE")} {e.einheit ?? ""}
                                  </span>
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
