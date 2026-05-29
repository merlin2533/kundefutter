"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

interface QuellPosition {
  quelle: "vorbestellung" | "lieferung" | "angebot";
  positionId: number;
  belegId: number;
  belegNummer: string;
  belegTyp: string;
  kunde: { id: number; name: string; firma: string | null } | null;
  artikelId: number;
  artikelName: string;
  artikelnummer: string;
  einheit: string;
  menge: number;
  bestelltAm: string | null;
}

interface Zeile {
  artikelId: number;
  artikelName: string;
  artikelnummer: string;
  einheit: string;
  einkaufspreis: number;
  gesamtMenge: number;
  offeneMenge: number;
  bestelltMenge: number;
  positionen: QuellPosition[];
}

interface Gruppe {
  lieferantId: number;
  lieferantName: string;
  lieferant: { email: string | null; telefon: string | null };
  einkaufswertOffen: number;
  zeilen: Zeile[];
}

const BELEG_FARBE: Record<string, string> = {
  vorbestellung: "bg-purple-100 text-purple-800",
  lieferung: "bg-blue-100 text-blue-800",
  angebot: "bg-teal-100 text-teal-800",
};

function eur(n: number): string {
  return n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}
function menge(n: number): string {
  return n.toLocaleString("de-DE", { maximumFractionDigits: 2 });
}
function datum(d: string): string {
  return new Date(d).toLocaleDateString("de-DE");
}

type Filter = "offen" | "bestellt" | "alle";

