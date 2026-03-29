"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { formatDatum } from "@/lib/utils";
import SearchableSelect from "@/components/SearchableSelect";

interface ExportCard {
  title: string;
  description: string;
  typ: string;
  hasDateRange?: boolean;
  hasKundeFilter?: boolean;
}

const EXPORTS: ExportCard[] = [
  {
    title: "Kundenliste",
    description: "Alle Kunden mit Kontaktdaten, Kategorie und Status als Excel/CSV.",
    typ: "kunden",
  },
  {
    title: "Artikel mit Preisen",
    description: "Vollständige Artikelliste mit Standardpreisen, Einheiten und Beständen.",
    typ: "artikel",
  },
  {
    title: "Lieferantenübersicht",
    description: "Alle Lieferanten mit zugeordneten Artikeln und Einkaufspreisen.",
    typ: "lieferanten",
  },
  {
    title: "Lieferhistorie",
    description: "Alle Lieferungen im gewählten Zeitraum, optional nach Kunde gefiltert.",
    typ: "lieferhistorie",
    hasDateRange: true,
    hasKundeFilter: true,
  },
  {
    title: "Lagerübersicht",
    description: "Aktueller Lagerbestand aller Artikel mit Mindestbestand und Ampelstatus.",
    typ: "lager",
  },
  {
    title: "Lagerbewegungen",
    description: "Alle Ein- und Ausgänge im gewählten Zeitraum.",
    typ: "bewegungen",
    hasDateRange: true,
  },
  {
    title: "Margenbericht",
    description: "Umsatz, Einkauf und Margen je Artikel und Kunde im gewählten Zeitraum.",
    typ: "margen",
    hasDateRange: true,
  },
  {
    title: "DATEV-Buchhaltung",
    description: "Rechnungsdaten im DATEV-Format für den Steuerberater. Buchungsstapel als CSV.",
    typ: "datev",
    hasDateRange: true,
  },
];

const today = new Date().toISOString().split("T")[0];
const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  .toISOString()
  .split("T")[0];

interface ExportState {
  von: string;
  bis: string;
  kundeId: string;
}

interface Kunde { id: number; name: string; firma?: string; }

