"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter } from "next/navigation";
import SearchableSelect from "@/components/SearchableSelect";
import CameraUpload from "@/components/CameraUpload";

// ---- Types ----------------------------------------------------------------

interface Artikel {
  id: number;
  name: string;
  artikelnummer: string;
  einheit: string;
  standardpreis: number;
  aktuellerBestand: number;
  mindestbestand: number;
}

interface Lieferant {
  id: number;
  name: string;
}

interface KiPosition {
  name: string;
  artikelnummer?: string;
  menge: number;
  einheit: string;
  einzelpreis?: number;
}

interface KiErgebnis {
  lieferant?: string;
  lieferscheinNr?: string;
  datum?: string;
  positionen: KiPosition[];
}

type Konfidenz = "exakt" | "teilweise" | "keine";

interface MatchedPosition {
  ki: KiPosition;
  artikelId: string;
  menge: number;
  einkaufspreis: number;
  konfidenz: Konfidenz;
}

// ---- Helper ---------------------------------------------------------------

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

function konfidenzBadge(k: Konfidenz) {
  if (k === "exakt")
    return (
      <span className="inline-block rounded-full px-2 py-0.5 text-xs bg-green-100 text-green-800 font-medium">
        Exakt
      </span>
    );
  if (k === "teilweise")
    return (
      <span className="inline-block rounded-full px-2 py-0.5 text-xs bg-amber-100 text-amber-800 font-medium">
        Teilweise
      </span>
    );
  return (
    <span className="inline-block rounded-full px-2 py-0.5 text-xs bg-red-100 text-red-800 font-medium">
      Nicht gefunden
    </span>
  );
}

function matchArtikel(ki: KiPosition, alle: Artikel[]): { artikelId: string; konfidenz: Konfidenz } {
  // 1. Exakter Artikelnummer-Match
  if (ki.artikelnummer) {
    const hit = alle.find(
      (a) => a.artikelnummer.toLowerCase() === ki.artikelnummer!.toLowerCase()
    );
    if (hit) return { artikelId: String(hit.id), konfidenz: "exakt" };
  }

  // 2. Name enthält den erkannten Namen (case-insensitive)
  const nameLower = ki.name.toLowerCase();
  const containsHit = alle.find(
    (a) =>
      a.name.toLowerCase().includes(nameLower) ||
      nameLower.includes(a.name.toLowerCase())
  );
  if (containsHit) return { artikelId: String(containsHit.id), konfidenz: "teilweise" };

  // 3. Teile des Namens stimmen überein
  const parts = nameLower.split(/\s+/).filter((p) => p.length > 3);
  for (const part of parts) {
    const partial = alle.find((a) => a.name.toLowerCase().includes(part));
    if (partial) return { artikelId: String(partial.id), konfidenz: "teilweise" };
  }

  return { artikelId: "", konfidenz: "keine" };
}

// ---- Stepper ---------------------------------------------------------------

const STEPS = ["Upload", "KI-Analyse", "Matching", "Bestätigung"];

