"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { formatEuro, formatDatum } from "@/lib/utils";
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
}

interface Lieferung {
  id: number;
  datum: string;
  rechnungNr?: string | null;
  positionen: {
    artikelId: number;
    menge: number;
    verkaufspreis: number;
    artikel: { id: number; name: string; einheit: string; standardpreis: number; artikelnummer: string };
  }[];
}

interface Position {
  artikelId: string;
  menge: string;
  preis: string;
  ruecknahme: boolean;
}

function NeueGutschriftForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedKundeId = searchParams.get("kundeId") ?? "";

  const [kunden, setKunden] = useState<Kunde[]>([]);
  const [artikel, setArtikel] = useState<Artikel[]>([]);
  const [lieferungen, setLieferungen] = useState<Lieferung[]>([]);

  const FALLBACK_GRUENDE = ["Reklamation", "Retoure", "Preiskorrektur", "Sonstiges"];
  const [gutschriftGruende, setGutschriftGruende] = useState<string[]>(FALLBACK_GRUENDE);
  const [kundeId, setKundeId] = useState(preselectedKundeId);
  const [lieferungId, setLieferungId] = useState("");
  const [datum, setDatum] = useState(new Date().toISOString().split("T")[0]);
  const [grund, setGrund] = useState("Reklamation");
  const [notiz, setNotiz] = useState("");
  const [positionen, setPositionen] = useState<Position[]>([
    { artikelId: "", menge: "1", preis: "", ruecknahme: false },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/kunden?aktiv=true")
      .then((r) => r.json())
      .then((d) => setKunden(Array.isArray(d) ? d : []))
      .catch(() => {});
    fetch("/api/artikel?aktiv=true")
      .then((r) => r.json())
      .then((d) => setArtikel(Array.isArray(d) ? d : []))
      .catch(() => {});
    fetch("/api/einstellungen?prefix=system.")
      .then((r) => r.json())
      .then((d) => {
        if (d["system.gutschrift_gruende"]) {
          try {
            const parsed = JSON.parse(d["system.gutschrift_gruende"]);
            if (Array.isArray(parsed) && parsed.length) {
              setGutschriftGruende(parsed);
              setGrund(parsed[0]);
            }
          } catch { /* ignore */ }
        }
      })
      .catch(() => {});
  }, []);

  // Fetch deliveries when customer changes
  useEffect(() => {
    if (!kundeId) {
      setLieferungen([]);
      setLieferungId("");
      return;
    }
    fetch(`/api/lieferungen?kundeId=${kundeId}`)
      .then((r) => r.json())
      .then((d) => setLieferungen(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [kundeId]);

  // Pre-fill positions from selected delivery
  useEffect(() => {
    if (!lieferungId) return;
    const lief = lieferungen.find((l) => String(l.id) === lieferungId);
    if (!lief || lief.positionen.length === 0) return;
    setPositionen(
      lief.positionen.map((p) => ({
        artikelId: String(p.artikelId),
        menge: String(p.menge),
        preis: String(p.verkaufspreis),
        ruecknahme: false,
      }))
    );
  }, [lieferungId, lieferungen]);

  const kundenOptions = kunden.map((k) => ({
    value: String(k.id),
    label: k.name,
    sub: k.firma ?? undefined,
  }));

  const lieferungOptions = lieferungen.map((l) => ({
    value: String(l.id),
    label: l.rechnungNr
      ? `${l.rechnungNr} (${formatDatum(l.datum)})`
      : `Lieferung #${l.id} (${formatDatum(l.datum)})`,
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
      };
      return updated;
    });
  }

  function updatePosition(index: number, field: keyof Position, value: string | boolean) {
    setPositionen((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  function addPosition() {
    setPositionen((prev) => [
      ...prev,
      { artikelId: "", menge: "1", preis: "", ruecknahme: false },
    ]);
  }

  function removePosition(index: number) {
    setPositionen((prev) => prev.filter((_, i) => i !== index));
  }

  function gesamtBetrag(): number {
    return positionen.reduce((sum, pos) => {
      const p = parseFloat(pos.preis) || 0;
      const m = parseFloat(pos.menge) || 0;
      return sum + m * p;
    }, 0);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!kundeId) {
      setError("Bitte einen Kunden wählen.");
      return;
    }
    const validPositionen = positionen.filter(
      (p) => p.artikelId && parseFloat(p.menge) > 0 && parseFloat(p.preis) >= 0
    );
    if (validPositionen.length === 0) {
      setError("Mindestens eine vollständige Position erforderlich.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/gutschriften", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kundeId: Number(kundeId),
          lieferungId: lieferungId ? Number(lieferungId) : null,
          datum,
          grund,
          notiz: notiz.trim() || null,
          positionen: validPositionen.map((pos) => ({
            artikelId: Number(pos.artikelId),
            menge: parseFloat(pos.menge),
            preis: parseFloat(pos.preis),
            ruecknahme: pos.ruecknahme,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Fehler beim Speichern");
      router.push(`/gutschriften/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      setSaving(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/gutschriften" className="hover:text-green-700">
          Gutschriften
        </Link>
        <span>›</span>
        <span className="text-gray-900 font-medium">Neue Gutschrift</span>
      </nav>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Neue Gutschrift / Retoure</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Stammdaten */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-900">Gutschriftsdaten</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kunde <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                options={kundenOptions}
                value={kundeId}
                onChange={(v) => { setKundeId(v); setLieferungId(""); }}
                placeholder="Kunden wählen…"
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Grund</label>
              <select
                value={grund}
                onChange={(e) => setGrund(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
              >
                {gutschriftGruende.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bezug: Lieferung (optional)
              </label>
              <SearchableSelect
                options={lieferungOptions}
                value={lieferungId}
                onChange={setLieferungId}
                placeholder={kundeId ? "Lieferung wählen…" : "Zuerst Kunden wählen"}
                allowClear
                clearLabel="— Keine Lieferung —"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notiz</label>
            <textarea
              value={notiz}
              onChange={(e) => setNotiz(e.target.value)}
              rows={3}
              placeholder="Interne Notiz oder Anmerkung…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 resize-none"
            />
          </div>
        </div>

        {/* Positionen */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-900">Positionen</h2>

          <div className="space-y-3">
            {positionen.map((pos, i) => {
              const artObj = artikel.find((a) => String(a.id) === pos.artikelId);
              const netto = (parseFloat(pos.menge) || 0) * (parseFloat(pos.preis) || 0);
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
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Artikel <span className="text-red-500">*</span>
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
                        type="number"
                        step="0.01"
                        min="0"
                        value={pos.menge}
                        onChange={(e) => updatePosition(i, "menge", e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Gutschriftspreis (je {artObj?.einheit ?? "Einheit"})
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
                    <div className="sm:col-span-2">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={pos.ruecknahme}
                          onChange={(e) => updatePosition(i, "ruecknahme", e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-600"
                        />
                        <span className="text-sm text-gray-700">
                          Ware zurück ins Lager buchen (Rücknahme)
                        </span>
                      </label>
                    </div>
                  </div>

                  {netto > 0 && (
                    <div className="text-right text-sm text-gray-600">
                      Gutschrift:{" "}
                      <span className="font-semibold text-gray-900">
                        {formatEuro(netto)}
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
            <span className="text-sm text-gray-600">Gesamt Gutschrift: </span>
            <span className="text-base font-bold text-gray-900">
              {formatEuro(gesamtBetrag())}
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
        <div className="flex gap-3 justify-end">
          <Link
            href="/gutschriften"
            className="px-5 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors"
          >
            Abbrechen
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Speichere…" : "Gutschrift speichern"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function NeueGutschriftPage() {
  return (
    <Suspense fallback={<div className="text-center py-16 text-gray-400">Lade…</div>}>
      <NeueGutschriftForm />
    </Suspense>
  );
}