export default function EinkaufszettelPage() {
  const [gruppen, setGruppen] = useState<Gruppe[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("offen");
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [bestelldatum, setBestelldatum] = useState<string>(() => new Date().toISOString().slice(0, 10));

  async function load() {
    setLoading(true);
    const res = await fetch("/api/einkaufszettel");
    const data = res.ok ? await res.json() : [];
    setGruppen(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function mark(
    aktion: "bestellen" | "zuruecksetzen",
    positionen: QuellPosition[],
    lieferantId: number
  ) {
    if (positionen.length === 0) return;
    setBusy(true);
    await fetch("/api/einkaufszettel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        aktion,
        bestelltAm: aktion === "bestellen" ? bestelldatum : undefined,
        positionen: positionen.map((p) => ({
          quelle: p.quelle,
          positionId: p.positionId,
          artikelId: p.artikelId,
          lieferantId: lieferantId || null,
          menge: p.menge,
          einheit: p.einheit,
        })),
      }),
    });
    setBusy(false);
    load();
  }

  // Zeilen je nach Filter
  function sichtbareZeilen(z: Zeile[]): Zeile[] {
    if (filter === "offen") return z.filter((x) => x.offeneMenge > 0);
    if (filter === "bestellt") return z.filter((x) => x.bestelltMenge > 0);
    return z;
  }
  const sichtbareGruppen = gruppen
    .map((g) => ({ ...g, zeilen: sichtbareZeilen(g.zeilen) }))
    .filter((g) => g.zeilen.length > 0);

  const offeneZeilen = gruppen.reduce((s, g) => s + g.zeilen.filter((z) => z.offeneMenge > 0).length, 0);
  const wertOffen = gruppen.reduce((s, g) => s + g.einkaufswertOffen, 0);

  function zeileStatus(z: Zeile): { label: string; color: string } {
    if (z.offeneMenge <= 0) return { label: "Bestellt", color: "bg-green-100 text-green-800" };
    if (z.bestelltMenge > 0) return { label: "Teilweise", color: "bg-amber-100 text-amber-800" };
    return { label: "Offen", color: "bg-yellow-100 text-yellow-800" };
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <style>{`@media print { .print-hidden { display: none !important; } @page { margin: 1.5cm; size: A4; } }`}</style>

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Einkaufszettel</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Bestellbedarf aus Vorbestellungen, geplanten Lieferungen &amp; angenommenen Angeboten — je Lieferant.
          </p>
          {!loading && (
            <p className="text-sm mt-1">
              {offeneZeilen > 0 ? (
                <span className="text-yellow-700 font-medium">
                  {offeneZeilen} offene Position{offeneZeilen !== 1 ? "en" : ""} · noch zu bestellen {eur(wertOffen)}
                </span>
              ) : (
                <span className="text-green-700 font-medium">Alles bestellt ✓</span>
              )}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 print-hidden">
          <div className="flex gap-1">
            {(["offen", "bestellt", "alle"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  filter === f ? "bg-green-700 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                }`}
              >
                {f === "offen" ? "Offen" : f === "bestellt" ? "Bestellt" : "Alle"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Bestelldatum:</label>
            <input
              type="date"
              value={bestelldatum}
              onChange={(e) => setBestelldatum(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-2 py-1"
            />
            <button
              onClick={() => window.print()}
              className="text-sm px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg"
            >
              Drucken
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 py-8 text-center">Lade…</p>
      ) : sichtbareGruppen.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">🛒</p>
          <p className="text-sm">
            {filter === "bestellt" ? "Noch nichts als bestellt markiert." : "Kein offener Bestellbedarf."}
          </p>
          <p className="text-xs mt-1">
            Bedarf entsteht aus offenen Vorbestellungen, geplanten Lieferungen und angenommenen Angeboten.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {sichtbareGruppen.map((g) => {
            const offenePos = g.zeilen.flatMap((z) => z.positionen.filter((p) => !p.bestelltAm));
            return (
              <div key={g.lieferantId} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                {/* Lieferant-Kopf */}
                <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    {g.lieferantId > 0 ? (
                      <Link href={`/lieferanten/${g.lieferantId}`} className="font-semibold text-gray-900 hover:text-green-700">
                        {g.lieferantName}
                      </Link>
                    ) : (
                      <span className="font-semibold text-gray-500">{g.lieferantName}</span>
                    )}
                    <div className="flex gap-3 text-xs text-gray-500 mt-0.5">
                      {g.lieferant.telefon && <span>📞 {g.lieferant.telefon}</span>}
                      {g.lieferant.email && (
                        <a href={`mailto:${g.lieferant.email}`} className="hover:text-green-700">
                          ✉️ {g.lieferant.email}
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">
                      {g.zeilen.length} Artikel{g.einkaufswertOffen > 0 ? ` · offen ${eur(g.einkaufswertOffen)}` : ""}
                    </span>
                    {offenePos.length > 0 && (
                      <button
                        onClick={() => mark("bestellen", offenePos, g.lieferantId)}
                        disabled={busy}
                        className="print-hidden text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-40"
                      >
                        Alles bestellen
                      </button>
                    )}
                  </div>
                </div>

                {/* Artikel-Zeilen */}
                <div className="divide-y divide-gray-100">
                  {g.zeilen.map((z) => {
                    const key = `${g.lieferantId}:${z.artikelId}`;
                    const isOpen = expanded.has(key);
                    const st = zeileStatus(z);
                    const offenePosZeile = z.positionen.filter((p) => !p.bestelltAm);
                    const bestelltPosZeile = z.positionen.filter((p) => p.bestelltAm);
                    return (
                      <div key={key} className="px-5 py-3">
                        <div className="flex gap-3 items-start">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>{st.label}</span>
                              <Link href={`/artikel/${z.artikelId}`} className="font-medium text-gray-900 hover:text-green-700 text-sm">
                                {z.artikelName}
                              </Link>
                              <span className="text-xs text-gray-400 font-mono">{z.artikelnummer}</span>
                            </div>
                            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500">
                              <span className="font-medium text-gray-700">
                                Gesamt {menge(z.gesamtMenge)} {z.einheit}
                              </span>
                              {z.offeneMenge > 0 && <span className="text-yellow-700">offen {menge(z.offeneMenge)}</span>}
                              {z.bestelltMenge > 0 && <span className="text-green-700">bestellt {menge(z.bestelltMenge)}</span>}
                              {z.einkaufspreis > 0 && <span>EK {eur(z.einkaufspreis)}/{z.einheit}</span>}
                              <button
                                onClick={() => toggle(key)}
                                className="print-hidden text-gray-400 hover:text-gray-700"
                              >
                                {z.positionen.length} Auftr. {isOpen ? "▲" : "▼"}
                              </button>
                            </div>
                          </div>
                          <div className="flex flex-col gap-1 items-end shrink-0 print-hidden">
                            {offenePosZeile.length > 0 && (
                              <button
                                onClick={() => mark("bestellen", offenePosZeile, g.lieferantId)}
                                disabled={busy}
                                className="text-xs px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg font-medium transition-colors disabled:opacity-40"
                              >
                                Bestellt ✓
                              </button>
                            )}
                            {bestelltPosZeile.length > 0 && (
                              <button
                                onClick={() => mark("zuruecksetzen", bestelltPosZeile, g.lieferantId)}
                                disabled={busy}
                                className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-40"
                              >
                                Zurücksetzen
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Auftrags-Aufschlüsselung */}
                        {isOpen && (
                          <div className="mt-2 ml-1 pl-3 border-l-2 border-gray-100 space-y-1.5">
                            {z.positionen.map((p) => (
                              <div key={`${p.quelle}:${p.positionId}`} className="flex items-center gap-2 text-xs flex-wrap">
                                <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${BELEG_FARBE[p.quelle]}`}>
                                  {p.belegTyp}
                                </span>
                                <span className="font-mono text-gray-500">{p.belegNummer}</span>
                                {p.kunde && (
                                  <Link href={`/kunden/${p.kunde.id}`} className="text-gray-600 hover:text-green-700">
                                    {p.kunde.firma || p.kunde.name}
                                  </Link>
                                )}
                                <span className="font-medium text-gray-700">
                                  {menge(p.menge)} {p.einheit}
                                </span>
                                {p.bestelltAm ? (
                                  <span className="text-green-700">✓ bestellt {datum(p.bestelltAm)}</span>
                                ) : (
                                  <span className="text-yellow-700">offen</span>
                                )}
                                <span className="print-hidden ml-auto">
                                  {p.bestelltAm ? (
                                    <button
                                      onClick={() => mark("zuruecksetzen", [p], g.lieferantId)}
                                      disabled={busy}
                                      className="text-gray-400 hover:text-gray-600 disabled:opacity-40"
                                    >
                                      zurücksetzen
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => mark("bestellen", [p], g.lieferantId)}
                                      disabled={busy}
                                      className="text-blue-600 hover:text-blue-800 disabled:opacity-40"
                                    >
                                      bestellt ✓
                                    </button>
                                  )}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
