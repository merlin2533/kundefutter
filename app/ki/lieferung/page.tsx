"use client";

import { useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import SearchableSelect from "@/components/SearchableSelect";
import CameraUpload from "@/components/CameraUpload";

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
}

interface KiErgebnis {
  kunde: { name: string; firma?: string; ort?: string };
  datum?: string;
  positionen: KiPosition[];
}

interface ZuordnungsPosition {
  kiPosition: KiPosition;
  artikelId: string;
  menge: number;
  verkaufspreis: number;
  konfidenz: "hoch" | "mittel" | "niedrig" | "keine";
  showNeuForm?: boolean;
}

interface NeuArtikelForm {
  name: string;
  artikelnummer: string;
  einheit: string;
  kategorie: string;
  standardpreis: string;
  lieferantId: string;
  kiInhaltsstoffe: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function lagerAmpel(
  artikel: { aktuellerBestand: number; mindestbestand: number; einheit: string } | undefined
) {
  if (!artikel) return null;
  if (artikel.aktuellerBestand <= 0)
    return <span className="text-red-600 text-xs">● Kein Lager</span>;
  if (artikel.aktuellerBestand < artikel.mindestbestand)
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

function matchArtikel(
  kiPos: KiPosition,
  artikel: ArtikelRaw[]
): { artikel: ArtikelRaw | null; konfidenz: ZuordnungsPosition["konfidenz"] } {
  if (!artikel.length) return { artikel: null, konfidenz: "keine" };

  if (kiPos.artikelnummer) {
    const exact = artikel.find(
      (a) => a.artikelnummer.toLowerCase() === kiPos.artikelnummer!.toLowerCase()
    );
    if (exact) return { artikel: exact, konfidenz: "hoch" };
  }

  const nameLower = kiPos.name.toLowerCase();

  const nameContains = artikel.find(
    (a) => a.name.toLowerCase().includes(nameLower) || nameLower.includes(a.name.toLowerCase())
  );
  if (nameContains) return { artikel: nameContains, konfidenz: "mittel" };

  const words = nameLower.split(/\s+/).filter((w) => w.length > 2);
  for (const word of words) {
    const partial = artikel.find((a) => a.name.toLowerCase().includes(word));
    if (partial) return { artikel: partial, konfidenz: "niedrig" };
  }

  return { artikel: null, konfidenz: "keine" };
}

function matchKunde(
  kiKunde: { name: string; firma?: string; ort?: string },
  kunden: KundeRaw[]
): { kunde: KundeRaw | null; konfidenz: ZuordnungsPosition["konfidenz"] } {
  if (!kunden.length) return { kunde: null, konfidenz: "keine" };

  const search = (kiKunde.firma || kiKunde.name).toLowerCase();

  const exact = kunden.find(
    (k) => k.name.toLowerCase() === search || (k.firma && k.firma.toLowerCase() === search)
  );
  if (exact) return { kunde: exact, konfidenz: "hoch" };

  const containsMatch =
    search.length >= 3
      ? kunden.find(
          (k) =>
            k.name.toLowerCase().includes(search) ||
            (k.firma && k.firma.toLowerCase().includes(search)) ||
            search.includes(k.name.toLowerCase())
        )
      : null;
  if (containsMatch) return { kunde: containsMatch, konfidenz: "mittel" };

  const words = search.split(/\s+/).filter((w) => w.length > 2);
  for (const word of words) {
    const partial = kunden.find(
      (k) =>
        k.name.toLowerCase().includes(word) ||
        (k.firma && k.firma.toLowerCase().includes(word))
    );
    if (partial) return { kunde: partial, konfidenz: "niedrig" };
  }

  return { kunde: null, konfidenz: "keine" };
}

function KonfidenzBadge({ k }: { k: ZuordnungsPosition["konfidenz"] }) {
  if (k === "hoch")
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
        Hoch
      </span>
    );
  if (k === "mittel")
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
        Mittel
      </span>
    );
  if (k === "niedrig")
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
        Niedrig
      </span>
    );
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
      Keine
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

// ─── Inline Artikel-Schnellanlage ─────────────────────────────────────────────

const DEFAULT_KATEGORIEN = ["Futter", "Duenger", "Saatgut", "Analysen", "Beratung", "Pflege"];
const DEFAULT_EINHEITEN = ["kg", "t", "l", "ml", "Stück", "Sack", "Big Bag", "Ballen", "Palette", "m²", "ha"];

