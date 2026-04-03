"use client";

import { useState, useRef, useCallback, Suspense } from "react";
import { useRouter } from "next/navigation";
import SearchableSelect from "@/components/SearchableSelect";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ArtikelRaw {
  id: number;
  name: string;
  artikelnummer: string;
  einheit: string;
  standardpreis: number;
  aktuellerBestand: number;
  mindestbestand: number;
}

interface KundeRaw {
  id: number;
  name: string;
  firma?: string;
  ort?: string;
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

  // 1. Exakter Artikelnummer-Match
  if (kiPos.artikelnummer) {
    const exact = artikel.find(
      (a) => a.artikelnummer.toLowerCase() === kiPos.artikelnummer!.toLowerCase()
    );
    if (exact) return { artikel: exact, konfidenz: "hoch" };
  }

  const nameLower = kiPos.name.toLowerCase();

  // 2. Name enthält (vollständig)
  const nameContains = artikel.find((a) => a.name.toLowerCase().includes(nameLower));
  if (nameContains) return { artikel: nameContains, konfidenz: "mittel" };

  // 3. Teilwort-Match
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

  // Enthält-Match auf Name oder Firma
  const match = kunden.find(
    (k) =>
      k.name.toLowerCase().includes(search) ||
      (k.firma && k.firma.toLowerCase().includes(search)) ||
      search.includes(k.name.toLowerCase())
  );

  if (match) return { kunde: match, konfidenz: "hoch" };

  // Teilwort
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

// ─── Main Component ───────────────────────────────────────────────────────────

function KiLieferungWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  // Step 1
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2
  const [kiErgebnis, setKiErgebnis] = useState<KiErgebnis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");

  // Step 3
  const [artikel, setArtikel] = useState<ArtikelRaw[]>([]);
  const [kunden, setKunden] = useState<KundeRaw[]>([]);
  const [kundeId, setKundeId] = useState("");
  const [kundKonfidenz, setKundKonfidenz] = useState<ZuordnungsPosition["konfidenz"]>("keine");
  const [positionen, setPositionen] = useState<ZuordnungsPosition[]>([]);
  const [datum, setDatum] = useState(() => new Date().toISOString().slice(0, 10));

  // Step 4
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // ── File handling ──────────────────────────────────────────────────────────

