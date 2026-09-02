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
import MultiSelectDropdown from "@/components/MultiSelectDropdown";

interface Eintrag {
  jahr: number;
  artikelId: number;
  artikelName: string;
  unterkategorie: string | null;
  mengeGeliefert: number;
  mengeOffen: number;
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

const isoHeute = (d: Date) => d.toISOString().slice(0, 10);

export default function KategorieVerlaufPage() {
  const now = new Date();
  const [kategorie, setKategorie] = useState("Saatgut");
  const [unterkategorien, setUnterkategorien] = useState<string[]>([]);
  const [von, setVon] = useState(isoHeute(new Date(Date.UTC(now.getUTCFullYear() - 2, 0, 1))));
  const [bis, setBis] = useState(isoHeute(now));
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

  // Unterkategorien kommen aus zwei Quellen: den unter /einstellungen/stammdaten konfigurierten
  // Werten UND den tatsächlich auf Artikeln verwendeten Werten (GET /api/artikel/kategorien) —
  // ein Artikel kann eine Unterkategorie tragen, die (noch) nicht in den Stammdaten registriert
  // ist (z.B. Alt-Import, Tippfehler wie "Einzelkomponenten" statt "Einzelkomponente"). Solche
  // nicht registrierten Werte werden im Dropdown zusätzlich mit einem Hinweis markiert, statt sie
  // von unregistrierten Duplikaten ununterscheidbar in die Liste zu mischen.
  const aktuelleUnterkategorien = (() => {
    if (kategorie === "alle") return [];
    const fromSettings = systemSettings !== null
      ? parseListSetting(systemSettings, getUnterkategorienKey(kategorie), DEFAULT_UNTERKATEGORIEN[kategorie] ?? [])
      : DEFAULT_UNTERKATEGORIEN[kategorie] ?? [];
    const fromDb = kategorienMap[kategorie] ?? [];
    const fromSettingsSet = new Set(fromSettings);
    return [...new Set([...fromSettings, ...fromDb])]
      .sort()
      .map((u) => ({
        value: u,
        label: u,
        hint: fromSettingsSet.has(u) ? undefined : "· nicht in Stammdaten registriert",
      }));
  })();

  const laden = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ kategorie, von, bis });
      for (const u of unterkategorien) params.append("unterkategorie", u);
      const res = await fetch(`/api/statistik/kategorie-verlauf?${params}`);
      if (!res.ok) { setError("Auswertung konnte nicht geladen werden."); return; }
      setData(await res.json());
    } catch (err) {
      Sentry.captureException(err);
      setError("Netzwerkfehler beim Laden.");
    } finally {
      setLoading(false);
    }
  }, [kategorie, unterkategorien, von, bis]);

  useEffect(() => { laden(); }, [laden]);

  const suche = kundeSuche.trim().toLowerCase();
  const kunden = (data?.kunden ?? []).filter((k) =>
    !suche || k.kundeName.toLowerCase().includes(suche) || (k.kundeOrt ?? "").toLowerCase().includes(suche)
  );
  const jahre = data?.jahre ?? [];

  const exportParams = new URLSearchParams({ kategorie, von, bis });
  for (const u of unterkategorien) exportParams.append("unterkategorie", u);
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
            Welcher Kunde hat in welchem Jahr welchen Artikel einer Kategorie erhalten oder bereits bestellt — z.&nbsp;B. für die
            Fruchtfolgeplanung (Zwischenfrucht, Getreide, …) im nächsten Jahr, oder um zu sehen wer schon bestellt hat.
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
            onChange={(e) => { setKategorie(e.target.value); setUnterkategorien([]); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="alle">Alle</option>
            {kategorien.map((k) => <option key={k} value={k}>{k === "Duenger" ? "Dünger" : k}</option>)}
          </select>
        </div>
        {aktuelleUnterkategorien.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Unterkategorie</label>
            <MultiSelectDropdown
              options={aktuelleUnterkategorien}
              values={unterkategorien}
              onChange={setUnterkategorien}
              allLabel="Alle"
              className="min-w-[200px]"
            />
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Von</label>
          <input
            type="date"
            value={von}
            max={bis}
            onChange={(e) => setVon(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Bis</label>
          <input
            type="date"
            value={bis}
            min={von}
            onChange={(e) => setBis(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
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
                                <span key={e.artikelId} className="inline-flex flex-col gap-0.5">
                                  {e.mengeGeliefert > 0 && (
                                    <span
                                      className="inline-block text-xs px-1.5 py-0.5 rounded-full bg-green-50 text-green-800 border border-green-200 whitespace-nowrap"
                                      title="Bereits ausgeliefert"
                                    >
                                      {e.artikelName}
                                      <span className="text-green-600">
                                        {" · "}{e.mengeGeliefert.toLocaleString("de-DE")} {e.einheit ?? ""}
                                      </span>
                                    </span>
                                  )}
                                  {e.mengeOffen > 0 && (
                                    <span
                                      className="inline-block text-xs px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap"
                                      title="Bestellt, noch nicht ausgeliefert"
                                    >
                                      {e.artikelName}
                                      <span className="text-amber-600">
                                        {" · "}{e.mengeOffen.toLocaleString("de-DE")} {e.einheit ?? ""} · offen
                                      </span>
                                    </span>
                                  )}
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