export default function ExportePage() {
  const [states, setStates] = useState<Record<string, ExportState>>(() => {
    const init: Record<string, ExportState> = {};
    for (const e of EXPORTS) {
      init[e.typ] = { von: firstOfMonth, bis: today, kundeId: "" };
    }
    return init;
  });
  const [downloading, setDownloading] = useState<Record<string, boolean>>({});
  const [kunden, setKunden] = useState<Kunde[]>([]);

  // Massenexport state
  const [bulkTyp, setBulkTyp] = useState<"rechnung" | "lieferschein">("rechnung");
  const [bulkKundeId, setBulkKundeId] = useState("");
  const [bulkVon, setBulkVon] = useState(firstOfMonth);
  const [bulkBis, setBulkBis] = useState(today);
  const [bulkRnrVon, setBulkRnrVon] = useState("");
  const [bulkRnrBis, setBulkRnrBis] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkError, setBulkError] = useState("");
  const [bulkCount, setBulkCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/kunden")
      .then((r) => r.json())
      .then((d) => setKunden(Array.isArray(d) ? d : []));
  }, []);

  function updateState(typ: string, field: keyof ExportState, value: string) {
    setStates((prev) => ({
      ...prev,
      [typ]: { ...prev[typ], [field]: value },
    }));
  }

  function buildUrl(card: ExportCard): string {
    const s = states[card.typ];
    const params = new URLSearchParams({ typ: card.typ });
    if (card.hasDateRange) {
      if (s.von) params.set("von", s.von);
      if (s.bis) params.set("bis", s.bis);
    }
    if (card.hasKundeFilter && s.kundeId) {
      params.set("kundeId", s.kundeId);
    }
    return `/api/exporte?${params}`;
  }

  async function handleBulkDownload() {
    setBulkLoading(true);
    setBulkError("");
    setBulkCount(null);
    try {
      const params = new URLSearchParams({ typ: bulkTyp });
      if (bulkKundeId) params.set("kundeId", bulkKundeId);
      if (bulkVon) params.set("von", bulkVon);
      if (bulkBis) params.set("bis", bulkBis);
      if (bulkTyp === "rechnung" && bulkRnrVon) params.set("rnrVon", bulkRnrVon);
      if (bulkTyp === "rechnung" && bulkRnrBis) params.set("rnrBis", bulkRnrBis);
      const res = await fetch(`/api/exporte/bulk?${params}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setBulkError(data.error ?? "Export fehlgeschlagen");
        return;
      }
      const count = res.headers.get("X-Export-Count");
      if (count) setBulkCount(Number(count));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `massenexport-${bulkTyp}-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setBulkError("Netzwerkfehler beim Massenexport");
    } finally {
      setBulkLoading(false);
    }
  }

  function buildDatevUrl(card: ExportCard): string {
    const s = states[card.typ];
    const params = new URLSearchParams();
    if (s.von) params.set("von", s.von);
    if (s.bis) params.set("bis", s.bis);
    return `/api/exporte/datev?${params}`;
  }

  async function handleDownload(card: ExportCard) {
    const url = card.typ === "datev" ? buildDatevUrl(card) : buildUrl(card);
    setDownloading((prev) => ({ ...prev, [card.typ]: true }));
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Download fehlgeschlagen");
      const blob = await res.blob();
      const contentDisposition = res.headers.get("content-disposition");
      let filename = card.typ === "datev" ? `datev-buchungsstapel.csv` : `${card.typ}-export.csv`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (match?.[1]) filename = match[1].replace(/['"]/g, "");
      }
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch {
      // Fall back to direct navigation
      window.location.href = url;
    } finally {
      setDownloading((prev) => ({ ...prev, [card.typ]: false }));
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">Exporte</h1>
        <p className="text-sm text-gray-500">Daten als CSV/Excel exportieren oder Berichte herunterladen.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 mb-8">
        {EXPORTS.map((card) => {
          const s = states[card.typ];
          const isDownloading = downloading[card.typ];
          return (
            <div
              key={card.typ}
              className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col gap-4"
            >
              <div>
                <h2 className="text-base font-semibold text-gray-900 mb-1">{card.title}</h2>
                <p className="text-sm text-gray-500">{card.description}</p>
              </div>

              {/* Filters */}
              {(card.hasDateRange || card.hasKundeFilter) && (
                <div className="space-y-2">
                  {card.hasDateRange && (
                    <div className="flex gap-2 flex-wrap">
                      <div className="flex flex-col gap-1 flex-1 min-w-[120px]">
                        <label className="text-xs text-gray-500">Von</label>
                        <input
                          type="date"
                          value={s.von}
                          onChange={(e) => updateState(card.typ, "von", e.target.value)}
                          className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
                        />
                      </div>
                      <div className="flex flex-col gap-1 flex-1 min-w-[120px]">
                        <label className="text-xs text-gray-500">Bis</label>
                        <input
                          type="date"
                          value={s.bis}
                          onChange={(e) => updateState(card.typ, "bis", e.target.value)}
                          className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
                        />
                      </div>
                    </div>
                  )}
                  {card.hasKundeFilter && (
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Kunde (optional)</label>
                      <SearchableSelect
                        options={kunden.map((k) => ({ value: k.id, label: k.firma ? `${k.firma} – ${k.name}` : k.name }))}
                        value={s.kundeId}
                        onChange={(v) => updateState(card.typ, "kundeId", v)}
                        placeholder="Alle Kunden"
                        allowClear
                        clearLabel="Alle Kunden"
                      />
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={() => handleDownload(card)}
                disabled={isDownloading}
                className="mt-auto w-full px-4 py-2 text-sm font-medium bg-green-800 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {isDownloading ? (
                  <>
                    <span className="inline-block w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Exportieren…
                  </>
                ) : (
                  "Herunterladen"
                )}
              </button>
            </div>
          );
        })}

        {/* Preislisten-Import card */}
        <div className="bg-white rounded-xl border border-dashed border-gray-300 shadow-sm p-5 flex flex-col gap-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-1">Preislisten-Import</h2>
            <p className="text-sm text-gray-500">
              Preislisten von Lieferanten importieren und Artikelpreise automatisch aktualisieren.
            </p>
          </div>
          <Link
            href="/preislisten-import"
            className="mt-auto w-full px-4 py-2 text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 rounded-lg transition-colors text-center"
          >
            Zum Preislisten-Import →
          </Link>
        </div>
      </div>

      {/* ── Massenexport ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-lg font-bold mb-1">Massenexport PDF</h2>
        <p className="text-sm text-gray-500 mb-5">Mehrere Rechnungen oder Lieferscheine als ZIP-Archiv herunterladen.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Typ */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Typ</label>
            <div className="flex gap-2">
              {(["rechnung", "lieferschein"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setBulkTyp(t)}
                  className={`flex-1 py-2 text-sm rounded-lg border font-medium transition-colors ${
                    bulkTyp === t ? "bg-green-700 text-white border-green-700" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {t === "rechnung" ? "Rechnungen" : "Lieferscheine"}
                </button>
              ))}
            </div>
          </div>

          {/* Kunde */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kunde (optional)</label>
            <SearchableSelect
              options={kunden.map((k) => ({ value: k.id, label: k.firma ? `${k.firma} – ${k.name}` : k.name }))}
              value={bulkKundeId}
              onChange={setBulkKundeId}
              placeholder="Alle Kunden"
              allowClear
              clearLabel="Alle Kunden"
            />
          </div>

          {/* Datum */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lieferdatum von</label>
            <input
              type="date"
              value={bulkVon}
              onChange={(e) => setBulkVon(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lieferdatum bis</label>
            <input
              type="date"
              value={bulkBis}
              onChange={(e) => setBulkBis(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
            />
          </div>

          {/* Rechnungsnummer-Bereich (nur Rechnungen) */}
          {bulkTyp === "rechnung" && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rechnungsnummer von (optional)</label>
                <input
                  type="text"
                  value={bulkRnrVon}
                  onChange={(e) => setBulkRnrVon(e.target.value)}
                  placeholder="z.B. RE-2026-0001"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rechnungsnummer bis (optional)</label>
                <input
                  type="text"
                  value={bulkRnrBis}
                  onChange={(e) => setBulkRnrBis(e.target.value)}
                  placeholder="z.B. RE-2026-0050"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
                />
              </div>
            </>
          )}
        </div>

        {bulkError && (
          <div className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {bulkError}
          </div>
        )}
        {bulkCount !== null && !bulkLoading && (
          <p className="mt-3 text-sm text-green-700">{bulkCount} {bulkTyp === "rechnung" ? "Rechnungen" : "Lieferscheine"} heruntergeladen.</p>
        )}

        <button
          onClick={handleBulkDownload}
          disabled={bulkLoading}
          className="mt-5 px-6 py-2.5 text-sm font-medium bg-green-800 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-60 flex items-center gap-2"
        >
          {bulkLoading ? (
            <>
              <span className="inline-block w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Erstelle ZIP…
            </>
          ) : (
            `Massenexport ${bulkTyp === "rechnung" ? "Rechnungen" : "Lieferscheine"} (ZIP)`
          )}
        </button>
      </div>
    </div>
  );
}
