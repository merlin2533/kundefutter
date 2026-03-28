"use client";
import { useState } from "react";
import Link from "next/link";
import { formatDatum } from "@/lib/utils";

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

export default function ExportePage() {
  const [states, setStates] = useState<Record<string, ExportState>>(() => {
    const init: Record<string, ExportState> = {};
    for (const e of EXPORTS) {
      init[e.typ] = { von: firstOfMonth, bis: today, kundeId: "" };
    }
    return init;
  });
  const [downloading, setDownloading] = useState<Record<string, boolean>>({});

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

  async function handleDownload(card: ExportCard) {
    const url = buildUrl(card);
    setDownloading((prev) => ({ ...prev, [card.typ]: true }));
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Download fehlgeschlagen");
      const blob = await res.blob();
      const contentDisposition = res.headers.get("content-disposition");
      let filename = `${card.typ}-export.csv`;
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
                      <label className="text-xs text-gray-500 block mb-1">Kunden-ID (optional)</label>
                      <input
                        type="number"
                        placeholder="Alle Kunden"
                        value={s.kundeId}
                        onChange={(e) => updateState(card.typ, "kundeId", e.target.value)}
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
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
    </div>
  );
}
