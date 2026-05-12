"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import SearchableSelect from "@/components/SearchableSelect";

interface Artikel {
  id: number;
  name: string;
  artikelnummer: string | null;
  kategorie: string | null;
  einheit: string;
  standardpreis: number;
}

interface Lieferant {
  id: number;
  name: string;
}

interface ArtikelLieferant {
  lieferantId: number;
  lieferant: { id: number; name: string };
}

interface ArtikelMitLieferant extends Artikel {
  lieferanten?: ArtikelLieferant[];
}

interface Kunde {
  id: number;
  name: string;
  firma: string | null;
  ort: string | null;
}

interface BedarfRow {
  id: number;
  kundeId: number;
  artikelId: number;
  menge: number;
  intervallTage: number;
  notiz: string | null;
  kunde: Kunde;
  artikel: { id: number; name: string; einheit: string; standardpreis: number };
}

interface PositionRow {
  kundeId: number;
  kundeName: string;
  menge: number;
  fromBedarf: boolean;
}

type Step = 1 | 2 | 3;

function fmt(n: number) {
  return n.toLocaleString("de-DE", { maximumFractionDigits: 2 });
}

export default function SammelbestellungPage() {
  const [step, setStep] = useState<Step>(1);

  // Step 1
  const [artikel, setArtikel] = useState<ArtikelMitLieferant[]>([]);
  const [lieferanten, setLieferanten] = useState<Lieferant[]>([]);
  const [selectedArtikelId, setSelectedArtikelId] = useState("");
  const [selectedLieferantId, setSelectedLieferantId] = useState("");
  const [loadingArtikel, setLoadingArtikel] = useState(false);

  // Step 2
  const [bedarfe, setBedarfe] = useState<BedarfRow[]>([]);
  const [positionen, setPositionen] = useState<PositionRow[]>([]);
  const [loadingBedarfe, setLoadingBedarfe] = useState(false);
  const [alleKunden, setAlleKunden] = useState<Kunde[]>([]);
  const [addKundeId, setAddKundeId] = useState("");

  // Step 3
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ id: number; nummer: string } | null>(null);
  const [saveError, setSaveError] = useState("");

  // Load articles and suppliers once
  useEffect(() => {
    setLoadingArtikel(true);
    Promise.all([
      fetch("/api/artikel?limit=500").then((r) => r.json()),
      fetch("/api/lieferanten").then((r) => r.json()),
      fetch("/api/kunden?limit=500&aktiv=true").then((r) => r.json()),
    ])
      .then(([artData, liefData, kundenData]) => {
        setArtikel(Array.isArray(artData) ? artData : (artData.artikel ?? []));
        setLieferanten(Array.isArray(liefData) ? liefData : []);
        const kunden = Array.isArray(kundenData) ? kundenData : (kundenData.kunden ?? []);
        setAlleKunden(kunden);
      })
      .catch(() => {})
      .finally(() => setLoadingArtikel(false));
  }, []);

  const selectedArtikel = artikel.find((a) => String(a.id) === selectedArtikelId);

  // When artikel is selected, pre-fill lieferant
  useEffect(() => {
    if (!selectedArtikel) return;
    if (selectedArtikel.lieferanten && selectedArtikel.lieferanten.length > 0) {
      setSelectedLieferantId(String(selectedArtikel.lieferanten[0].lieferantId));
    }
  }, [selectedArtikel]);

  // Load Bedarfe when artikel is selected
  const loadBedarfe = useCallback(async (artikelId: string) => {
    if (!artikelId) return;
    setLoadingBedarfe(true);
    try {
      const res = await fetch(`/api/bestellungen/sammel?artikelId=${artikelId}`);
      if (!res.ok) throw new Error("Fehler");
      const data: BedarfRow[] = await res.json();
      setBedarfe(Array.isArray(data) ? data : []);
      // Pre-fill positionen from bedarfe
      const rows: PositionRow[] = (Array.isArray(data) ? data : []).map((b) => ({
        kundeId: b.kundeId,
        kundeName: b.kunde.firma ?? b.kunde.name,
        menge: b.menge,
        fromBedarf: true,
      }));
      setPositionen(rows);
    } catch {
      setBedarfe([]);
    } finally {
      setLoadingBedarfe(false);
    }
  }, []);

  function goToStep2() {
    if (!selectedArtikelId || !selectedLieferantId) return;
    loadBedarfe(selectedArtikelId);
    setStep(2);
  }

  function addKunde() {
    if (!addKundeId) return;
    const kid = parseInt(addKundeId, 10);
    if (positionen.find((p) => p.kundeId === kid)) {
      setAddKundeId("");
      return;
    }
    const kunde = alleKunden.find((k) => k.id === kid);
    if (!kunde) return;
    setPositionen((prev) => [
      ...prev,
      {
        kundeId: kunde.id,
        kundeName: kunde.firma ?? kunde.name,
        menge: 0,
        fromBedarf: false,
      },
    ]);
    setAddKundeId("");
  }

  function updateMenge(kundeId: number, val: string) {
    const n = parseFloat(val.replace(",", "."));
    setPositionen((prev) =>
      prev.map((p) => (p.kundeId === kundeId ? { ...p, menge: isNaN(n) ? 0 : n } : p))
    );
  }

  function removePosition(kundeId: number) {
    setPositionen((prev) => prev.filter((p) => p.kundeId !== kundeId));
  }

  const aktivPositionen = positionen.filter((p) => p.menge > 0);
  const gesamtMenge = aktivPositionen.reduce((s, p) => s + p.menge, 0);

  async function anlegen() {
    if (!selectedArtikelId || !selectedLieferantId || aktivPositionen.length === 0) return;
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch("/api/bestellungen/sammel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artikelId: parseInt(selectedArtikelId, 10),
          lieferantId: parseInt(selectedLieferantId, 10),
          positionen: aktivPositionen.map((p) => ({ kundeId: p.kundeId, menge: p.menge })),
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Fehler");
      }
      const d = await res.json();
      setResult({ id: d.id, nummer: d.nummer });
      setStep(3);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setSaving(false);
    }
  }

  const selectedLieferant = lieferanten.find((l) => String(l.id) === selectedLieferantId);

  // Kunden die noch nicht in Positionen sind
  const verfuegbareKunden = alleKunden.filter(
    (k) => !positionen.find((p) => p.kundeId === k.id)
  );

  return (
    <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Sammelbestellung</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Mehrere Kunden in einer Lieferantenbestellung zusammenfassen
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {([1, 2, 3] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${
                step === s
                  ? "bg-green-700 border-green-700 text-white"
                  : step > s
                  ? "bg-green-100 border-green-400 text-green-700"
                  : "bg-gray-100 border-gray-300 text-gray-400"
              }`}
            >
              {s}
            </div>
            <span
              className={`text-sm font-medium ${
                step === s ? "text-green-800" : "text-gray-400"
              }`}
            >
              {s === 1 ? "Artikel & Lieferant" : s === 2 ? "Kunden & Mengen" : "Bestätigen"}
            </span>
            {i < 2 && <div className="flex-1 h-px bg-gray-200 mx-2 w-8" />}
          </div>
        ))}
      </div>

      {/* ─── Step 1 ─── */}
      {step === 1 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <h2 className="text-base font-semibold text-gray-800">Schritt 1: Artikel & Lieferant wählen</h2>

          {loadingArtikel ? (
            <p className="text-sm text-gray-500">Wird geladen…</p>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Artikel <span className="text-red-500">*</span>
                </label>
                <SearchableSelect
                  options={artikel.map((a) => ({
                    value: String(a.id),
                    label: a.name,
                    sub: [a.kategorie, a.artikelnummer].filter(Boolean).join(" · "),
                  }))}
                  value={selectedArtikelId}
                  onChange={(v) => {
                    setSelectedArtikelId(v);
                    setSelectedLieferantId("");
                  }}
                  placeholder="Artikel suchen…"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Lieferant <span className="text-red-500">*</span>
                </label>
                <SearchableSelect
                  options={lieferanten.map((l) => ({ value: String(l.id), label: l.name }))}
                  value={selectedLieferantId}
                  onChange={setSelectedLieferantId}
                  placeholder="Lieferant suchen…"
                />
              </div>

              {selectedArtikel && (
                <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
                  <strong>{selectedArtikel.name}</strong> · {selectedArtikel.einheit} ·{" "}
                  {selectedArtikel.standardpreis.toLocaleString("de-DE", {
                    style: "currency",
                    currency: "EUR",
                  })}{" "}
                  / {selectedArtikel.einheit}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={goToStep2}
                  disabled={!selectedArtikelId || !selectedLieferantId}
                  className="px-5 py-2 bg-green-700 text-white rounded-lg font-medium hover:bg-green-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Weiter →
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── Step 2 ─── */}
      {step === 2 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-800">Schritt 2: Kunden & Mengen</h2>
            <button onClick={() => setStep(1)} className="text-sm text-gray-400 hover:text-gray-600">
              ← Zurück
            </button>
          </div>

          <div className="bg-green-50 rounded-lg p-3 text-sm text-green-800">
            <strong>Artikel:</strong> {selectedArtikel?.name} ·{" "}
            <strong>Lieferant:</strong> {selectedLieferant?.name}
          </div>

          {loadingBedarfe ? (
            <p className="text-sm text-gray-500">Bedarfe werden geladen…</p>
          ) : (
            <>
              {bedarfe.length > 0 && (
                <p className="text-sm text-gray-500">
                  {bedarfe.length} Kunden mit aktivem Bedarf vorbelegt.
                </p>
              )}
              {bedarfe.length === 0 && positionen.length === 0 && (
                <p className="text-sm text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                  Keine Kunden mit aktivem Bedarf für diesen Artikel. Füge Kunden manuell hinzu.
                </p>
              )}

              {/* Positions table */}
              {positionen.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-500 uppercase tracking-wide bg-gray-50">
                        <th className="px-3 py-2">Kunde</th>
                        <th className="px-3 py-2 text-right">
                          Menge ({selectedArtikel?.einheit})
                        </th>
                        <th className="px-3 py-2 text-center">Aus Bedarf</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {positionen.map((p) => (
                        <tr key={p.kundeId} className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-medium text-gray-800">{p.kundeName}</td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={p.menge === 0 ? "" : p.menge}
                              onChange={(e) => updateMenge(p.kundeId, e.target.value)}
                              placeholder="0"
                              className="w-24 text-right border border-gray-300 rounded px-2 py-1 text-sm focus:border-green-400 focus:outline-none"
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            {p.fromBedarf ? (
                              <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Bedarf</span>
                            ) : (
                              <span className="text-xs text-gray-400">manuell</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              onClick={() => removePosition(p.kundeId)}
                              className="text-gray-300 hover:text-red-500"
                              title="Entfernen"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Add customer */}
              <div className="flex flex-wrap items-end gap-3 pt-2 border-t border-gray-100">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs text-gray-500 mb-1">Weiteren Kunden hinzufügen</label>
                  <SearchableSelect
                    options={verfuegbareKunden.map((k) => ({
                      value: String(k.id),
                      label: k.firma ?? k.name,
                      sub: k.ort ?? undefined,
                    }))}
                    value={addKundeId}
                    onChange={setAddKundeId}
                    placeholder="Kunden suchen…"
                    allowClear
                  />
                </div>
                <button
                  onClick={addKunde}
                  disabled={!addKundeId}
                  className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-40"
                >
                  + Hinzufügen
                </button>
              </div>

              {/* Gesamtmenge */}
              <div className="bg-green-50 rounded-lg px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-green-800 font-medium">Gesamtmenge</span>
                <span className="text-xl font-bold text-green-800">
                  {fmt(gesamtMenge)} {selectedArtikel?.einheit}
                </span>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(3)}
                  disabled={aktivPositionen.length === 0 || gesamtMenge <= 0}
                  className="px-5 py-2 bg-green-700 text-white rounded-lg font-medium hover:bg-green-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Weiter →
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── Step 3 ─── */}
      {step === 3 && !result && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-800">Schritt 3: Zusammenfassung</h2>
            <button onClick={() => setStep(2)} className="text-sm text-gray-400 hover:text-gray-600">
              ← Zurück
            </button>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-1.5 border-b border-gray-100">
              <span className="text-gray-500">Artikel</span>
              <span className="font-medium text-gray-800">{selectedArtikel?.name}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-gray-100">
              <span className="text-gray-500">Lieferant</span>
              <span className="font-medium text-gray-800">{selectedLieferant?.name}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-gray-100">
              <span className="text-gray-500">Gesamtmenge</span>
              <span className="text-xl font-bold text-green-700">
                {fmt(gesamtMenge)} {selectedArtikel?.einheit}
              </span>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Aufschlüsselung pro Kunde</h3>
            <div className="rounded-lg border border-gray-100 overflow-hidden">
              {aktivPositionen.map((p, i) => (
                <div
                  key={p.kundeId}
                  className={`flex justify-between px-3 py-2 text-sm ${
                    i % 2 === 0 ? "bg-gray-50" : "bg-white"
                  }`}
                >
                  <span className="text-gray-700">{p.kundeName}</span>
                  <span className="font-medium text-gray-800">
                    {fmt(p.menge)} {selectedArtikel?.einheit}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {saveError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
              {saveError}
            </div>
          )}

          <button
            onClick={anlegen}
            disabled={saving}
            className="w-full py-3 bg-green-700 text-white rounded-lg font-semibold hover:bg-green-800 disabled:opacity-50 transition-colors"
          >
            {saving ? "Wird angelegt…" : "Sammelbestellung anlegen"}
          </button>
        </div>
      )}

      {/* ─── Success ─── */}
      {step === 3 && result && (
        <div className="bg-white rounded-xl border border-green-200 p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-800">Sammelbestellung angelegt</h2>
          <p className="text-gray-500 text-sm">
            Bestellung <strong>{result.nummer}</strong> wurde erfolgreich erstellt.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href={`/bestellungen/${result.id}`}
              className="px-5 py-2 bg-green-700 text-white rounded-lg font-medium hover:bg-green-800 transition-colors"
            >
              Bestellung ansehen
            </Link>
            <button
              onClick={() => {
                setStep(1);
                setResult(null);
                setSelectedArtikelId("");
                setSelectedLieferantId("");
                setPositionen([]);
                setBedarfe([]);
                setSaveError("");
              }}
              className="px-5 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              Neue Sammelbestellung
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