function NeuArtikelInline({
  kiName,
  kiEinheit,
  lieferanten,
  onCreated,
  onCancel,
}: {
  kiName: string;
  kiEinheit?: string;
  lieferanten: LieferantRaw[];
  onCreated: (artikel: ArtikelRaw) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<NeuArtikelForm>({
    name: kiName,
    artikelnummer: "",
    einheit: kiEinheit ?? "kg",
    kategorie: "Futter",
    standardpreis: "",
    lieferantId: "",
    kiInhaltsstoffe: false,
  });
  const [saving, setSaving] = useState(false);
  const [kiSearching, setKiSearching] = useState(false);
  const [error, setError] = useState("");

  async function handleKiInhaltsstoffe() {
    setKiSearching(true);
    try {
      const res = await fetch("/api/ki/inhaltsstoffe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, kategorie: form.kategorie }),
      });
      if (!res.ok) throw new Error("KI-Suche fehlgeschlagen");
      // Inhaltsstoffe werden beim Anlegen mitgegeben — hier nur als Info
      setForm((f) => ({ ...f, kiInhaltsstoffe: true }));
    } catch {
      setError("KI-Suche nicht verfügbar");
    } finally {
      setKiSearching(false);
    }
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    setError("");
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        einheit: form.einheit,
        kategorie: form.kategorie,
        standardpreis: parseFloat(form.standardpreis) || 0,
        aktuellerBestand: 0,
        mindestbestand: 0,
        mwstSatz: 19,
      };
      if (form.artikelnummer) body.artikelnummer = form.artikelnummer;
      if (form.lieferantId) {
        body.lieferanten = [{ lieferantId: parseInt(form.lieferantId, 10), einkaufspreis: 0 }];
      }

      const res = await fetch("/api/artikel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Anlegen fehlgeschlagen");
      }
      const neuArtikel = await res.json();
      onCreated({
        id: neuArtikel.id,
        name: neuArtikel.name,
        artikelnummer: neuArtikel.artikelnummer ?? "",
        einheit: neuArtikel.einheit,
        standardpreis: neuArtikel.standardpreis ?? 0,
        aktuellerBestand: 0,
        mindestbestand: 0,
        kategorie: neuArtikel.kategorie,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Fehler");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 p-4 rounded-lg border border-blue-200 bg-blue-50 space-y-3">
      <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Neuen Artikel anlegen</p>

      {error && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Artikelname *</label>
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Artikelnummer</label>
          <input
            value={form.artikelnummer}
            onChange={(e) => setForm((f) => ({ ...f, artikelnummer: e.target.value }))}
            placeholder="Autom. vergeben"
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Kategorie</label>
          <select
            value={form.kategorie}
            onChange={(e) => setForm((f) => ({ ...f, kategorie: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {DEFAULT_KATEGORIEN.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Einheit</label>
          <input
            list="einheiten-list-neu"
            value={form.einheit}
            onChange={(e) => setForm((f) => ({ ...f, einheit: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <datalist id="einheiten-list-neu">
            {DEFAULT_EINHEITEN.map((e) => <option key={e} value={e} />)}
          </datalist>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Standardpreis (€)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.standardpreis}
            onChange={(e) => setForm((f) => ({ ...f, standardpreis: e.target.value }))}
            placeholder="0.00"
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Lieferant zuordnen</label>
          <select
            value={form.lieferantId}
            onChange={(e) => setForm((f) => ({ ...f, lieferantId: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">— kein Lieferant —</option>
            {lieferanten.map((l) => (
              <option key={l.id} value={String(l.id)}>{l.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 pt-1">
        <button
          type="button"
          onClick={handleKiInhaltsstoffe}
          disabled={kiSearching || !form.name}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-100 text-purple-700 hover:bg-purple-200 disabled:opacity-50 transition-colors"
        >
          {kiSearching ? (
            <span className="w-3 h-3 border-2 border-purple-700 border-t-transparent rounded-full animate-spin" />
          ) : "🤖"}
          {form.kiInhaltsstoffe ? "Inhaltsstoffe werden ergänzt ✓" : "KI-Inhaltsstoffe suchen"}
        </button>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !form.name.trim()}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
          >
            {saving && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            Anlegen & zuordnen
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

function KiLieferungWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  // Step 1
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");

  // Step 2
  const [kiErgebnis, setKiErgebnis] = useState<KiErgebnis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");

  // Step 3
  const [artikel, setArtikel] = useState<ArtikelRaw[]>([]);
  const [kunden, setKunden] = useState<KundeRaw[]>([]);
  const [lieferanten, setLieferanten] = useState<LieferantRaw[]>([]);
  const [kundeId, setKundeId] = useState("");
  const [kundKonfidenz, setKundKonfidenz] = useState<ZuordnungsPosition["konfidenz"]>("keine");
  const [positionen, setPositionen] = useState<ZuordnungsPosition[]>([]);
  const [datum, setDatum] = useState(() => new Date().toISOString().slice(0, 10));
  const [lieferStatus, setLieferStatus] = useState<"geplant" | "geliefert">("geplant");
  const [kundenSonderpreise, setKundenSonderpreise] = useState<Record<number, number>>({});

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
    if (!imagePreview) return;
    setAnalyzing(true);
    setAnalyzeError("");

    try {
      const [artikelRes, kundenRes, lieferantenRes, analyzeRes] = await Promise.all([
        fetch("/api/artikel?limit=500"),
        fetch("/api/kunden?limit=500"),
        fetch("/api/lieferanten?limit=200"),
        fetch("/api/ki/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image: imagePreview.includes(",") ? imagePreview.split(",")[1] : imagePreview,
            feature: "lieferung",
          }),
        }),
      ]);

      const artikelData = artikelRes.ok ? await artikelRes.json() : [];
      const kundenData = kundenRes.ok ? await kundenRes.json() : [];
      const lieferantenData = lieferantenRes.ok ? await lieferantenRes.json() : [];
      const analyzeData = await analyzeRes.json();

      if (!analyzeRes.ok) throw new Error(analyzeData.error || "KI-Analyse fehlgeschlagen");

      const artikelList: ArtikelRaw[] = Array.isArray(artikelData)
        ? artikelData
        : (artikelData.artikel ?? []);
      const kundenList: KundeRaw[] = Array.isArray(kundenData)
        ? kundenData
        : (kundenData.kunden ?? []);
      const lieferantenList: LieferantRaw[] = Array.isArray(lieferantenData)
        ? lieferantenData
        : (lieferantenData.lieferanten ?? []);

      setArtikel(artikelList);
      setKunden(kundenList);
      setLieferanten(lieferantenList);

      const ergebnis: KiErgebnis = analyzeData.ergebnis;
      setKiErgebnis(ergebnis);

      if (ergebnis.datum) setDatum(ergebnis.datum.slice(0, 10));

      const { kunde: matchedKunde, konfidenz: kk } = matchKunde(ergebnis.kunde, kundenList);
      setKundeId(matchedKunde ? String(matchedKunde.id) : "");
      setKundKonfidenz(matchedKunde ? kk : "keine");

      const zugeordnet: ZuordnungsPosition[] = ergebnis.positionen.map((pos) => {
        const { artikel: matchedArtikel, konfidenz } = matchArtikel(pos, artikelList);
        return {
          kiPosition: pos,
          artikelId: matchedArtikel ? String(matchedArtikel.id) : "",
          menge: pos.menge,
          verkaufspreis: pos.einzelpreis ?? (matchedArtikel ? matchedArtikel.standardpreis : 0),
          konfidenz: matchedArtikel ? konfidenz : "keine",
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
    field: "artikelId" | "menge" | "verkaufspreis",
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
        menge: 1,
        verkaufspreis: 0,
        konfidenz: "keine",
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

  // ── Step 4: Submit ────────────────────────────────────────────────────────

  async function handleSubmit() {
    const validPositionen = positionen.filter((p) => p.artikelId);
    if (!kundeId || validPositionen.length === 0) return;

    setSubmitting(true);
    setSubmitError("");

    try {
      const res = await fetch("/api/lieferungen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kundeId: parseInt(kundeId, 10),
          datum: datum ? new Date(datum + "T00:00:00").toISOString() : new Date().toISOString(),
          status: lieferStatus,
          positionen: validPositionen.map((p) => ({
            artikelId: parseInt(p.artikelId, 10),
            menge: p.menge,
            verkaufspreis: p.verkaufspreis,
          })),
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Fehler beim Anlegen");
      }
      const neu = await res.json();
      setErstellteId(neu.id ?? null);

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
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6 text-gray-900">KI-Lieferung anlegen</h1>
      <Stepper current={step > 3 ? 4 : step} />

      {/* ─── Step 1: Upload ─────────────────────────────────────────────── */}
      {step === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
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
                      <th className="px-4 py-2.5 text-left font-medium">Einheit</th>
                      <th className="px-4 py-2.5 text-right font-medium">Einzelpreis</th>
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
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{pos.menge}</td>
                        <td className="px-4 py-2.5 text-gray-500">{pos.einheit ?? "—"}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
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
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={pos.verkaufspreis}
                        onChange={(e) =>
                          updatePosition(idx, "verkaufspreis", parseFloat(e.target.value) || 0)
                        }
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-green-600"
                      />
                    </div>
                  </div>

                  {/* Inline Neu-Anlage */}
                  {pos.showNeuForm && (
                    <NeuArtikelInline
                      kiName={pos.kiPosition.name}
                      kiEinheit={pos.kiPosition.einheit}
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
                  <th className="px-4 py-2.5 text-right font-medium">VK-Preis</th>
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
                          {isNiedrig && (
                            <span className="text-xs text-amber-600">⚠ Niedriger Bestand</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {pos.menge} {art?.einheit ?? ""}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
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
                  <td colSpan={3} className="px-4 py-3 text-sm font-bold text-right text-gray-700">
                    Gesamtsumme (netto)
                  </td>
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
    </div>
  );
}

// ─── Default export mit Suspense-Boundary ─────────────────────────────────────

export default function KiLieferungPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-3xl mx-auto px-4 py-6">
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse mb-6" />
          <div className="h-64 bg-white rounded-xl border border-gray-200 animate-pulse" />
        </div>
      }
    >
      <KiLieferungWizard />
    </Suspense>
  );
}
