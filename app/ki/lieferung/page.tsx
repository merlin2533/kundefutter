"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import SearchableSelect from "@/components/SearchableSelect";
import CameraUpload from "@/components/CameraUpload";
import AudioRecorder from "@/components/AudioRecorder";
import MultiCameraUpload, { type AusgewaehlteDatei } from "@/components/MultiCameraUpload";
import KonfidenzBadge from "@/components/KonfidenzBadge";
import DezimalInput from "@/components/DezimalInput";
import NeuArtikelInline from "@/components/NeuArtikelInline";
import NeuKundeInline, { type NeuKundeErgebnis } from "@/components/NeuKundeInline";
import { lagerStatus } from "@/lib/utils";
import { matchArtikel, matchKunde, normalisiereSuchtext, fetchAlleSeiten, type Konfidenz } from "@/lib/kiMatching";

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
  betriebsnummer?: string | null;
  vvvoNr?: string | null;
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
  kunde: { name: string; firma?: string; ort?: string; betriebsnummer?: string };
  datum?: string;
  positionen: KiPosition[];
}

type EingabeModus = "bild" | "sprache";

interface ZuordnungsPosition {
  kiPosition: KiPosition;
  artikelId: string;
  vorschlagArtikelId: number | null;
  menge: number;
  verkaufspreis: number;
  konfidenz: Konfidenz;
  showNeuForm?: boolean;
  preisUebernommen?: "global" | "individuell";
  chargeNr: string;
}

// ─── Vollständiges Laden (kein Limit) ────────────────────────────────────────
// Artikel/Kunden/Lieferanten werden für die manuelle Zuordnung komplett
// geladen — ein festes Limit würde bei wachsendem Datenbestand irgendwann
// wieder Einträge im Zuordnungs-Dropdown fehlen lassen (siehe fetchAlleSeiten).

async function ladeAlleArtikel(): Promise<ArtikelRaw[]> {
  return fetchAlleSeiten<ArtikelRaw>(async (page) => {
    const res = await fetch(`/api/artikel?page=${page}&limit=2000&relations=false`);
    if (!res.ok) return null;
    const items = await res.json();
    const total = Number(res.headers.get("X-Total-Count") ?? (Array.isArray(items) ? items.length : 0));
    return { items: Array.isArray(items) ? items : [], total };
  });
}

async function ladeAlleKunden(): Promise<KundeRaw[]> {
  return fetchAlleSeiten<KundeRaw>(async (page) => {
    const res = await fetch(`/api/kunden?page=${page}&limit=1000`);
    if (!res.ok) return null;
    const json = await res.json();
    return { items: Array.isArray(json.data) ? json.data : [], total: json.total ?? 0 };
  });
}

