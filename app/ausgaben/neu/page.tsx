"use client";
import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import CameraUpload from "@/components/CameraUpload";
import MultiCameraUpload, { type AusgewaehlteDatei } from "@/components/MultiCameraUpload";
import { BUCHUNGSTYPEN, ZAHLUNGSWEGE, BUCHUNGSTYP_KONTEN_SKR03, BUCHUNGSTYP_KONTEN_SKR04, SACHKONTEN_SKR03, SACHKONTEN_SKR04, KILOMETERPAUSCHALE_EUR, type Buchungstyp } from "@/lib/datev";
import { formatEuro, berechneAusgabeNetto, berechneAusgabeMwst, berechneAusgabeBrutto } from "@/lib/utils";
import * as Sentry from "@sentry/nextjs";

const FALLBACK_AUSGABEN_KAT = ["Wareneinkauf", "Betriebsbedarf", "Fahrtkosten", "Bürobedarf", "Telefon/Internet", "Versicherung", "Miete", "Personal", "Sonstige"];

interface Lieferant {
  id: number;
  name: string;
}

interface BatchUebersicht {
  id: number;
  status: string;
  itemCount: number;
  counts: Record<string, number>;
  createdAt: string;
  abgeschlossenAm: string | null;
}

function batchStatusLabel(status: string) {
  switch (status) {
    case "offen": return { label: "Offen", cls: "bg-gray-100 text-gray-700" };
    case "verarbeitung": return { label: "In Verarbeitung", cls: "bg-blue-100 text-blue-800" };
    case "bereit": return { label: "Bereit zum Abschließen", cls: "bg-amber-100 text-amber-800" };
    case "abgeschlossen": return { label: "Abgeschlossen", cls: "bg-green-100 text-green-800" };
    default: return { label: status, cls: "bg-gray-100 text-gray-600" };
  }
}

// ─── Batch-Modus: Upload + offene Batches ────────────────────────────────────