  function handleFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []);

  // ── Step 1 → 2: Analyse ───────────────────────────────────────────────────

  async function runAnalysis() {
    if (!imagePreview) return;
    setAnalyzing(true);
    setAnalyzeError("");

    try {
      // Fetch Artikel + Kunden in parallel while analyzing
      const [artikelRes, kundenRes, analyzeRes] = await Promise.all([
        fetch("/api/artikel?limit=500"),
        fetch("/api/kunden?limit=500"),
        fetch("/api/ki/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: imagePreview, feature: "lieferung" }),
        }),
      ]);

      const artikelData = await artikelRes.json();
      const kundenData = await kundenRes.json();
      const analyzeData = await analyzeRes.json();

      if (!analyzeRes.ok) throw new Error(analyzeData.error || "KI-Analyse fehlgeschlagen");

      const artikelList: ArtikelRaw[] = artikelData.artikel ?? artikelData ?? [];
      const kundenList: KundeRaw[] = kundenData.kunden ?? kundenData ?? [];

      setArtikel(artikelList);
      setKunden(kundenList);

      const ergebnis: KiErgebnis = analyzeData.ergebnis;
      setKiErgebnis(ergebnis);

      if (ergebnis.datum) setDatum(ergebnis.datum.slice(0, 10));

      // Auto-match Kunde
      const { kunde: matchedKunde, konfidenz: kk } = matchKunde(ergebnis.kunde, kundenList);
      setKundeId(matchedKunde ? String(matchedKunde.id) : "");
      setKundKonfidenz(matchedKunde ? kk : "keine");

      // Auto-match Artikel
      const zugeordnet: ZuordnungsPosition[] = ergebnis.positionen.map((pos) => {
        const { artikel: matchedArtikel, konfidenz } = matchArtikel(pos, artikelList);
        return {
          kiPosition: pos,
          artikelId: matchedArtikel ? String(matchedArtikel.id) : "",
          menge: pos.menge,
          verkaufspreis:
            pos.einzelpreis ??
            (matchedArtikel ? matchedArtikel.standardpreis : 0),
          konfidenz: matchedArtikel ? konfidenz : "keine",
        };
      });
      setPositionen(zugeordnet);

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

  // ── Step 3: update position ────────────────────────────────────────────────

  function updatePosition(idx: number, field: "artikelId" | "menge" | "verkaufspreis", val: string | number) {
    setPositionen((prev) =>
      prev.map((p, i) => {
        if (i !== idx) return p;
        const updated = { ...p, [field]: val };
        // When artikelId changes, update price from artikel list
        if (field === "artikelId") {
          const found = artikel.find((a) => String(a.id) === String(val));
          updated.verkaufspreis = found ? found.standardpreis : 0;
          updated.konfidenz = found ? "hoch" : "keine";
        }
        return updated;
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
          datum,
          status: "geplant",
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
      router.push("/lieferungen");
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setSubmitting(false);
    }
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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6 text-gray-900">KI-Lieferung anlegen</h1>
      <Stepper current={step} />

      {/* ─── Step 1: Upload ─────────────────────────────────────────────── */}
      {step === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-800">Bild hochladen</h2>
          <p className="text-sm text-gray-500 mb-6">
            Lade ein Foto einer Bestellung, eines Lieferscheins oder einer handschriftlichen
            Notiz hoch. Die KI erkennt Kunde, Artikel und Mengen automatisch.
          </p>

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center cursor-pointer transition-colors
              ${isDragging ? "border-green-500 bg-green-50" : "border-gray-300 hover:border-green-400 hover:bg-gray-50"}
            `}
          >
            {imagePreview ? (
              <img
                src={imagePreview}
                alt="Vorschau"
                className="max-h-56 max-w-full rounded-lg object-contain mb-3 shadow"
              />
            ) : (
              <svg
                className="w-14 h-14 text-gray-300 mb-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            )}
            <p className="text-sm text-gray-500">
              {imagePreview ? imageFile?.name : "Bild hierher ziehen oder klicken zum Auswählen"}
            </p>
            {imagePreview && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setImageFile(null);
                  setImagePreview("");
                }}
                className="mt-2 text-xs text-red-500 hover:text-red-700 underline"
              >
                Entfernen
              </button>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
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
              {/* Erkannter Kunde */}
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

              {/* Erkannte Positionen */}
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
          <div className="mb-6 p-4 rounded-lg border border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Kunde
              </p>
              <KonfidenzBadge k={kundKonfidenz} />
            </div>
            {kiErgebnis && (
              <p className="text-xs text-gray-400 mb-2">
                KI erkannt: <span className="font-medium text-gray-600">{kiErgebnis.kunde.firma ?? kiErgebnis.kunde.name}</span>
              </p>
            )}
            <SearchableSelect
              options={kundenOptions}
              value={kundeId}
              onChange={(v) => {
                setKundeId(v);
                setKundKonfidenz(v ? "hoch" : "keine");
              }}
              placeholder="Kunde auswählen…"
              allowClear
            />
          </div>

          {/* Datum */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">Lieferdatum</label>
            <input
              type="date"
              value={datum}
              onChange={(e) => setDatum(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 w-full sm:w-48"
            />
          </div>

          {/* Positionen */}
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Artikel-Positionen
          </p>
          <div className="space-y-4">
            {positionen.map((pos, idx) => {
              const gefundenerArtikel = artikel.find((a) => String(a.id) === pos.artikelId);
              return (
                <div key={idx} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{pos.kiPosition.name}</p>
                      {pos.kiPosition.artikelnummer && (
                        <p className="text-xs text-gray-400">Nr: {pos.kiPosition.artikelnummer}</p>
                      )}
                    </div>
                    <KonfidenzBadge k={pos.konfidenz} />
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
                        <div className="mt-1">{lagerAmpel(gefundenerArtikel)}</div>
                      )}
                      {!pos.artikelId && (
                        <a
                          href="/artikel/neu"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline mt-1 inline-block"
                        >
                          + Neuen Artikel anlegen
                        </a>
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
                </div>
              );
            })}
          </div>

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

          {/* Kopfdaten */}
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
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                Geplant
              </span>
            </div>
          </div>

          {/* Positionen-Tabelle */}
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
                    return (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5">
                          <p className="font-medium text-gray-900">{art?.name ?? pos.kiPosition.name}</p>
                          {art && (
                            <p className="text-xs text-gray-400">{art.artikelnummer}</p>
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