async function ladeAlleLieferanten(): Promise<LieferantRaw[]> {
  return fetchAlleSeiten<LieferantRaw>(async (page) => {
    const res = await fetch(`/api/lieferanten?page=${page}&limit=500`);
    if (!res.ok) return null;
    const json = await res.json();
    return { items: Array.isArray(json.data) ? json.data : [], total: json.total ?? 0 };
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function lagerAmpel(
  artikel: { aktuellerBestand: number; mindestbestand: number; einheit: string } | undefined
) {
  if (!artikel) return null;
  const status = lagerStatus(artikel.aktuellerBestand, artikel.mindestbestand);
  if (status === "rot")
    return <span className="text-red-600 text-xs">● Kein Lager</span>;
  if (status === "gelb")
    return (
      <span className="text-amber-600 text-xs">
        ● Gering ({artikel.aktuellerBestand} {artikel.einheit})
      </span>
    );
  return (
    <span className="text-green-600 text-xs">
      ● Auf Lager ({artikel.aktuellerBestand} {artikel.einheit})
    </span>
  );
}

// ─── Stepper ─────────────────────────────────────────────────────────────────

const STEPS = ["Upload", "KI-Analyse", "Zuordnung", "Bestätigung"];

function Stepper({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center mb-8 gap-0">
      {STEPS.map((label, idx) => {
        const done = idx < current;
        const active = idx === current;
        return (
          <div key={idx} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors
                  ${done ? "bg-green-600 border-green-600 text-white" : ""}
                  ${active ? "bg-white border-green-600 text-green-600" : ""}
                  ${!done && !active ? "bg-white border-gray-300 text-gray-400" : ""}
                `}
              >
                {done ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  idx + 1
                )}
              </div>
              <span
                className={`mt-1 text-xs font-medium whitespace-nowrap ${
                  active ? "text-green-700" : done ? "text-green-600" : "text-gray-400"
                }`}
              >
                {label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={`h-0.5 w-12 sm:w-20 mx-1 mb-4 transition-colors ${
                  idx < current ? "bg-green-600" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

function KiLieferungWizard({ initialEingabeModus = "bild" }: { initialEingabeModus?: EingabeModus }) {
  const router = useRouter();
  const [step, setStep] = useState(0);

  // Step 1
  const [eingabeModus, setEingabeModus] = useState<EingabeModus>(initialEingabeModus);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [sprachText, setSprachText] = useState("");

  // Step 2
  const [kiErgebnis, setKiErgebnis] = useState<KiErgebnis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");

  // Step 3
  const [artikel, setArtikel] = useState<ArtikelRaw[]>([]);
  const [kunden, setKunden] = useState<KundeRaw[]>([]);
  const [lieferanten, setLieferanten] = useState<LieferantRaw[]>([]);
  const [kundeId, setKundeId] = useState("");
  const [vorschlagKundeId, setVorschlagKundeId] = useState<number | null>(null);
  const [kundKonfidenz, setKundKonfidenz] = useState<Konfidenz>("keine");
  const [showNeuKundeForm, setShowNeuKundeForm] = useState(false);
  const [positionen, setPositionen] = useState<ZuordnungsPosition[]>([]);
  const [datum, setDatum] = useState(() => new Date().toISOString().slice(0, 10));
  const [lieferStatus, setLieferStatus] = useState<"geplant" | "geliefert">("geplant");
  const [kundenSonderpreise, setKundenSonderpreise] = useState<Record<number, number>>({});
  const [savingPreisIdx, setSavingPreisIdx] = useState<number | null>(null);

  // Step 4
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [erstellteId, setErstellteId] = useState<number | null>(null);
  const [bestelllisteAnlegen, setBestelllisteAnlegen] = useState(false);
  const [bestelllisteErledigt, setBestelllisteErledigt] = useState(false);

  // ── Sonderpreise laden ────────────────────────────────────────────────────

  async function ladeSonderpreise(kid: string) {
    if (!kid) { setKundenSonderpreise({}); return; }
    try {
      const res = await fetch(`/api/kunden/${kid}/preise`);
      if (!res.ok) return;
      const data = await res.json();
      const map: Record<number, number> = {};
      const list = Array.isArray(data) ? data : (data.preise ?? []);
      for (const p of list) {
        if (p.artikelId && p.preis != null) map[p.artikelId] = p.preis;
      }
      setKundenSonderpreise(map);
      // Preise aktualisieren
      setPositionen((prev) =>
        prev.map((pos) => {
          if (!pos.artikelId) return pos;
          const aid = parseInt(pos.artikelId, 10);
          if (map[aid] != null) return { ...pos, verkaufspreis: map[aid] };
          return pos;
        })
      );
    } catch { /* ignore */ }
  }

  // ── Step 1 → 2: Analyse ───────────────────────────────────────────────────

  async function runAnalysis() {
    if (eingabeModus === "bild" && !imagePreview) return;
    if (eingabeModus === "sprache" && !sprachText.trim()) return;
    setAnalyzing(true);
    setAnalyzeError("");

    try {
      const analyzeBody =
        eingabeModus === "sprache"
          ? { text: sprachText, feature: "lieferung" }
          : {
              image: imagePreview.includes(",") ? imagePreview.split(",")[1] : imagePreview,
              feature: "lieferung",
            };

      const [artikelList, kundenList, lieferantenList, analyzeRes, gelerntKundeRes, gelerntArtikelRes] = await Promise.all([
        ladeAlleArtikel(),
        ladeAlleKunden(),
        ladeAlleLieferanten(),
        fetch("/api/ki/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(analyzeBody),
        }),
        fetch("/api/ki/lernen?typ=kunde"),
        fetch("/api/ki/lernen?typ=artikel"),
      ]);

      const analyzeData = await analyzeRes.json();
      const gelerntKundeData = gelerntKundeRes.ok ? await gelerntKundeRes.json() : { eintraege: [] };
      const gelerntArtikelData = gelerntArtikelRes.ok ? await gelerntArtikelRes.json() : { eintraege: [] };

      if (!analyzeRes.ok) throw new Error(analyzeData.error || "KI-Analyse fehlgeschlagen");

      setArtikel(artikelList);
      setKunden(kundenList);
      setLieferanten(lieferantenList);

      const gelerntKundeMap = new Map<string, number>(
        (gelerntKundeData.eintraege ?? []).map((e: { suchtext: string; zielId: number }) => [normalisiereSuchtext(e.suchtext), e.zielId])
      );
      const gelerntArtikelMap = new Map<string, number>(
        (gelerntArtikelData.eintraege ?? []).map((e: { suchtext: string; zielId: number }) => [normalisiereSuchtext(e.suchtext), e.zielId])
      );

      const ergebnis: KiErgebnis = analyzeData.ergebnis;
      setKiErgebnis(ergebnis);

      if (ergebnis.datum) setDatum(ergebnis.datum.slice(0, 10));

      const { kunde: matchedKunde, konfidenz: kk } = matchKunde(ergebnis.kunde, kundenList, gelerntKundeMap);
      setKundeId(matchedKunde ? String(matchedKunde.id) : "");
      setVorschlagKundeId(matchedKunde ? matchedKunde.id : null);
      setKundKonfidenz(matchedKunde ? kk : "keine");

      const zugeordnet: ZuordnungsPosition[] = ergebnis.positionen.map((pos) => {
        const { artikel: matchedArtikel, konfidenz } = matchArtikel(pos, artikelList, gelerntArtikelMap);
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
      setPositionen(zugeordnet);

      if (matchedKunde) {
        ladeSonderpreise(String(matchedKunde.id));
      }

      setStep(2);
    } catch (err: unknown) {
      setAnalyzeError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setAnalyzing(false);
    }
  }

  function goToAnalyze() {
    setStep(1);
    runAnalysis();
  }

  // ── Step 3: position updates ──────────────────────────────────────────────

  function updatePosition(
    idx: number,
    field: "artikelId" | "menge" | "verkaufspreis" | "chargeNr",
    val: string | number
  ) {
    setPositionen((prev) =>
      prev.map((p, i) => {
        if (i !== idx) return p;
        const updated = { ...p, [field]: val };
        if (field === "artikelId") {
          const found = artikel.find((a) => String(a.id) === String(val));
          const aid = found ? found.id : null;
          const sonderpreis = aid != null ? kundenSonderpreise[aid] : undefined;
          updated.verkaufspreis =
            sonderpreis != null ? sonderpreis : found ? found.standardpreis : 0;
          updated.konfidenz = found ? "hoch" : "keine";
          updated.showNeuForm = false;
        }
        return updated;
      })
    );
  }

  // Preis aus KI-Erkennung, der in den Artikel-Stammdaten (noch) nicht hinterlegt ist,
  // dort nachpflegen — entweder als globaler Standardpreis oder als individueller
  // Sonderpreis (KundeArtikelPreis) für den aktuell zugeordneten Kunden.
  async function preisInStammdatenUebernehmen(idx: number, modus: "global" | "individuell") {
    const pos = positionen[idx];
    const artikelIdNum = parseInt(pos.artikelId, 10);
    if (!artikelIdNum || !pos.verkaufspreis) return;
    setSavingPreisIdx(idx);
    try {
      if (modus === "global") {
        const res = await fetch(`/api/artikel/${artikelIdNum}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ standardpreis: pos.verkaufspreis }),
        });
        if (!res.ok) return;
        setArtikel((prev) =>
          prev.map((a) => (a.id === artikelIdNum ? { ...a, standardpreis: pos.verkaufspreis } : a))
        );
      } else {
        if (!kundeId) return;
        const res = await fetch(`/api/kunden/${kundeId}/preise`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ artikelId: artikelIdNum, preis: pos.verkaufspreis }),
        });
        if (!res.ok) return;
        setKundenSonderpreise((prev) => ({ ...prev, [artikelIdNum]: pos.verkaufspreis }));
      }
      setPositionen((prev) =>
        prev.map((p, i) => (i === idx ? { ...p, preisUebernommen: modus } : p))
      );
    } finally {
      setSavingPreisIdx(null);
    }
  }

  function toggleNeuForm(idx: number, show: boolean) {
    setPositionen((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, showNeuForm: show } : p))
    );
  }

  function deletePosition(idx: number) {
    setPositionen((prev) => prev.filter((_, i) => i !== idx));
  }

  function addPosition() {
    setPositionen((prev) => [
      ...prev,
      {
        kiPosition: { name: "", menge: 1 },
        artikelId: "",
        vorschlagArtikelId: null,
        menge: 1,
        verkaufspreis: 0,
        konfidenz: "keine",
        chargeNr: "",
      },
    ]);
  }

  function onArtikelCreated(idx: number, neu: ArtikelRaw) {
    setArtikel((prev) => [...prev, neu]);
    setPositionen((prev) =>
      prev.map((p, i) => {
        if (i !== idx) return p;
        const sonderpreis = kundenSonderpreise[neu.id];
        return {
          ...p,
          artikelId: String(neu.id),
          verkaufspreis: sonderpreis != null ? sonderpreis : neu.standardpreis,
          konfidenz: "hoch",
          showNeuForm: false,
        };
      })
    );
  }

  function onKundeCreated(neu: NeuKundeErgebnis) {
    const kunde: KundeRaw = { id: neu.id, name: neu.name, firma: neu.firma ?? undefined, ort: neu.ort ?? undefined };
    setKunden((prev) => [...prev, kunde]);
    setKundeId(String(kunde.id));
    setVorschlagKundeId(kunde.id);
    setKundKonfidenz("hoch");
    setShowNeuKundeForm(false);
    ladeSonderpreise(String(kunde.id));
  }

  // ── Lernkorrekturen melden ────────────────────────────────────────────────
  // Meldet nur Zuordnungen, bei denen die finale Auswahl vom ursprünglichen
  // KI-Vorschlag abweicht — vermeidet unnötiges Rauschen bei bereits korrekten
  // "hoch"-Treffern.

  function meldeLernkorrekturen(finalerKundeId: number) {
    const sendeAlias = (typ: "artikel" | "kunde", suchtext: string, zielId: number) => {
      const text = suchtext.trim();
      if (!text) return;
      fetch("/api/ki/lernen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ typ, suchtext: text, zielId }),
      }).catch(() => {});
    };

    if (kiErgebnis && vorschlagKundeId !== finalerKundeId) {
      sendeAlias("kunde", kiErgebnis.kunde.firma || kiErgebnis.kunde.name, finalerKundeId);
    }
    for (const pos of positionen) {
      if (!pos.kiPosition.name || !pos.artikelId) continue;
      const finalId = parseInt(pos.artikelId, 10);
      if (pos.vorschlagArtikelId !== finalId) {
        sendeAlias("artikel", pos.kiPosition.name, finalId);
      }
    }
  }

  // ── Step 4: Submit ────────────────────────────────────────────────────────

  async function handleSubmit() {
    const validPositionen = positionen.filter((p) => p.artikelId);
    if (!kundeId || validPositionen.length === 0) return;

    setSubmitting(true);
    setSubmitError("");

    try {
      const finalerKundeId = parseInt(kundeId, 10);
      const res = await fetch("/api/lieferungen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kundeId: finalerKundeId,
          datum: datum ? new Date(datum + "T00:00:00").toISOString() : new Date().toISOString(),
          status: lieferStatus,
          quelle: eingabeModus === "sprache" ? "ki-sprache" : "ki",
          positionen: validPositionen.map((p) => ({
            artikelId: parseInt(p.artikelId, 10),
            menge: p.menge,
            verkaufspreis: p.verkaufspreis,
            chargeNr: p.chargeNr.trim() || undefined,
          })),
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Fehler beim Anlegen");
      }
      const neu = await res.json();
      setErstellteId(neu.id ?? null);
      meldeLernkorrekturen(finalerKundeId);

      // Prüfen ob Artikel mit niedrigem/keinem Bestand vorhanden
      const niedrig = validPositionen.some((p) => {
        const art = artikel.find((a) => String(a.id) === p.artikelId);
        return art && art.aktuellerBestand <= art.mindestbestand;
      });
      setBestelllisteAnlegen(niedrig);

      setStep(4 as number);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleBestelllisteAnlegen() {
    const validPositionen = positionen.filter((p) => p.artikelId);
    const niedrigeArtikel = validPositionen.filter((p) => {
      const art = artikel.find((a) => String(a.id) === p.artikelId);
      return art && art.aktuellerBestand <= art.mindestbestand;
    });

    for (const pos of niedrigeArtikel) {
      await fetch("/api/bestellliste", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artikelId: parseInt(pos.artikelId, 10),
          menge: pos.menge,
          status: "offen",
        }),
      });
    }
    setBestelllisteErledigt(true);
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const kundenOptions = kunden.map((k) => ({
    value: String(k.id),
    label: k.firma ? `${k.name} — ${k.firma}` : k.name,
    sub: k.ort,
  }));

  const artikelOptions = artikel.map((a) => ({
    value: String(a.id),
    label: a.name,
    sub: a.artikelnummer,
  }));

  const selectedKunde = kunden.find((k) => String(k.id) === kundeId);

  const gesamtsumme = positionen
    .filter((p) => p.artikelId)
    .reduce((sum, p) => sum + p.menge * p.verkaufspreis, 0);

  const niedrigeBestandArtikel = positionen
    .filter((p) => p.artikelId)
    .filter((p) => {
      const art = artikel.find((a) => String(a.id) === p.artikelId);
      return art && art.aktuellerBestand <= art.mindestbestand;
    });

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <Stepper current={step > 3 ? 4 : step} />

      {/* ─── Step 1: Upload ─────────────────────────────────────────────── */}
      {step === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          {/* Eingabemodus-Tabs */}
          <div className="flex gap-1 mb-5 bg-gray-100 rounded-lg p-1">
            <button
              type="button"
              onClick={() => setEingabeModus("bild")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-colors ${
                eingabeModus === "bild"
                  ? "bg-white text-green-700 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Bild / Kamera
            </button>
            <button
              type="button"
              onClick={() => setEingabeModus("sprache")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-colors ${
                eingabeModus === "sprache"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-14 0m7 7v4m-4 0h8M12 1a3 3 0 00-3 3v7a3 3 0 006 0V4a3 3 0 00-3-3z" />
              </svg>
              Spracheingabe
            </button>
          </div>

          {eingabeModus === "bild" && (
            <>
              <h2 className="text-lg font-semibold mb-4 text-gray-800">Bild hochladen</h2>
              <p className="text-sm text-gray-500 mb-6">
                Lade ein Foto einer Bestellung, eines Lieferscheins oder einer handschriftlichen
                Notiz hoch. Die KI erkennt Kunde, Artikel und Mengen automatisch.
              </p>

              <CameraUpload
                onImageSelected={(file, preview) => {
                  setImageFile(file);
                  setImagePreview(preview);
                }}
                imagePreview={imagePreview}
                imageName={imageFile?.name ?? "Bestellung"}
                onRemove={() => {
                  setImageFile(null);
                  setImagePreview("");
                }}
              />

              <div className="mt-6 flex justify-end">
                <button
                  onClick={goToAnalyze}
                  disabled={!imagePreview}
                  className="px-6 py-2.5 rounded-lg text-sm font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Weiter
                </button>
              </div>
            </>
          )}

          {eingabeModus === "sprache" && (
            <>
              <h2 className="text-lg font-semibold mb-4 text-gray-800">Lieferung diktieren</h2>
              <p className="text-sm text-gray-500 mb-4">
                Sprich Kunde, Datum, Artikel und Mengen ein (max. 3 Minuten) — z.B. „Lieferung an
                Hof Meyer morgen, 500 Kilo Rindermais und 2 Sack Mineralfutter, Betriebsnummer DE
                03 1234 5678&quot;. Mistral transkribiert die Aufnahme, die KI erkennt anschließend
                Kunde und Positionen.
              </p>

              <AudioRecorder
                onTranscript={(text) =>
                  setSprachText((prev) => (prev ? `${prev} ${text}` : text))
                }
                feature="lieferung"
                maxDurationSec={180}
                placeholder="Aufnahme starten (max. 3 Min.)"
              />

              {sprachText && (
                <div className="mt-4 space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Erkannter Text</label>
                  <textarea
                    value={sprachText}
                    onChange={(e) => setSprachText(e.target.value)}
                    rows={5}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                  />
                </div>
              )}

              <div className="mt-6 flex justify-end">
                <button
                  onClick={goToAnalyze}
                  disabled={!sprachText.trim()}
                  className="px-6 py-2.5 rounded-lg text-sm font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Weiter
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── Step 2: KI-Analyse ─────────────────────────────────────────── */}
      {step === 1 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-800">KI-Analyse</h2>

          {analyzing && (
            <div className="flex flex-col items-center py-16 gap-5">
              <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-600 font-medium">KI analysiert Bestellung…</p>
              <p className="text-sm text-gray-400">Das kann einige Sekunden dauern.</p>
            </div>
          )}

          {analyzeError && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700 mb-4">
              {analyzeError}
            </div>
          )}

          {!analyzing && kiErgebnis && (
            <>
              <div className="mb-6 p-4 rounded-lg bg-green-50 border border-green-100">
                <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1">
                  Erkannter Kunde
                </p>
                <p className="font-semibold text-gray-900">{kiErgebnis.kunde.name}</p>
                {kiErgebnis.kunde.firma && (
                  <p className="text-sm text-gray-600">{kiErgebnis.kunde.firma}</p>
                )}
                {kiErgebnis.kunde.ort && (
                  <p className="text-sm text-gray-500">{kiErgebnis.kunde.ort}</p>
                )}
              </div>

              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Erkannte Positionen
              </p>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-medium">Artikel</th>
                      <th className="px-4 py-2.5 text-right font-medium">Menge</th>
                      <th className="px-4 py-2.5 text-left font-medium hidden sm:table-cell">Einheit</th>
                      <th className="px-4 py-2.5 text-right font-medium hidden sm:table-cell">Einzelpreis</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {kiErgebnis.positionen.map((pos, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5">
                          <p className="font-medium text-gray-900">{pos.name}</p>
                          {pos.artikelnummer && (
                            <p className="text-xs text-gray-400">{pos.artikelnummer}</p>
                          )}
                          {pos.chargeNr && (
                            <p className="text-xs text-gray-400">Charge: {pos.chargeNr}</p>
                          )}
                          <div className="sm:hidden text-xs text-gray-500 mt-0.5">
                            {pos.einheit ?? "—"}
                            {pos.einzelpreis != null && ` · ${pos.einzelpreis.toFixed(2)} €`}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{pos.menge}</td>
                        <td className="px-4 py-2.5 text-gray-500 hidden sm:table-cell">{pos.einheit ?? "—"}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums hidden sm:table-cell">
                          {pos.einzelpreis != null
                            ? `${pos.einzelpreis.toFixed(2)} €`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex justify-between gap-3">
                <button
                  onClick={() => setStep(0)}
                  className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                >
                  Zurück
                </button>
                <button
                  onClick={() => setStep(2)}
                  className="px-6 py-2.5 rounded-lg text-sm font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors"
                >
                  Weiter
                </button>
              </div>
            </>
          )}

          {!analyzing && analyzeError && (
            <div className="flex justify-between mt-4">
              <button
                onClick={() => setStep(0)}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
              >
                Zurück
              </button>
              <button
                onClick={runAnalysis}
                className="px-6 py-2.5 rounded-lg text-sm font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors"
              >
                Erneut versuchen
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── Step 3: Zuordnung ──────────────────────────────────────────── */}
      {step === 2 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-5 text-gray-800">Zuordnung prüfen</h2>

          {/* Kunde */}
          <div className="mb-5 p-4 rounded-lg border border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Kunde</p>
              <KonfidenzBadge k={kundKonfidenz} />
            </div>
            {kiErgebnis && (
              <p className="text-xs text-gray-400 mb-2">
                KI erkannt:{" "}
                <span className="font-medium text-gray-600">
                  {kiErgebnis.kunde.firma ?? kiErgebnis.kunde.name}
                </span>
              </p>
            )}
            {kiErgebnis?.kunde.betriebsnummer && (
              <p className="text-xs text-gray-400 mb-2">
                Betriebsnummer (erkannt):{" "}
                <span className="font-medium text-gray-600">{kiErgebnis.kunde.betriebsnummer}</span>
              </p>
            )}
            <SearchableSelect
              options={kundenOptions}
              value={kundeId}
              onChange={(v) => {
                setKundeId(v);
                setKundKonfidenz(v ? "hoch" : "keine");
                ladeSonderpreise(v);
              }}
              placeholder="Kunde auswählen…"
              allowClear
            />
            {!kundeId && !showNeuKundeForm && (
              <button
                type="button"
                onClick={() => setShowNeuKundeForm(true)}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium mt-2 inline-flex items-center gap-1"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Neuen Kunden anlegen
              </button>
            )}
            {showNeuKundeForm && (
              <NeuKundeInline
                kiName={kiErgebnis?.kunde.name ?? ""}
                kiFirma={kiErgebnis?.kunde.firma}
                kiOrt={kiErgebnis?.kunde.ort}
                onCreated={onKundeCreated}
                onCancel={() => setShowNeuKundeForm(false)}
              />
            )}
          </div>

          {/* Datum + Status */}
          <div className="mb-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lieferdatum</label>
              <input
                type="date"
                value={datum}
                onChange={(e) => setDatum(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <div className="flex gap-2">
                {(["geplant", "geliefert"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setLieferStatus(s)}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                      lieferStatus === s
                        ? s === "geliefert"
                          ? "bg-green-600 text-white border-green-600"
                          : "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {s === "geplant" ? "Geplant" : "Geliefert"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Positionen */}
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Artikel-Positionen
            </p>
            <button
              type="button"
              onClick={addPosition}
              className="text-xs text-green-600 hover:text-green-700 font-medium"
            >
              + Position hinzufügen
            </button>
          </div>

          <div className="space-y-4">
            {positionen.map((pos, idx) => {
              const gefundenerArtikel = artikel.find((a) => String(a.id) === pos.artikelId);
              const hatSonderpreis =
                gefundenerArtikel && kundenSonderpreise[gefundenerArtikel.id] != null;

              return (
                <div key={idx} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {pos.kiPosition.name || <span className="text-gray-400 italic">Neue Position</span>}
                      </p>
                      {pos.kiPosition.artikelnummer && (
                        <p className="text-xs text-gray-400">Nr: {pos.kiPosition.artikelnummer}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <KonfidenzBadge k={pos.konfidenz} />
                      <button
                        type="button"
                        onClick={() => deletePosition(idx)}
                        className="text-gray-300 hover:text-red-500 transition-colors"
                        title="Position entfernen"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Artikel-Auswahl */}
                    <div className="sm:col-span-1">
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Zugeordneter Artikel
                      </label>
                      <SearchableSelect
                        options={artikelOptions}
                        value={pos.artikelId}
                        onChange={(v) => updatePosition(idx, "artikelId", v)}
                        placeholder="Artikel wählen…"
                        allowClear
                      />
                      {gefundenerArtikel && (
                        <div className="mt-1 flex items-center gap-2">
                          {lagerAmpel(gefundenerArtikel)}
                          {hatSonderpreis && (
                            <span className="text-xs text-purple-600 font-medium">★ Sonderpreis</span>
                          )}
                        </div>
                      )}
                      {!pos.artikelId && !pos.showNeuForm && (
                        <button
                          type="button"
                          onClick={() => toggleNeuForm(idx, true)}
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium mt-1 inline-flex items-center gap-1"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Neuen Artikel anlegen
                        </button>
                      )}
                    </div>

                    {/* Menge */}
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Menge {pos.kiPosition.einheit ? `(${pos.kiPosition.einheit})` : ""}
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={pos.menge}
                        onChange={(e) =>
                          updatePosition(idx, "menge", parseFloat(e.target.value) || 0)
                        }
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-green-600"
                      />
                    </div>

                    {/* VK-Preis */}
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        VK-Preis (€)
                        {hatSonderpreis && (
                          <span className="ml-1 text-purple-600">★</span>
                        )}
                      </label>
                      <DezimalInput
                        value={pos.verkaufspreis}
                        onChange={(v) => updatePosition(idx, "verkaufspreis", v)}
                        placeholder="0,00"
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-green-600"
                      />
                    </div>
                  </div>

                  {/* Chargennummer */}
                  <div className="mt-3">
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Chargennummer <span className="text-gray-400">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={pos.chargeNr}
                      onChange={(e) => updatePosition(idx, "chargeNr", e.target.value)}
                      placeholder="z.B. LOT-2024-001"
                      className="w-full sm:w-64 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                    />
                  </div>

                  {/* Preis nicht in Stammdaten hinterlegt → Übernahme anbieten */}
                  {gefundenerArtikel &&
                    !gefundenerArtikel.standardpreis &&
                    !hatSonderpreis &&
                    pos.verkaufspreis > 0 &&
                    !pos.preisUebernommen && (
                      <div className="mt-3 p-2.5 rounded-lg bg-amber-50 border border-amber-200">
                        <p className="text-xs text-amber-800 mb-1.5">
                          Für diesen Artikel ist noch kein Preis in den Stammdaten hinterlegt —
                          erkannten Preis ({pos.verkaufspreis.toFixed(2)} €) übernehmen als:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => preisInStammdatenUebernehmen(idx, "global")}
                            disabled={savingPreisIdx === idx}
                            className="text-xs px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-amber-800 hover:bg-amber-100 disabled:opacity-40 font-medium transition-colors"
                          >
                            🌐 Globaler Preis
                          </button>
                          <button
                            type="button"
                            onClick={() => preisInStammdatenUebernehmen(idx, "individuell")}
                            disabled={savingPreisIdx === idx || !kundeId}
                            title={!kundeId ? "Kunde zuerst auswählen" : undefined}
                            className="text-xs px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-amber-800 hover:bg-amber-100 disabled:opacity-40 font-medium transition-colors"
                          >
                            👤 Individueller Preis (nur dieser Kunde)
                          </button>
                        </div>
                      </div>
                    )}
                  {pos.preisUebernommen && (
                    <p className="mt-2 text-xs font-medium text-green-700">
                      ✓ Preis in Stammdaten übernommen als{" "}
                      {pos.preisUebernommen === "global" ? "🌐 Globaler Preis" : "👤 Individueller Preis"}
                    </p>
                  )}

                  {/* Inline Neu-Anlage */}
                  {pos.showNeuForm && (
                    <NeuArtikelInline
                      kiName={pos.kiPosition.name}
                      kiEinheit={pos.kiPosition.einheit}
                      kiArtikelnummer={pos.kiPosition.artikelnummer}
                      kiPreis={pos.kiPosition.einzelpreis}
                      lieferanten={lieferanten}
                      onCreated={(neu) => onArtikelCreated(idx, neu)}
                      onCancel={() => toggleNeuForm(idx, false)}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {positionen.length === 0 && (
            <div className="text-center py-8 text-gray-400 text-sm">
              Keine Positionen — klicke auf &quot;+ Position hinzufügen&quot;
            </div>
          )}

          <div className="mt-6 flex justify-between gap-3">
            <button
              onClick={() => setStep(1)}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
            >
              Zurück
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!kundeId || positionen.filter((p) => p.artikelId).length === 0}
              className="px-6 py-2.5 rounded-lg text-sm font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Weiter
            </button>
          </div>
        </div>
      )}

      {/* ─── Step 4: Bestätigung ────────────────────────────────────────── */}
      {step === 3 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-5 text-gray-800">Zusammenfassung</h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
                Kunde
              </p>
              <p className="font-medium text-gray-900">
                {selectedKunde?.firma ?? selectedKunde?.name ?? "—"}
              </p>
              {selectedKunde?.firma && (
                <p className="text-sm text-gray-500">{selectedKunde.name}</p>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
                Datum
              </p>
              <p className="font-medium text-gray-900">
                {new Date(datum + "T00:00:00").toLocaleDateString("de-DE")}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
                Status
              </p>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  lieferStatus === "geliefert"
                    ? "bg-green-100 text-green-800"
                    : "bg-blue-100 text-blue-800"
                }`}
              >
                {lieferStatus === "geliefert" ? "Geliefert" : "Geplant"}
              </span>
            </div>
          </div>

          {/* Warnung niedrige Bestände */}
          {niedrigeBestandArtikel.length > 0 && (
            <div className="mb-5 p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2">
              <svg className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <div className="text-xs text-amber-800">
                <span className="font-semibold">
                  {niedrigeBestandArtikel.length} Artikel mit niedrigem/keinem Bestand:
                </span>{" "}
                {niedrigeBestandArtikel
                  .map((p) => artikel.find((a) => String(a.id) === p.artikelId)?.name)
                  .filter(Boolean)
                  .join(", ")}
              </div>
            </div>
          )}

          <div className="overflow-x-auto rounded-lg border border-gray-200 mb-4">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">Artikel</th>
                  <th className="px-4 py-2.5 text-right font-medium">Menge</th>
                  <th className="px-4 py-2.5 text-right font-medium hidden sm:table-cell">VK-Preis</th>
                  <th className="px-4 py-2.5 text-right font-medium">Summe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {positionen
                  .filter((p) => p.artikelId)
                  .map((pos, i) => {
                    const art = artikel.find((a) => String(a.id) === pos.artikelId);
                    const summe = pos.menge * pos.verkaufspreis;
                    const isNiedrig =
                      art && art.aktuellerBestand <= art.mindestbestand;
                    return (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5">
                          <p className="font-medium text-gray-900">{art?.name ?? pos.kiPosition.name}</p>
                          {art && <p className="text-xs text-gray-400">{art.artikelnummer}</p>}
                          {pos.chargeNr && <p className="text-xs text-gray-400">Charge: {pos.chargeNr}</p>}
                          <div className="sm:hidden text-xs text-gray-500 mt-0.5">
                            {pos.verkaufspreis.toFixed(2)} € / Stk.
                          </div>
                          {isNiedrig && (
                            <span className="text-xs text-amber-600">⚠ Niedriger Bestand</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {pos.menge} {art?.einheit ?? ""}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums hidden sm:table-cell">
                          {pos.verkaufspreis.toFixed(2)} €
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-semibold">
                          {summe.toFixed(2)} €
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan={2} className="px-4 py-3 text-sm font-bold text-right text-gray-700">
                    Gesamtsumme (netto)
                  </td>
                  <td className="hidden sm:table-cell" />
                  <td className="px-4 py-3 text-right tabular-nums font-bold text-gray-900">
                    {gesamtsumme.toFixed(2)} €
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {submitError && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700 mb-4">
              {submitError}
            </div>
          )}

          <div className="flex justify-between gap-3">
            <button
              onClick={() => setStep(2)}
              disabled={submitting}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-40 transition-colors"
            >
              Zurück
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-6 py-2.5 rounded-lg text-sm font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {submitting && (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              Lieferung anlegen
            </button>
          </div>
        </div>
      )}

      {/* ─── Step 5: Erfolg ─────────────────────────────────────────────── */}
      {step === (4 as number) && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Lieferung angelegt!</h2>
          <p className="text-sm text-gray-500 mb-6">
            Die Lieferung wurde erfolgreich erstellt.
          </p>

          {/* Bestellliste-Hinweis */}
          {bestelllisteAnlegen && !bestelllisteErledigt && (
            <div className="mb-6 p-4 rounded-lg bg-amber-50 border border-amber-200 text-left">
              <p className="text-sm font-semibold text-amber-800 mb-1">
                ⚠ {niedrigeBestandArtikel.length} Artikel mit niedrigem/keinem Bestand
              </p>
              <p className="text-xs text-amber-700 mb-3">
                {niedrigeBestandArtikel
                  .map((p) => artikel.find((a) => String(a.id) === p.artikelId)?.name)
                  .filter(Boolean)
                  .join(", ")}
              </p>
              <button
                onClick={handleBestelllisteAnlegen}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-amber-600 text-white hover:bg-amber-700 transition-colors"
              >
                Automatisch zur Bestellliste hinzufügen
              </button>
            </div>
          )}

          {bestelllisteErledigt && (
            <div className="mb-6 p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700">
              ✓ Artikel wurden zur Bestellliste hinzugefügt
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {erstellteId && (
              <button
                onClick={() => router.push(`/lieferungen/${erstellteId}`)}
                className="px-6 py-2.5 rounded-lg text-sm font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors"
              >
                Zur Lieferung
              </button>
            )}
            <button
              onClick={() => router.push("/lieferungen")}
              className="px-6 py-2.5 rounded-lg text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
            >
              Alle Lieferungen
            </button>
            <button
              onClick={() => {
                setStep(0);
                setImageFile(null);
                setImagePreview("");
                setSprachText("");
                setKiErgebnis(null);
                setPositionen([]);
                setKundeId("");
                setErstellteId(null);
                setBestelllisteAnlegen(false);
                setBestelllisteErledigt(false);
              }}
              className="px-6 py-2.5 rounded-lg text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
            >
              Neue Lieferung
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Batch-Modus: Upload + offene Batches ────────────────────────────────────

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

function KiLieferungBatchStart() {
  const router = useRouter();
  const [dateien, setDateien] = useState<AusgewaehlteDatei[]>([]);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [batches, setBatches] = useState<BatchUebersicht[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(true);

  useEffect(() => {
    fetch("/api/ki/lieferung/batch")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setBatches(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoadingBatches(false));
  }, []);

  async function starteBatch() {
    if (dateien.length === 0) return;
    setStarting(true);
    setError("");
    try {
      const formData = new FormData();
      for (const d of dateien) formData.append("files", d.file, d.file.name);

      const res = await fetch("/api/ki/lieferung/batch", { method: "POST", body: formData });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Batch konnte nicht angelegt werden");
      }
      const neu = await res.json();
      router.push(`/ki/lieferung/batch/${neu.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      setStarting(false);
    }
  }

  const offeneBatches = batches.filter((b) => b.status !== "abgeschlossen");

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <h2 className="text-lg font-semibold mb-2 text-gray-800">Neue Lieferscheine hochladen</h2>
        <p className="text-sm text-gray-500 mb-6">
          Fotografiere oder lade mehrere Lieferscheine auf einmal hoch (empfohlen: 10–20 Stück).
          Die KI analysiert anschließend jeden einzeln und du prüfst danach alle gesammelt in
          einer Übersicht.
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
            Batch starten {dateien.length > 0 && `(${dateien.length} Lieferscheine)`}
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
                    href={`/ki/lieferung/batch/${b.id}`}
                    className="flex items-center justify-between gap-3 p-3 rounded-lg border border-gray-200 hover:border-green-300 hover:bg-green-50/50 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        Batch #{b.id} — {b.itemCount} Lieferscheine
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
            <p className="text-sm text-gray-400">Keine offenen Batches — alle Lieferscheine wurden verarbeitet.</p>
          )}
        </div>
      )}
    </>
  );
}

// ─── Modus-Umschalter (Einzeln / Batch) ──────────────────────────────────────

function ModusSchalter({ modus }: { modus: "einzeln" | "batch" }) {
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
          onClick={() => router.push(opt.key === "einzeln" ? "/ki/lieferung" : "/ki/lieferung?modus=batch")}
          className={`px-3 py-1.5 rounded-md transition-colors ${
            modus === opt.key
              ? "bg-white text-green-700 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── Default export mit Suspense-Boundary ─────────────────────────────────────

function KiLieferungPageInner() {
  const searchParams = useSearchParams();
  const modus = searchParams.get("modus") === "batch" ? "batch" : "einzeln";
  const eingabeParam: EingabeModus = searchParams.get("eingabe") === "sprache" ? "sprache" : "bild";

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900">
          {modus === "batch" ? "KI-Lieferung: Batch-Modus" : "KI-Lieferung anlegen"}
        </h1>
        <ModusSchalter modus={modus} />
      </div>

      {modus === "batch" ? (
        <KiLieferungBatchStart />
      ) : (
        <KiLieferungWizard initialEingabeModus={eingabeParam} />
      )}
    </div>
  );
}

export default function KiLieferungPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-3xl mx-auto">
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse mb-6" />
          <div className="h-64 bg-white rounded-xl border border-gray-200 animate-pulse" />
        </div>
      }
    >
      <KiLieferungPageInner />
    </Suspense>
  );
}