function Stepper({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8 select-none">
      {STEPS.map((label, i) => {
        const active = i === current;
        const done = i < current;
        return (
          <div key={i} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${
                  done
                    ? "bg-green-700 border-green-700 text-white"
                    : active
                    ? "bg-white border-green-700 text-green-700"
                    : "bg-white border-gray-300 text-gray-400"
                }`}
              >
                {done ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={`mt-1 text-xs font-medium hidden sm:block ${
                  active ? "text-green-700" : done ? "text-green-600" : "text-gray-400"
                }`}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`w-10 sm:w-16 h-0.5 mx-1 transition-colors ${
                  done ? "bg-green-600" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---- Spinner ---------------------------------------------------------------

function Spinner() {
  return (
    <svg
      className="animate-spin h-8 w-8 text-green-700"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

// ---- Main Wizard Component ------------------------------------------------

function KiWareneingangWizard() {
  const router = useRouter();

  // Data
  const [artikel, setArtikel] = useState<Artikel[]>([]);
  const [lieferanten, setLieferanten] = useState<Lieferant[]>([]);

  // Step 1
  const [imageBase64, setImageBase64] = useState<string>("");
  const [imagePreview, setImagePreview] = useState<string>("");
  const [vorLieferantId, setVorLieferantId] = useState<string>("");

  // Step 2
  const [analysing, setAnalysing] = useState(false);
  const [kiErgebnis, setKiErgebnis] = useState<KiErgebnis | null>(null);
  const [analyseError, setAnalyseError] = useState<string>("");

  // Step 3
  const [lieferantId, setLieferantId] = useState<string>("");
  const [datum, setDatum] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [notiz, setNotiz] = useState<string>("");
  const [positionen, setPositionen] = useState<MatchedPosition[]>([]);

  // Step 4
  const [booking, setBooking] = useState(false);
  const [bookError, setBookError] = useState<string>("");

  // Current step
  const [step, setStep] = useState(0);

  // Load Artikel + Lieferanten once
  useEffect(() => {
    fetch("/api/artikel?limit=500")
      .then((r) => r.json())
      .then((data) => setArtikel(Array.isArray(data) ? data : data.artikel ?? []))
      .catch(() => {});
    fetch("/api/lieferanten")
      .then((r) => r.json())
      .then((data) => setLieferanten(Array.isArray(data) ? data : data.lieferanten ?? []))
      .catch(() => {});
  }, []);

  // ---- Step 2: KI Analyse --------------------------------------------------

  const runAnalyse = useCallback(async () => {
    setAnalysing(true);
    setAnalyseError("");
    try {
      const res = await fetch("/api/ki/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageBase64, feature: "wareneingang" }),
      });
      if (!res.ok) throw new Error(`Fehler ${res.status}`);
      const json = await res.json();
      const ergebnis: KiErgebnis = json.ergebnis ?? json;
      setKiErgebnis(ergebnis);

      // Pre-fill lieferant from KI or from step1 pre-selection
      if (vorLieferantId) {
        setLieferantId(vorLieferantId);
      } else if (ergebnis.lieferant) {
        const found = lieferanten.find((l) =>
          l.name.toLowerCase().includes(ergebnis.lieferant!.toLowerCase())
        );
        if (found) setLieferantId(String(found.id));
      }

      // Pre-fill datum
      if (ergebnis.datum) {
        const d = new Date(ergebnis.datum);
        if (!isNaN(d.getTime())) setDatum(d.toISOString().slice(0, 10));
      }

      // Build matched positions
      const matched: MatchedPosition[] = (ergebnis.positionen ?? []).map((ki) => {
        const { artikelId, konfidenz } = matchArtikel(ki, artikel);
        return {
          ki,
          artikelId,
          menge: ki.menge ?? 1,
          einkaufspreis: ki.einzelpreis ?? 0,
          konfidenz,
        };
      });
      setPositionen(matched);

      setStep(2);
    } catch (err: unknown) {
      setAnalyseError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setAnalysing(false);
    }
  }, [imageBase64, vorLieferantId, lieferanten, artikel]);

  // Trigger analyse directly (no useEffect race condition)
  const goToAnalyse = () => {
    setKiErgebnis(null);
    setStep(1);
    runAnalyse();
  };

  // ---- Step 3: position update helpers ------------------------------------

  const updatePosition = (idx: number, patch: Partial<MatchedPosition>) => {
    setPositionen((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  // ---- Step 4: Booking -----------------------------------------------------

  const handleBook = async () => {
    setBooking(true);
    setBookError("");
    try {
      const payload = {
        lieferantId: lieferantId ? parseInt(lieferantId, 10) : undefined,
        datum: datum ? new Date(datum).toISOString() : new Date().toISOString(),
        notiz,
        positionen: positionen
          .filter((p) => p.artikelId)
          .map((p) => ({
            artikelId: parseInt(p.artikelId, 10),
            menge: p.menge,
            einkaufspreis: p.einkaufspreis,
          })),
      };
      const res = await fetch("/api/lager/wareneingaenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Fehler ${res.status}`);
      }
      router.push("/lager");
    } catch (err: unknown) {
      setBookError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setBooking(false);
    }
  };

  // ---- Derived data --------------------------------------------------------

  const lieferantOptions = lieferanten.map((l) => ({
    value: String(l.id),
    label: l.name,
  }));

  const artikelOptions = artikel.map((a) => ({
    value: String(a.id),
    label: a.name,
    sub: a.artikelnummer,
  }));

  const artikelById = new Map(artikel.map((a) => [String(a.id), a]));

  const gueltigePositionen = positionen.filter((p) => p.artikelId);
  const gesamtsumme = gueltigePositionen.reduce(
    (s, p) => s + p.menge * p.einkaufspreis,
    0
  );

  const lieferantName =
    lieferantId ? (lieferanten.find((l) => String(l.id) === lieferantId)?.name ?? "—") : "—";

  // ---- Render --------------------------------------------------------------

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-2 text-gray-900">KI-Wareneingang</h1>
      <p className="text-gray-500 text-sm mb-6">
        Laden Sie ein Foto eines Lieferscheins hoch — die KI erkennt automatisch Artikel, Mengen und Preise.
      </p>

      <Stepper current={step} />

      {/* ======== STEP 0: Upload ======== */}
      {step === 0 && (
        <div className="border border-gray-200 rounded-xl p-6 bg-white space-y-6">
          <h2 className="text-lg font-semibold text-gray-800">Schritt 1: Lieferschein hochladen</h2>

          <CameraUpload
            onImageSelected={(file, preview) => {
              setImagePreview(preview);
              setImageBase64(preview.split(",")[1] ?? preview);
            }}
            imagePreview={imagePreview}
            imageName={"Lieferschein"}
            onRemove={() => {
              setImagePreview("");
              setImageBase64("");
            }}
          />

          {/* Optional Lieferant pre-selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Lieferant vorauswählen <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <SearchableSelect
              options={lieferantOptions}
              value={vorLieferantId}
              onChange={setVorLieferantId}
              placeholder="— Lieferant wählen —"
              allowClear
            />
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              disabled={!imageBase64}
              onClick={goToAnalyse}
              className="px-6 py-2.5 rounded-lg bg-green-700 text-white font-semibold text-sm disabled:opacity-40 hover:bg-green-800 transition-colors"
            >
              Weiter →
            </button>
          </div>
        </div>
      )}

      {/* ======== STEP 1: KI-Analyse ======== */}
      {step === 1 && (
        <div className="border border-gray-200 rounded-xl p-6 bg-white">
          <h2 className="text-lg font-semibold text-gray-800 mb-6">Schritt 2: KI-Analyse</h2>

          {analysing && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <Spinner />
              <p className="text-gray-600 font-medium">KI analysiert Lieferschein...</p>
              <p className="text-gray-400 text-sm">Bitte warten, das kann einige Sekunden dauern.</p>
            </div>
          )}

          {analyseError && !analysing && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
              <p className="font-semibold mb-1">Fehler bei der Analyse</p>
              <p>{analyseError}</p>
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => setStep(0)}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm hover:bg-gray-50"
                >
                  ← Zurück
                </button>
                <button
                  onClick={runAnalyse}
                  className="px-4 py-2 rounded-lg bg-green-700 text-white text-sm hover:bg-green-800"
                >
                  Erneut versuchen
                </button>
              </div>
            </div>
          )}

          {kiErgebnis && !analysing && (
            <div className="space-y-6">
              {/* Erkannte Metadaten */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-0.5">Lieferant (erkannt)</p>
                  <p className="font-medium text-gray-900 text-sm">
                    {kiErgebnis.lieferant ?? <span className="text-gray-400">—</span>}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-0.5">Lieferschein-Nr.</p>
                  <p className="font-medium text-gray-900 text-sm">
                    {kiErgebnis.lieferscheinNr ?? <span className="text-gray-400">—</span>}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-0.5">Datum</p>
                  <p className="font-medium text-gray-900 text-sm">
                    {kiErgebnis.datum ?? <span className="text-gray-400">—</span>}
                  </p>
                </div>
              </div>

              {/* Erkannte Positionen */}
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">
                  Erkannte Positionen ({kiErgebnis.positionen?.length ?? 0})
                </p>
                {kiErgebnis.positionen && kiErgebnis.positionen.length > 0 ? (
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                        <tr>
                          <th className="px-3 py-2 text-left">Artikel</th>
                          <th className="px-3 py-2 text-left hidden sm:table-cell">Artikelnr.</th>
                          <th className="px-3 py-2 text-right">Menge</th>
                          <th className="px-3 py-2 text-left hidden sm:table-cell">Einheit</th>
                          <th className="px-3 py-2 text-right hidden sm:table-cell">EK-Preis</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {kiErgebnis.positionen.map((p, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-3 py-2 font-medium text-gray-900">{p.name}</td>
                            <td className="px-3 py-2 text-gray-500 hidden sm:table-cell">
                              {p.artikelnummer ?? "—"}
                            </td>
                            <td className="px-3 py-2 text-right">{p.menge}</td>
                            <td className="px-3 py-2 text-gray-500 hidden sm:table-cell">
                              {p.einheit}
                            </td>
                            <td className="px-3 py-2 text-right hidden sm:table-cell">
                              {p.einzelpreis != null
                                ? `${p.einzelpreis.toFixed(2)} €`
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm">Keine Positionen erkannt.</p>
                )}
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => setStep(0)}
                  className="px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  ← Zurück
                </button>
                <button
                  onClick={() => setStep(2)}
                  className="px-6 py-2.5 rounded-lg bg-green-700 text-white font-semibold text-sm hover:bg-green-800 transition-colors"
                >
                  Weiter →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======== STEP 2: Artikel-Matching ======== */}
      {step === 2 && (
        <div className="border border-gray-200 rounded-xl p-6 bg-white space-y-6">
          <h2 className="text-lg font-semibold text-gray-800">Schritt 3: Artikel-Matching</h2>

          {/* Lieferant + Datum + Notiz */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lieferant</label>
              <SearchableSelect
                options={lieferantOptions}
                value={lieferantId}
                onChange={setLieferantId}
                placeholder="— Lieferant wählen —"
                allowClear
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Datum</label>
              <input
                type="date"
                value={datum}
                onChange={(e) => setDatum(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notiz</label>
              <input
                type="text"
                value={notiz}
                onChange={(e) => setNotiz(e.target.value)}
                placeholder="Optionale Notiz zum Wareneingang"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>
          </div>

          {/* Positionen Matching Tabelle */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">
              Positionen zuordnen
            </p>
            {positionen.length === 0 ? (
              <p className="text-gray-400 text-sm">Keine Positionen zu matchen.</p>
            ) : (
              <div className="space-y-3">
                {positionen.map((pos, idx) => {
                  const zugeordneterArtikel = pos.artikelId ? artikelById.get(pos.artikelId) : undefined;
                  return (
                    <div
                      key={idx}
                      className="border border-gray-200 rounded-lg p-4 space-y-3"
                    >
                      {/* Header row */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 text-sm">
                            {pos.ki.name}
                          </span>
                          {pos.ki.artikelnummer && (
                            <span className="text-xs text-gray-400">{pos.ki.artikelnummer}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {konfidenzBadge(pos.konfidenz)}
                        </div>
                      </div>

                      {/* Matching row */}
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                        {/* Artikel-Zuordnung */}
                        <div className="sm:col-span-2">
                          <label className="block text-xs text-gray-500 mb-1">Zugeordneter Artikel</label>
                          <SearchableSelect
                            options={artikelOptions}
                            value={pos.artikelId}
                            onChange={(v) =>
                              updatePosition(idx, {
                                artikelId: v,
                                konfidenz: v
                                  ? v === pos.artikelId
                                    ? pos.konfidenz
                                    : "teilweise"
                                  : "keine",
                              })
                            }
                            placeholder="— Artikel wählen —"
                            allowClear
                          />
                          {zugeordneterArtikel && (
                            <div className="mt-1">{lagerAmpel(zugeordneterArtikel)}</div>
                          )}
                          {!pos.artikelId && (
                            <a
                              href="/artikel/neu"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-block mt-1 text-xs text-green-700 underline hover:text-green-900"
                            >
                              + Neuen Artikel anlegen
                            </a>
                          )}
                        </div>

                        {/* Menge */}
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">
                            Menge{pos.ki.einheit ? ` (${pos.ki.einheit})` : ""}
                          </label>
                          <input
                            type="number"
                            min={0}
                            step="any"
                            value={pos.menge}
                            onChange={(e) =>
                              updatePosition(idx, { menge: parseFloat(e.target.value) || 0 })
                            }
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                          />
                        </div>

                        {/* EK-Preis */}
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">EK-Preis (€)</label>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={pos.einkaufspreis}
                            onChange={(e) =>
                              updatePosition(idx, {
                                einkaufspreis: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-between">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              ← Zurück
            </button>
            <button
              onClick={() => setStep(3)}
              className="px-6 py-2.5 rounded-lg bg-green-700 text-white font-semibold text-sm hover:bg-green-800 transition-colors"
            >
              Weiter →
            </button>
          </div>
        </div>
      )}

      {/* ======== STEP 3: Bestätigung ======== */}
      {step === 3 && (
        <div className="border border-gray-200 rounded-xl p-6 bg-white space-y-6">
          <h2 className="text-lg font-semibold text-gray-800">Schritt 4: Bestätigung</h2>

          {/* Zusammenfassung */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-0.5">Lieferant</p>
              <p className="font-medium text-gray-900 text-sm">{lieferantName}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-0.5">Datum</p>
              <p className="font-medium text-gray-900 text-sm">
                {datum
                  ? new Date(datum + "T00:00:00").toLocaleDateString("de-DE")
                  : "—"}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-0.5">Positionen</p>
              <p className="font-medium text-gray-900 text-sm">
                {gueltigePositionen.length} von {positionen.length}
                {positionen.length - gueltigePositionen.length > 0 && (
                  <span className="text-amber-600 text-xs ml-1">
                    ({positionen.length - gueltigePositionen.length} ohne Zuordnung)
                  </span>
                )}
              </p>
            </div>
          </div>

          {notiz && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-2 text-sm text-blue-800">
              <span className="font-medium">Notiz:</span> {notiz}
            </div>
          )}

          {/* Positions-Tabelle */}
          {gueltigePositionen.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left">Artikel</th>
                    <th className="px-3 py-2 text-right">Menge</th>
                    <th className="px-3 py-2 text-right hidden sm:table-cell">EK-Preis</th>
                    <th className="px-3 py-2 text-right">Summe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {gueltigePositionen.map((pos, i) => {
                    const a = artikelById.get(pos.artikelId);
                    const summe = pos.menge * pos.einkaufspreis;
                    return (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium text-gray-900">
                          {a?.name ?? pos.ki.name}
                          <div className="text-xs text-gray-400">{a?.artikelnummer}</div>
                        </td>
                        <td className="px-3 py-2 text-right">
                          {pos.menge} {a?.einheit ?? pos.ki.einheit}
                        </td>
                        <td className="px-3 py-2 text-right hidden sm:table-cell">
                          {pos.einkaufspreis.toFixed(2)} €
                        </td>
                        <td className="px-3 py-2 text-right font-medium">
                          {summe.toFixed(2)} €
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                  <tr>
                    <td colSpan={2} className="px-3 py-2 text-right font-semibold text-gray-700 text-sm sm:hidden">
                      Gesamt
                    </td>
                    <td colSpan={3} className="px-3 py-2 text-right font-bold text-gray-900 hidden sm:table-cell">
                      Gesamtsumme
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-gray-900">
                      {gesamtsumme.toFixed(2)} €
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-700 text-sm">
              Keine Positionen mit gültigem Artikel zum Buchen vorhanden. Bitte gehen Sie zurück und ordnen Sie mindestens einen Artikel zu.
            </div>
          )}

          {bookError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
              {bookError}
            </div>
          )}

          <div className="flex justify-between">
            <button
              onClick={() => setStep(2)}
              disabled={booking}
              className="px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-40"
            >
              ← Zurück
            </button>
            <button
              onClick={handleBook}
              disabled={booking || gueltigePositionen.length === 0}
              className="px-6 py-2.5 rounded-lg bg-green-700 text-white font-bold text-sm hover:bg-green-800 transition-colors disabled:opacity-40 flex items-center gap-2"
            >
              {booking && <Spinner />}
              {booking ? "Wird gebucht…" : "Wareneingang buchen"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Default export with Suspense boundary --------------------------------

export default function KiWareneingangPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <svg
            className="animate-spin h-8 w-8 text-green-700"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        </div>
      }
    >
      <KiWareneingangWizard />
    </Suspense>
  );
}
