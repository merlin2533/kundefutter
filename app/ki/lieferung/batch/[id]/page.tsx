"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import SearchableSelect from "@/components/SearchableSelect";
import KonfidenzBadge from "@/components/KonfidenzBadge";
import NeuArtikelInline, { type NeuArtikelErgebnis } from "@/components/NeuArtikelInline";
import DezimalInput from "@/components/DezimalInput";
import {
  matchArtikel,
  matchKunde,
  berechneFehlendeFelder,
  normalisiereSuchtext,
  type Konfidenz,
} from "@/lib/kiMatching";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ArtikelRaw {
  id: number;
  name: string;
  artikelnummer: string;
  einheit: string;
  standardpreis: number;
  aktuellerBestand: number;
  mindestbestand: number;
  kategorie?: string;
}

interface KundeRaw {
  id: number;
  name: string;
  firma?: string;
  ort?: string;
}

interface LieferantRaw {
  id: number;
  name: string;
}

interface KiPosition {
  name: string;
  artikelnummer?: string;
  menge: number;
  einheit?: string;
  einzelpreis?: number;
  chargeNr?: string;
}

interface KiErgebnis {
  kunde: { name: string; firma?: string; ort?: string };
  datum?: string;
  positionen: KiPosition[];
}

interface BatchPosition {
  kiPosition: KiPosition;
  artikelId: string;
  vorschlagArtikelId: number | null;
  menge: number;
  verkaufspreis: number;
  konfidenz: Konfidenz;
  showNeuForm?: boolean;
  chargeNr: string;
}

interface BatchItem {
  id: number;
  reihenfolge: number;
  dateiPfad: string;
  dateiName: string | null;
  status: "wartet" | "analysiert" | "fehler" | "uebernommen" | "verworfen";
  kiErgebnis: KiErgebnis | null;
  kundeId: number | null;
  kundeKonfidenz: Konfidenz | null;
  positionen: BatchPosition[];
  fehlendeFelder: string[];
  fehlerText: string | null;
  entscheidung: "passt" | "passt_nicht" | null;
  lieferungId: number | null;
}

