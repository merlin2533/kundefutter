"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import SearchableSelect from "@/components/SearchableSelect";
import KonfidenzBadge from "@/components/KonfidenzBadge";
import NeuLieferantInline, { type NeuLieferantErgebnis } from "@/components/NeuLieferantInline";
import DezimalInput from "@/components/DezimalInput";
import * as Sentry from "@sentry/nextjs";
import {
  matchKunde,
  normalisiereSuchtext,
  fetchAlleSeiten,
  type Konfidenz,
} from "@/lib/kiMatching";
import { berechneAusgabeNetto, berechneAusgabeMwst, berechneAusgabeBrutto, ausgabeBetragsteile, formatEuro } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

const FALLBACK_AUSGABEN_KAT = ["Wareneinkauf", "Betriebsbedarf", "Fahrtkosten", "Bürobedarf", "Telefon/Internet", "Versicherung", "Miete", "Personal", "Sonstige"];

interface LieferantRaw {
  id: number;
  name: string;
}

interface KiErgebnis {
  datum: string | null;
  belegNr: string | null;
  faelligAm: string | null;
  beschreibung: string | null;
  betragNetto: number | null;
  betragBrutto: number | null;
  mwstSatz: number;
  kategorie: string | null;
  lieferant: string | null;
  iban: string | null;
  bic: string | null;
}

interface BatchItem {
  id: number;
  reihenfolge: number;
  dateiPfad: string;
  dateiName: string | null;
  status: "wartet" | "analysiert" | "fehler" | "uebernommen" | "verworfen";
  kiErgebnis: KiErgebnis | null;
  lieferantId: number | null;
  lieferantKonfidenz: Konfidenz | null;
  datum: string | null;
  belegNr: string | null;
  beschreibung: string | null;
  betragNetto: number | null;
  mwstSatz: number | null;
  betragNetto2: number | null;
  mwstSatz2: number | null;
  betragNetto3: number | null;
  mwstSatz3: number | null;
  kategorie: string | null;
  fehlendeFelder: string[];
  fehlerText: string | null;
  entscheidung: "passt" | "passt_nicht" | null;
  ausgabeId: number | null;
  ibanGespeichert?: boolean;
  zweiterSatz?: boolean;
  dritterSatz?: boolean;
}

interface BatchDetail {
  id: number;
  status: string;
  items: BatchItem[];
}

// ─── Vollständiges Laden (kein Limit) ────────────────────────────────────────

async function ladeAlleLieferanten(): Promise<LieferantRaw[]> {
  return fetchAlleSeiten<LieferantRaw>(async (page) => {
    const res = await fetch(`/api/lieferanten?page=${page}&limit=500`);
    if (!res.ok) return null;
    const json = await res.json();
    return { items: Array.isArray(json.data) ? json.data : [], total: json.total ?? 0 };
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function meldeLernkorrektur(suchtext: string, zielId: number) {
  const text = suchtext.trim();
  if (!text) return;
  fetch("/api/ki/lernen", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ typ: "lieferant", suchtext: text, zielId }),
  }).catch((err) => {
    Sentry.captureException(err);
  });
}

