"use client";

import React, { useState } from "react";
import Link from "next/link";
import { formatEuro, formatDatum } from "@/lib/utils";
import { Kunde, Lieferung, statusBadge, lieferungTotal } from "../_shared";

export default function LieferhistorieTab({ kunde, onRefresh }: { kunde: Kunde; onRefresh: () => void }) {
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [sammelrechnungLoading, setSammelrechnungLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"alle" | "geplant" | "geliefert" | "storniert">("alle");
  const [zahlungFilter, setZahlungFilter] = useState<"alle" | "offen" | "bezahlt" | "ueberfaellig">("alle");

  const heute = new Date();
  heute.setHours(0, 0, 0, 0);

  const emailKontakt = kunde.kontakte.find((k) => k.typ === "email");

  function zahlungsStatus(l: Lieferung): { label: string; cls: string } {
    if (l.status !== "geliefert") return { label: "—", cls: "text-gray-400" };
    if (l.bezahltAm) return { label: "Bezahlt", cls: "text-green-700 font-medium" };
    if (!l.rechnungNr) return { label: "Offen", cls: "text-yellow-700 font-medium" };
    const tage = l.zahlungsziel ?? 30;
    const basisDatum = l.rechnungDatum ?? l.datum;
    const faellig = new Date(new Date(basisDatum).getTime() + tage * 24 * 60 * 60 * 1000);
    if (heute > faellig) return { label: "Überfällig", cls: "text-red-600 font-medium" };
    return { label: "Offen", cls: "text-yellow-700 font-medium" };
  }

  async function markiereAlsBezahlt(l: Lieferung) {
    setActionLoading(l.id);
    await fetch(`/api/lieferungen/${l.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bezahltAm: l.bezahltAm ? null : new Date().toISOString() }),
    });
    setActionLoading(null);
    onRefresh();
  }

  async function rechnungErstellen(l: Lieferung) {
    setActionLoading(l.id);
    window.open(`/lieferungen/${l.id}/rechnung`, "_blank");
    setTimeout(() => { setActionLoading(null); onRefresh(); }, 1500);
  }

  function toggleSammelrechnungSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function erstelleSammelrechnung() {
    if (selectedIds.size < 2) return;
    setSammelrechnungLoading(true);
    try {
      const res = await fetch("/api/exporte/sammelrechnung", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kundeId: kunde.id, lieferungIds: Array.from(selectedIds) }),
      });
      if (!res.ok) throw new Error("Fehler beim Erstellen der Sammelrechnung");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sammelrechnung-${kunde.name}-${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setSelectedIds(new Set());
      onRefresh();
    } catch {
      // ignore
    } finally {
      setSammelrechnungLoading(false);
    }
  }

  const sammelrechnungFaehig = (l: Lieferung) =>
    l.status === "geliefert" && !l.rechnungNr && !l.sammelrechnungId;

  const gefiltert = kunde.lieferungen.filter((l) => {
    if (statusFilter !== "alle" && l.status !== statusFilter) return false;
    if (zahlungFilter !== "alle") {
      const zs = zahlungsStatus(l);
      if (zahlungFilter === "bezahlt" && zs.label !== "Bezahlt") return false;
      if (zahlungFilter === "offen" && zs.label !== "Offen") return false;
      if (zahlungFilter === "ueberfaellig" && zs.label !== "Überfällig") return false;
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const inRechnungNr = l.rechnungNr?.toLowerCase().includes(q) ?? false;
      const inArtikel = l.positionen.some((p) =>
        p.artikel.name.toLowerCase().includes(q)
      );
      if (!inRechnungNr && !inArtikel) return false;
    }
    return true;
  });

  const gesamtBetrag = kunde.lieferungen
    .filter((l) => l.status === "geliefert")
    .reduce((s, l) => s + lieferungTotal(l), 0);
  const offen = kunde.lieferungen
    .filter((l) => l.status === "geliefert" && !l.bezahltAm)
    .reduce((s, l) => s + lieferungTotal(l), 0);

  if (kunde.lieferungen.length === 0) {
    return <p className="text-sm text-gray-400">Keine Lieferungen vorhanden.</p>;
  }

  return (
    <div className="space-y-4">
      {/* Zusammenfassung */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-xs text-green-700 font-medium">Gesamtumsatz</p>
          <p className="text-lg font-bold text-green-800">{formatEuro(gesamtBetrag)}</p>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-xs text-yellow-700 font-medium">Offen</p>
          <p className="text-lg font-bold text-yellow-800">{formatEuro(offen)}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs text-blue-700 font-medium">Bezahlt</p>
          <p className="text-lg font-bold text-blue-800">{formatEuro(gesamtBetrag - offen)}</p>
        </div>
      </div>

      {/* Sammelrechnung Action */}
      {selectedIds.size >= 2 && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
          <span className="text-sm text-green-800 font-medium">{selectedIds.size} Lieferungen ausgewählt</span>
          <button
            onClick={erstelleSammelrechnung}
            disabled={sammelrechnungLoading}
            className="px-4 py-1.5 text-sm bg-green-700 hover:bg-green-800 text-white rounded-lg font-medium transition-colors disabled:opacity-60"
          >
            {sammelrechnungLoading ? "Erstelle PDF…" : "Sammelrechnung erstellen"}
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Auswahl löschen
          </button>
        </div>
      )}

      {/* Suchleiste und Filter */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Suche nach Artikel oder Rechnungsnr."
          className="flex-1 min-w-[200px] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <div className="flex gap-1">
          {(["alle", "geplant", "geliefert", "storniert"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                statusFilter === s
                  ? "bg-green-600 text-white"
                  : "border border-gray-300 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {s === "alle" ? "Alle Status" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {(["alle", "offen", "bezahlt", "ueberfaellig"] as const).map((z) => (
            <button
              key={z}
              onClick={() => setZahlungFilter(z)}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                zahlungFilter === z
                  ? "bg-green-600 text-white"
                  : "border border-gray-300 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {z === "alle" ? "Alle Zahlungen" : z === "ueberfaellig" ? "Überfällig" : z.charAt(0).toUpperCase() + z.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Tabelle */}
      <div className="overflow-x-auto border border-gray-200 rounded-xl">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="hidden md:table-cell px-3 py-2.5 text-xs font-medium text-gray-500" title="Für Sammelrechnung auswählen">SR</th>
              <th className="text-left px-3 py-2.5 font-medium text-gray-600 text-xs">Datum</th>
              <th className="hidden sm:table-cell text-left px-3 py-2.5 font-medium text-gray-600 text-xs">Artikel</th>
              <th className="text-right px-3 py-2.5 font-medium text-gray-600 text-xs">Betrag</th>
              <th className="text-left px-3 py-2.5 font-medium text-gray-600 text-xs">Status</th>
              <th className="hidden lg:table-cell text-left px-3 py-2.5 font-medium text-gray-600 text-xs">Lieferschein</th>
              <th className="hidden md:table-cell text-left px-3 py-2.5 font-medium text-gray-600 text-xs">Rechnung</th>
              <th className="hidden sm:table-cell text-left px-3 py-2.5 font-medium text-gray-600 text-xs">Zahlung</th>
              <th className="px-3 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {gefiltert.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-sm text-gray-400">
                  Keine Lieferungen gefunden.
                </td>
              </tr>
            ) : null}
            {gefiltert.map((l) => {
              const total = lieferungTotal(l);
              const posSummary = l.positionen.slice(0, 2)
                .map((p) => `${p.menge} ${p.artikel.einheit} ${p.artikel.name}`)
                .join(", ");
              const more = l.positionen.length > 2 ? ` +${l.positionen.length - 2}` : "";
              const zStatus = zahlungsStatus(l);
              const isLoading = actionLoading === l.id;

              const emailHref = emailKontakt && l.rechnungNr
                ? (() => {
                    const subject = encodeURIComponent(`Rechnung ${l.rechnungNr}`);
                    const body = encodeURIComponent(
                      `Sehr geehrte Damen und Herren,\n\nanbei erhalten Sie die Rechnung ${l.rechnungNr} vom ${formatDatum(l.datum)} über ${formatEuro(total)}.\n\nMit freundlichen Grüßen`
                    );
                    return `mailto:${emailKontakt.wert}?subject=${subject}&body=${body}`;
                  })()
                : null;

              return (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="hidden md:table-cell px-3 py-2.5 text-center">
                    {sammelrechnungFaehig(l) ? (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(l.id)}
                        onChange={() => toggleSammelrechnungSelect(l.id)}
                        className="rounded border-gray-300 text-green-700 focus:ring-green-700"
                        title="Für Sammelrechnung auswählen"
                      />
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-xs">
                    {formatDatum(l.datum)}
                    <div className="sm:hidden text-xs text-gray-500 mt-0.5">{posSummary}{more}</div>
                  </td>
                  <td className="hidden sm:table-cell px-3 py-2.5 text-gray-600 text-xs max-w-[180px] truncate">
                    {posSummary}{more}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-medium text-xs whitespace-nowrap">
                    {formatEuro(total)}
                  </td>
                  <td className="px-3 py-2.5">{statusBadge(l.status)}</td>

                  {/* Lieferschein — direkter Link, kein Modal */}
                  <td className="hidden lg:table-cell px-3 py-2.5">
                    <a
                      href={`/lieferungen/${l.id}/lieferschein`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-100 transition-colors whitespace-nowrap"
                    >
                      📄 Lieferschein
                    </a>
                  </td>

                  {/* Rechnung — direkter Link + Datum + E-Mail-Icon */}
                  <td className="hidden md:table-cell px-3 py-2.5">
                    {l.rechnungNr ? (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <a
                          href={`/lieferungen/${l.id}/rechnung`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs px-2 py-1 border border-green-300 text-green-700 rounded hover:bg-green-50 transition-colors whitespace-nowrap"
                        >
                          🧾 {l.rechnungNr}
                        </a>
                        {l.rechnungDatum && (
                          <span className="text-xs text-gray-400">{formatDatum(l.rechnungDatum)}</span>
                        )}
                        {emailHref && (
                          <a
                            href={emailHref}
                            className="text-xs text-blue-500 hover:text-blue-700"
                            title="Per E-Mail senden"
                          >
                            📧
                          </a>
                        )}
                      </div>
                    ) : l.status === "geliefert" ? (
                      <button
                        onClick={() => rechnungErstellen(l)}
                        disabled={isLoading}
                        className="text-xs px-2 py-1 bg-green-700 hover:bg-green-800 text-white rounded transition-colors disabled:opacity-50 whitespace-nowrap"
                      >
                        {isLoading ? "…" : "+ Rechnung erstellen"}
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>

                  {/* Zahlung */}
                  <td className="hidden sm:table-cell px-3 py-2.5">
                    {l.status === "geliefert" ? (
                      <label className="flex items-center gap-1.5 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={!!l.bezahltAm}
                          disabled={isLoading}
                          onChange={() => markiereAlsBezahlt(l)}
                          className="rounded border-gray-300 text-green-700 focus:ring-green-700"
                        />
                        <span className={`text-xs ${zStatus.cls}`}>{zStatus.label}</span>
                      </label>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>

                  <td className="px-3 py-2.5">
                    <Link
                      href={`/lieferungen/${l.id}`}
                      className="text-green-700 hover:underline text-xs font-medium"
                    >
                      Details →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
