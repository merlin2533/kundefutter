"use client";
import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import SearchableSelect from "@/components/SearchableSelect";
import ChargeInput from "@/components/ChargeInput";

interface Kunde {
  id: number;
  name: string;
  firma?: string;
}

interface Lieferant {
  id: number;
  name: string;
}

interface ArtikelLieferantInfo {
  einkaufspreis: number;
  bevorzugt: boolean;
}

interface Artikel {
  id: number;
  name: string;
  einheit: string;
  standardpreis: number;
  einkaufspreis?: number;
  aktuellerBestand: number;
  mindestbestand: number;
  lieferanten?: ArtikelLieferantInfo[];
  sprengstoffvorlaeufer?: boolean;
  chargePflicht?: boolean;
}

/** EK aus bevorzugtem Lieferanten, sonst einzigem Lieferanten, sonst 0 */
function resolveEK(art: Artikel | undefined): number {
  if (!art) return 0;
  if (art.lieferanten?.length) {
    const bev = art.lieferanten.find((l) => l.bevorzugt);
    if (bev) return bev.einkaufspreis;
    if (art.lieferanten.length === 1) return art.lieferanten[0].einkaufspreis;
  }
  return art.einkaufspreis ?? 0;
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

interface NewPosition {
  artikelId: number | "";
  menge: string;
  verkaufspreis: string;
  einkaufspreis: string;
  chargeNr: string;
}

const today = new Date().toISOString().split("T")[0];

const emptyPosition = (): NewPosition => ({
  artikelId: "",
  menge: "1",
  verkaufspreis: "",
  einkaufspreis: "",
  chargeNr: "",
});

function formatEuro(n: number) {
  return n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

function MargeBadge({ pct }: { pct: number }) {
  const cls =
    pct >= 20
      ? "bg-green-100 text-green-800 border border-green-200"
      : pct >= 10
      ? "bg-yellow-100 text-yellow-800 border border-yellow-200"
      : "bg-red-100 text-red-800 border border-red-200";
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-medium whitespace-nowrap ${cls}`}>
      {pct.toFixed(1)}&thinsp;%
    </span>
  );
}

const STATUS_OPTIONS = [
  { value: "geplant", label: "Geplant" },
  { value: "geliefert", label: "Geliefert" },
];

function NeueLieferungInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ausAngebotId = searchParams.get("ausAngebot");
  const kundeIdParam = searchParams.get("kundeId");

  const [kunden, setKunden] = useState<Kunde[]>([]);
  const [artikel, setArtikel] = useState<Artikel[]>([]);
  const [lieferanten, setLieferanten] = useState<Lieferant[]>([]);
  const [loading, setLoading] = useState(true);
  const [angebotHinweis, setAngebotHinweis] = useState<string | null>(null);

  const [kundeId, setKundeId] = useState<number | "">("");
  const [datum, setDatum] = useState(today);
  const [notiz, setNotiz] = useState("");
  const [status, setStatus] = useState("geplant");
  const [positionen, setPositionen] = useState<NewPosition[]>([emptyPosition()]);
  const [istStreckengeschaeft, setIstStreckengeschaeft] = useState(false);
  const [streckenLieferantId, setStreckenLieferantId] = useState<number | "">("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [erklaerungOk, setErklaerungOk] = useState<boolean | null>(null);
  const [erklaerungBestaetigt, setErklaerungBestaetigt] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        // Volle Kundenliste laden (max 1000, ohne Kontakte für Performance);
        // Artikel ebenfalls mit hohem Limit, damit alle für Vorschläge verfügbar sind.
        const [kr, ar, lr] = await Promise.all([
          fetch("/api/kunden?aktiv=true&limit=1000&kontakte=false").then((r) => r.ok ? r.json() : []),
          fetch("/api/artikel?limit=500").then((r) => r.ok ? r.json() : []),
          fetch("/api/lieferanten?limit=500").then((r) => r.ok ? r.json() : []),
        ]);
        let kundenData: Kunde[] = Array.isArray(kr) ? kr : [];
        const artikelData: Artikel[] = Array.isArray(ar) ? ar : [];
        setLieferanten(Array.isArray(lr) ? lr : []);

        // Wenn ein bestimmter Kunde vorausgewählt werden soll, sicherstellen
        // dass er in der Liste ist (auch wenn inaktiv oder außerhalb des Limits).
        const vorauswahlId = kundeIdParam ? parseInt(kundeIdParam, 10) : NaN;
        if (!isNaN(vorauswahlId) && !kundenData.some((k) => k.id === vorauswahlId)) {
          try {
            const k = await fetch(`/api/kunden/${vorauswahlId}`).then((r) => (r.ok ? r.json() : null));
            if (k && k.id) kundenData = [k, ...kundenData];
          } catch {
            /* ignore */
          }
        }
        setKunden(kundenData);
        setArtikel(artikelData);

        // Pre-fill from angebot if param present
        if (ausAngebotId) {
          try {
            const ang = await fetch(`/api/angebote/${ausAngebotId}`).then((r) => r.ok ? r.json() : null);
            if (ang && ang.id) {
              setKundeId(ang.kundeId ?? ang.kunde?.id ?? "");
              setAngebotHinweis(`Erstellt aus Angebot ${ang.nummer}`);
              setNotiz(`Aus Angebot ${ang.nummer} übernommen`);
              if (Array.isArray(ang.positionen) && ang.positionen.length > 0) {
                setPositionen(ang.positionen.map((pos: {
                  artikelId: number;
                  menge: number;
                  preis: number;
                  rabatt: number;
                  artikel?: { einheit?: string };
                }) => {
                  const art = artikelData.find((a: Artikel) => a.id === pos.artikelId);
                  const vkPreis = pos.preis * (1 - pos.rabatt / 100);
                  return {
                    artikelId: pos.artikelId,
                    menge: String(pos.menge),
                    verkaufspreis: String(Math.round(vkPreis * 100) / 100),
                    einkaufspreis: String(resolveEK(art)),
                    chargeNr: "",
                  };
                }));
              }
            }
          } catch {
            // ignore, fallback to empty form
          }
        } else if (!isNaN(vorauswahlId)) {
          setKundeId(vorauswahlId);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Wenn Kunde oder Positionen wechseln: prüfen ob Sprengstoffvorläufer betroffen
  // und ob für diesen Kunden eine gültige Jahreserklärung vorliegt.
  useEffect(() => {
    const hatSprengstoff = positionen.some((p) => {
      const art = artikel.find((a) => a.id === Number(p.artikelId));
      return art?.sprengstoffvorlaeufer;
    });
    if (!hatSprengstoff || !kundeId) {
      setErklaerungOk(null);
      setErklaerungBestaetigt(false);
      return;
    }
    fetch(`/api/kunden/${kundeId}/erklaerungen`)
      .then((r) => r.ok ? r.json() : [])
      .then((data: { jahr: number }[]) => {
        const aktuellesJahr = new Date().getFullYear();
        setErklaerungOk(Array.isArray(data) && data.some((e) => e.jahr === aktuellesJahr));
        setErklaerungBestaetigt(false);
      })
      .catch(() => setErklaerungOk(false));
  }, [kundeId, positionen, artikel]);

  function updatePosition(idx: number, field: keyof NewPosition, value: string | number) {
    setPositionen((prev) =>
      prev.map((p, i) => {
        if (i !== idx) return p;
        const next = { ...p };
        if (field === "artikelId") {
          const num = value === "" ? "" : Number(value);
          next.artikelId = num === "" || isNaN(num as number) ? "" : (num as number);
          const art = artikel.find((a) => a.id === next.artikelId);
          if (art) {
            next.verkaufspreis = String(art.standardpreis);
            next.einkaufspreis = String(resolveEK(art));
          } else {
            next.verkaufspreis = "";
            next.einkaufspreis = "";
          }
        } else {
          (next as unknown as Record<string, string>)[field] = String(value);
        }
        return next;
      })
    );
  }

  function addPosition() {
    setPositionen((prev) => [...prev, emptyPosition()]);
  }

  function removePosition(idx: number) {
    if (positionen.length <= 1) return;
    setPositionen((prev) => prev.filter((_, i) => i !== idx));
  }

  // Live summary (parse string-state to numbers)
  const num = (s: string) => {
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  };
  const nettoSumme = positionen.reduce(
    (sum, p) => sum + num(p.menge) * num(p.verkaufspreis),
    0
  );
  const ekSumme = positionen.reduce(
    (sum, p) => sum + num(p.menge) * num(p.einkaufspreis),
    0
  );
  const deckungsbeitrag = nettoSumme - ekSumme;
  const gesamtMargePct = nettoSumme > 0 ? (deckungsbeitrag / nettoSumme) * 100 : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!kundeId) {
      setError("Bitte einen Kunden auswählen.");
      return;
    }
    if (positionen.some((p) => !p.artikelId)) {
      setError("Bitte alle Positionen mit einem Artikel belegen.");
      return;
    }
    if (erklaerungOk === false && !erklaerungBestaetigt) {
      setError("Bitte die Bestätigung zur Sprengstoffvorläufer-Erklärung setzen.");
      return;
    }
    const missingCharge = positionen.find((p) => {
      if (!p.artikelId) return false;
      const art = artikel.find((a) => a.id === Number(p.artikelId));
      return art?.chargePflicht && !p.chargeNr.trim();
    });
    if (missingCharge) {
      const art = artikel.find((a) => a.id === Number(missingCharge.artikelId));
      setError(`Chargennummer für „${art?.name}" ist Pflichtfeld.`);
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (istStreckengeschaeft && !streckenLieferantId) {
        setError("Bitte einen Direktlieferanten auswählen.");
        setSaving(false);
        return;
      }
      const res = await fetch("/api/lieferungen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kundeId: Number(kundeId),
          datum,
          status,
          notiz: notiz || undefined,
          istStreckengeschaeft,
          streckenLieferantId: istStreckengeschaeft && streckenLieferantId ? Number(streckenLieferantId) : undefined,
          positionen: positionen.map((p) => ({
            artikelId: Number(p.artikelId),
            menge: parseFloat(p.menge) || 0,
            verkaufspreis: parseFloat(p.verkaufspreis) || 0,
            einkaufspreis: parseFloat(p.einkaufspreis) || 0,
            chargeNr: p.chargeNr || undefined,
          })),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Fehler beim Speichern");
      }
      const neu = await res.json();
      router.push(`/lieferungen/${neu.id}/lieferschein`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Speichern.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Neue Lieferung</h1>
        <p className="text-gray-400 text-sm">Lade Daten...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">Neue Lieferung</h1>
        <Link
          href="/lieferungen"
          className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Abbrechen
        </Link>
      </div>

      {angebotHinweis && (
        <div className="mb-4 bg-blue-50 border border-blue-200 text-blue-800 text-sm rounded-lg px-4 py-3 flex items-center gap-2">
          <span className="font-semibold">Vorlage:</span> {angebotHinweis} — Bitte Preise und Mengen prüfen.
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-5">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {/* Kunde + Datum — two columns on wider screens */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kunde <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                options={kunden.map((k) => ({
                  value: k.id,
                  label: k.firma ? `${k.firma} (${k.name})` : k.name,
                  sub: k.firma ? k.name : undefined,
                }))}
                value={kundeId}
                onChange={(v) => setKundeId(v ? Number(v) : "")}
                placeholder="Kunde auswählen..."
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Datum</label>
              <input
                type="date"
                value={datum}
                onChange={(e) => setDatum(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
              />
            </div>
          </div>

          {/* Streckengeschäft Toggle */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={istStreckengeschaeft}
                onChange={(e) => {
                  setIstStreckengeschaeft(e.target.checked);
                  if (!e.target.checked) setStreckenLieferantId("");
                }}
                className="w-4 h-4 rounded border-gray-300 text-green-700 focus:ring-green-700"
              />
              <span className="text-sm font-medium text-gray-700">
                Streckengeschäft (Lieferant liefert direkt an Kunden — kein Lagerabgang)
              </span>
            </label>
            {istStreckengeschaeft && (
              <div className="space-y-2 pl-7">
                <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Bei Streckengeschäft wird kein Lagerabgang gebucht. Die Rechnung wird trotzdem durch Sie ausgestellt.
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Direktlieferant <span className="text-red-500">*</span>
                  </label>
                  <SearchableSelect
                    options={lieferanten.map((l) => ({
                      value: l.id,
                      label: l.name,
                    }))}
                    value={streckenLieferantId}
                    onChange={(v) => setStreckenLieferantId(v ? Number(v) : "")}
                    placeholder="Direktlieferant auswählen…"
                    required={istStreckengeschaeft}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Sprengstoffvorläufer-Warnung */}
          {erklaerungOk === true && (
            <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
              <span>✓</span>
              <span>Gültige Sprengstoffvorläufer-Erklärung für {new Date().getFullYear()} liegt vor.</span>
            </div>
          )}
          {erklaerungOk === false && (
            <div className="p-3 bg-orange-50 border border-orange-300 rounded-lg space-y-2">
              <div className="flex items-start gap-2 text-sm text-orange-900">
                <span className="text-base leading-none">⚠</span>
                <span>
                  <strong>Achtung:</strong> Diese Lieferung enthält Sprengstoffvorläufer (EU-VO 2019/1148).
                  Für diesen Kunden liegt <strong>keine gültige Erklärung</strong> für {new Date().getFullYear()} vor.
                  Bitte zuerst im Kunden-Tab &quot;Erklärungen&quot; die Jahreserklärung erfassen.
                </span>
              </div>
              <label className="flex items-center gap-2 text-sm text-orange-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={erklaerungBestaetigt}
                  onChange={(e) => setErklaerungBestaetigt(e.target.checked)}
                  className="rounded"
                />
                Ich bestätige, dass eine gültige schriftliche Erklärung vorliegt und nachgepflegt wird.
              </label>
            </div>
          )}

          {/* Positionen */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Positionen</span>
              <button
                type="button"
                onClick={addPosition}
                className="text-sm text-green-700 hover:text-green-900 font-medium"
              >
                + Artikel hinzufügen
              </button>
            </div>

            {/* Table — scrollable on small screens */}
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-500 uppercase border-b border-gray-200">
                    <th className="px-3 py-2 text-left font-medium">Artikel</th>
                    <th className="px-3 py-2 text-right font-medium w-20">Menge</th>
                    <th className="px-3 py-2 text-right font-medium w-28">EK-Preis</th>
                    <th className="px-3 py-2 text-right font-medium w-28">VK-Preis</th>
                    <th className="px-3 py-2 text-right font-medium w-24">Marge</th>
                    <th className="px-3 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {positionen.map((pos, idx) => {
                    const vk = num(pos.verkaufspreis);
                    const ek = num(pos.einkaufspreis);
                    const margePct = vk > 0 ? ((vk - ek) / vk) * 100 : 0;
                    const selectedArtikel = artikel.find((a) => a.id === Number(pos.artikelId));

                    return (
                      <tr
                        key={idx}
                        className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors"
                      >
                        {/* Artikel */}
                        <td className="px-3 py-2">
                          <SearchableSelect
                            options={artikel.map((a) => ({
                              value: a.id,
                              label: a.name,
                              sub: a.einheit,
                            }))}
                            value={pos.artikelId}
                            onChange={(v) => updatePosition(idx, "artikelId", v)}
                            placeholder="— Artikel wählen —"
                            required
                          />
                          <LagerAmpel art={selectedArtikel} />
                          {/* Charge field — shown below when article is selected */}
                          {pos.artikelId !== "" && (
                            <div className="mt-1.5">
                              {selectedArtikel?.chargePflicht && !pos.chargeNr && (
                                <p className="text-xs text-amber-600 mb-1">⚠ Chargennummer Pflicht</p>
                              )}
                              <ChargeInput
                                artikelId={pos.artikelId}
                                value={pos.chargeNr}
                                onChange={(v) => updatePosition(idx, "chargeNr", v)}
                                einheit={selectedArtikel?.einheit}
                                className={`w-full border rounded px-2 py-1 text-xs text-gray-600 focus:outline-none focus:ring-1 focus:ring-green-600 bg-white ${selectedArtikel?.chargePflicht && !pos.chargeNr ? "border-amber-400 bg-amber-50" : "border-gray-200"}`}
                              />
                            </div>
                          )}
                        </td>

                        {/* Menge */}
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            step="0.001"
                            min="0"
                            value={pos.menge}
                            onChange={(e) => updatePosition(idx, "menge", e.target.value)}
                            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-green-700"
                          />
                          {selectedArtikel && (
                            <div className="text-xs text-gray-400 text-right mt-0.5">
                              {selectedArtikel.einheit}
                            </div>
                          )}
                        </td>

                        {/* EK-Preis */}
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={pos.einkaufspreis}
                            onChange={(e) => updatePosition(idx, "einkaufspreis", e.target.value)}
                            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-green-700"
                          />
                          <div className="text-xs text-gray-400 text-right mt-0.5">
                            {formatEuro(num(pos.menge) * num(pos.einkaufspreis))}
                          </div>
                        </td>

                        {/* VK-Preis */}
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={pos.verkaufspreis}
                            onChange={(e) => updatePosition(idx, "verkaufspreis", e.target.value)}
                            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-green-700"
                          />
                          <div className="text-xs text-gray-400 text-right mt-0.5">
                            {formatEuro(num(pos.menge) * num(pos.verkaufspreis))}
                          </div>
                        </td>

                        {/* Marge */}
                        <td className="px-3 py-2 text-right">
                          <MargeBadge pct={margePct} />
                          <div className="text-xs text-gray-400 mt-0.5 text-right">
                            {formatEuro(num(pos.menge) * (num(pos.verkaufspreis) - num(pos.einkaufspreis)))}
                          </div>
                        </td>

                        {/* Remove */}
                        <td className="px-2 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => removePosition(idx)}
                            disabled={positionen.length <= 1}
                            title="Zeile entfernen"
                            className="text-gray-300 hover:text-red-500 disabled:opacity-20 disabled:cursor-not-allowed transition-colors text-base leading-none"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Zusammenfassung */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
            <p className="font-medium text-gray-700 mb-2">Zusammenfassung</p>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-gray-600">
              <span>
                Netto-Summe:{" "}
                <strong className="text-gray-900">{formatEuro(nettoSumme)}</strong>
              </span>
              <span>
                Deckungsbeitrag:{" "}
                <strong className={deckungsbeitrag >= 0 ? "text-green-700" : "text-red-600"}>
                  {formatEuro(deckungsbeitrag)}
                </strong>
                {nettoSumme > 0 && (
                  <span className="ml-1 text-gray-500">
                    ({gesamtMargePct.toFixed(1)}&thinsp;%)
                  </span>
                )}
              </span>
            </div>
          </div>

          {/* Notiz + Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notiz</label>
              <textarea
                rows={2}
                value={notiz}
                onChange={(e) => setNotiz(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700 resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700 bg-white"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
            <Link
              href="/lieferungen"
              className="px-4 py-2.5 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-center w-full sm:w-auto"
            >
              Abbrechen
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2.5 text-sm bg-green-800 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-60 w-full sm:w-auto"
            >
              {saving ? "Speichern..." : "Lieferung erstellen"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function NeueLieferungPage() {
  return (
    <Suspense fallback={<div><h1 className="text-2xl font-bold mb-6">Neue Lieferung</h1><p className="text-gray-400 text-sm">Lade…</p></div>}>
      <NeueLieferungInner />
    </Suspense>
  );
}