function berechneFehlendeFelder(item: { beschreibung: string | null; betragNetto: number | null }): string[] {
  const felder: string[] = [];
  if (!item.beschreibung || !item.beschreibung.trim()) felder.push("Beschreibung fehlt");
  if (item.betragNetto == null || item.betragNetto <= 0) felder.push("Betrag fehlt");
  return felder;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AusgabenBatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const batchId = parseInt(id, 10);

  const [batch, setBatch] = useState<BatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [lieferanten, setLieferanten] = useState<LieferantRaw[]>([]);
  const [kategorienList, setKategorienList] = useState<string[]>(FALLBACK_AUSGABEN_KAT);
  const [gelerntLieferant, setGelerntLieferant] = useState<Map<string, number>>(new Map());

  const [analyzing, setAnalyzing] = useState(false);
  const [analyzedCount, setAnalyzedCount] = useState(0);
  const analyzeLoopStarted = useRef(false);

  const [finalizing, setFinalizing] = useState(false);
  const [finalizeResult, setFinalizeResult] = useState<{ erstellt: number; uebersprungen: number; fehlgeschlagen: number } | null>(null);
  const [discarding, setDiscarding] = useState(false);
  const [neuLieferantItemId, setNeuLieferantItemId] = useState<number | null>(null);
  const [zoomBild, setZoomBild] = useState<{ src: string; alt: string } | null>(null);
  const [finalizingItemId, setFinalizingItemId] = useState<number | null>(null);

  // ── Initial load ──────────────────────────────────────────────────────────

  const ladeAlles = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [batchRes, lieferantenList, gelerntRes, kategorienRes] = await Promise.all([
        fetch(`/api/ki/ausgaben/batch/${batchId}`),
        ladeAlleLieferanten(),
        fetch("/api/ki/lernen?typ=lieferant"),
        fetch("/api/einstellungen?prefix=ausgaben."),
      ]);

      if (!batchRes.ok) throw new Error("Batch nicht gefunden");
      const batchData: BatchDetail = await batchRes.json();

      const gelerntData = gelerntRes.ok ? await gelerntRes.json() : { eintraege: [] };
      if (kategorienRes.ok) {
        const kd = await kategorienRes.json();
        if (kd["ausgaben.kategorien"]) {
          try {
            const parsed = JSON.parse(kd["ausgaben.kategorien"]);
            if (Array.isArray(parsed) && parsed.length) setKategorienList(parsed);
          } catch (err) {
            Sentry.captureException(err);
          }
        }
      }

      setLieferanten(lieferantenList);
      setGelerntLieferant(
        new Map((gelerntData.eintraege ?? []).map((e: { suchtext: string; zielId: number }) => [normalisiereSuchtext(e.suchtext), e.zielId]))
      );
      setBatch({
        ...batchData,
        items: batchData.items.map((it) => ({
          ...it,
          zweiterSatz: it.betragNetto2 != null,
          dritterSatz: it.betragNetto3 != null,
        })),
      });
    } catch (err: unknown) {
      Sentry.captureException(err);
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
          const res = await fetch(`/api/ki/ausgaben/batch/${batchId}/analyze`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ itemId: item.id }),
          });
          if (res.status === 400) {
            const d = await res.json().catch((err) => {
              Sentry.captureException(err);
              return ({});
            });
            setLoadError(d.error || "KI-Analyse nicht möglich");
            break;
          }
          if (res.ok) {
            const updatedRaw = await res.json();
            await verarbeiteAnalyseErgebnis(item.id, updatedRaw);
          }
        } catch (err) {
          Sentry.captureException(err);
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

    const { kunde: matchedLieferant, konfidenz: lk } = ergebnis.lieferant
      ? matchKunde({ name: ergebnis.lieferant }, lieferanten, gelerntLieferant)
      : { kunde: null, konfidenz: "keine" as Konfidenz };

    const heute = new Date().toISOString().slice(0, 10);
    const felder = {
      beschreibung: ergebnis.beschreibung,
      betragNetto: ergebnis.betragNetto,
    };
    const fehlendeFelder = berechneFehlendeFelder(felder);
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
                    lieferantId: matchedLieferant ? matchedLieferant.id : null,
                    lieferantKonfidenz: matchedLieferant ? lk : "keine",
                    datum: ergebnis.datum ?? heute,
                    belegNr: ergebnis.belegNr,
                    beschreibung: ergebnis.beschreibung,
                    betragNetto: ergebnis.betragNetto,
                    mwstSatz: ergebnis.mwstSatz,
                    kategorie: ergebnis.kategorie ?? "Sonstige",
                    fehlendeFelder,
                    entscheidung,
                  }
                : it
            ),
          }
        : prev
    );

    fetch(`/api/ki/ausgaben/batch/${batchId}/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lieferantId: matchedLieferant ? matchedLieferant.id : null,
        lieferantKonfidenz: matchedLieferant ? lk : "keine",
        datum: ergebnis.datum ?? heute,
        belegNr: ergebnis.belegNr,
        beschreibung: ergebnis.beschreibung,
        betragNetto: ergebnis.betragNetto,
        mwstSatz: ergebnis.mwstSatz,
        kategorie: ergebnis.kategorie ?? "Sonstige",
        fehlendeFelder,
        entscheidung,
      }),
    }).catch((err) => {
      Sentry.captureException(err);
    });
  }

  // ── Item-Korrekturen ──────────────────────────────────────────────────────

  function speichereItem(item: BatchItem) {
    fetch(`/api/ki/ausgaben/batch/${batchId}/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lieferantId: item.lieferantId,
        lieferantKonfidenz: item.lieferantKonfidenz,
        datum: item.datum,
        belegNr: item.belegNr,
        beschreibung: item.beschreibung,
        betragNetto: item.betragNetto,
        mwstSatz: item.mwstSatz,
        betragNetto2: item.zweiterSatz ? item.betragNetto2 : null,
        mwstSatz2: item.zweiterSatz ? item.mwstSatz2 : null,
        betragNetto3: item.dritterSatz ? item.betragNetto3 : null,
        mwstSatz3: item.dritterSatz ? item.mwstSatz3 : null,
        kategorie: item.kategorie,
        fehlendeFelder: item.fehlendeFelder,
        entscheidung: item.entscheidung,
      }),
    }).catch((err) => {
      Sentry.captureException(err);
    });
  }

  function updateItem(itemId: number, updater: (item: BatchItem) => BatchItem) {
    setBatch((prev) => {
      if (!prev) return prev;
      let aktualisiert: BatchItem | null = null;
      const items = prev.items.map((it) => {
        if (it.id !== itemId) return it;
        const neu = updater(it);
        const mitFehlenden = { ...neu, fehlendeFelder: berechneFehlendeFelder(neu) };
        aktualisiert = mitFehlenden;
        return mitFehlenden;
      });
      if (aktualisiert) speichereItem(aktualisiert);
      return { ...prev, items };
    });
  }

  function setLieferantFuerItem(item: BatchItem, lieferantIdStr: string) {
    const neueId = lieferantIdStr ? parseInt(lieferantIdStr, 10) : null;
    if (neueId != null && item.lieferantId !== neueId && item.kiErgebnis?.lieferant) {
      meldeLernkorrektur(item.kiErgebnis.lieferant, neueId);
    }
    updateItem(item.id, (it) => ({ ...it, lieferantId: neueId, lieferantKonfidenz: neueId ? "hoch" : "keine" }));
  }

  function onLieferantAngelegt(item: BatchItem, neu: NeuLieferantErgebnis) {
    setLieferanten((prev) => [...prev, neu]);
    updateItem(item.id, (it) => ({ ...it, lieferantId: neu.id, lieferantKonfidenz: "hoch" }));
    setNeuLieferantItemId(null);
    if (item.kiErgebnis?.lieferant) {
      meldeLernkorrektur(item.kiErgebnis.lieferant, neu.id);
    }
  }

  async function ibanSpeichern(item: BatchItem) {
    if (!item.lieferantId || !item.kiErgebnis?.iban) return;
    try {
      await fetch(`/api/lieferanten/${item.lieferantId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ iban: item.kiErgebnis.iban, bic: item.kiErgebnis.bic }),
      });
      setBatch((prev) =>
        prev ? { ...prev, items: prev.items.map((it) => (it.id === item.id ? { ...it, ibanGespeichert: true } : it)) } : prev
      );
    } catch (err) {
      Sentry.captureException(err);
      // ignore
    }
  }

  function setEntscheidung(item: BatchItem, entscheidung: "passt" | "passt_nicht") {
    updateItem(item.id, (it) => ({ ...it, entscheidung: it.entscheidung === entscheidung ? null : entscheidung }));
  }

  // ── Abschließen / Verwerfen ───────────────────────────────────────────────

  async function abschliessen() {
    setFinalizing(true);
    try {
      const res = await fetch(`/api/ki/ausgaben/batch/${batchId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aktion: "abschliessen" }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Abschließen fehlgeschlagen");
      setFinalizeResult(d);
      await ladeAlles();
    } catch (err: unknown) {
      Sentry.captureException(err);
      setLoadError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setFinalizing(false);
    }
  }

  async function uebernehmeEinzeln(item: BatchItem) {
    setFinalizingItemId(item.id);
    try {
      const res = await fetch(`/api/ki/ausgaben/batch/${batchId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aktion: "abschliessen", itemId: item.id }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Übernehmen fehlgeschlagen");
      await ladeAlles();
    } catch (err: unknown) {
      Sentry.captureException(err);
      setLoadError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setFinalizingItemId(null);
    }
  }

  async function verwerfen() {
    if (!confirm("Batch inkl. aller hochgeladenen Dateien unwiderruflich verwerfen?")) return;
    setDiscarding(true);
    try {
      const res = await fetch(`/api/ki/ausgaben/batch/${batchId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aktion: "verwerfen" }),
      });
      if (!res.ok) throw new Error("Verwerfen fehlgeschlagen");
      router.push("/ausgaben/neu?modus=batch");
    } catch (err: unknown) {
      Sentry.captureException(err);
      setLoadError(err instanceof Error ? err.message : "Unbekannter Fehler");
      setDiscarding(false);
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const lieferantenOptions = lieferanten.map((l) => ({ value: String(l.id), label: l.name }));

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
        <h1 className="text-2xl font-bold text-gray-900">Batch #{batch.id}: Belege prüfen</h1>
        <Link href="/ausgaben/neu?modus=batch" className="text-sm font-medium text-green-700 hover:text-green-800">
          ← Zur Batch-Übersicht
        </Link>
      </div>

      {analyzing && (
        <div className="mb-6 p-4 rounded-lg bg-blue-50 border border-blue-200 flex items-center gap-3">
          <span className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin shrink-0" />
          <p className="text-sm text-blue-800">
            {analyzedCount} von {items.filter((it) => it.status !== "verworfen").length} Belege analysiert…
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
          ✓ {finalizeResult.erstellt} Ausgabe(n) angelegt
          {finalizeResult.uebersprungen > 0 && `, ${finalizeResult.uebersprungen} übersprungen`}
          {finalizeResult.fehlgeschlagen > 0 && `, ${finalizeResult.fehlgeschlagen} fehlgeschlagen`}.
        </div>
      )}

      <div className="space-y-4">
        {items.map((item, itemIdx) => {
          const betragsteile = {
            betragNetto: item.betragNetto ?? 0,
            mwstSatz: item.mwstSatz ?? 19,
            betragNetto2: item.zweiterSatz ? item.betragNetto2 ?? 0 : null,
            mwstSatz2: item.zweiterSatz ? item.mwstSatz2 ?? 19 : null,
            betragNetto3: item.dritterSatz ? item.betragNetto3 ?? 0 : null,
            mwstSatz3: item.dritterSatz ? item.mwstSatz3 ?? 0 : null,
          };
          const gesamtNetto = berechneAusgabeNetto(betragsteile);
          const mwstBetrag = berechneAusgabeMwst(betragsteile);
          const brutto = berechneAusgabeBrutto(betragsteile);

          return (
            <div key={item.id} className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="flex flex-col sm:flex-row">
                {/* Thumbnail */}
                <div className="sm:w-40 shrink-0 bg-gray-50 border-b sm:border-b-0 sm:border-r border-gray-200 flex items-center justify-center p-3 rounded-t-xl sm:rounded-t-none sm:rounded-l-xl overflow-hidden">
                  {/\.pdf$/i.test(item.dateiPfad) ? (
                    <div className="text-center py-6">
                      <svg className="w-10 h-10 text-red-500 mx-auto mb-1" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
                      </svg>
                      <p className="text-xs text-gray-500 truncate">{item.dateiName}</p>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        setZoomBild({
                          src: `/api/uploads/${item.dateiPfad}`,
                          alt: item.dateiName ?? `Beleg ${itemIdx + 1}`,
                        })
                      }
                      title="Größer anzeigen"
                      className="cursor-zoom-in"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/uploads/${item.dateiPfad}`} alt={item.dateiName ?? `Beleg ${itemIdx + 1}`} className="max-h-40 max-w-full object-contain rounded" />
                    </button>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 p-4 min-w-0">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="text-xs text-gray-400 font-medium">Beleg #{itemIdx + 1}</p>
                      {item.status === "wartet" && <p className="text-sm text-gray-500">Wartet auf Analyse…</p>}
                      {item.status === "fehler" && <p className="text-sm text-red-600">Fehler: {item.fehlerText}</p>}
                      {item.status === "uebernommen" && (
                        <p className="text-sm text-green-700 font-medium">
                          ✓ Übernommen{item.ausgabeId && (
                            <>
                              {" — "}
                              <Link href={`/ausgaben/${item.ausgabeId}`} className="underline">
                                Ausgabe ansehen
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

                      {/* Lieferant (optional) */}
                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Lieferant (optional)</label>
                          {item.lieferantId && <KonfidenzBadge k={item.lieferantKonfidenz ?? "keine"} />}
                        </div>
                        {item.kiErgebnis?.lieferant && (
                          <p className="text-xs text-gray-400 mb-1">
                            KI erkannt: <span className="font-medium text-gray-600">{item.kiErgebnis.lieferant}</span>
                          </p>
                        )}
                        <SearchableSelect
                          options={lieferantenOptions}
                          value={item.lieferantId != null ? String(item.lieferantId) : ""}
                          onChange={(v) => setLieferantFuerItem(item, v)}
                          placeholder="— kein Lieferant —"
                          allowClear
                        />
                        {!item.lieferantId && neuLieferantItemId !== item.id && (
                          <button
                            type="button"
                            onClick={() => setNeuLieferantItemId(item.id)}
                            className="text-xs text-blue-600 hover:text-blue-700 font-medium mt-1"
                          >
                            + Neuen Lieferanten anlegen
                          </button>
                        )}
                        {neuLieferantItemId === item.id && (
                          <NeuLieferantInline
                            kiName={item.kiErgebnis?.lieferant ?? ""}
                            onCreated={(neu) => onLieferantAngelegt(item, neu)}
                            onCancel={() => setNeuLieferantItemId(null)}
                          />
                        )}
                      </div>

                      {/* Felder */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Beschreibung</label>
                          <input
                            type="text"
                            value={item.beschreibung ?? ""}
                            onChange={(e) => updateItem(item.id, (it) => ({ ...it, beschreibung: e.target.value }))}
                            placeholder="z.B. Düngemittel Lieferung März"
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-green-600"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Beleg-Nr.</label>
                          <input
                            type="text"
                            value={item.belegNr ?? ""}
                            onChange={(e) => updateItem(item.id, (it) => ({ ...it, belegNr: e.target.value }))}
                            placeholder="z.B. RE-2026-1234"
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-green-600"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Datum</label>
                          <input
                            type="date"
                            value={item.datum ?? ""}
                            onChange={(e) => updateItem(item.id, (it) => ({ ...it, datum: e.target.value || null }))}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-green-600"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Kategorie</label>
                          <select
                            value={item.kategorie ?? "Sonstige"}
                            onChange={(e) => updateItem(item.id, (it) => ({ ...it, kategorie: e.target.value }))}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-green-600"
                          >
                            {kategorienList.map((k) => <option key={k}>{k}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Betrag netto (€)</label>
                          <DezimalInput
                            value={item.betragNetto ?? 0}
                            onChange={(v) => updateItem(item.id, (it) => ({ ...it, betragNetto: v }))}
                            placeholder="0,00"
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-green-600"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">MwSt-Satz</label>
                          <select
                            value={item.mwstSatz ?? 19}
                            onChange={(e) => updateItem(item.id, (it) => ({ ...it, mwstSatz: Number(e.target.value) }))}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-green-600"
                          >
                            <option value="19">19 %</option>
                            <option value="7">7 %</option>
                            <option value="0">0 % (steuerfrei)</option>
                          </select>
                        </div>
                      </div>

                      <div className="mb-3">
                        <label className="flex items-center gap-2 text-xs text-gray-600">
                          <input
                            type="checkbox"
                            checked={item.zweiterSatz ?? false}
                            onChange={(e) => updateItem(item.id, (it) => ({
                              ...it,
                              zweiterSatz: e.target.checked,
                              dritterSatz: e.target.checked ? it.dritterSatz : false,
                            }))}
                          />
                          Beleg enthält einen zweiten MwSt-Satz (z. B. Bewirtung: Speisen 7 % / Getränke 19 %)
                        </label>
                        {item.zweiterSatz && (
                          <>
                            <div className="grid grid-cols-2 gap-2 mt-2">
                              <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Betrag netto 2 (€)</label>
                                <DezimalInput
                                  value={item.betragNetto2 ?? 0}
                                  onChange={(v) => updateItem(item.id, (it) => ({ ...it, betragNetto2: v }))}
                                  placeholder="0,00"
                                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-green-600"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">MwSt-Satz 2</label>
                                <select
                                  value={item.mwstSatz2 ?? 19}
                                  onChange={(e) => updateItem(item.id, (it) => ({ ...it, mwstSatz2: Number(e.target.value) }))}
                                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-green-600"
                                >
                                  <option value="19">19 %</option>
                                  <option value="7">7 %</option>
                                  <option value="0">0 % (steuerfrei)</option>
                                </select>
                              </div>
                            </div>

                            <label className="flex items-center gap-2 text-xs text-gray-600 mt-2">
                              <input
                                type="checkbox"
                                checked={item.dritterSatz ?? false}
                                onChange={(e) => updateItem(item.id, (it) => ({ ...it, dritterSatz: e.target.checked }))}
                              />
                              Beleg enthält einen dritten MwSt-Satz (z. B. zusätzlich Trinkgeld 0 %)
                            </label>
                            {item.dritterSatz && (
                              <div className="grid grid-cols-2 gap-2 mt-2">
                                <div>
                                  <label className="block text-xs font-medium text-gray-500 mb-1">Betrag netto 3 (€)</label>
                                  <DezimalInput
                                    value={item.betragNetto3 ?? 0}
                                    onChange={(v) => updateItem(item.id, (it) => ({ ...it, betragNetto3: v }))}
                                    placeholder="0,00"
                                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-green-600"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-500 mb-1">MwSt-Satz 3</label>
                                  <select
                                    value={item.mwstSatz3 ?? 0}
                                    onChange={(e) => updateItem(item.id, (it) => ({ ...it, mwstSatz3: Number(e.target.value) }))}
                                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-green-600"
                                  >
                                    <option value="19">19 %</option>
                                    <option value="7">7 %</option>
                                    <option value="0">0 % (steuerfrei)</option>
                                  </select>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      {gesamtNetto > 0 && (
                        <div className="mb-3 bg-gray-50 border rounded-lg p-2.5 text-xs grid grid-cols-3 gap-2 text-center">
                          <div>
                            <div className="text-gray-500">Netto</div>
                            <div className="font-medium">{formatEuro(gesamtNetto)}</div>
                          </div>
                          <div>
                            <div className="text-gray-500">
                              MwSt {ausgabeBetragsteile(betragsteile).map(t => `${t.satz}%`).join("+")}
                            </div>
                            <div className="font-medium text-amber-600">{formatEuro(mwstBetrag)}</div>
                          </div>
                          <div>
                            <div className="text-gray-500">Brutto</div>
                            <div className="font-bold text-blue-700">{formatEuro(brutto)}</div>
                          </div>
                        </div>
                      )}

                      {/* IBAN erkannt */}
                      {item.kiErgebnis?.iban && item.lieferantId && !item.ibanGespeichert && (
                        <div className="mb-3 p-2.5 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-between gap-2 flex-wrap">
                          <p className="text-xs text-amber-800 font-mono">
                            IBAN erkannt: {item.kiErgebnis.iban.replace(/(.{4})/g, "$1 ").trim()}
                            {item.kiErgebnis.bic && ` · ${item.kiErgebnis.bic}`}
                          </p>
                          <button
                            type="button"
                            onClick={() => ibanSpeichern(item)}
                            className="text-xs px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-amber-800 hover:bg-amber-100 font-medium transition-colors"
                          >
                            Beim Lieferanten speichern
                          </button>
                        </div>
                      )}
                      {item.ibanGespeichert && (
                        <p className="mb-3 text-xs font-medium text-green-700">✓ IBAN beim Lieferanten gespeichert</p>
                      )}

                      {item.entscheidung === "passt" && (
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => uebernehmeEinzeln(item)}
                            disabled={finalizingItemId === item.id}
                            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-40 transition-colors flex items-center gap-1.5"
                          >
                            {finalizingItemId === item.id && (
                              <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            )}
                            ✓ Nur diese Ausgabe jetzt übernehmen
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sticky-Leiste */}
      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm text-gray-600">
            <span className="font-semibold text-green-700">{bereitCount + uebernommenCount} bereit</span>
            {uebersprungenCount > 0 && <span className="ml-3 text-gray-500">{uebersprungenCount} übersprungen</span>}
            {offenCount > 0 && <span className="ml-3 text-amber-600">{offenCount} noch offen</span>}
          </div>
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

      {/* Bild-Zoom */}
      {zoomBild && (
        <div
          className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4"
          onClick={() => setZoomBild(null)}
        >
          <button
            type="button"
            onClick={() => setZoomBild(null)}
            className="absolute top-4 right-4 text-white/80 hover:text-white text-3xl leading-none"
            title="Schließen"
          >
            ×
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={zoomBild.src}
            alt={zoomBild.alt}
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