interface BatchDetail {
  id: number;
  status: string;
  items: BatchItem[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function meldeLernkorrektur(typ: "artikel" | "kunde", suchtext: string, zielId: number) {
  const text = suchtext.trim();
  if (!text) return;
  fetch("/api/ki/lernen", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ typ, suchtext: text, zielId }),
  }).catch(() => {});
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function KiLieferungBatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const batchId = parseInt(id, 10);

  const [batch, setBatch] = useState<BatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [artikel, setArtikel] = useState<ArtikelRaw[]>([]);
  const [kunden, setKunden] = useState<KundeRaw[]>([]);
  const [lieferanten, setLieferanten] = useState<LieferantRaw[]>([]);
  const [gelerntKunde, setGelerntKunde] = useState<Map<string, number>>(new Map());
  const [gelerntArtikel, setGelerntArtikel] = useState<Map<string, number>>(new Map());

  const [analyzing, setAnalyzing] = useState(false);
  const [analyzedCount, setAnalyzedCount] = useState(0);
  const analyzeLoopStarted = useRef(false);

  const [finalizing, setFinalizing] = useState(false);
  const [finalizeResult, setFinalizeResult] = useState<{ erstellt: number; uebersprungen: number; fehlgeschlagen: number; rechnungenErstellt?: number } | null>(null);
  const [discarding, setDiscarding] = useState(false);
  const [autoRechnung, setAutoRechnung] = useState(false);

  // ── Initial load ──────────────────────────────────────────────────────────

  const ladeAlles = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [batchRes, artikelRes, kundenRes, lieferantenRes, gelerntKundeRes, gelerntArtikelRes] = await Promise.all([
        fetch(`/api/ki/lieferung/batch/${batchId}`),
        fetch("/api/artikel?limit=500"),
        fetch("/api/kunden?limit=500"),
        fetch("/api/lieferanten?limit=200"),
        fetch("/api/ki/lernen?typ=kunde"),
        fetch("/api/ki/lernen?typ=artikel"),
      ]);

      if (!batchRes.ok) throw new Error("Batch nicht gefunden");
      const batchData: BatchDetail = await batchRes.json();

      const artikelData = artikelRes.ok ? await artikelRes.json() : [];
      const kundenData = kundenRes.ok ? await kundenRes.json() : [];
      const lieferantenData = lieferantenRes.ok ? await lieferantenRes.json() : [];
      const gelerntKundeData = gelerntKundeRes.ok ? await gelerntKundeRes.json() : { eintraege: [] };
      const gelerntArtikelData = gelerntArtikelRes.ok ? await gelerntArtikelRes.json() : { eintraege: [] };

      setArtikel(Array.isArray(artikelData) ? artikelData : (artikelData.artikel ?? []));
      setKunden(Array.isArray(kundenData) ? kundenData : (kundenData.kunden ?? []));
      setLieferanten(Array.isArray(lieferantenData) ? lieferantenData : (lieferantenData.lieferanten ?? []));
      setGelerntKunde(new Map((gelerntKundeData.eintraege ?? []).map((e: { suchtext: string; zielId: number }) => [normalisiereSuchtext(e.suchtext), e.zielId])));
      setGelerntArtikel(new Map((gelerntArtikelData.eintraege ?? []).map((e: { suchtext: string; zielId: number }) => [normalisiereSuchtext(e.suchtext), e.zielId])));
      setBatch(batchData);
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    if (!isNaN(batchId)) ladeAlles();
  }, [batchId, ladeAlles]);

  // ── Analyse-Loop (sequenziell) ────────────────────────────────────────────

  useEffect(() => {
    if (!batch || loading || analyzeLoopStarted.current) return;
    const wartend = batch.items.filter((it) => it.status === "wartet");
    if (wartend.length === 0) return;
    analyzeLoopStarted.current = true;

    (async () => {
      setAnalyzing(true);
      let erledigt = 0;
      for (const item of wartend) {
        try {
          const res = await fetch(`/api/ki/lieferung/batch/${batchId}/analyze`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ itemId: item.id }),
          });
          if (res.status === 400) {
            // Globales Konfigurationsproblem (z.B. fehlender API-Key) — weitere Versuche sind zwecklos
            const d = await res.json().catch(() => ({}));
            setLoadError(d.error || "KI-Analyse nicht möglich");
            break;
          }
          if (res.ok) {
            const updatedRaw = await res.json();
            await verarbeiteAnalyseErgebnis(item.id, updatedRaw);
          }
        } catch {
          // einzelnes Item schlägt fehl — weiter mit dem nächsten
        }
        erledigt++;
        setAnalyzedCount(erledigt);
      }
      setAnalyzing(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batch, loading, batchId]);

  async function verarbeiteAnalyseErgebnis(itemId: number, raw: { status: string; kiErgebnisJson?: string; fehlerText?: string }) {
    if (raw.status !== "analysiert" || !raw.kiErgebnisJson) {
      setBatch((prev) =>
        prev
          ? { ...prev, items: prev.items.map((it) => (it.id === itemId ? { ...it, status: "fehler", fehlerText: raw.fehlerText ?? "Analyse fehlgeschlagen" } : it)) }
          : prev
      );
      return;
    }

    const ergebnis: KiErgebnis = JSON.parse(raw.kiErgebnisJson);

    const { kunde: matchedKunde, konfidenz: kk } = matchKunde(ergebnis.kunde, kunden, gelerntKunde);
    const positionen: BatchPosition[] = (ergebnis.positionen ?? []).map((pos) => {
      const { artikel: matchedArtikel, konfidenz } = matchArtikel(pos, artikel, gelerntArtikel);
      return {
        kiPosition: pos,
        artikelId: matchedArtikel ? String(matchedArtikel.id) : "",
        vorschlagArtikelId: matchedArtikel ? matchedArtikel.id : null,
        menge: pos.menge,
        verkaufspreis: pos.einzelpreis ?? (matchedArtikel ? matchedArtikel.standardpreis : 0),
        konfidenz: matchedArtikel ? konfidenz : "keine",
        chargeNr: pos.chargeNr ?? "",
      };
    });

    const fehlendeFelder = berechneFehlendeFelder({
      kundeKonfidenz: matchedKunde ? kk : "keine",
      positionen: positionen.map((p) => ({ artikelId: p.artikelId, konfidenz: p.konfidenz, verkaufspreis: p.verkaufspreis, menge: p.menge })),
    });
    const entscheidung = fehlendeFelder.length === 0 ? "passt" : null;

    setBatch((prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.map((it) =>
              it.id === itemId
                ? {
                    ...it,
                    status: "analysiert",
                    kiErgebnis: ergebnis,
                    kundeId: matchedKunde ? matchedKunde.id : null,
                    kundeKonfidenz: matchedKunde ? kk : "keine",
                    positionen,
                    fehlendeFelder,
                    entscheidung,
                  }
                : it
            ),
          }
        : prev
    );

    fetch(`/api/ki/lieferung/batch/${batchId}/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kundeId: matchedKunde ? matchedKunde.id : null,
        kundeKonfidenz: matchedKunde ? kk : "keine",
        positionen,
        fehlendeFelder,
        entscheidung,
      }),
    }).catch(() => {});
  }

  // ── Item-Korrekturen ──────────────────────────────────────────────────────

  function neuBerechneFehlendeFelder(item: BatchItem): string[] {
    return berechneFehlendeFelder({
      kundeKonfidenz: item.kundeKonfidenz ?? "keine",
      positionen: item.positionen.map((p) => ({ artikelId: p.artikelId, konfidenz: p.konfidenz, verkaufspreis: p.verkaufspreis, menge: p.menge })),
    });
  }

  function speichereItem(item: BatchItem) {
    fetch(`/api/ki/lieferung/batch/${batchId}/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kundeId: item.kundeId,
        kundeKonfidenz: item.kundeKonfidenz,
        positionen: item.positionen,
        fehlendeFelder: item.fehlendeFelder,
        entscheidung: item.entscheidung,
      }),
    }).catch(() => {});
  }

  function updateItem(itemId: number, updater: (item: BatchItem) => BatchItem) {
    setBatch((prev) => {
      if (!prev) return prev;
      let aktualisiert: BatchItem | null = null;
      const items = prev.items.map((it) => {
        if (it.id !== itemId) return it;
        const neu = updater(it);
        const mitFehlenden = { ...neu, fehlendeFelder: neuBerechneFehlendeFelder(neu) };
        aktualisiert = mitFehlenden;
        return mitFehlenden;
      });
      if (aktualisiert) speichereItem(aktualisiert);
      return { ...prev, items };
    });
  }

  function setKundeFuerItem(item: BatchItem, kundeIdStr: string) {
    const neueId = kundeIdStr ? parseInt(kundeIdStr, 10) : null;
    if (neueId != null && item.kundeId !== neueId && item.kiErgebnis) {
      meldeLernkorrektur("kunde", item.kiErgebnis.kunde.firma || item.kiErgebnis.kunde.name, neueId);
    }
    updateItem(item.id, (it) => ({ ...it, kundeId: neueId, kundeKonfidenz: neueId ? "hoch" : "keine" }));
  }

  function setPositionFeld(item: BatchItem, idx: number, feld: "artikelId" | "menge" | "verkaufspreis" | "chargeNr", wert: string | number) {
    updateItem(item.id, (it) => ({
      ...it,
      positionen: it.positionen.map((p, i) => {
        if (i !== idx) return p;
        const updated: BatchPosition = { ...p, [feld]: wert };
        if (feld === "artikelId") {
          const found = artikel.find((a) => String(a.id) === String(wert));
          updated.verkaufspreis = found ? found.standardpreis : 0;
          updated.konfidenz = found ? "hoch" : "keine";
          updated.showNeuForm = false;
          if (found && p.kiPosition.name) {
            meldeLernkorrektur("artikel", p.kiPosition.name, found.id);
          }
        }
        return updated;
      }),
    }));
  }

  function toggleNeuForm(item: BatchItem, idx: number, show: boolean) {
    updateItem(item.id, (it) => ({
      ...it,
      positionen: it.positionen.map((p, i) => (i === idx ? { ...p, showNeuForm: show } : p)),
    }));
  }

  function onArtikelAngelegt(item: BatchItem, idx: number, neu: NeuArtikelErgebnis) {
    setArtikel((prev) => [...prev, neu]);
    updateItem(item.id, (it) => ({
      ...it,
      positionen: it.positionen.map((p, i) =>
        i === idx ? { ...p, artikelId: String(neu.id), verkaufspreis: neu.standardpreis, konfidenz: "hoch", showNeuForm: false } : p
      ),
    }));
  }

  function setEntscheidung(item: BatchItem, entscheidung: "passt" | "passt_nicht") {
    updateItem(item.id, (it) => ({ ...it, entscheidung: it.entscheidung === entscheidung ? null : entscheidung }));
  }

  // ── Abschließen / Verwerfen ───────────────────────────────────────────────

  async function abschliessen() {
    setFinalizing(true);
    try {
      const res = await fetch(`/api/ki/lieferung/batch/${batchId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aktion: "abschliessen", autoRechnung }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Abschließen fehlgeschlagen");
      setFinalizeResult(d);
      await ladeAlles();
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setFinalizing(false);
    }
  }

  async function verwerfen() {
    if (!confirm("Batch inkl. aller hochgeladenen Fotos unwiderruflich verwerfen?")) return;
    setDiscarding(true);
    try {
      const res = await fetch(`/api/ki/lieferung/batch/${batchId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aktion: "verwerfen" }),
      });
      if (!res.ok) throw new Error("Verwerfen fehlgeschlagen");
      router.push("/ki/lieferung?modus=batch");
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : "Unbekannter Fehler");
      setDiscarding(false);
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const kundenOptions = kunden.map((k) => ({ value: String(k.id), label: k.firma ? `${k.name} — ${k.firma}` : k.name, sub: k.ort }));
  const artikelOptions = artikel.map((a) => ({ value: String(a.id), label: a.name, sub: a.artikelnummer }));

  const items = batch?.items ?? [];
  const bereitCount = items.filter((it) => it.entscheidung === "passt" && it.status !== "uebernommen").length;
  const uebersprungenCount = items.filter((it) => it.entscheidung === "passt_nicht").length;
  const offenCount = items.filter((it) => it.status === "analysiert" && it.entscheidung === null).length;
  const uebernommenCount = items.filter((it) => it.status === "uebernommen").length;
  const wartetNoch = items.some((it) => it.status === "wartet");

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="h-8 w-64 bg-gray-200 rounded animate-pulse mb-6" />
        <div className="h-40 bg-white rounded-xl border border-gray-200 animate-pulse" />
      </div>
    );
  }

  if (loadError && !batch) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">{loadError}</div>
      </div>
    );
  }

  if (!batch) return null;

  return (
    <div className="max-w-4xl mx-auto pb-28">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900">Batch #{batch.id}: Lieferscheine prüfen</h1>
        <Link href="/ki/lieferung?modus=batch" className="text-sm font-medium text-green-700 hover:text-green-800">
          ← Zur Batch-Übersicht
        </Link>
      </div>

      {analyzing && (
        <div className="mb-6 p-4 rounded-lg bg-blue-50 border border-blue-200 flex items-center gap-3">
          <span className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin shrink-0" />
          <p className="text-sm text-blue-800">
            {analyzedCount} von {items.filter((it) => it.status !== "verworfen").length} Lieferscheinen analysiert…
          </p>
        </div>
      )}

      {wartetNoch && !analyzing && (
        <div className="mb-6 p-4 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
          Analyse wurde unterbrochen (z. B. durch Neuladen der Seite).{" "}
          <button onClick={() => { analyzeLoopStarted.current = false; ladeAlles(); }} className="underline font-medium">
            Erneut versuchen
          </button>
        </div>
      )}

      {loadError && (
        <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{loadError}</div>
      )}

      {finalizeResult && (
        <div className="mb-6 p-4 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800">
          ✓ {finalizeResult.erstellt} Lieferung(en) angelegt
          {!!finalizeResult.rechnungenErstellt && `, ${finalizeResult.rechnungenErstellt} Rechnung(en) automatisch erzeugt`}
          {finalizeResult.uebersprungen > 0 && `, ${finalizeResult.uebersprungen} übersprungen`}
          {finalizeResult.fehlgeschlagen > 0 && `, ${finalizeResult.fehlgeschlagen} fehlgeschlagen`}.
        </div>
      )}

      <div className="space-y-4">
        {items.map((item, itemIdx) => (
          <div key={item.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="flex flex-col sm:flex-row">
              {/* Thumbnail */}
              <div className="sm:w-40 shrink-0 bg-gray-50 border-b sm:border-b-0 sm:border-r border-gray-200 flex items-center justify-center p-3">
                {/\.pdf$/i.test(item.dateiPfad) ? (
                  <div className="text-center py-6">
                    <svg className="w-10 h-10 text-red-500 mx-auto mb-1" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
                    </svg>
                    <p className="text-xs text-gray-500 truncate">{item.dateiName}</p>
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/uploads/${item.dateiPfad}`} alt={item.dateiName ?? `Lieferschein ${itemIdx + 1}`} className="max-h-40 max-w-full object-contain rounded" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 p-4 min-w-0">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="text-xs text-gray-400 font-medium">Lieferschein #{itemIdx + 1}</p>
                    {item.status === "wartet" && <p className="text-sm text-gray-500">Wartet auf Analyse…</p>}
                    {item.status === "fehler" && <p className="text-sm text-red-600">Fehler: {item.fehlerText}</p>}
                    {item.status === "uebernommen" && (
                      <p className="text-sm text-green-700 font-medium">
                        ✓ Übernommen{item.lieferungId && (
                          <>
                            {" — "}
                            <Link href={`/lieferungen/${item.lieferungId}`} className="underline">
                              Lieferung ansehen
                            </Link>
                          </>
                        )}
                      </p>
                    )}
                  </div>
                  {item.status === "analysiert" && (
                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setEntscheidung(item, "passt")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                          item.entscheidung === "passt" ? "bg-green-600 text-white border-green-600" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        ✓ Passt
                      </button>
                      <button
                        type="button"
                        onClick={() => setEntscheidung(item, "passt_nicht")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                          item.entscheidung === "passt_nicht" ? "bg-red-600 text-white border-red-600" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        ✗ Passt nicht
                      </button>
                    </div>
                  )}
                </div>

                {item.status === "analysiert" && (
                  <>
                    {item.fehlendeFelder.length > 0 && (
                      <div className="mb-3 flex flex-wrap gap-1.5">
                        {item.fehlendeFelder.map((f, i) => (
                          <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200">
                            ⚠ {f}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Kunde */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Kunde</label>
                        <KonfidenzBadge k={item.kundeKonfidenz ?? "keine"} />
                      </div>
                      {item.kiErgebnis && (
                        <p className="text-xs text-gray-400 mb-1">
                          KI erkannt: <span className="font-medium text-gray-600">{item.kiErgebnis.kunde.firma ?? item.kiErgebnis.kunde.name}</span>
                        </p>
                      )}
                      <SearchableSelect
                        options={kundenOptions}
                        value={item.kundeId != null ? String(item.kundeId) : ""}
                        onChange={(v) => setKundeFuerItem(item, v)}
                        placeholder="Kunde auswählen…"
                        allowClear
                      />
                    </div>

                    {/* Positionen */}
                    <div className="space-y-2">
                      {item.positionen.map((pos, idx) => {
                        const gefunden = artikel.find((a) => String(a.id) === pos.artikelId);
                        return (
                          <div key={idx} className="border border-gray-200 rounded-lg p-3">
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <p className="text-sm font-medium text-gray-900 truncate flex-1 min-w-0">{pos.kiPosition.name || "—"}</p>
                              <KonfidenzBadge k={pos.konfidenz} />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <div className="sm:col-span-1">
                                <SearchableSelect
                                  options={artikelOptions}
                                  value={pos.artikelId}
                                  onChange={(v) => setPositionFeld(item, idx, "artikelId", v)}
                                  placeholder="Artikel wählen…"
                                  allowClear
                                />
                                {!pos.artikelId && !pos.showNeuForm && (
                                  <button
                                    type="button"
                                    onClick={() => toggleNeuForm(item, idx, true)}
                                    className="text-xs text-blue-600 hover:text-blue-700 font-medium mt-1"
                                  >
                                    + Neuen Artikel anlegen
                                  </button>
                                )}
                              </div>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={pos.menge}
                                onChange={(e) => setPositionFeld(item, idx, "menge", parseFloat(e.target.value) || 0)}
                                placeholder="Menge"
                                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-green-600"
                              />
                              <DezimalInput
                                value={pos.verkaufspreis}
                                onChange={(v) => setPositionFeld(item, idx, "verkaufspreis", v)}
                                placeholder="VK-Preis (€)"
                                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-green-600"
                              />
                            </div>
                            <input
                              type="text"
                              value={pos.chargeNr}
                              onChange={(e) => setPositionFeld(item, idx, "chargeNr", e.target.value)}
                              placeholder="Chargennummer (optional)"
                              className="mt-2 border border-gray-300 rounded-lg px-3 py-2 text-sm w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-green-600"
                            />
                            {pos.showNeuForm && (
                              <NeuArtikelInline
                                kiName={pos.kiPosition.name}
                                kiEinheit={pos.kiPosition.einheit}
                                lieferanten={lieferanten}
                                onCreated={(neu) => onArtikelAngelegt(item, idx, neu)}
                                onCancel={() => toggleNeuForm(item, idx, false)}
                              />
                            )}
                            {!gefunden && !pos.artikelId && !pos.showNeuForm && (
                              <p className="text-xs text-red-500 mt-1">Kein Artikel zugeordnet</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Sticky-Leiste */}
      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm text-gray-600">
            <span className="font-semibold text-green-700">{bereitCount + uebernommenCount} bereit</span>
            {uebersprungenCount > 0 && <span className="ml-3 text-gray-500">{uebersprungenCount} übersprungen</span>}
            {offenCount > 0 && <span className="ml-3 text-amber-600">{offenCount} noch offen</span>}
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoRechnung}
              onChange={(e) => setAutoRechnung(e.target.checked)}
              disabled={finalizing || discarding}
              className="rounded border-gray-300 text-green-600 focus:ring-green-600"
            />
            Rechnung automatisch erzeugen
          </label>
          <div className="flex gap-2">
            <button
              onClick={verwerfen}
              disabled={discarding || finalizing}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-40 transition-colors"
            >
              Batch verwerfen
            </button>
            <button
              onClick={abschliessen}
              disabled={finalizing || discarding || analyzing || bereitCount === 0}
              className="px-6 py-2 rounded-lg text-sm font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {finalizing && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              Abschließen ({bereitCount})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