function AusgabenBatchStart() {
  const router = useRouter();
  const [dateien, setDateien] = useState<AusgewaehlteDatei[]>([]);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [batches, setBatches] = useState<BatchUebersicht[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(true);

  useEffect(() => {
    fetch("/api/ki/ausgaben/batch")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setBatches(Array.isArray(data) ? data : []))
      .catch((err) => {
        Sentry.captureException(err);
      })
      .finally(() => setLoadingBatches(false));
  }, []);

  async function starteBatch() {
    if (dateien.length === 0) return;
    setStarting(true);
    setError("");
    try {
      const formData = new FormData();
      for (const d of dateien) formData.append("files", d.file, d.file.name);

      const res = await fetch("/api/ki/ausgaben/batch", { method: "POST", body: formData });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Batch konnte nicht angelegt werden");
      }
      const neu = await res.json();
      router.push(`/ausgaben/batch/${neu.id}`);
    } catch (err: unknown) {
      Sentry.captureException(err);
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      setStarting(false);
    }
  }

  const offeneBatches = batches.filter((b) => b.status !== "abgeschlossen");

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <h2 className="text-lg font-semibold mb-2 text-gray-800">Mehrere Belege hochladen</h2>
        <p className="text-sm text-gray-500 mb-6">
          Fotografiere oder lade mehrere Belege auf einmal hoch (empfohlen: 10–20 Stück). Die KI
          analysiert anschließend jeden einzeln und du prüfst danach alle gesammelt in einer Übersicht.
        </p>

        <MultiCameraUpload dateien={dateien} onChange={setDateien} />

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            onClick={starteBatch}
            disabled={dateien.length === 0 || starting}
            className="px-6 py-2.5 rounded-lg text-sm font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {starting && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            Batch starten {dateien.length > 0 && `(${dateien.length} Belege)`}
          </button>
        </div>
      </div>

      {!loadingBatches && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-800">Offene Batches fortsetzen</h2>
          {offeneBatches.length > 0 ? (
            <div className="space-y-2">
              {offeneBatches.map((b) => {
                const s = batchStatusLabel(b.status);
                const analysiert = (b.counts.analysiert ?? 0) + (b.counts.uebernommen ?? 0) + (b.counts.fehler ?? 0);
                return (
                  <Link
                    key={b.id}
                    href={`/ausgaben/batch/${b.id}`}
                    className="flex items-center justify-between gap-3 p-3 rounded-lg border border-gray-200 hover:border-green-300 hover:bg-green-50/50 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        Batch #{b.id} — {b.itemCount} Belege
                      </p>
                      <p className="text-xs text-gray-400">
                        {analysiert} von {b.itemCount} analysiert · erstellt am{" "}
                        {new Date(b.createdAt).toLocaleDateString("de-DE")}
                      </p>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${s.cls}`}>
                      {s.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Keine offenen Batches — alle Belege wurden verarbeitet.</p>
          )}
        </div>
      )}
    </>
  );
}

// ─── Modus-Umschalter (Einzeln / Batch) ──────────────────────────────────────

function ModusSchalter({ modus, offeneBatches }: { modus: "einzeln" | "batch"; offeneBatches: number }) {
  const router = useRouter();
  return (
    <div className="inline-flex rounded-lg border border-gray-200 bg-gray-100 p-1 text-sm font-medium">
      {(
        [
          { key: "einzeln", label: "Einzeln (1 Beleg)" },
          { key: "batch", label: "Batch (mehrere)" },
        ] as const
      ).map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => router.push(opt.key === "einzeln" ? "/ausgaben/neu" : "/ausgaben/neu?modus=batch")}
          className={`relative px-3 py-1.5 rounded-md transition-colors ${
            modus === opt.key
              ? "bg-white text-green-700 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          {opt.label}
          {opt.key === "batch" && offeneBatches > 0 && (
            <span className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] font-bold">
              {offeneBatches}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function AusgabenNeuInner() {
  const searchParams = useSearchParams();
  const modus = searchParams.get("modus") === "batch" ? "batch" : "einzeln";
  const [offeneBatches, setOffeneBatches] = useState(0);

  useEffect(() => {
    fetch("/api/ki/ausgaben/batch")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: BatchUebersicht[]) => {
        if (!Array.isArray(data)) return;
        setOffeneBatches(data.filter((b) => b.status !== "abgeschlossen").length);
      })
      .catch((err) => {
        Sentry.captureException(err);
      });
  }, []);

  if (modus === "batch") {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/ausgaben" className="text-gray-500 hover:text-gray-800">← Zurück</Link>
          <h1 className="text-2xl font-bold flex-1">Ausgaben: Batch-Modus</h1>
          <ModusSchalter modus={modus} offeneBatches={offeneBatches} />
        </div>
        <AusgabenBatchStart />
      </div>
    );
  }

  return <AusgabeEinzelnForm offeneBatches={offeneBatches} />;
}

export default function NeueAusgabePage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-xl mx-auto">
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse mb-6" />
          <div className="h-64 bg-white rounded-xl border border-gray-200 animate-pulse" />
        </div>
      }
    >
      <AusgabenNeuInner />
    </Suspense>
  );
}

function AusgabeEinzelnForm({ offeneBatches }: { offeneBatches: number }) {
  const router = useRouter();
  const [lieferanten, setLieferanten] = useState<Lieferant[]>([]);
  const [kategorienList, setKategorienList] = useState<string[]>(FALLBACK_AUSGABEN_KAT);
  const [kostenstellenList, setKostenstellenList] = useState<string[]>([]);
  const [sachkontoMap, setSachkontoMap] = useState<Record<string, string>>({});
  const [kontenrahmen, setKontenrahmen] = useState<"SKR03" | "SKR04">("SKR03");
  const [saving, setSaving] = useState(false);
  const [fehler, setFehler] = useState("");
  const [loginUser, setLoginUser] = useState("");

  const heute = new Date().toISOString().slice(0, 10);
  const [datum, setDatum] = useState(heute);
  const [belegNr, setBelegNr] = useState("");
  const [beschreibung, setBeschreibung] = useState("");
  const [betragNetto, setBetragNetto] = useState("");
  const [mwstSatz, setMwstSatz] = useState("19");
  // Beleg mit gemischten MwSt-Sätzen auf einer Rechnung (z.B. Bewirtung: Speisen 7 % / Getränke 19 %)
  const [zweiterSatz, setZweiterSatz] = useState(false);
  const [betragNetto2, setBetragNetto2] = useState("");
  const [mwstSatz2, setMwstSatz2] = useState("19");
  const [kategorie, setKategorie] = useState("Sonstige");
  const [lieferantId, setLieferantId] = useState("");
  const [bezahltHeute, setBezahltHeute] = useState(false);
  const [notiz, setNotiz] = useState("");
  const [privaterAusleger, setPrivaterAusleger] = useState(false);
  const [ausleger, setAusleger] = useState("");
  const [erfasstVon, setErfasstVon] = useState("");

  // DATEV-Felder
  const [buchungstyp, setBuchungstyp] = useState("Betriebsausgabe");
  const [zahlungsweg, setZahlungsweg] = useState("");
  const [sachkonto, setSachkonto] = useState("");
  const sachkontoManual = useRef(false);
  const [kostenstelle, setKostenstelle] = useState("");
  // Reisekosten
  const [reiseZiel, setReiseZiel] = useState("");
  const [reiseKm, setReiseKm] = useState("");
  const [reiseKilometerpauschale, setReiseKilometerpauschale] = useState(false);
  const [reiseZweck, setReiseZweck] = useState("");
  // Bewirtung
  const [bewirtungTeilnehmer, setBewirtungTeilnehmer] = useState("");
  const [bewirtungZweck, setBewirtungZweck] = useState("");

  // Beleg upload state
  const [belegFile, setBelegFile] = useState<File | null>(null);
  const [belegPreview, setBelegPreview] = useState<string>("");
  const [belegName, setBelegName] = useState<string>("");
  const [kiLaeding, setKiLaeding] = useState(false);
  const [kiHinweis, setKiHinweis] = useState("");
  const [kiWarnung, setKiWarnung] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.ok ? r.json() : null).then(d => {
      if (d?.benutzername) { setLoginUser(d.benutzername); setErfasstVon(d.benutzername); }
    }).catch((err) => {
      Sentry.captureException(err);
    });
    fetch("/api/lieferanten").then(r => r.ok ? r.json() : []).then(d => setLieferanten(Array.isArray(d) ? d : []));
    Promise.all([
      fetch("/api/einstellungen?prefix=ausgaben.").then(r => r.json()),
      fetch("/api/einstellungen?prefix=datev.").then(r => r.json()),
    ]).then(([d, dv]) => {
      if (d["ausgaben.kategorien"]) {
        try {
          const parsed = JSON.parse(d["ausgaben.kategorien"]);
          if (Array.isArray(parsed) && parsed.length) setKategorienList(parsed);
        } catch (err) {
          Sentry.captureException(err);
          /* ignore */
        }
      }
      if (d["ausgaben.kostenstellen"]) {
        try { setKostenstellenList(JSON.parse(d["ausgaben.kostenstellen"]) ?? []); } catch (err) {
          Sentry.captureException(err);
          /* ignore */
        }
      }
      if (d["ausgaben.sachkonten"]) {
        try { setSachkontoMap(JSON.parse(d["ausgaben.sachkonten"]) ?? {}); } catch (err) {
          Sentry.captureException(err);
          /* ignore */
        }
      }
      if (dv["datev.sachkontenrahmen"] === "SKR04") setKontenrahmen("SKR04");
    }).catch((err) => {
      Sentry.captureException(err);
    });
  }, []);

  // Auto-suggest Sachkonto wenn Buchungstyp oder Kategorie wechselt
  useEffect(() => {
    if (sachkontoManual.current) return;
    const typeMap = kontenrahmen === "SKR04" ? BUCHUNGSTYP_KONTEN_SKR04 : BUCHUNGSTYP_KONTEN_SKR03;
    const katMap = kontenrahmen === "SKR04" ? SACHKONTEN_SKR04 : SACHKONTEN_SKR03;
    const typeOverride = typeMap[buchungstyp as Buchungstyp];
    setSachkonto(typeOverride ?? sachkontoMap[kategorie] ?? katMap[kategorie] ?? "");
  }, [buchungstyp, kategorie, sachkontoMap, kontenrahmen]);

  // Kilometerpauschale: betrag auto berechnen
  useEffect(() => {
    if (buchungstyp === "Reisekosten" && reiseKilometerpauschale && reiseKm) {
      const km = parseFloat(reiseKm);
      if (!isNaN(km)) setBetragNetto((km * KILOMETERPAUSCHALE_EUR).toFixed(2));
    }
  }, [buchungstyp, reiseKilometerpauschale, reiseKm]);

  // Privatentnahme/einlage: MwSt auf 0 setzen, zweiten Satz nicht anwendbar
  useEffect(() => {
    if (buchungstyp === "Privatentnahme" || buchungstyp === "Privateinlage") {
      setMwstSatz("0");
      setZweiterSatz(false);
    }
  }, [buchungstyp]);

  const isPrivat = buchungstyp === "Privatentnahme" || buchungstyp === "Privateinlage";
  const netto = parseFloat(betragNetto) || 0;
  const betragsteile = {
    betragNetto: netto,
    mwstSatz: parseFloat(mwstSatz) || 0,
    betragNetto2: zweiterSatz ? parseFloat(betragNetto2) || 0 : null,
    mwstSatz2: zweiterSatz ? parseFloat(mwstSatz2) || 0 : null,
  };
  const gesamtNetto = berechneAusgabeNetto(betragsteile);
  const mwstBetrag = berechneAusgabeMwst(betragsteile);
  const brutto = berechneAusgabeBrutto(betragsteile);

  function handleBelegSelected(file: File, preview: string) {
    setBelegFile(file);
    setBelegPreview(preview);
    setBelegName(file.name);
    setKiHinweis("");
    setKiWarnung(false);
  }

  async function kiAnalyse() {
    if (!belegPreview) return;
    setKiLaeding(true);
    setKiHinweis("");
    setKiWarnung(false);
    try {
      const res = await fetch("/api/ki/beleg", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: belegPreview }),
      });
      if (!res.ok) {
        const d = await res.json();
        setKiHinweis("KI-Fehler: " + (d.error ?? "Unbekannt"));
        setKiWarnung(true);
        return;
      }
      const d = await res.json();
      const erkannt: string[] = [];
      if (d.datum) { setDatum(d.datum); erkannt.push("Datum"); }
      if (d.belegNr) { setBelegNr(d.belegNr); erkannt.push("Beleg-Nr."); }
      if (d.beschreibung) { setBeschreibung(d.beschreibung); erkannt.push("Beschreibung"); }
      if (d.betragNetto !== null && d.betragNetto !== undefined) { setBetragNetto(String(d.betragNetto)); erkannt.push("Betrag"); }
      if (d.mwstSatz !== undefined && d.mwstSatz !== null) setMwstSatz(String(d.mwstSatz));
      if (d.kategorie) setKategorie(d.kategorie);
      if (d.lieferant) {
        const nameLower = String(d.lieferant).toLowerCase();
        const match = lieferanten.find(
          (l) => l.name.toLowerCase().includes(nameLower) || nameLower.includes(l.name.toLowerCase())
        );
        if (match) { setLieferantId(String(match.id)); erkannt.push("Lieferant"); }
      }
      if (erkannt.length > 0) {
        setKiHinweis(`Erkannt und übernommen: ${erkannt.join(", ")} – bitte prüfen.`);
      } else {
        setKiHinweis("Die KI konnte auf diesem Beleg keine Daten erkennen – bitte ein schärferes/helleres Foto versuchen oder die Felder manuell ausfüllen.");
        setKiWarnung(true);
      }
    } catch (err) {
      Sentry.captureException(err);
      setKiHinweis("KI-Analyse fehlgeschlagen.");
      setKiWarnung(true);
    } finally {
      setKiLaeding(false);
    }
  }

  async function speichern(e: React.FormEvent) {
    e.preventDefault();
    if (!beschreibung.trim() || !betragNetto) {
      setFehler("Bitte Beschreibung und Betrag ausfüllen.");
      return;
    }
    setSaving(true);
    setFehler("");

    const res = await fetch("/api/ausgaben", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        datum,
        belegNr: belegNr || null,
        beschreibung,
        betragNetto: netto,
        mwstSatz: parseFloat(mwstSatz),
        betragNetto2: zweiterSatz && betragNetto2 ? parseFloat(betragNetto2) : null,
        mwstSatz2: zweiterSatz && betragNetto2 ? parseFloat(mwstSatz2) : null,
        kategorie,
        lieferantId: lieferantId || null,
        bezahltAm: bezahltHeute ? new Date().toISOString() : null,
        notiz: notiz || null,
        ausleger: privaterAusleger ? (ausleger.trim() || loginUser || "Ich") : null,
        erfasstVon: erfasstVon.trim() || null,
        // DATEV
        buchungstyp,
        sachkonto: sachkonto || null,
        kostenstelle: kostenstelle || null,
        zahlungsweg: zahlungsweg || null,
        reiseZiel: reiseZiel || null,
        reiseKm: reiseKm ? parseFloat(reiseKm) : null,
        reiseKilometerpauschale,
        reiseZweck: reiseZweck || null,
        bewirtungTeilnehmer: bewirtungTeilnehmer || null,
        bewirtungZweck: bewirtungZweck || null,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setFehler(data.error ?? "Fehler beim Speichern");
      setSaving(false);
      return;
    }

    const ausgabe = await res.json();

    if (belegFile && ausgabe.id) {
      const fd = new FormData();
      fd.append("file", belegFile);
      await fetch(`/api/ausgaben/${ausgabe.id}/beleg`, { method: "POST", body: fd });
    }

    setSaving(false);
    router.push("/ausgaben");
  }

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <Link href="/ausgaben" className="text-gray-500 hover:text-gray-800">← Zurück</Link>
        <h1 className="text-2xl font-bold flex-1">Neue Ausgabe</h1>
        <ModusSchalter modus="einzeln" offeneBatches={offeneBatches} />
      </div>

      <form onSubmit={speichern} className="bg-white border rounded p-5 space-y-4">
        {fehler && <div className="bg-red-50 text-red-700 px-3 py-2 rounded text-sm">{fehler}</div>}

        {/* ── Beleg hochladen ── */}
        <div>
          <label className="block text-sm font-medium mb-2">Beleg (Foto / Upload)</label>
          <CameraUpload
            onImageSelected={handleBelegSelected}
            imagePreview={belegPreview}
            imageName={belegName}
            onRemove={() => { setBelegFile(null); setBelegPreview(""); setBelegName(""); setKiHinweis(""); }}
            maxResolution={1200}
          />

          {belegPreview && !belegPreview.startsWith("data:application/pdf") && (
            <button
              type="button"
              onClick={kiAnalyse}
              disabled={kiLaeding}
              className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2 rounded border border-purple-300 bg-purple-50 text-purple-700 text-sm font-medium hover:bg-purple-100 disabled:opacity-50"
            >
              {kiLaeding ? (
                <span className="animate-spin w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full" />
              ) : (
                <span>🤖</span>
              )}
              {kiLaeding ? "KI analysiert…" : "KI: Felder automatisch ausfüllen"}
            </button>
          )}

          {kiHinweis && (
            <p className={`mt-1 text-xs rounded px-2 py-1 ${kiWarnung ? "text-amber-800 bg-amber-50" : "text-purple-700 bg-purple-50"}`}>
              {kiHinweis}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Datum</label>
            <input type="date" value={datum} onChange={e => setDatum(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Beleg-Nr. (Eingangsrechnung)</label>
            <input type="text" value={belegNr} onChange={e => setBelegNr(e.target.value)}
              placeholder="z.B. RE-2026-1234"
              className="w-full border rounded px-3 py-2 text-sm" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Beschreibung *</label>
          <input type="text" value={beschreibung} onChange={e => setBeschreibung(e.target.value)}
            placeholder="z.B. Düngemittel Lieferung März"
            className="w-full border rounded px-3 py-2 text-sm" required />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Kategorie</label>
            <select value={kategorie} onChange={e => { setKategorie(e.target.value); sachkontoManual.current = false; }}
              className="w-full border rounded px-3 py-2 text-sm">
              {kategorienList.map(k => <option key={k}>{k}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Buchungstyp</label>
            <select value={buchungstyp} onChange={e => { setBuchungstyp(e.target.value); sachkontoManual.current = false; }}
              className="w-full border rounded px-3 py-2 text-sm">
              {BUCHUNGSTYPEN.map(bt => <option key={bt}>{bt}</option>)}
            </select>
          </div>
        </div>

        {/* Privatentnahme/einlage Info */}
        {isPrivat && (
          <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-800">
            <p className="font-medium">{buchungstyp}</p>
            <p className="text-xs mt-0.5">
              {buchungstyp === "Privatentnahme"
                ? "Konto 1800 (SKR03) / 2100 (SKR04) — keine MwSt, kein Lieferant"
                : "Konto 1890 (SKR03) / 2110 (SKR04) — Einlage des Inhabers"}
            </p>
          </div>
        )}

        {/* Reisekosten Subformular */}
        {buchungstyp === "Reisekosten" && (
          <div className="border border-sky-200 rounded p-4 bg-sky-50 space-y-3">
            <h3 className="text-sm font-semibold text-sky-800">Reisekosten-Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-sky-700 mb-1">Reiseziel</label>
                <input value={reiseZiel} onChange={e => setReiseZiel(e.target.value)}
                  placeholder="z.B. Berlin"
                  className="w-full border rounded px-2 py-1 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-sky-700 mb-1">Geschäftlicher Zweck</label>
                <input value={reiseZweck} onChange={e => setReiseZweck(e.target.value)}
                  placeholder="z.B. Kundentermin"
                  className="w-full border rounded px-2 py-1 text-sm" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer text-sky-800">
              <input type="checkbox" checked={reiseKilometerpauschale}
                onChange={e => setReiseKilometerpauschale(e.target.checked)} />
              Kilometerpauschale anwenden (0,30 €/km, §9 Abs. 1 Nr. 4 EStG)
            </label>
            {reiseKilometerpauschale && (
              <div>
                <label className="block text-xs font-medium text-sky-700 mb-1">Kilometer</label>
                <input type="number" step="1" min="0" value={reiseKm}
                  onChange={e => setReiseKm(e.target.value)}
                  placeholder="z.B. 120"
                  className="w-full border rounded px-2 py-1 text-sm" />
                {reiseKm && (
                  <p className="text-xs text-sky-700 mt-1">
                    Betrag netto: {formatEuro(parseFloat(reiseKm) * KILOMETERPAUSCHALE_EUR)} (wird automatisch gesetzt)
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Bewirtung Subformular */}
        {buchungstyp === "Bewirtung" && (
          <div className="border border-amber-200 rounded p-4 bg-amber-50 space-y-3">
            <h3 className="text-sm font-semibold text-amber-800">Bewirtungskosten-Details</h3>
            <div className="bg-amber-100 border border-amber-300 rounded p-2 text-xs text-amber-800">
              Nur 70 % steuerlich abzugsfähig (§ 4 Abs. 5 Nr. 2 EStG). Der volle Betrag wird gespeichert —
              DATEV markiert den nicht abzugsfähigen Anteil automatisch (BU-Schlüssel 9).
            </div>
            <div>
              <label className="block text-xs font-medium text-amber-700 mb-1">Teilnehmer</label>
              <input value={bewirtungTeilnehmer} onChange={e => setBewirtungTeilnehmer(e.target.value)}
                placeholder="z.B. Max Müller, Anna Schmidt (Fa. XY)"
                className="w-full border rounded px-2 py-1 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-amber-700 mb-1">Geschäftlicher Anlass</label>
              <input value={bewirtungZweck} onChange={e => setBewirtungZweck(e.target.value)}
                placeholder="z.B. Jahresgespräch Kunde XY"
                className="w-full border rounded px-2 py-1 text-sm" />
            </div>
          </div>
        )}

        {!isPrivat && (
          <div>
            <label className="block text-sm font-medium mb-1">Lieferant (optional)</label>
            <select value={lieferantId} onChange={e => setLieferantId(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm">
              <option value="">— kein Lieferant —</option>
              {lieferanten.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Betrag netto (€) *
              {buchungstyp === "Reisekosten" && reiseKilometerpauschale && " (auto)"}
            </label>
            <input type="number" step="0.001" min="0" value={betragNetto}
              onChange={e => setBetragNetto(e.target.value)}
              readOnly={buchungstyp === "Reisekosten" && reiseKilometerpauschale}
              placeholder="0,00"
              className={`w-full border rounded px-3 py-2 text-sm ${buchungstyp === "Reisekosten" && reiseKilometerpauschale ? "bg-gray-50 text-gray-500" : ""}`}
              required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">MwSt-Satz</label>
            <select value={mwstSatz} onChange={e => setMwstSatz(e.target.value)}
              disabled={isPrivat}
              className="w-full border rounded px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400">
              <option value="19">19 %</option>
              <option value="7">7 %</option>
              <option value="0">0 % (steuerfrei)</option>
            </select>
          </div>
        </div>

        {!isPrivat && (
          <div>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={zweiterSatz}
                onChange={e => setZweiterSatz(e.target.checked)} />
              Beleg enthält einen zweiten MwSt-Satz (z. B. Bewirtung: Speisen 7 % / Getränke 19 %)
            </label>
            {zweiterSatz && (
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div>
                  <label className="block text-sm font-medium mb-1">Betrag netto 2 (€)</label>
                  <input type="number" step="0.001" min="0" value={betragNetto2}
                    onChange={e => setBetragNetto2(e.target.value)}
                    placeholder="0,00"
                    className="w-full border rounded px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">MwSt-Satz 2</label>
                  <select value={mwstSatz2} onChange={e => setMwstSatz2(e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm">
                    <option value="19">19 %</option>
                    <option value="7">7 %</option>
                    <option value="0">0 % (steuerfrei)</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        )}

        {gesamtNetto > 0 && (
          <div className="bg-gray-50 border rounded p-3 text-sm grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-xs text-gray-500">Netto</div>
              <div className="font-medium">{formatEuro(gesamtNetto)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">
                MwSt {zweiterSatz && betragsteile.betragNetto2 ? `${mwstSatz}%+${mwstSatz2}%` : `${mwstSatz}%`}
              </div>
              <div className="font-medium text-amber-600">{formatEuro(mwstBetrag)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Brutto</div>
              <div className="font-bold text-blue-700">{formatEuro(brutto)}</div>
            </div>
          </div>
        )}

        {/* DATEV Buchungskonten */}
        <div className="border rounded p-4 bg-gray-50 space-y-3">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Buchungskonto (DATEV)</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Zahlungsweg</label>
              <select value={zahlungsweg} onChange={e => setZahlungsweg(e.target.value)}
                className="w-full border rounded px-2 py-1 text-sm">
                <option value="">— auswählen —</option>
                {ZAHLUNGSWEGE.map(z => <option key={z}>{z}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Sachkonto (DATEV)</label>
              <input type="text" value={sachkonto}
                onChange={e => { setSachkonto(e.target.value); sachkontoManual.current = true; }}
                placeholder="z.B. 4530 (auto)"
                className="w-full border rounded px-2 py-1 text-sm font-mono" />
              <p className="text-xs text-gray-400 mt-0.5">Wird aus Buchungstyp/Kategorie vorgeschlagen.</p>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Kostenstelle</label>
            <input list="kostenstellen-list" value={kostenstelle} onChange={e => setKostenstelle(e.target.value)}
              placeholder="z.B. Vertrieb"
              className="w-full border rounded px-2 py-1 text-sm" />
            <datalist id="kostenstellen-list">
              {kostenstellenList.map(k => <option key={k} value={k} />)}
            </datalist>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={bezahltHeute} onChange={e => setBezahltHeute(e.target.checked)} />
          Bereits bezahlt (heute)
        </label>

        <div className="border rounded p-3 bg-orange-50 space-y-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer font-medium text-orange-800">
            <input type="checkbox" checked={privaterAusleger} onChange={e => {
            setPrivaterAusleger(e.target.checked);
            if (e.target.checked && !ausleger) setAusleger(loginUser);
          }} />
            Privat ausgelegt – Erstattung ausstehend
          </label>
          {privaterAusleger && (
            <div>
              <label className="block text-xs text-orange-700 mb-1">Ausgelegt von (Name)</label>
              <input
                type="text"
                value={ausleger}
                onChange={e => setAusleger(e.target.value)}
                placeholder="z.B. Max Müller"
                className="w-full border border-orange-200 rounded px-3 py-2 text-sm bg-white"
              />
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Erfasst von</label>
          <input type="text" value={erfasstVon} onChange={e => setErfasstVon(e.target.value)}
            placeholder="Benutzername / Name"
            className="w-full border rounded px-3 py-2 text-sm" />
          <p className="text-xs text-gray-400 mt-0.5">Vorbelegt mit dem eingeloggten Benutzer.</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Notiz</label>
          <textarea value={notiz} onChange={e => setNotiz(e.target.value)} rows={2}
            className="w-full border rounded px-3 py-2 text-sm" />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving}
            className="bg-blue-600 text-white px-5 py-2 rounded hover:bg-blue-700 text-sm disabled:opacity-50 w-full sm:w-auto">
            {saving ? "Speichern…" : "Ausgabe speichern"}
          </button>
          <Link href="/ausgaben"
            className="px-5 py-2 rounded border text-sm hover:bg-gray-50 w-full sm:w-auto text-center">
            Abbrechen
          </Link>
        </div>
      </form>
    </div>
  );
}
