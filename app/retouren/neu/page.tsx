"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { formatEuro, resolveBevorzugtenEK } from "@/lib/utils";
import SearchableSelect from "@/components/SearchableSelect";
import * as Sentry from "@sentry/nextjs";

interface Lieferant {
  id: number;
  name: string;
}

interface ArtikelLieferantInfo {
  lieferantId: number;
  einkaufspreis: number;
  bevorzugt?: boolean;
}

interface Artikel {
  id: number;
  name: string;
  artikelnummer: string;
  einheit: string;
  aktuellerBestand: number;
  mindestbestand: number;
  lieferanten?: ArtikelLieferantInfo[];
}

interface Position {
  artikelId: string;
  menge: string;
  einkaufspreis: string;
  chargeNr: string;
}

const GRUENDE = ["Kommission", "Mangel", "Falschlieferung", "Sonstiges"];

function ekFuerLieferant(art: Artikel | undefined, lieferantId: number | null): number {
  if (!art?.lieferanten?.length) return 0;
  if (lieferantId) {
    const match = art.lieferanten.find((l) => l.lieferantId === lieferantId);
    if (match) return match.einkaufspreis;
  }
  return resolveBevorzugtenEK(art.lieferanten);
}

function NeueRetoureForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedLieferantId = searchParams.get("lieferantId") ?? "";

  const [lieferanten, setLieferanten] = useState<Lieferant[]>([]);
  const [artikel, setArtikel] = useState<Artikel[]>([]);

  const [lieferantId, setLieferantId] = useState(preselectedLieferantId);
  const [datum, setDatum] = useState(new Date().toISOString().split("T")[0]);
  const [grund, setGrund] = useState("Kommission");
  const [notiz, setNotiz] = useState("");
  const [positionen, setPositionen] = useState<Position[]>([
    { artikelId: "", menge: "", einkaufspreis: "", chargeNr: "" },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/lieferanten?limit=500")
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setLieferanten(Array.isArray(d) ? d : []))
      .catch((err) => {
        Sentry.captureException(err);
      });
    fetch("/api/artikel?limit=500")
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setArtikel(Array.isArray(d) ? d : []))
      .catch((err) => {
        Sentry.captureException(err);
      });
  }, []);

  const lieferantNum = lieferantId ? Number(lieferantId) : null;

  const lieferantOptions = lieferanten.map((l) => ({ value: String(l.id), label: l.name }));
  const artikelOptions = artikel.map((a) => ({
    value: String(a.id),
    label: a.name,
    sub: `${a.artikelnummer} · Bestand: ${a.aktuellerBestand} ${a.einheit}`,
  }));

  // Vorschlag: Artikel dieses Lieferanten, die noch auf Lager liegen (Restbestände nach Saison)
  const vorschlag = lieferantNum
    ? artikel.filter((a) => a.aktuellerBestand > 0 && a.lieferanten?.some((l) => l.lieferantId === lieferantNum))
    : [];

  function uebernehmeRestbestaende() {
    if (vorschlag.length === 0) return;
    setPositionen(vorschlag.map((a) => ({
      artikelId: String(a.id),
      menge: String(a.aktuellerBestand),
      einkaufspreis: String(ekFuerLieferant(a, lieferantNum)),
      chargeNr: "",
    })));
  }

  function handleArtikelChange(index: number, artId: string) {
    const art = artikel.find((a) => String(a.id) === artId);
    setPositionen((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        artikelId: artId,
        einkaufspreis: art ? String(ekFuerLieferant(art, lieferantNum)) : "",
      };
      return updated;
    });
  }

  function updatePosition(index: number, field: keyof Position, value: string) {
    setPositionen((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  function addPosition() {
    setPositionen((prev) => [...prev, { artikelId: "", menge: "", einkaufspreis: "", chargeNr: "" }]);
  }

  function removePosition(index: number) {
    setPositionen((prev) => prev.filter((_, i) => i !== index));
  }

  function gesamtBetrag(): number {
    return positionen.reduce((sum, pos) => {
      const p = parseFloat(pos.einkaufspreis) || 0;
      const m = parseFloat(pos.menge) || 0;
      return sum + m * p;
    }, 0);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!lieferantId) { setError("Bitte einen Lieferanten wählen."); return; }
    const validPositionen = positionen.filter(
      (p) => p.artikelId && parseFloat(p.menge) > 0 && (parseFloat(p.einkaufspreis) || 0) >= 0,
    );
    if (validPositionen.length === 0) { setError("Mindestens eine vollständige Position erforderlich."); return; }

    setSaving(true);
    try {
      const res = await fetch("/api/retouren", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lieferantId: Number(lieferantId),
          datum,
          grund,
          notiz: notiz.trim() || null,
          positionen: validPositionen.map((pos) => ({
            artikelId: Number(pos.artikelId),
            menge: parseFloat(pos.menge),
            einkaufspreis: parseFloat(pos.einkaufspreis) || 0,
            chargeNr: pos.chargeNr.trim() || null,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Fehler beim Speichern");
      router.push(`/retouren/${data.id}`);
    } catch (err) {
      Sentry.captureException(err);
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      setSaving(false);
    }
  }

  function lagerAmpel(art: Artikel | undefined) {
    if (!art) return null;
    if (art.aktuellerBestand <= 0) return <span className="text-red-600 text-xs">● Kein Lager</span>;
    return <span className="text-green-600 text-xs">● {art.aktuellerBestand} {art.einheit} auf Lager</span>;
  }

  return (
    <div className="max-w-4xl">
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/retouren" className="hover:text-green-700">Retouren</Link>
        <span>›</span>
        <span className="text-gray-900 font-medium">Neue Retoure</span>
      </nav>

      <h1 className="text-2xl font-bold text-gray-900 mb-1">Neue Retoure</h1>
      <p className="text-sm text-gray-500 mb-6">Ware zurück an den Lieferanten — bucht den Lagerbestand ab und erzeugt eine Lieferantengutschrift.</p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Stammdaten */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-900">Retouren-Daten</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lieferant <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                options={lieferantOptions}
                value={lieferantId}
                onChange={(v) => { setLieferantId(v); }}
                placeholder="Lieferant wählen…"
                required
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
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Grund</label>
            <select
              value={grund}
              onChange={(e) => setGrund(e.target.value)}
              className="w-full sm:w-1/2 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
            >
              {GRUENDE.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notiz</label>
            <textarea
              value={notiz}
              onChange={(e) => setNotiz(e.target.value)}
              rows={2}
              placeholder="z. B. Saison-Restmengen Kommissionsware…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 resize-none"
            />
          </div>
        </div>

        {/* Positionen */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-base font-semibold text-gray-900">Positionen</h2>
            {vorschlag.length > 0 && (
              <button
                type="button"
                onClick={uebernehmeRestbestaende}
                className="text-xs px-3 py-1.5 border border-green-300 text-green-700 rounded-lg hover:bg-green-50 transition-colors"
                title="Alle auf Lager liegenden Artikel dieses Lieferanten als Retoure übernehmen"
              >
                Restbestände übernehmen ({vorschlag.length})
              </button>
            )}
          </div>

          <div className="space-y-3">
            {positionen.map((pos, i) => {
              const artObj = artikel.find((a) => String(a.id) === pos.artikelId);
              const netto = (parseFloat(pos.menge) || 0) * (parseFloat(pos.einkaufspreis) || 0);
              return (
                <div key={i} className="border border-gray-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Position {i + 1}</span>
                    {positionen.length > 1 && (
                      <button type="button" onClick={() => removePosition(i)} className="text-xs text-red-500 hover:text-red-700">
                        Entfernen
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <label className="flex items-center justify-between text-xs font-medium text-gray-600 mb-1">
                        <span>Artikel <span className="text-red-500">*</span></span>
                        {lagerAmpel(artObj)}
                      </label>
                      <SearchableSelect
                        options={artikelOptions}
                        value={pos.artikelId}
                        onChange={(v) => handleArtikelChange(i, v)}
                        placeholder="Artikel wählen…"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Menge ({artObj?.einheit ?? "Einheit"})
                      </label>
                      <input
                        type="number" step="0.001" min="0"
                        value={pos.menge}
                        onChange={(e) => updatePosition(i, "menge", e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        EK-Preis (je {artObj?.einheit ?? "Einheit"})
                      </label>
                      <input
                        type="number" step="0.01" min="0"
                        value={pos.einkaufspreis}
                        onChange={(e) => updatePosition(i, "einkaufspreis", e.target.value)}
                        placeholder="0,00"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Charge / Los (optional)</label>
                      <input
                        type="text"
                        value={pos.chargeNr}
                        onChange={(e) => updatePosition(i, "chargeNr", e.target.value)}
                        placeholder="Chargennummer"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                      />
                    </div>
                  </div>

                  {netto > 0 && (
                    <div className="text-right text-sm text-gray-600">
                      Gutschrift: <span className="font-semibold text-gray-900">{formatEuro(netto)}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={addPosition}
            className="w-full py-2.5 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-green-400 hover:text-green-700 transition-colors"
          >
            + Position hinzufügen
          </button>

          <div className="border-t border-gray-200 pt-3 text-right">
            <span className="text-sm text-gray-600">Erwartete Lieferantengutschrift: </span>
            <span className="text-base font-bold text-gray-900">{formatEuro(gesamtBetrag())}</span>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
        )}

        <div className="flex gap-3 justify-end">
          <Link href="/retouren" className="px-5 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors">
            Abbrechen
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Speichere…" : "Retoure buchen"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function NeueRetourePage() {
  return (
    <Suspense fallback={<div className="text-center py-16 text-gray-400">Lade…</div>}>
      <NeueRetoureForm />
    </Suspense>
  );
}
