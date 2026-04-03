"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import SearchableSelect from "@/components/SearchableSelect";

interface Kunde {
  id: number;
  name: string;
  firma: string | null;
}

interface Artikel {
  id: number;
  name: string;
  artikelnummer: string;
  einheit: string;
  standardpreis: number;
  aktuellerBestand: number;
  mindestbestand: number;
}

interface KundeBedarf {
  id: number;
  artikelId: number;
  menge: number;
  intervallTage: number;
  notiz?: string | null;
  aktiv: boolean;
  artikel: Artikel;
}

function LagerAmpel({ art }: { art: Artikel | undefined }) {
  if (!art) return null;
  if (art.aktuellerBestand <= 0) {
    return (
      <div className="flex items-center gap-1 mt-1">
        <span className="inline-block w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
        <span className="text-xs text-red-600">Kein Lager</span>
      </div>
    );
  }
  if (art.aktuellerBestand < art.mindestbestand) {
    return (
      <div className="flex items-center gap-1 mt-1">
        <span className="inline-block w-2 h-2 rounded-full bg-yellow-400 flex-shrink-0" />
        <span className="text-xs text-yellow-700">
          Gering ({art.aktuellerBestand.toLocaleString("de-DE")} {art.einheit})
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1 mt-1">
      <span className="inline-block w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
      <span className="text-xs text-green-700">
        Auf Lager ({art.aktuellerBestand.toLocaleString("de-DE")} {art.einheit})
      </span>
    </div>
  );
}

interface Position {
  artikelId: string;
  menge: string;
  preis: string;
  rabatt: string;
  einheit: string;
  notiz: string;
}

function addTage(tage: number): string {
  const d = new Date();
  d.setDate(d.getDate() + tage);
  return d.toISOString().split("T")[0];
}

function NeuesAngebotForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedKundeId = searchParams.get("kundeId") ?? "";
  const ausBedarfen = searchParams.get("ausBedarfen") === "true";

  const [kunden, setKunden] = useState<Kunde[]>([]);
  const [artikel, setArtikel] = useState<Artikel[]>([]);
  const [kundeId, setKundeId] = useState(preselectedKundeId);
  const [gueltigBis, setGueltigBis] = useState(addTage(30));
  const [notiz, setNotiz] = useState("");
  const [positionen, setPositionen] = useState<Position[]>([
    { artikelId: "", menge: "1", preis: "", rabatt: "0", einheit: "kg", notiz: "" },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [bedarfenGeladen, setBedarfenGeladen] = useState(false);
  const [loadingBedarfe, setLoadingBedarfe] = useState(false);

  useEffect(() => {
    fetch("/api/kunden?aktiv=true&limit=500")
      .then((r) => r.json())
      .then((d) => setKunden(Array.isArray(d) ? d : []))
      .catch(() => {});
    fetch("/api/artikel?aktiv=true")
      .then((r) => r.json())
      .then((d) => setArtikel(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  // Auto-load Bedarfe when ausBedarfen=true and a kundeId is set
  useEffect(() => {
    if (ausBedarfen && preselectedKundeId && artikel.length > 0 && !bedarfenGeladen) {
      ladeBedarfe(preselectedKundeId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ausBedarfen, preselectedKundeId, artikel.length]);

  async function ladeBedarfe(kid: string) {
    if (!kid) return;
    setLoadingBedarfe(true);
    try {
      const res = await fetch(`/api/kunden/${kid}/bedarfe`);
      const data: KundeBedarf[] = await res.json();
      if (!Array.isArray(data) || data.length === 0) return;
      const neuPositionen: Position[] = data
        .filter((b) => b.aktiv)
        .map((b) => {
          const artDetails = artikel.find((a) => a.id === b.artikelId);
          return {
            artikelId: String(b.artikelId),
            menge: String(b.menge),
            preis: artDetails ? String(artDetails.standardpreis) : "",
            rabatt: "0",
            einheit: artDetails?.einheit ?? b.artikel?.einheit ?? "kg",
            notiz: b.notiz ?? "",
          };
        });
      if (neuPositionen.length > 0) {
        setPositionen(neuPositionen);
        setBedarfenGeladen(true);
      }
    } catch {
      // ignore
    } finally {
      setLoadingBedarfe(false);
    }
  }

  const kundenOptions = kunden.map((k) => ({
    value: String(k.id),
    label: k.name,
    sub: k.firma ?? undefined,
  }));

  const artikelOptions = artikel.map((a) => ({
    value: String(a.id),
    label: a.name,
    sub: `${a.artikelnummer} · ${a.einheit}`,
  }));

  function handleArtikelChange(index: number, artId: string) {
    const art = artikel.find((a) => String(a.id) === artId);
    setPositionen((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        artikelId: artId,
        preis: art ? String(art.standardpreis) : "",
        einheit: art ? art.einheit : "kg",
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
    setPositionen((prev) => [
      ...prev,
      { artikelId: "", menge: "1", preis: "", rabatt: "0", einheit: "kg", notiz: "" },
    ]);
  }

  function removePosition(index: number) {
    setPositionen((prev) => prev.filter((_, i) => i !== index));
  }

  function gesamtNetto(): number {
    return positionen.reduce((sum, pos) => {
      const p = parseFloat(pos.preis) || 0;
      const m = parseFloat(pos.menge) || 0;
      const r = parseFloat(pos.rabatt) || 0;
      return sum + m * p * (1 - r / 100);
    }, 0);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!kundeId) { setError("Bitte einen Kunden wählen."); return; }
    const validPositionen = positionen.filter((p) => p.artikelId && parseFloat(p.menge) > 0 && parseFloat(p.preis) >= 0);
    if (validPositionen.length === 0) { setError("Mindestens eine vollständige Position erforderlich."); return; }

    setSaving(true);
    try {
      const res = await fetch("/api/angebote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kundeId: Number(kundeId),
          gueltigBis: gueltigBis || null,
          notiz: notiz.trim() || null,
          positionen: validPositionen.map((pos) => ({
            artikelId: Number(pos.artikelId),
            menge: parseFloat(pos.menge),
            preis: parseFloat(pos.preis),
            rabatt: parseFloat(pos.rabatt) || 0,
            einheit: pos.einheit,
            notiz: pos.notiz.trim() || null,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Fehler beim Speichern");
      router.push(`/angebote/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      setSaving(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/angebote" className="hover:text-green-700">Angebote</Link>
        <span>›</span>
        <span className="text-gray-900 font-medium">Neues Angebot</span>
      </nav>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Neues Angebot erstellen</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Stammdaten */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-900">Angebotsdaten</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kunde <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                options={kundenOptions}
                value={kundeId}
                onChange={setKundeId}
                placeholder="Kunden wählen…"
                required
              />
              {kundeId && (
                <button
                  type="button"
                  onClick={() => { setBedarfenGeladen(false); ladeBedarfe(kundeId); }}
                  disabled={loadingBedarfe}
                  className="mt-2 text-xs px-3 py-1.5 bg-orange-100 hover:bg-orange-200 text-orange-800 border border-orange-300 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {loadingBedarfe ? "Lade…" : bedarfenGeladen ? "Bedarfe neu laden" : "Bedarfe laden"}
                </button>
              )}
              {bedarfenGeladen && (
                <p className="text-xs text-orange-700 mt-1">Positionen aus Kundenbedarf vorausgefüllt.</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Gültig bis
              </label>
              <input
                type="date"
                value={gueltigBis}
                onChange={(e) => setGueltigBis(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notiz</label>
            <textarea
              value={notiz}
              onChange={(e) => setNotiz(e.target.value)}
              rows={3}
              placeholder="Interne Notiz oder Anmerkung zum Angebot…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 resize-none"
            />
          </div>
        </div>

        {/* Positionen */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-900">Positionen</h2>

          <div className="space-y-3">
            {positionen.map((pos, i) => {
              const artObj = artikel.find((a) => String(a.id) === pos.artikelId);
              const netto = (parseFloat(pos.menge) || 0) * (parseFloat(pos.preis) || 0) * (1 - (parseFloat(pos.rabatt) || 0) / 100);
              return (
                <div key={i} className="border border-gray-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Position {i + 1}</span>
                    {positionen.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removePosition(i)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Entfernen
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Artikel <span className="text-red-500">*</span></label>
                      <SearchableSelect
                        options={artikelOptions}
                        value={pos.artikelId}
                        onChange={(v) => handleArtikelChange(i, v)}
                        placeholder="Artikel wählen…"
                      />
                      <LagerAmpel art={artObj} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Menge</label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={pos.menge}
                          onChange={(e) => updatePosition(i, "menge", e.target.value)}
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                        />
                        <input
                          type="text"
                          value={pos.einheit}
                          onChange={(e) => updatePosition(i, "einheit", e.target.value)}
                          placeholder="Einheit"
                          className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Preis (netto, {artObj?.einheit ?? "Einheit"})
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={pos.preis}
                        onChange={(e) => updatePosition(i, "preis", e.target.value)}
                        placeholder="0,00"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Rabatt (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={pos.rabatt}
                        onChange={(e) => updatePosition(i, "rabatt", e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Positionsnotiz</label>
                      <input
                        type="text"
                        value={pos.notiz}
                        onChange={(e) => updatePosition(i, "notiz", e.target.value)}
                        placeholder="Optionale Notiz…"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                      />
                    </div>
                  </div>

                  {netto > 0 && (
                    <div className="text-right text-sm text-gray-600">
                      Netto: <span className="font-semibold text-gray-900">
                        {netto.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
                      </span>
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

          {/* Summe */}
          <div className="border-t border-gray-200 pt-3 text-right">
            <span className="text-sm text-gray-600">Gesamt netto: </span>
            <span className="text-base font-bold text-gray-900">
              {gesamtNetto().toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
            </span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
          <Link
            href="/angebote"
            className="w-full sm:w-auto text-center px-5 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors"
          >
            Abbrechen
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto px-5 py-2 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Speichere…" : "Angebot speichern"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function NeuesAngebotPage() {
  return (
    <Suspense fallback={<div className="text-center py-16 text-gray-400">Lade…</div>}>
      <NeuesAngebotForm />
    </Suspense>
  );
}
